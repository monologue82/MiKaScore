import { Mat4, Quat, Vec3, scratchMat4Values, scratchQuat } from "./math";
import { Engine } from "./engine";
import { joinAssetPath } from "./asset-reader";
import { IKSolverSystem } from "./ik-solver";
import { VMDLoader } from "./vmd-loader";
import { VMDWriter } from "./vmd-writer";
import { AnimationState, interpolateControlPoints, rawInterpolationToBoneInterpolation, } from "./animation";
const VERTEX_STRIDE = 8;
export class Model {
    get name() {
        return this._name;
    }
    setName(value) {
        this._name = value;
    }
    // Root transform public API. Instant setters — no tween baked in; wrap in
    // your own lerp if you need smoothing. Changes are applied on the next
    // getSkinMatrices() call (once per frame during rendering).
    get position() {
        return this._position;
    }
    get rotation() {
        return this._rotation;
    }
    setPosition(position) {
        this._position.set(position);
        this.rootMatrixDirty = true;
    }
    setRotation(rotation) {
        this._rotation.set(rotation);
        this.rootMatrixDirty = true;
    }
    /** Called by Engine when registering the model; enables loadVmd to resolve relative paths for folder uploads. */
    setAssetContext(reader, basePath) {
        this.assetReader = reader;
        this.assetBasePath = basePath;
    }
    constructor(vertexData, indexData, textures, materials, skeleton, skinning, morphing, rigidbodies = [], joints = []) {
        this._name = "";
        this.textures = [];
        this.materials = [];
        // Physics data from PMX
        this.rigidbodies = [];
        this.joints = [];
        this.morphsDirty = false; // Flag indicating if morphs need to be applied
        // Root transform — model's placement in world space, independent of bones.
        // Folded into skin matrices (see getSkinMatrices) so every pass (main VS,
        // shadow VS, any future skinned pass) sees it without per-shader plumbing.
        // Skip-when-identity flag avoids the extra mat mul per bone when unused.
        this._position = Vec3.zeros();
        this._rotation = Quat.identity();
        this.rootMatrixValues = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
        this.rootMatrixDirty = false;
        this.rootIsIdentity = true;
        this.tweenTimeMs = 0; // Time tracking for tweens (milliseconds)
        // Animation: state and multiple slots (idle, walk, attack, etc.); commit/rollback for action-game style
        this.animationState = new AnimationState();
        this.boneTrackIndices = new Map();
        this.morphTrackIndices = new Map();
        this.lastAppliedClip = null;
        this.assetReader = null;
        this.assetBasePath = "";
        // When true, update() skips applyPoseFromClip, so whatever was last written to
        // localRotations / localTranslations persists across frames. Used by gizmo drag
        // and other direct-manipulation flows to prevent the currently-shown clip from
        // overwriting manual edits each frame. Auto-cleared on play()/seek() so the user
        // gets back to normal playback without having to manage this flag explicitly.
        this.clipApplySuspended = false;
        // Cached set to track which bones are being computed in current IK pass (to avoid infinite recursion)
        this.ikComputedSet = new Set();
        // Store base vertex data (original positions before morphing)
        this.baseVertexData = new Float32Array(vertexData);
        this.vertexData = vertexData;
        this.vertexCount = vertexData.length / VERTEX_STRIDE;
        this.indexData = indexData;
        this.textures = textures;
        this.materials = materials;
        this.skeleton = skeleton;
        this.skinning = skinning;
        this.morphing = morphing;
        this.rigidbodies = rigidbodies;
        this.joints = joints;
        if (this.skeleton.bones.length == 0) {
            throw new Error("Model has no bones");
        }
        this.initializeRuntimeSkeleton();
        this.initializeRuntimeMorph();
        this.initializeTweenBuffers();
        this.applyMorphs();
    }
    initializeRuntimeSkeleton() {
        const boneCount = this.skeleton.bones.length;
        // Pre-allocate object arrays for skeletal pose
        const localRotations = new Array(boneCount);
        const localTranslations = new Array(boneCount);
        const worldMatrices = new Array(boneCount);
        for (let i = 0; i < boneCount; i++) {
            localRotations[i] = Quat.identity();
            localTranslations[i] = Vec3.zeros();
            worldMatrices[i] = Mat4.identity();
        }
        this.runtimeSkeleton = {
            localRotations,
            localTranslations,
            worldMatrices,
            nameIndex: this.skeleton.bones.reduce((acc, bone, index) => {
                acc[bone.name] = index;
                return acc;
            }, {}),
        };
        // Initialize IK runtime state
        this.initializeIKRuntime();
    }
    initializeIKRuntime() {
        const boneCount = this.skeleton.bones.length;
        const bones = this.skeleton.bones;
        // Initialize IK chain info for all bones (will be populated for IK chain bones)
        const ikChainInfo = new Array(boneCount);
        for (let i = 0; i < boneCount; i++) {
            ikChainInfo[i] = {
                ikRotation: Quat.identity(),
                localRotation: Quat.identity(),
            };
        }
        // Build IK solvers from bone data
        const ikSolvers = [];
        let solverIndex = 0;
        for (let i = 0; i < boneCount; i++) {
            const bone = bones[i];
            if (bone.ikTargetIndex !== undefined && bone.ikLinks && bone.ikLinks.length > 0) {
                const solver = {
                    index: solverIndex++,
                    ikBoneIndex: i,
                    targetBoneIndex: bone.ikTargetIndex,
                    iterationCount: bone.ikIteration ?? 1,
                    limitAngle: bone.ikLimitAngle ?? Math.PI,
                    links: bone.ikLinks,
                };
                ikSolvers.push(solver);
            }
        }
        this.runtimeSkeleton.ikChainInfo = ikChainInfo;
        this.runtimeSkeleton.ikSolvers = ikSolvers;
    }
    initializeTweenBuffers() {
        const boneCount = this.skeleton.bones.length;
        const morphCount = this.morphing.morphs.length;
        // Pre-allocate Quat and Vec3 arrays to avoid reallocation during tweens
        const rotStartQuat = new Array(boneCount);
        const rotTargetQuat = new Array(boneCount);
        const transStartVec = new Array(boneCount);
        const transTargetVec = new Array(boneCount);
        for (let i = 0; i < boneCount; i++) {
            rotStartQuat[i] = Quat.identity();
            rotTargetQuat[i] = Quat.identity();
            transStartVec[i] = Vec3.zeros();
            transTargetVec[i] = Vec3.zeros();
        }
        this.tweenState = {
            // Bone rotation tweens
            rotActive: new Uint8Array(boneCount),
            rotStartQuat,
            rotTargetQuat,
            rotStartTimeMs: new Float32Array(boneCount),
            rotDurationMs: new Float32Array(boneCount),
            // Bone translation tweens
            transActive: new Uint8Array(boneCount),
            transStartVec,
            transTargetVec,
            transStartTimeMs: new Float32Array(boneCount),
            transDurationMs: new Float32Array(boneCount),
            // Morph weight tweens
            morphActive: new Uint8Array(morphCount),
            morphStartWeight: new Float32Array(morphCount),
            morphTargetWeight: new Float32Array(morphCount),
            morphStartTimeMs: new Float32Array(morphCount),
            morphDurationMs: new Float32Array(morphCount),
        };
    }
    initializeRuntimeMorph() {
        const morphCount = this.morphing.morphs.length;
        this.runtimeMorph = {
            nameIndex: this.morphing.morphs.reduce((acc, morph, index) => {
                acc[morph.name] = index;
                return acc;
            }, {}),
            weights: new Float32Array(morphCount),
        };
    }
    // Tween update - processes all tweens together with a single time reference
    // This avoids conflicts and ensures consistent timing across all tween types
    // Returns true if morph weights changed (needed for vertex buffer updates)
    updateTweens() {
        const state = this.tweenState;
        const now = this.tweenTimeMs; // Single time reference for all tweens
        let morphChanged = false;
        // Update bone rotation tweens
        const rotations = this.runtimeSkeleton.localRotations;
        const boneCount = this.skeleton.bones.length;
        for (let i = 0; i < boneCount; i++) {
            if (state.rotActive[i] !== 1)
                continue;
            const startMs = state.rotStartTimeMs[i];
            const durMs = Math.max(1, state.rotDurationMs[i]);
            const t = Math.max(0, Math.min(1, (now - startMs) / durMs));
            const e = t; // Linear interpolation
            const result = Quat.slerp(state.rotStartQuat[i], state.rotTargetQuat[i], e);
            rotations[i].set(result);
            if (t >= 1) {
                state.rotActive[i] = 0;
            }
        }
        // Update bone translation tweens
        const translations = this.runtimeSkeleton.localTranslations;
        for (let i = 0; i < boneCount; i++) {
            if (state.transActive[i] !== 1)
                continue;
            const startMs = state.transStartTimeMs[i];
            const durMs = Math.max(1, state.transDurationMs[i]);
            const t = Math.max(0, Math.min(1, (now - startMs) / durMs));
            const e = t; // Linear interpolation
            const startVec = state.transStartVec[i];
            const targetVec = state.transTargetVec[i];
            translations[i].x = startVec.x + (targetVec.x - startVec.x) * e;
            translations[i].y = startVec.y + (targetVec.y - startVec.y) * e;
            translations[i].z = startVec.z + (targetVec.z - startVec.z) * e;
            if (t >= 1) {
                state.transActive[i] = 0;
            }
        }
        // Update morph weight tweens
        const weights = this.runtimeMorph.weights;
        const morphCount = this.morphing.morphs.length;
        for (let i = 0; i < morphCount; i++) {
            if (state.morphActive[i] !== 1)
                continue;
            const startMs = state.morphStartTimeMs[i];
            const durMs = Math.max(1, state.morphDurationMs[i]);
            const t = Math.max(0, Math.min(1, (now - startMs) / durMs));
            const e = t; // Linear interpolation
            const oldWeight = weights[i];
            weights[i] = state.morphStartWeight[i] + (state.morphTargetWeight[i] - state.morphStartWeight[i]) * e;
            // Check if weight actually changed (accounting for floating point precision)
            if (Math.abs(weights[i] - oldWeight) > 1e-6) {
                morphChanged = true;
            }
            if (t >= 1) {
                weights[i] = state.morphTargetWeight[i];
                state.morphActive[i] = 0;
                // Check if final weight is different from old weight
                if (Math.abs(weights[i] - oldWeight) > 1e-6) {
                    morphChanged = true;
                }
            }
        }
        return morphChanged;
    }
    getVertices() {
        return this.vertexData;
    }
    getTextures() {
        return this.textures;
    }
    getMaterials() {
        return this.materials;
    }
    getIndices() {
        return this.indexData;
    }
    getSkeleton() {
        return this.skeleton;
    }
    // Direct bone local-transform accessors (used by interactive gizmo drag).
    // Readers return the live runtime state — callers that want a snapshot for
    // later comparison should `.clone()` the returned Quat / copy the Vec3.
    getBoneLocalRotation(boneIndex) {
        return this.runtimeSkeleton.localRotations[boneIndex];
    }
    getBoneLocalTranslation(boneIndex) {
        return this.runtimeSkeleton.localTranslations[boneIndex];
    }
    // Raw absolute-local translation write. NOT equivalent to
    // `moveBones({ name: v }, 0)` — moveBones treats the input as VMD-relative
    // (offset from bind pose) and runs convertVMDTranslationToLocal() over it.
    // Use this when you already have the final local translation (e.g. the
    // gizmo's computed target). For rotation, just use rotateBones(..., 0).
    setBoneLocalTranslation(boneIndex, v) {
        const t = this.runtimeSkeleton.localTranslations[boneIndex];
        t.x = v.x;
        t.y = v.y;
        t.z = v.z;
        this.tweenState.transActive[boneIndex] = 0;
    }
    setClipApplySuspended(suspended) {
        this.clipApplySuspended = suspended;
    }
    isClipApplySuspended() {
        return this.clipApplySuspended;
    }
    // World bone origin (world matrix col3); unknown name → null
    getBoneWorldPosition(boneName) {
        const idx = this.runtimeSkeleton.nameIndex[boneName];
        if (idx === undefined || idx < 0)
            return null;
        return this.runtimeSkeleton.worldMatrices[idx].getPosition();
    }
    getSkinning() {
        return this.skinning;
    }
    getRigidbodies() {
        return this.rigidbodies;
    }
    getJoints() {
        return this.joints;
    }
    getMorphing() {
        return this.morphing;
    }
    getMorphWeights() {
        return this.runtimeMorph.weights;
    }
    // ------- Bone helpers (API) -------
    rotateBones(boneRotations, durationMs) {
        const state = this.tweenState;
        // Clone and normalize to avoid mutating input
        Object.values(boneRotations).forEach((q) => q.normalize());
        const now = this.tweenTimeMs;
        const dur = durationMs && durationMs > 0 ? durationMs : 0;
        for (const [name, targetQuat] of Object.entries(boneRotations)) {
            const idx = this.runtimeSkeleton.nameIndex[name] ?? -1;
            if (idx < 0 || idx >= this.skeleton.bones.length)
                continue;
            const rotations = this.runtimeSkeleton.localRotations;
            const targetNorm = targetQuat;
            if (dur === 0) {
                rotations[idx].set(targetNorm);
                state.rotActive[idx] = 0;
                continue;
            }
            const currentRot = rotations[idx];
            let sx = currentRot.x;
            let sy = currentRot.y;
            let sz = currentRot.z;
            let sw = currentRot.w;
            if (state.rotActive[idx] === 1) {
                const startMs = state.rotStartTimeMs[idx];
                const prevDur = Math.max(1, state.rotDurationMs[idx]);
                const t = Math.max(0, Math.min(1, (now - startMs) / prevDur));
                const e = t; // Linear interpolation
                const result = Quat.slerp(state.rotStartQuat[idx], state.rotTargetQuat[idx], e);
                sx = result.x;
                sy = result.y;
                sz = result.z;
                sw = result.w;
            }
            state.rotStartQuat[idx].x = sx;
            state.rotStartQuat[idx].y = sy;
            state.rotStartQuat[idx].z = sz;
            state.rotStartQuat[idx].w = sw;
            state.rotTargetQuat[idx].set(targetNorm);
            state.rotStartTimeMs[idx] = now;
            state.rotDurationMs[idx] = dur;
            state.rotActive[idx] = 1;
        }
    }
    // Move bones using VMD-style relative translations (relative to bind pose world position)
    // This is the default behavior for VMD animations
    moveBones(boneTranslations, durationMs) {
        const state = this.tweenState;
        const now = this.tweenTimeMs;
        const dur = durationMs && durationMs > 0 ? durationMs : 0;
        for (const [name, vmdRelativeTranslation] of Object.entries(boneTranslations)) {
            const idx = this.runtimeSkeleton.nameIndex[name] ?? -1;
            if (idx < 0 || idx >= this.skeleton.bones.length)
                continue;
            const translations = this.runtimeSkeleton.localTranslations;
            // Convert VMD relative translation to local translation
            const localTranslation = this.convertVMDTranslationToLocal(idx, vmdRelativeTranslation);
            const [tx, ty, tz] = [localTranslation.x, localTranslation.y, localTranslation.z];
            if (dur === 0) {
                translations[idx].x = tx;
                translations[idx].y = ty;
                translations[idx].z = tz;
                state.transActive[idx] = 0;
                continue;
            }
            const currentTrans = translations[idx];
            let sx = currentTrans.x;
            let sy = currentTrans.y;
            let sz = currentTrans.z;
            if (state.transActive[idx] === 1) {
                const startMs = state.transStartTimeMs[idx];
                const prevDur = Math.max(1, state.transDurationMs[idx]);
                const t = Math.max(0, Math.min(1, (now - startMs) / prevDur));
                const e = t; // Linear interpolation
                const startVec = state.transStartVec[idx];
                const targetVec = state.transTargetVec[idx];
                sx = startVec.x + (targetVec.x - startVec.x) * e;
                sy = startVec.y + (targetVec.y - startVec.y) * e;
                sz = startVec.z + (targetVec.z - startVec.z) * e;
            }
            state.transStartVec[idx].x = sx;
            state.transStartVec[idx].y = sy;
            state.transStartVec[idx].z = sz;
            state.transTargetVec[idx].x = tx;
            state.transTargetVec[idx].y = ty;
            state.transTargetVec[idx].z = tz;
            state.transStartTimeMs[idx] = now;
            state.transDurationMs[idx] = dur;
            state.transActive[idx] = 1;
        }
    }
    // VMD translation (world delta from bind pose) → bone local space; optional rotation for animation vs IK
    convertVMDTranslationToLocal(boneIdx, vmdRelativeTranslation, rotation) {
        const skeleton = this.skeleton;
        const bones = skeleton.bones;
        const localRot = this.runtimeSkeleton.localRotations;
        // Compute bind pose world positions for all bones
        const computeBindPoseWorldPosition = (idx) => {
            const bone = bones[idx];
            const bindPos = new Vec3(bone.bindTranslation[0], bone.bindTranslation[1], bone.bindTranslation[2]);
            if (bone.parentIndex >= 0 && bone.parentIndex < bones.length) {
                const parentWorldPos = computeBindPoseWorldPosition(bone.parentIndex);
                return parentWorldPos.add(bindPos);
            }
            else {
                return bindPos;
            }
        };
        const bone = bones[boneIdx];
        // VMD translation is relative to bind pose world position
        // targetWorldPos = bindPoseWorldPos + vmdRelativeTranslation
        const bindPoseWorldPos = computeBindPoseWorldPosition(boneIdx);
        const targetWorldPos = bindPoseWorldPos.add(vmdRelativeTranslation);
        // Convert target world position to local translation
        // We need parent's bind pose world position to transform to parent space
        let parentBindPoseWorldPos;
        if (bone.parentIndex >= 0) {
            parentBindPoseWorldPos = computeBindPoseWorldPosition(bone.parentIndex);
        }
        else {
            parentBindPoseWorldPos = Vec3.zeros();
        }
        // Transform target world position to parent's local space
        // In bind pose, parent's world matrix is just a translation
        const parentSpacePos = targetWorldPos.subtract(parentBindPoseWorldPos);
        // Subtract bindTranslation to get position after bind translation
        const afterBindTranslation = parentSpacePos.subtract(new Vec3(bone.bindTranslation[0], bone.bindTranslation[1], bone.bindTranslation[2]));
        // Apply inverse rotation to get local translation
        // Use provided rotation (animation rotation) or fall back to current localRotation
        // Using animation rotation prevents conflicts when IK modifies the rotation
        const localRotation = rotation ?? localRot[boneIdx];
        // Clone to avoid mutating, then conjugate and normalize
        const invRotation = localRotation.clone().conjugate().normalize();
        const rotationMat = Mat4.fromQuat(invRotation.x, invRotation.y, invRotation.z, invRotation.w);
        const rm = rotationMat.values;
        const localTranslation = new Vec3(rm[0] * afterBindTranslation.x + rm[4] * afterBindTranslation.y + rm[8] * afterBindTranslation.z, rm[1] * afterBindTranslation.x + rm[5] * afterBindTranslation.y + rm[9] * afterBindTranslation.z, rm[2] * afterBindTranslation.x + rm[6] * afterBindTranslation.y + rm[10] * afterBindTranslation.z);
        return localTranslation;
    }
    getWorldMatrices() {
        return this.runtimeSkeleton.worldMatrices;
    }
    getBoneWorldMatrices() {
        // Convert Mat4[] to Float32Array for WebGPU compatibility
        const boneCount = this.skeleton.bones.length;
        const worldMats = this.runtimeSkeleton.worldMatrices;
        const result = new Float32Array(boneCount * 16);
        for (let i = 0; i < boneCount; i++) {
            result.set(worldMats[i].values, i * 16);
        }
        return result;
    }
    getBoneInverseBindMatrices() {
        return this.skeleton.inverseBindMatrices;
    }
    getSkinMatrices() {
        const boneCount = this.skeleton.bones.length;
        const worldMats = this.runtimeSkeleton.worldMatrices;
        const invBindMats = this.skeleton.inverseBindMatrices;
        // Initialize cached array if needed or if bone count changed
        if (!this.skinMatricesArray || this.skinMatricesArray.length !== boneCount * 16) {
            this.skinMatricesArray = new Float32Array(boneCount * 16);
        }
        const skinMatrices = this.skinMatricesArray;
        // Rebuild root matrix + cache identity-shortcut flag only when pos/rot changed.
        if (this.rootMatrixDirty) {
            const p = this._position, r = this._rotation;
            Mat4.fromPositionRotationInto(p.x, p.y, p.z, r.x, r.y, r.z, r.w, this.rootMatrixValues);
            this.rootIsIdentity =
                p.x === 0 && p.y === 0 && p.z === 0 &&
                    r.x === 0 && r.y === 0 && r.z === 0 && r.w === 1;
            this.rootMatrixDirty = false;
        }
        if (this.rootIsIdentity) {
            // skinMatrix = worldMatrix × inverseBindMatrix
            for (let i = 0; i < boneCount; i++) {
                const off = i * 16;
                Mat4.multiplyArrays(worldMats[i].values, 0, invBindMats, off, skinMatrices, off);
            }
        }
        else {
            // skinMatrix = rootMatrix × worldMatrix × inverseBindMatrix
            // Two-mul path. scratchMat4Values[1] — [0] is owned by computeWorldMatrices.
            const rootVals = this.rootMatrixValues;
            const tmp = scratchMat4Values[1];
            for (let i = 0; i < boneCount; i++) {
                const off = i * 16;
                Mat4.multiplyArrays(rootVals, 0, worldMats[i].values, 0, tmp, 0);
                Mat4.multiplyArrays(tmp, 0, invBindMats, off, skinMatrices, off);
            }
        }
        return skinMatrices;
    }
    setMorphWeight(name, weight, durationMs) {
        const idx = this.runtimeMorph.nameIndex[name] ?? -1;
        if (idx < 0 || idx >= this.runtimeMorph.weights.length)
            return;
        const clampedWeight = Math.max(0, Math.min(1, weight));
        const dur = durationMs && durationMs > 0 ? durationMs : 0;
        if (dur === 0) {
            // Instant change
            this.runtimeMorph.weights[idx] = clampedWeight;
            this.tweenState.morphActive[idx] = 0;
            this.applyMorphs();
            try {
                Engine.getInstance().markVertexBufferDirty(this);
            }
            catch {
                // not registered yet
            }
            return;
        }
        // Animated change
        const state = this.tweenState;
        const now = this.tweenTimeMs;
        // If already tweening, start from current interpolated value
        let startWeight = this.runtimeMorph.weights[idx];
        if (state.morphActive[idx] === 1) {
            const startMs = state.morphStartTimeMs[idx];
            const prevDur = Math.max(1, state.morphDurationMs[idx]);
            const t = Math.max(0, Math.min(1, (now - startMs) / prevDur));
            const e = t; // Linear interpolation
            startWeight = state.morphStartWeight[idx] + (state.morphTargetWeight[idx] - state.morphStartWeight[idx]) * e;
        }
        state.morphStartWeight[idx] = startWeight;
        state.morphTargetWeight[idx] = clampedWeight;
        state.morphStartTimeMs[idx] = now;
        state.morphDurationMs[idx] = dur;
        state.morphActive[idx] = 1;
        // Immediately apply morphs with current weight
        this.runtimeMorph.weights[idx] = startWeight;
        this.applyMorphs();
    }
    applyMorphs() {
        // Reset vertex data to base positions
        this.vertexData.set(this.baseVertexData);
        const vertexCount = this.vertexCount;
        const morphCount = this.morphing.morphs.length;
        const weights = this.runtimeMorph.weights;
        // First pass: Compute effective weights for all morphs (handling group morphs)
        const effectiveWeights = new Float32Array(morphCount);
        effectiveWeights.set(weights); // Start with direct weights
        // Apply group morphs: group morph weight * ratio affects referenced morphs
        for (let morphIdx = 0; morphIdx < morphCount; morphIdx++) {
            const morph = this.morphing.morphs[morphIdx];
            if (morph.type === 0 && morph.groupReferences) {
                const groupWeight = weights[morphIdx];
                if (groupWeight > 0.0001) {
                    for (const ref of morph.groupReferences) {
                        if (ref.morphIndex >= 0 && ref.morphIndex < morphCount) {
                            // Add group morph's contribution to the referenced morph
                            effectiveWeights[ref.morphIndex] += groupWeight * ref.ratio;
                        }
                    }
                }
            }
        }
        // Clamp effective weights to [0, 1]
        for (let i = 0; i < morphCount; i++) {
            effectiveWeights[i] = Math.max(0, Math.min(1, effectiveWeights[i]));
        }
        // Second pass: Apply vertex morphs with their effective weights
        for (let morphIdx = 0; morphIdx < morphCount; morphIdx++) {
            const effectiveWeight = effectiveWeights[morphIdx];
            if (effectiveWeight === 0 || effectiveWeight < 0.0001)
                continue;
            const morph = this.morphing.morphs[morphIdx];
            if (morph.type !== 1)
                continue; // Only process vertex morphs
            // For vertex morphs, iterate through vertices that have offsets
            for (const vertexOffset of morph.vertexOffsets) {
                const vIdx = vertexOffset.vertexIndex;
                if (vIdx < 0 || vIdx >= vertexCount)
                    continue;
                // Get morph offset for this vertex
                const offsetX = vertexOffset.positionOffset[0];
                const offsetY = vertexOffset.positionOffset[1];
                const offsetZ = vertexOffset.positionOffset[2];
                // Skip if offset is zero
                if (Math.abs(offsetX) < 0.0001 && Math.abs(offsetY) < 0.0001 && Math.abs(offsetZ) < 0.0001) {
                    continue;
                }
                // Apply weighted offset to vertex position (positions are at stride 0, 8, 16, ...)
                const vertexIdx = vIdx * VERTEX_STRIDE;
                this.vertexData[vertexIdx] += offsetX * effectiveWeight;
                this.vertexData[vertexIdx + 1] += offsetY * effectiveWeight;
                this.vertexData[vertexIdx + 2] += offsetZ * effectiveWeight;
            }
        }
    }
    buildClipFromVmdKeyFrames(vmdKeyFrames) {
        const boneTracksByBone = {};
        for (const keyFrame of vmdKeyFrames) {
            for (const bf of keyFrame.boneFrames) {
                if (!boneTracksByBone[bf.boneName])
                    boneTracksByBone[bf.boneName] = [];
                boneTracksByBone[bf.boneName].push({
                    frame: bf.frame,
                    rotation: bf.rotation,
                    translation: bf.translation,
                    interpolation: rawInterpolationToBoneInterpolation(bf.interpolation),
                });
            }
        }
        const boneTracks = new Map();
        for (const name in boneTracksByBone) {
            const keyframes = boneTracksByBone[name];
            const sorted = [...keyframes].sort((a, b) => a.frame - b.frame);
            boneTracks.set(name, sorted.map((kf) => ({
                boneName: name,
                frame: kf.frame,
                rotation: kf.rotation,
                translation: kf.translation,
                interpolation: kf.interpolation,
            })));
        }
        const morphTracksByMorph = {};
        for (const keyFrame of vmdKeyFrames) {
            for (const mf of keyFrame.morphFrames) {
                if (!morphTracksByMorph[mf.morphName])
                    morphTracksByMorph[mf.morphName] = [];
                morphTracksByMorph[mf.morphName].push({ frame: mf.frame, weight: mf.weight });
            }
        }
        const morphTracks = new Map();
        for (const name in morphTracksByMorph) {
            const keyframes = morphTracksByMorph[name];
            const sorted = [...keyframes].sort((a, b) => a.frame - b.frame);
            morphTracks.set(name, sorted.map((kf) => ({
                morphName: name,
                frame: kf.frame,
                weight: kf.weight,
            })));
        }
        let maxFrame = 0;
        for (const frames of boneTracks.values()) {
            if (frames.length > 0)
                maxFrame = Math.max(maxFrame, frames[frames.length - 1].frame);
        }
        for (const frames of morphTracks.values()) {
            if (frames.length > 0)
                maxFrame = Math.max(maxFrame, frames[frames.length - 1].frame);
        }
        return { boneTracks, morphTracks, frameCount: maxFrame };
    }
    loadVmd(name, urlOrRelative) {
        const loadBuffer = () => {
            const u = urlOrRelative.trim();
            const useSiteFetch = u.startsWith("http://") ||
                u.startsWith("https://") ||
                u.startsWith("/") ||
                u.startsWith("blob:") ||
                u.startsWith("data:");
            if (useSiteFetch) {
                return fetch(u).then((r) => {
                    if (!r.ok)
                        throw new Error(`Failed to fetch VMD ${u}: ${r.status}`);
                    return r.arrayBuffer();
                });
            }
            if (this.assetReader) {
                return this.assetReader.readBinary(joinAssetPath(this.assetBasePath, u));
            }
            return fetch(u).then((r) => {
                if (!r.ok)
                    throw new Error(`Failed to fetch VMD ${u}: ${r.status}`);
                return r.arrayBuffer();
            });
        };
        return loadBuffer().then((buf) => {
            const vmdKeyFrames = VMDLoader.loadFromBuffer(buf);
            const clip = this.buildClipFromVmdKeyFrames(vmdKeyFrames);
            this.animationState.loadAnimation(name, clip);
        });
    }
    loadClip(name, clip) {
        this.animationState.loadAnimation(name, clip);
    }
    resetAllBones() {
        for (let boneIdx = 0; boneIdx < this.skeleton.bones.length; boneIdx++) {
            const localRot = this.runtimeSkeleton.localRotations[boneIdx];
            const localTrans = this.runtimeSkeleton.localTranslations[boneIdx];
            localRot.set(Quat.identity());
            localTrans.set(Vec3.zeros());
        }
        this.computeWorldMatrices();
    }
    resetAllMorphs() {
        for (let morphIdx = 0; morphIdx < this.morphing.morphs.length; morphIdx++) {
            const morphName = this.morphing.morphs[morphIdx].name;
            this.setMorphWeight(morphName, 0);
        }
        this.morphsDirty = true;
        this.applyMorphs();
    }
    getClip(name) {
        return this.animationState.getAnimationClip(name);
    }
    exportVmd(name) {
        const clip = this.animationState.getAnimationClip(name);
        if (!clip)
            throw new Error(`Animation clip "${name}" not found`);
        return new VMDWriter().write(clip);
    }
    play(name, options) {
        this.clipApplySuspended = false;
        if (name === undefined) {
            this.animationState.play();
            return;
        }
        this.resetAllBones();
        this.resetAllMorphs();
        return this.animationState.play(name, options);
    }
    show(name) {
        this.resetAllBones();
        this.resetAllMorphs();
        this.animationState.show(name);
    }
    // @deprecated Use model.play()
    playAnimation() {
        this.animationState.play();
    }
    pause() {
        this.animationState.pause();
    }
    // @deprecated Use model.pause()
    pauseAnimation() {
        this.animationState.pause();
    }
    stop() {
        this.animationState.stop();
    }
    // @deprecated Use model.stop()
    stopAnimation() {
        this.animationState.stop();
    }
    // Seek by absolute timeline seconds, not frame index.
    seek(seconds) {
        this.clipApplySuspended = false;
        this.animationState.seek(seconds);
    }
    // @deprecated Use model.seek()
    seekAnimation(seconds) {
        this.animationState.seek(seconds);
    }
    getAnimationProgress() {
        const p = this.animationState.getProgress();
        return {
            current: p.current,
            duration: p.duration,
            percentage: p.percentage,
            animationName: p.animationName,
            looping: p.looping,
            playing: p.playing,
            paused: p.paused,
        };
    }
    static upperBound(frame, keyFrames, startIdx = 0) {
        let left = startIdx, right = keyFrames.length;
        while (left < right) {
            const mid = Math.floor((left + right) / 2);
            if (keyFrames[mid].frame <= frame)
                left = mid + 1;
            else
                right = mid;
        }
        return left;
    }
    findKeyframeIndex(frame, keyFrames, cachedIdx) {
        if (keyFrames.length === 0)
            return -1;
        if (cachedIdx >= 0 && cachedIdx < keyFrames.length) {
            const currentFrame = keyFrames[cachedIdx].frame;
            const nextFrame = cachedIdx + 1 < keyFrames.length ? keyFrames[cachedIdx + 1].frame : Infinity;
            if (frame >= currentFrame && frame < nextFrame) {
                return cachedIdx;
            }
        }
        const idx = Model.upperBound(frame, keyFrames, 0) - 1;
        return idx;
    }
    applyPoseFromClip(clip, frame) {
        if (!clip)
            return;
        if (clip !== this.lastAppliedClip) {
            this.boneTrackIndices.clear();
            this.morphTrackIndices.clear();
            this.lastAppliedClip = clip;
        }
        for (const [boneName, keyFrames] of clip.boneTracks.entries()) {
            if (keyFrames.length === 0)
                continue;
            const cachedIdx = this.boneTrackIndices.get(boneName) ?? -1;
            const clampedFrame = Math.max(keyFrames[0].frame, Math.min(keyFrames[keyFrames.length - 1].frame, frame));
            const idx = this.findKeyframeIndex(clampedFrame, keyFrames, cachedIdx);
            if (idx < 0)
                continue;
            this.boneTrackIndices.set(boneName, idx);
            const frameA = keyFrames[idx];
            const frameB = keyFrames[idx + 1];
            const boneIdx = this.runtimeSkeleton.nameIndex[boneName];
            if (boneIdx === undefined)
                continue;
            const localRot = this.runtimeSkeleton.localRotations[boneIdx];
            const localTrans = this.runtimeSkeleton.localTranslations[boneIdx];
            if (!frameB) {
                const frameRotation = frameA.rotation;
                localRot.set(frameRotation);
                const localTranslation = this.convertVMDTranslationToLocal(boneIdx, frameA.translation, frameRotation);
                localTrans.set(localTranslation);
            }
            else {
                const frameDelta = frameB.frame - frameA.frame;
                const gradient = frameDelta > 0 ? (clampedFrame - frameA.frame) / frameDelta : 0;
                const interp = frameB.interpolation;
                const rotT = interpolateControlPoints(interp.rotation, gradient);
                const rotation = Quat.slerp(frameA.rotation, frameB.rotation, rotT);
                const txWeight = interpolateControlPoints(interp.translationX, gradient);
                const tyWeight = interpolateControlPoints(interp.translationY, gradient);
                const tzWeight = interpolateControlPoints(interp.translationZ, gradient);
                const interpolatedVMDTranslation = new Vec3(frameA.translation.x + (frameB.translation.x - frameA.translation.x) * txWeight, frameA.translation.y + (frameB.translation.y - frameA.translation.y) * tyWeight, frameA.translation.z + (frameB.translation.z - frameA.translation.z) * tzWeight);
                const localTranslation = this.convertVMDTranslationToLocal(boneIdx, interpolatedVMDTranslation, rotation);
                localRot.set(rotation);
                localTrans.set(localTranslation);
            }
        }
        for (const [morphName, keyFrames] of clip.morphTracks.entries()) {
            if (keyFrames.length === 0)
                continue;
            const cachedIdx = this.morphTrackIndices.get(morphName) ?? -1;
            const clampedFrame = Math.max(keyFrames[0].frame, Math.min(keyFrames[keyFrames.length - 1].frame, frame));
            const idx = this.findKeyframeIndex(clampedFrame, keyFrames, cachedIdx);
            if (idx < 0)
                continue;
            this.morphTrackIndices.set(morphName, idx);
            const frameA = keyFrames[idx];
            const frameB = keyFrames[idx + 1];
            const morphIdx = this.runtimeMorph.nameIndex[morphName];
            if (morphIdx === undefined)
                continue;
            const weight = frameB
                ? frameA.weight +
                    (frameB.weight - frameA.weight) *
                        (keyFrames[idx + 1].frame > keyFrames[idx].frame
                            ? (clampedFrame - keyFrames[idx].frame) / (keyFrames[idx + 1].frame - keyFrames[idx].frame)
                            : 0)
                : frameA.weight;
            this.runtimeMorph.weights[morphIdx] = weight;
            this.morphsDirty = true; // Mark as dirty when animation sets morph weights
        }
    }
    // Returns true when morphs changed (vertex buffer may need upload). ikEnabled is driven by engine (same for all models).
    update(deltaTime, ikEnabled) {
        // Update tween time (in milliseconds)
        this.tweenTimeMs += deltaTime * 1000;
        // Update all active tweens (rotations, translations, morphs)
        const tweensChangedMorphs = this.updateTweens();
        this.animationState.update(deltaTime);
        const clip = this.animationState.getCurrentClip();
        const frame = this.animationState.getCurrentFrame();
        if (clip !== null && !this.clipApplySuspended) {
            this.applyPoseFromClip(clip, frame);
        }
        // Apply morphs if tweens changed morphs or animation changed morphs
        const verticesChanged = this.morphsDirty || tweensChangedMorphs;
        if (this.morphsDirty || tweensChangedMorphs) {
            this.applyMorphs();
            this.morphsDirty = false;
        }
        // Compute world matrices (needed for IK solving to read bone positions)
        this.computeWorldMatrices();
        // Solve IK chains (modifies localRotations with final IK rotations)
        if (ikEnabled) {
            this.solveIKChains();
            // Recompute world matrices with final IK rotations applied to localRotations
            this.computeWorldMatrices();
        }
        return verticesChanged;
    }
    solveIKChains() {
        const ikSolvers = this.runtimeSkeleton.ikSolvers;
        if (!ikSolvers || ikSolvers.length === 0)
            return;
        const ikChainInfo = this.runtimeSkeleton.ikChainInfo;
        if (!ikChainInfo)
            return;
        // Solve each IK solver sequentially, ensuring consistent state between solvers
        for (const solver of ikSolvers) {
            // Recompute ALL world matrices before each solver starts
            // This ensures each solver sees the effects of previous solvers on localRotations
            this.computeWorldMatrices();
            // Clear computed set for this solver's pass
            this.ikComputedSet.clear();
            // Solve this IK chain
            // Pass callback that uses model's world matrix computation (handles append correctly)
            IKSolverSystem.solve([solver], // Solve one at a time
            this.skeleton.bones, this.runtimeSkeleton.localRotations, this.runtimeSkeleton.localTranslations, this.runtimeSkeleton.worldMatrices, ikChainInfo, (boneIndex, applyIK) => {
                // Clear computed set for each bone update to allow recomputation in same iteration
                this.ikComputedSet.delete(boneIndex);
                this.computeSingleBoneWorldMatrix(boneIndex, applyIK);
            });
        }
    }
    // Add this new method to compute a single bone's world matrix
    // Recursively ensures parents are computed first to avoid using stale parent matrices
    computeSingleBoneWorldMatrix(boneIndex, applyIK) {
        const bones = this.skeleton.bones;
        const localRot = this.runtimeSkeleton.localRotations;
        const localTrans = this.runtimeSkeleton.localTranslations;
        const worldMats = this.runtimeSkeleton.worldMatrices;
        const ikChainInfo = this.runtimeSkeleton.ikChainInfo;
        const b = bones[boneIndex];
        // Prevent infinite recursion: if this bone is already being computed in this call chain, skip
        if (this.ikComputedSet.has(boneIndex)) {
            return;
        }
        // Mark this bone as being computed to prevent infinite recursion
        this.ikComputedSet.add(boneIndex);
        // Recursively compute parent first if it exists (ensures parent matrix is up-to-date)
        if (b.parentIndex >= 0) {
            this.computeSingleBoneWorldMatrix(b.parentIndex, applyIK);
        }
        // Get base rotation
        const baseRot = localRot[boneIndex];
        let fx = baseRot.x, fy = baseRot.y, fz = baseRot.z, fw = baseRot.w;
        // Apply IK rotation if requested: finalRot = ik * base, then normalize
        if (applyIK && ikChainInfo) {
            const chainInfo = ikChainInfo[boneIndex];
            if (chainInfo?.ikRotation) {
                const ik = chainInfo.ikRotation;
                const nx = ik.w * fx + ik.x * fw + ik.y * fz - ik.z * fy;
                const ny = ik.w * fy - ik.x * fz + ik.y * fw + ik.z * fx;
                const nz = ik.w * fz + ik.x * fy - ik.y * fx + ik.z * fw;
                const nw = ik.w * fw - ik.x * fx - ik.y * fy - ik.z * fz;
                const len = Math.sqrt(nx * nx + ny * ny + nz * nz + nw * nw);
                const inv = len > 0 ? 1 / len : 0;
                fx = nx * inv;
                fy = ny * inv;
                fz = nz * inv;
                fw = nw * inv;
            }
        }
        let addLocalTx = 0, addLocalTy = 0, addLocalTz = 0;
        // Handle append transformations (same logic as computeWorldMatrices)
        const appendParentIdx = b.appendParentIndex;
        const hasAppend = b.appendRotate &&
            appendParentIdx !== undefined &&
            appendParentIdx >= 0 &&
            appendParentIdx < bones.length;
        if (hasAppend) {
            const ratio = b.appendRatio === undefined ? 1 : Math.max(-1, Math.min(1, b.appendRatio));
            const hasRatio = Math.abs(ratio) > 1e-6;
            if (hasRatio) {
                if (b.appendRotate) {
                    // Recurse first (may touch scratch); all scratch use below happens after it unwinds
                    if (appendParentIdx >= 0) {
                        this.computeSingleBoneWorldMatrix(appendParentIdx, applyIK);
                    }
                    const appendRot = localRot[appendParentIdx];
                    let ax = appendRot.x, ay = appendRot.y, az = appendRot.z;
                    const aw = appendRot.w;
                    const absRatio = ratio < 0 ? -ratio : ratio;
                    if (ratio < 0) {
                        ax = -ax;
                        ay = -ay;
                        az = -az;
                    }
                    // slerp(identity, appendQuat, absRatio) into scratchQuat[1]
                    scratchQuat[0].setXYZW(ax, ay, az, aw);
                    scratchQuat[2].setIdentity();
                    Quat.slerpInto(scratchQuat[2], scratchQuat[0], absRatio, scratchQuat[1]);
                    // finalRot = slerpResult * finalRot (rotation composition as quat mul)
                    const sx = scratchQuat[1].x, sy = scratchQuat[1].y, sz = scratchQuat[1].z, sw = scratchQuat[1].w;
                    const nx = sw * fx + sx * fw + sy * fz - sz * fy;
                    const ny = sw * fy - sx * fz + sy * fw + sz * fx;
                    const nz = sw * fz + sx * fy - sy * fx + sz * fw;
                    const nw = sw * fw - sx * fx - sy * fy - sz * fz;
                    fx = nx;
                    fy = ny;
                    fz = nz;
                    fw = nw;
                }
                if (b.appendMove) {
                    const appendTrans = localTrans[appendParentIdx];
                    addLocalTx = appendTrans.x * ratio;
                    addLocalTy = appendTrans.y * ratio;
                    addLocalTz = appendTrans.z * ratio;
                }
            }
        }
        const boneTrans = localTrans[boneIndex];
        const localTx = boneTrans.x + addLocalTx;
        const localTy = boneTrans.y + addLocalTy;
        const localTz = boneTrans.z + addLocalTz;
        // Fused local transform: T_bind · R(finalRot) · T_local → scratchMat4Values[0]
        const localMVals = scratchMat4Values[0];
        Mat4.localTransformInto(b.bindTranslation[0], b.bindTranslation[1], b.bindTranslation[2], fx, fy, fz, fw, localTx, localTy, localTz, localMVals);
        const worldMat = worldMats[boneIndex];
        if (b.parentIndex >= 0) {
            const parentMat = worldMats[b.parentIndex];
            Mat4.multiplyArrays(parentMat.values, 0, localMVals, 0, worldMat.values, 0);
        }
        else {
            worldMat.values.set(localMVals);
        }
    }
    computeWorldMatrices() {
        const bones = this.skeleton.bones;
        const localRot = this.runtimeSkeleton.localRotations;
        const localTrans = this.runtimeSkeleton.localTranslations;
        const worldMats = this.runtimeSkeleton.worldMatrices;
        const boneCount = bones.length;
        if (boneCount === 0)
            return;
        // Local computed array (avoids instance field overhead)
        const computed = new Array(boneCount).fill(false);
        const computeWorld = (i) => {
            if (computed[i])
                return;
            const b = bones[i];
            if (b.parentIndex >= boneCount) {
                console.warn(`[RZM] bone ${i} parent out of range: ${b.parentIndex}`);
            }
            // Ensure parent is computed FIRST, before we touch any scratch buffers.
            // Recursion may itself use scratchMat4Values[0] / scratchQuat; doing it up
            // front keeps the current frame's scratch slots untouched when we use them below.
            if (b.parentIndex >= 0 && !computed[b.parentIndex])
                computeWorld(b.parentIndex);
            const boneRot = localRot[i];
            let fx = boneRot.x, fy = boneRot.y, fz = boneRot.z, fw = boneRot.w;
            let addLocalTx = 0, addLocalTy = 0, addLocalTz = 0;
            const appendParentIdx = b.appendParentIndex;
            const hasAppend = b.appendRotate && appendParentIdx !== undefined && appendParentIdx >= 0 && appendParentIdx < boneCount;
            if (hasAppend) {
                const ratio = b.appendRatio === undefined ? 1 : Math.max(-1, Math.min(1, b.appendRatio));
                const hasRatio = Math.abs(ratio) > 1e-6;
                if (hasRatio) {
                    if (b.appendRotate) {
                        const appendRot = localRot[appendParentIdx];
                        let ax = appendRot.x, ay = appendRot.y, az = appendRot.z;
                        const aw = appendRot.w;
                        const absRatio = ratio < 0 ? -ratio : ratio;
                        if (ratio < 0) {
                            ax = -ax;
                            ay = -ay;
                            az = -az;
                        }
                        scratchQuat[0].setXYZW(ax, ay, az, aw);
                        scratchQuat[2].setIdentity();
                        Quat.slerpInto(scratchQuat[2], scratchQuat[0], absRatio, scratchQuat[1]);
                        // finalRot = slerpResult * finalRot (quat mul)
                        const sx = scratchQuat[1].x, sy = scratchQuat[1].y, sz = scratchQuat[1].z, sw = scratchQuat[1].w;
                        const nx = sw * fx + sx * fw + sy * fz - sz * fy;
                        const ny = sw * fy - sx * fz + sy * fw + sz * fx;
                        const nz = sw * fz + sx * fy - sy * fx + sz * fw;
                        const nw = sw * fw - sx * fx - sy * fy - sz * fz;
                        fx = nx;
                        fy = ny;
                        fz = nz;
                        fw = nw;
                    }
                    if (b.appendMove) {
                        const appendTrans = localTrans[appendParentIdx];
                        const appendRatio = b.appendRatio ?? 1;
                        addLocalTx = appendTrans.x * appendRatio;
                        addLocalTy = appendTrans.y * appendRatio;
                        addLocalTz = appendTrans.z * appendRatio;
                    }
                }
            }
            const boneTrans = localTrans[i];
            const localTx = boneTrans.x + addLocalTx;
            const localTy = boneTrans.y + addLocalTy;
            const localTz = boneTrans.z + addLocalTz;
            const localMVals = scratchMat4Values[0];
            Mat4.localTransformInto(b.bindTranslation[0], b.bindTranslation[1], b.bindTranslation[2], fx, fy, fz, fw, localTx, localTy, localTz, localMVals);
            const worldMat = worldMats[i];
            if (b.parentIndex >= 0) {
                const parentMat = worldMats[b.parentIndex];
                Mat4.multiplyArrays(parentMat.values, 0, localMVals, 0, worldMat.values, 0);
            }
            else {
                worldMat.values.set(localMVals);
            }
            computed[i] = true;
        };
        // Process all bones (recursion handles dependencies automatically)
        for (let i = 0; i < boneCount; i++)
            computeWorld(i);
    }
}
