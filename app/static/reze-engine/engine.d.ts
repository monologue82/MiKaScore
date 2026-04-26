import { Quat, Vec3 } from "./math";
import { Model } from "./model";
import { type PhysicsOptions } from "./physics";
import { type AssetReader } from "./asset-reader";
export type MaterialPreset = "default" | "face" | "hair" | "body" | "eye" | "stockings" | "metal" | "cloth_smooth" | "cloth_rough";
export type MaterialPresetMap = Partial<Record<MaterialPreset, string[]>>;
export type RaycastCallback = (modelName: string, material: string | null, bone: string | null, screenX: number, screenY: number) => void;
/** Select a folder (webkitdirectory) and pass FileList or File[]; pmxFile picks which .pmx when several exist. */
export type LoadModelFromFilesOptions = {
    files: FileList | File[];
    pmxFile?: File;
};
export type WorldOptions = {
    /** Linear scene-referred color of the World Background (Blender: World > Surface > Color). */
    color?: Vec3;
    /** Multiplier on world color (Blender: World > Surface > Strength). */
    strength?: number;
};
export type SunOptions = {
    /** Linear color of the sun lamp (Blender: Light > Color). */
    color?: Vec3;
    /** Lamp power in Blender units (Blender: Light > Strength). */
    strength?: number;
    /** Direction sunlight travels (points FROM sun TO scene, Blender: -light.rotation.Z). */
    direction?: Vec3;
};
export type CameraOptions = {
    /** Orbit distance from target. */
    distance?: number;
    /** World-space orbit center. */
    target?: Vec3;
    /** Vertical field of view in radians. */
    fov?: number;
};
/** EEVEE Bloom panel (3D Viewport > Render > Bloom). Fields map 1:1 to Blender's UI. */
export type BloomOptions = {
    enabled: boolean;
    threshold: number;
    knee: number;
    radius: number;
    color: Vec3;
    intensity: number;
    clamp: number;
};
export declare const DEFAULT_BLOOM_OPTIONS: BloomOptions;
/** Blender Color Management / View (rendering.txt: Filmic, exposure, gamma). `look` is reserved for future curve tweaks. */
export type ViewTransformOptions = {
    /** Stops applied before Filmic: `linear *= 2^exposure`. */
    exposure: number;
    /** After Filmic, display gamma (`pow(rgb, 1/gamma)`). */
    gamma: number;
    look: "default" | "medium_high_contrast";
};
export declare const DEFAULT_VIEW_TRANSFORM: ViewTransformOptions;
export type GizmoDragKind = "rotate" | "translate";
export interface GizmoDragEvent {
    modelName: string;
    boneName: string;
    boneIndex: number;
    kind: GizmoDragKind;
    /** Computed target local rotation (for "rotate") / target local translation (for "translate"). */
    localRotation: Quat;
    localTranslation: Vec3;
    /** Drag start (mousedown) or end (mouseup). Undefined during drag moves. */
    phase?: "start" | "end";
}
/**
 * Gizmo drag callback. The engine does NOT write to the skeleton on its own —
 * it only computes the target local rotation / translation for the dragged bone
 * and fires this callback. The host decides how to apply it (e.g. call
 * `model.setBoneLocalRotation(boneIndex, localRotation)` for a runtime-only
 * edit, call `rotateBones({ [boneName]: localRotation }, 0)` for a tweened
 * write, or mutate an animation clip keyframe and re-seek).
 *
 * Fires once with phase="start" on mousedown, on every mousemove (no phase),
 * and once with phase="end" on mouseup.
 */
export type GizmoDragCallback = (event: GizmoDragEvent) => void;
export type EngineOptions = {
    world?: WorldOptions;
    sun?: SunOptions;
    camera?: CameraOptions;
    /** Initial EEVEE-style bloom; tune at runtime with `setBloomOptions`. */
    bloom?: Partial<BloomOptions>;
    /** View transform (exposure/gamma) applied in composite before/after Filmic. */
    view?: Partial<ViewTransformOptions>;
    onRaycast?: RaycastCallback;
    /** See {@link GizmoDragCallback}. */
    onGizmoDrag?: GizmoDragCallback;
    physicsOptions?: PhysicsOptions;
};
export declare const DEFAULT_ENGINE_OPTIONS: {
    world: {
        color: Vec3;
        strength: number;
    };
    sun: {
        color: Vec3;
        strength: number;
        direction: Vec3;
    };
    camera: {
        distance: number;
        target: Vec3;
        fov: number;
    };
    onRaycast: undefined;
    physicsOptions: {
        constraintSolverKeywords: string[];
    };
};
export interface EngineStats {
    fps: number;
    frameTime: number;
}
export declare class Engine {
    private static instance;
    static getInstance(): Engine;
    private canvas;
    private device;
    private context;
    private presentationFormat;
    private camera;
    private cameraUniformBuffer;
    private cameraMatrixData;
    private world;
    private sun;
    private cameraConfig;
    private lightUniformBuffer;
    private lightData;
    private lightCount;
    private resizeObserver;
    private depthTexture;
    private modelPipeline;
    private facePipeline;
    private hairPipeline;
    private clothSmoothPipeline;
    private clothRoughPipeline;
    private metalPipeline;
    private bodyPipeline;
    private eyePipeline;
    private hairOverEyesPipeline;
    private stockingsPipeline;
    private groundShadowPipeline;
    private groundShadowBindGroupLayout;
    private outlinePipeline;
    private selectedMaterial;
    private selectionMaskTexture?;
    private selectionMaskView?;
    private selectionMaskPipeline;
    private selectionMaskPassDescriptor;
    private selectionEdgePipeline;
    private selectionEdgeBindGroupLayout;
    private selectionEdgeBindGroup?;
    private selectionEdgeUniformBuffer;
    private selectionEdgePassDescriptor;
    private selectionSampler;
    private selectedBone;
    private gizmoVertexBuffer;
    private gizmoTransformBuffer;
    private gizmoPipeline;
    private gizmoBindGroup0;
    private gizmoColorBindGroups;
    private gizmoPassDescriptor;
    private static readonly GIZMO_RING_SEGMENTS;
    private static readonly GIZMO_RING_RADIUS;
    private static readonly GIZMO_AXIS_LENGTH;
    private gizmoDraws;
    private static readonly GIZMO_WORLD_SIZE;
    private static readonly GIZMO_THICKNESS_PX;
    private static readonly GIZMO_PICK_THRESHOLD_PX;
    private gizmoDrag;
    private mainPerFrameBindGroupLayout;
    private mainPerInstanceBindGroupLayout;
    private mainPerMaterialBindGroupLayout;
    private outlinePerFrameBindGroupLayout;
    private outlinePerMaterialBindGroupLayout;
    private perFrameBindGroup;
    private outlinePerFrameBindGroup;
    private multisampleTexture;
    private hdrResolveTexture;
    private static readonly MULTISAMPLE_COUNT;
    private hdrFormat;
    /** Stencil value stamped by eye draws so hair can stencil-test against it and
     *  alpha-blend a second pass over eye silhouette pixels (see-through-hair effect). */
    private static readonly STENCIL_EYE_VALUE;
    /** Aux MRT alongside HDR color. Two channels:
     *   .r — bloom mask (1 = model geometry, 0 = ground; sampled by bloom blit to gate prefilter).
     *   .g — accumulated alpha (the channel that used to live in hdr.a before the HDR format
     *        switched to rg11b10ufloat, which has no alpha). Sampled by composite/bloom to
     *        un-premultiply color for tonemap and to produce the canvas-drawable alpha used by
     *        the premultiplied alphaMode compositor (so the page background still shows through
     *        cleared / edge-faded regions like before).
     *  rg8unorm at 4× MSAA is 8 bytes/texel — still fits Apple TBDR tile memory comfortably. */
    private static readonly BLOOM_MASK_FORMAT;
    private multisampleMaskTexture;
    private maskResolveTexture;
    private maskResolveView;
    private renderPassDescriptor;
    private compositePassDescriptor;
    private compositePipelineIdentity;
    private compositePipelineGamma;
    private compositeBindGroupLayout;
    private compositeBindGroup;
    private compositeUniformBuffer;
    private readonly compositeUniformData;
    private bloomSampler;
    private bloomBlitUniformBuffer;
    private bloomUpsampleUniformBuffer;
    private readonly bloomBlitUniformData;
    private readonly bloomUpsampleUniformData;
    private bloomBlitPipeline;
    private bloomDownsamplePipeline;
    private bloomUpsamplePipeline;
    private bloomBlitBindGroupLayout;
    private bloomDownsampleBindGroupLayout;
    private bloomUpsampleBindGroupLayout;
    private bloomDownTexture;
    private bloomUpTexture;
    private bloomMipCount;
    private bloomDownMipViews;
    private bloomUpMipViews;
    private bloomBlitBindGroup;
    private bloomDownsampleBindGroups;
    private bloomUpsampleBindGroups;
    /** Single-attachment pass; colorAttachments[0].view set per bloom step. */
    private bloomPassDescriptor;
    private static readonly BLOOM_MAX_LEVELS;
    private groundVertexBuffer?;
    private groundIndexBuffer?;
    private hasGround;
    private shadowMapTexture;
    private shadowMapDepthView;
    private brdfLutTexture;
    private brdfLutView;
    private static readonly SHADOW_MAP_SIZE;
    private shadowDepthPipeline;
    private shadowLightVPBuffer;
    private shadowLightVPMatrix;
    private groundShadowBindGroup?;
    private shadowComparisonSampler;
    private groundShadowMaterialBuffer?;
    private groundDrawCall;
    private onRaycast?;
    private onGizmoDrag?;
    private physicsOptions;
    private lastTouchTime;
    private readonly DOUBLE_TAP_DELAY;
    private pickPipeline;
    private pickPerFrameBindGroupLayout;
    private pickPerInstanceBindGroupLayout;
    private pickPerMaterialBindGroupLayout;
    private pickPerFrameBindGroup;
    private pickTexture;
    private pickDepthTexture;
    private pickReadbackBuffer;
    private pendingPick;
    private modelInstances;
    private materialSampler;
    private fallbackMaterialTexture;
    private textureCache;
    private mipBlitPipeline;
    private mipBlitSampler;
    private _nextDefaultModelId;
    private ikEnabled;
    private physicsEnabled;
    private cameraTargetModel;
    private cameraTargetBoneName;
    private cameraTargetOffset;
    private lastFpsUpdate;
    private framesSinceLastUpdate;
    private lastFrameTime;
    private frameTimeSum;
    private frameTimeCount;
    private stats;
    private animationFrameId;
    private renderLoopCallback;
    private bloomSettings;
    private viewTransform;
    constructor(canvas: HTMLCanvasElement, options?: EngineOptions);
    /** Merge partial bloom with EEVEE defaults (same as constructor). */
    static mergeBloomDefaults(partial?: Partial<BloomOptions>): BloomOptions;
    static mergeViewTransformDefaults(partial?: Partial<ViewTransformOptions>): ViewTransformOptions;
    /** Current bloom settings (Blender names; tint is a copied `Vec3`). */
    getBloomOptions(): BloomOptions;
    getViewTransformOptions(): ViewTransformOptions;
    setViewTransformOptions(patch: Partial<ViewTransformOptions>): void;
    private writeCompositeViewUniforms;
    /** Patch bloom; GPU uniforms update immediately if `init()` has run. */
    setBloomOptions(patch: Partial<BloomOptions>): void;
    private writeBloomUniforms;
    init(): Promise<void>;
    private bakeBrdfLut;
    private createRenderPipeline;
    private createPipelines;
    private setupResize;
    private handleResize;
    private setupGizmo;
    private setupCamera;
    /** Set static camera look-at / orbit center. Clears any model follow binding. */
    setCameraTarget(v: Vec3): void;
    /** Bind camera orbit center to a model's bone (Souls-style follow cam). Pass null to unbind. */
    setCameraTarget(model: Model | null, boneName: string, offset?: Vec3): void;
    /** Souls-style follow cam: orbit center tracks a model bone each frame. Shorthand for setCameraTarget(model, boneName, offset). */
    setCameraFollow(model: Model | null, boneName?: string, offset?: Vec3): void;
    getCameraDistance(): number;
    setCameraDistance(d: number): void;
    getCameraAlpha(): number;
    setCameraAlpha(a: number): void;
    getCameraBeta(): number;
    setCameraBeta(b: number): void;
    private setupLighting;
    /**
     * Write world ambient. For a uniform-radiance world, hemispherical irradiance
     * is E = π·L and a Lambertian BRDF reflects (albedo/π)·E = albedo·L, so the
     * shader's ambient uniform is just `world.color × world.strength` — no /π.
     */
    private writeWorld;
    /** Write sun lamp into light slot `index` (0..3). Layout mirrors the WGSL struct. */
    private writeSun;
    /** Update the world environment (Blender: World Background). Ambient recomputes immediately. */
    setWorld(options: WorldOptions): void;
    /** Update the sun lamp (Blender: Light > Sun). Direction change marks shadow VP dirty. */
    setSun(options: SunOptions): void;
    getWorld(): Readonly<{
        color: Vec3;
        strength: number;
    }>;
    getSun(): Readonly<{
        color: Vec3;
        strength: number;
        direction: Vec3;
    }>;
    addGround(options?: {
        width?: number;
        height?: number;
        diffuseColor?: Vec3;
        fadeStart?: number;
        fadeEnd?: number;
        shadowStrength?: number;
        gridSpacing?: number;
        gridLineWidth?: number;
        gridLineOpacity?: number;
        gridLineColor?: Vec3;
        noiseStrength?: number;
    }): void;
    private updateLightBuffer;
    getStats(): EngineStats;
    runRenderLoop(callback?: () => void): void;
    stopRenderLoop(): void;
    dispose(): void;
    loadModel(path: string): Promise<Model>;
    loadModel(name: string, path: string): Promise<Model>;
    loadModel(name: string, options: LoadModelFromFilesOptions): Promise<Model>;
    addModel(model: Model, pmxPath: string, name?: string, assetReader?: AssetReader): Promise<string>;
    removeModel(name: string): void;
    getModelNames(): string[];
    getModel(name: string): Model | null;
    markVertexBufferDirty(modelNameOrModel?: string | Model): void;
    setSelectedMaterial(modelName: string | null, materialName: string | null): void;
    setSelectedBone(modelName: string | null, boneName: string | null): void;
    setMaterialPresets(modelName: string, presets: MaterialPresetMap): void;
    setMaterialVisible(modelName: string, materialName: string, visible: boolean): void;
    toggleMaterialVisible(modelName: string, materialName: string): void;
    isMaterialVisible(modelName: string, materialName: string): boolean;
    setIKEnabled(enabled: boolean): void;
    getIKEnabled(): boolean;
    setPhysicsEnabled(enabled: boolean): void;
    getPhysicsEnabled(): boolean;
    resetPhysics(): void;
    private forEachInstance;
    private updateInstances;
    private updateVertexBuffer;
    private setupModelInstance;
    private createGroundGeometry;
    private createShadowGroundResources;
    private shadowLightVPDirty;
    private updateShadowLightVP;
    private setupMaterialsForInstance;
    private createMaterialUniformBuffer;
    private createUniformBuffer;
    private shouldRenderDrawCall;
    private createTextureFromLogicalPath;
    private generateMipmaps;
    private renderGround;
    private handleCanvasDoubleClick;
    private handleCanvasTouch;
    private performRaycast;
    private renderSelectionPasses;
    private renderGizmoPass;
    private rotateVec3ByQuat;
    private unproject;
    private buildMouseRay;
    private hitTestGizmo;
    private distSegmentRay;
    private closestParamOnAxisLine;
    private rayPlane;
    private angleInRingPlane;
    private handleGizmoMouseDown;
    private handleGizmoMouseMove;
    private handleGizmoMouseUp;
    private renderPickPass;
    private resolvePickResult;
    render(): void;
    private drawInstanceShadow;
    private pipelineForPreset;
    /**
     * Draw every material of a given type (`opaque` or `transparent`) using the main
     * pipeline(s). Binds the per-frame and per-instance groups once at the top of the
     * batch, then issues one draw per material. Early-outs if nothing to draw so we
     * don't waste bindings when a model has no transparents, etc.
     */
    private drawMaterials;
    /**
     * Draw every outline of a given type (`opaque-outline` or `transparent-outline`).
     * Uses its own pipeline layout (group 0 = camera-only, group 2 = edge uniforms), so
     * every batch binds its own groups from scratch — the next drawMaterials call will
     * rebind group 0/1 correctly if needed.
     */
    private drawOutlines;
    /**
     * Main-pass render sequence for one model instance:
     *   1) opaque bodies → 2) opaque outlines → 3) transparents → 4) transparent outlines.
     * Each batch binds the groups it needs, so switching between main and outline
     * pipelines is self-contained (no cross-batch dependencies).
     */
    private renderOneModel;
    /**
     * Second hair pass for the see-through-hair effect. Re-draws every hair opaque
     * draw using `hairOverEyesPipeline` — which stencil-matches `EYE_VALUE` and runs
     * the hair shader with `IS_OVER_EYES=true` so alpha is halved. depthWriteEnabled
     * is off, so the eye's depth stays authoritative for anything drawn after.
     */
    private drawHairOverEyes;
    private updateCameraUniforms;
    private updateSkinMatrices;
    private updateStats;
}
//# sourceMappingURL=engine.d.ts.map