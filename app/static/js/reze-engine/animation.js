export const FPS = 30;
// Priority-aware playback: higher priority preempts, otherwise latest request is queued.
export class AnimationState {
    constructor() {
        this.animations = new Map();
        this.currentAnimationName = null;
        this.currentFrame = 0;
        this.currentPriority = 0;
        this.currentLoop = false;
        this.isPlaying = false;
        this.isPaused = false;
        this.nextAnimation = null;
        this.onEnd = null;
    }
    loadAnimation(name, clip) {
        this.animations.set(name, {
            boneTracks: clip.boneTracks,
            morphTracks: clip.morphTracks,
            frameCount: clip.frameCount,
        });
    }
    removeAnimation(name) {
        this.animations.delete(name);
        if (this.currentAnimationName === name) {
            this.currentAnimationName = null;
            this.currentFrame = 0;
            this.currentPriority = 0;
            this.currentLoop = false;
            this.isPlaying = false;
            this.nextAnimation = this.nextAnimation?.name === name ? null : this.nextAnimation;
        }
        else if (this.nextAnimation?.name === name) {
            this.nextAnimation = null;
        }
    }
    play(name, options) {
        if (name === undefined) {
            if (this.currentAnimationName && this.animations.has(this.currentAnimationName)) {
                this.isPaused = false;
                this.isPlaying = true;
            }
            return;
        }
        if (!this.animations.has(name))
            return false;
        const priority = options?.priority ?? 0;
        const loop = options?.loop ?? false;
        if (this.currentAnimationName === name) {
            this.currentFrame = 0;
            this.currentPriority = priority;
            this.currentLoop = loop;
            this.isPlaying = true;
            this.isPaused = false;
            return true;
        }
        if (this.isPlaying && !this.isPaused) {
            if (priority > this.currentPriority) {
                this.currentAnimationName = name;
                this.currentFrame = 0;
                this.currentPriority = priority;
                this.currentLoop = loop;
                this.isPlaying = true;
                this.isPaused = false;
                this.nextAnimation = null;
                return true;
            }
            this.nextAnimation = { name, priority, loop };
            return true;
        }
        this.currentAnimationName = name;
        this.currentFrame = 0;
        this.currentPriority = priority;
        this.currentLoop = loop;
        this.isPlaying = true;
        this.isPaused = false;
        this.nextAnimation = null;
        return true;
    }
    update(deltaTime) {
        if (!this.isPlaying || this.isPaused || this.currentAnimationName === null) {
            return { ended: false, animationName: this.currentAnimationName };
        }
        const clip = this.animations.get(this.currentAnimationName);
        if (!clip)
            return { ended: false, animationName: this.currentAnimationName };
        const frameCount = clip.frameCount;
        if (frameCount <= 0 || !Number.isFinite(frameCount)) {
            return { ended: false, animationName: this.currentAnimationName };
        }
        this.currentFrame += deltaTime * FPS;
        if (this.currentFrame >= frameCount) {
            if (this.currentLoop) {
                while (this.currentFrame >= frameCount) {
                    this.currentFrame -= frameCount;
                }
                return { ended: false, animationName: this.currentAnimationName };
            }
            this.currentFrame = frameCount;
            const finishedName = this.currentAnimationName;
            this.onEnd?.(finishedName);
            if (this.nextAnimation !== null) {
                const next = this.nextAnimation;
                this.nextAnimation = null;
                this.currentAnimationName = next.name;
                this.currentFrame = 0;
                this.currentPriority = next.priority;
                this.currentLoop = next.loop;
                this.isPlaying = true;
                this.isPaused = false;
                return { ended: true, animationName: finishedName };
            }
            this.isPlaying = false;
            return { ended: true, animationName: finishedName };
        }
        return { ended: false, animationName: this.currentAnimationName };
    }
    pause() {
        this.isPaused = true;
    }
    stop() {
        this.isPlaying = false;
        this.isPaused = false;
        this.currentFrame = 0;
        this.currentPriority = 0;
        this.currentLoop = false;
        this.nextAnimation = null;
    }
    // Seek by absolute timeline seconds, not frame index.
    seek(seconds) {
        const clip = this.getCurrentClip();
        if (!clip || clip.frameCount <= 0 || !Number.isFinite(clip.frameCount))
            return;
        const targetFrame = seconds * FPS;
        this.currentFrame = Math.max(0, Math.min(targetFrame, clip.frameCount));
    }
    getCurrentClip() {
        return this.currentAnimationName !== null ? this.animations.get(this.currentAnimationName) ?? null : null;
    }
    getAnimationClip(name) {
        return this.animations.get(name) ?? null;
    }
    getCurrentAnimation() {
        return this.currentAnimationName;
    }
    getCurrentTime() {
        const clip = this.getCurrentClip();
        if (!clip)
            return 0;
        return this.currentFrame / FPS;
    }
    getCurrentFrame() {
        return this.currentFrame;
    }
    /** Clip length in seconds (`frameCount / FPS`). */
    getDuration() {
        const clip = this.getCurrentClip();
        if (!clip || clip.frameCount <= 0 || !Number.isFinite(clip.frameCount))
            return 0;
        return clip.frameCount / FPS;
    }
    getProgress() {
        const clip = this.getCurrentClip();
        const duration = clip && clip.frameCount > 0 ? clip.frameCount / FPS : 0;
        const current = clip ? this.currentFrame / FPS : 0;
        const percentage = duration > 0 ? (current / duration) * 100 : 0;
        return {
            animationName: this.currentAnimationName,
            current,
            duration,
            percentage,
            looping: this.currentLoop,
            playing: this.isPlaying && !this.isPaused,
            paused: this.isPaused,
        };
    }
    getAnimationNames() {
        return Array.from(this.animations.keys());
    }
    hasAnimation(name) {
        return this.animations.has(name);
    }
    show(name) {
        if (!this.animations.has(name))
            return;
        this.currentAnimationName = name;
        this.currentFrame = 0;
        this.currentPriority = 0;
        this.currentLoop = false;
        this.isPlaying = false;
        this.isPaused = false;
        this.nextAnimation = null;
    }
    setOnEnd(callback) {
        this.onEnd = callback;
    }
    getPlaying() {
        return this.isPlaying;
    }
    getPaused() {
        return this.isPaused;
    }
}
export function bezierInterpolate(x1, x2, y1, y2, t) {
    t = Math.max(0, Math.min(1, t));
    let start = 0;
    let end = 1;
    let mid = 0.5;
    for (let i = 0; i < 15; i++) {
        const x = 3 * (1 - mid) * (1 - mid) * mid * x1 + 3 * (1 - mid) * mid * mid * x2 + mid * mid * mid;
        if (Math.abs(x - t) < 0.0001) {
            break;
        }
        if (x < t) {
            start = mid;
        }
        else {
            end = mid;
        }
        mid = (start + end) / 2;
    }
    const y = 3 * (1 - mid) * (1 - mid) * mid * y1 + 3 * (1 - mid) * mid * mid * y2 + mid * mid * mid;
    return y;
}
const INV_127 = 1 / 127;
export function rawInterpolationToBoneInterpolation(raw) {
    return {
        rotation: [
            { x: raw[0], y: raw[2] },
            { x: raw[1], y: raw[3] },
        ],
        translationX: [
            { x: raw[0], y: raw[4] },
            { x: raw[8], y: raw[12] },
        ],
        translationY: [
            { x: raw[16], y: raw[20] },
            { x: raw[24], y: raw[28] },
        ],
        translationZ: [
            { x: raw[32], y: raw[36] },
            { x: raw[40], y: raw[44] },
        ],
    };
}
export function interpolateControlPoints(cp, t) {
    return bezierInterpolate(cp[0].x * INV_127, cp[1].x * INV_127, cp[0].y * INV_127, cp[1].y * INV_127, t);
}
