import { Quat, Vec3 } from "./math";
export interface ControlPoint {
    x: number;
    y: number;
}
export interface BoneInterpolation {
    rotation: ControlPoint[];
    translationX: ControlPoint[];
    translationY: ControlPoint[];
    translationZ: ControlPoint[];
}
export interface BoneKeyframe {
    boneName: string;
    frame: number;
    rotation: Quat;
    translation: Vec3;
    interpolation: BoneInterpolation;
}
export interface MorphKeyframe {
    morphName: string;
    frame: number;
    weight: number;
}
export interface AnimationClip {
    boneTracks: Map<string, BoneKeyframe[]>;
    morphTracks: Map<string, MorphKeyframe[]>;
    frameCount: number;
}
export interface AnimationPlayOptions {
    priority?: number;
    loop?: boolean;
}
/** Wall-clock playback progress; `current`/`duration` are seconds (clip span uses `AnimationClip.frameCount`, not `duration`). */
export interface AnimationProgress {
    animationName: string | null;
    current: number;
    duration: number;
    percentage: number;
    looping: boolean;
    /** True while the timeline is advancing (not idle at end, not paused). */
    playing: boolean;
    paused: boolean;
}
export declare const FPS = 30;
export declare class AnimationState {
    private animations;
    private currentAnimationName;
    private currentFrame;
    private currentPriority;
    private currentLoop;
    private isPlaying;
    private isPaused;
    private nextAnimation;
    private onEnd;
    loadAnimation(name: string, clip: AnimationClip): void;
    removeAnimation(name: string): void;
    play(name: string, options?: AnimationPlayOptions): boolean;
    play(): void;
    update(deltaTime: number): {
        ended: boolean;
        animationName: string | null;
    };
    pause(): void;
    stop(): void;
    seek(seconds: number): void;
    getCurrentClip(): AnimationClip | null;
    getAnimationClip(name: string): AnimationClip | null;
    getCurrentAnimation(): string | null;
    getCurrentTime(): number;
    getCurrentFrame(): number;
    /** Clip length in seconds (`frameCount / FPS`). */
    getDuration(): number;
    getProgress(): AnimationProgress;
    getAnimationNames(): string[];
    hasAnimation(name: string): boolean;
    show(name: string): void;
    setOnEnd(callback: ((animationName: string) => void) | null): void;
    getPlaying(): boolean;
    getPaused(): boolean;
}
export declare function bezierInterpolate(x1: number, x2: number, y1: number, y2: number, t: number): number;
export declare function rawInterpolationToBoneInterpolation(raw: Uint8Array): BoneInterpolation;
export declare function interpolateControlPoints(cp: ControlPoint[], t: number): number;
//# sourceMappingURL=animation.d.ts.map