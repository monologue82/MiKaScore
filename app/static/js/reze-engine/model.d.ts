import { Mat4, Quat, Vec3 } from "./math";
import { type AssetReader } from "./asset-reader";
import { Rigidbody, Joint } from "./physics";
import { AnimationClip, AnimationPlayOptions, AnimationProgress } from "./animation";
export interface Texture {
    path: string;
    name: string;
}
export interface Material {
    name: string;
    diffuse: [number, number, number, number];
    specular: [number, number, number];
    ambient: [number, number, number];
    shininess: number;
    diffuseTextureIndex: number;
    normalTextureIndex: number;
    sphereTextureIndex: number;
    sphereMode: number;
    toonTextureIndex: number;
    edgeFlag: number;
    edgeColor: [number, number, number, number];
    edgeSize: number;
    vertexCount: number;
}
export interface Bone {
    name: string;
    parentIndex: number;
    bindTranslation: [number, number, number];
    children: number[];
    appendParentIndex?: number;
    appendRatio?: number;
    appendRotate?: boolean;
    appendMove?: boolean;
    ikTargetIndex?: number;
    ikIteration?: number;
    ikLimitAngle?: number;
    ikLinks?: IKLink[];
}
export interface IKLink {
    boneIndex: number;
    hasLimit: boolean;
    minAngle?: Vec3;
    maxAngle?: Vec3;
}
export interface IKSolver {
    index: number;
    ikBoneIndex: number;
    targetBoneIndex: number;
    iterationCount: number;
    limitAngle: number;
    links: IKLink[];
}
export interface IKChainInfo {
    ikRotation: Quat;
    localRotation: Quat;
}
export interface Skeleton {
    bones: Bone[];
    inverseBindMatrices: Float32Array;
}
export interface Skinning {
    joints: Uint16Array;
    weights: Uint8Array;
}
export interface VertexMorphOffset {
    vertexIndex: number;
    positionOffset: [number, number, number];
}
export interface GroupMorphReference {
    morphIndex: number;
    ratio: number;
}
export interface Morph {
    name: string;
    type: number;
    vertexOffsets: VertexMorphOffset[];
    groupReferences?: GroupMorphReference[];
}
export interface Morphing {
    morphs: Morph[];
    offsetsBuffer: Float32Array;
}
export interface SkeletonRuntime {
    nameIndex: Record<string, number>;
    localRotations: Quat[];
    localTranslations: Vec3[];
    worldMatrices: Mat4[];
    ikChainInfo?: IKChainInfo[];
    ikSolvers?: IKSolver[];
}
export interface MorphRuntime {
    nameIndex: Record<string, number>;
    weights: Float32Array;
}
export declare class Model {
    private _name;
    get name(): string;
    setName(value: string): void;
    get position(): Vec3;
    get rotation(): Quat;
    setPosition(position: Vec3): void;
    setRotation(rotation: Quat): void;
    private vertexData;
    private baseVertexData;
    private vertexCount;
    private indexData;
    private textures;
    private materials;
    private skeleton;
    private skinning;
    private morphing;
    private rigidbodies;
    private joints;
    private runtimeSkeleton;
    private runtimeMorph;
    private morphsDirty;
    private _position;
    private _rotation;
    private rootMatrixValues;
    private rootMatrixDirty;
    private rootIsIdentity;
    private skinMatricesArray?;
    private tweenState;
    private tweenTimeMs;
    private readonly animationState;
    private boneTrackIndices;
    private morphTrackIndices;
    private lastAppliedClip;
    private assetReader;
    private assetBasePath;
    /** Called by Engine when registering the model; enables loadVmd to resolve relative paths for folder uploads. */
    setAssetContext(reader: AssetReader, basePath: string): void;
    constructor(vertexData: Float32Array<ArrayBuffer>, indexData: Uint32Array<ArrayBuffer>, textures: Texture[], materials: Material[], skeleton: Skeleton, skinning: Skinning, morphing: Morphing, rigidbodies?: Rigidbody[], joints?: Joint[]);
    private initializeRuntimeSkeleton;
    private initializeIKRuntime;
    private initializeTweenBuffers;
    private initializeRuntimeMorph;
    private updateTweens;
    getVertices(): Float32Array<ArrayBuffer>;
    getTextures(): Texture[];
    getMaterials(): Material[];
    getIndices(): Uint32Array<ArrayBuffer>;
    getSkeleton(): Skeleton;
    getBoneLocalRotation(boneIndex: number): Quat;
    getBoneLocalTranslation(boneIndex: number): Vec3;
    setBoneLocalTranslation(boneIndex: number, v: Vec3): void;
    private clipApplySuspended;
    setClipApplySuspended(suspended: boolean): void;
    isClipApplySuspended(): boolean;
    getBoneWorldPosition(boneName: string): Vec3 | null;
    getSkinning(): Skinning;
    getRigidbodies(): Rigidbody[];
    getJoints(): Joint[];
    getMorphing(): Morphing;
    getMorphWeights(): Float32Array;
    rotateBones(boneRotations: Record<string, Quat>, durationMs?: number): void;
    moveBones(boneTranslations: Record<string, Vec3>, durationMs?: number): void;
    private convertVMDTranslationToLocal;
    getWorldMatrices(): Mat4[];
    getBoneWorldMatrices(): Float32Array;
    getBoneInverseBindMatrices(): Float32Array;
    getSkinMatrices(): Float32Array;
    setMorphWeight(name: string, weight: number, durationMs?: number): void;
    private applyMorphs;
    private buildClipFromVmdKeyFrames;
    loadVmd(name: string, urlOrRelative: string): Promise<void>;
    loadClip(name: string, clip: AnimationClip): void;
    resetAllBones(): void;
    resetAllMorphs(): void;
    getClip(name: string): AnimationClip | null;
    exportVmd(name: string): ArrayBuffer;
    play(): void;
    play(name: string): boolean;
    play(name: string, options?: AnimationPlayOptions): boolean;
    show(name: string): void;
    playAnimation(): void;
    pause(): void;
    pauseAnimation(): void;
    stop(): void;
    stopAnimation(): void;
    seek(seconds: number): void;
    seekAnimation(seconds: number): void;
    getAnimationProgress(): AnimationProgress;
    private static upperBound;
    private findKeyframeIndex;
    private applyPoseFromClip;
    update(deltaTime: number, ikEnabled: boolean): boolean;
    private solveIKChains;
    private ikComputedSet;
    private computeSingleBoneWorldMatrix;
    computeWorldMatrices(): void;
}
//# sourceMappingURL=model.d.ts.map