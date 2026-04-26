import { Quat, Vec3 } from "./math";
export interface BoneFrame {
    boneName: string;
    frame: number;
    rotation: Quat;
    translation: Vec3;
    interpolation: Uint8Array;
}
export interface MorphFrame {
    morphName: string;
    frame: number;
    weight: number;
}
export interface VMDKeyFrame {
    time: number;
    boneFrames: BoneFrame[];
    morphFrames: MorphFrame[];
}
export declare class VMDLoader {
    private view;
    private offset;
    private decoder;
    private constructor();
    static load(url: string): Promise<VMDKeyFrame[]>;
    static loadFromBuffer(buffer: ArrayBuffer): VMDKeyFrame[];
    private parse;
    private readBoneFrame;
    private readMorphFrame;
    private getUint8;
    private getUint32;
    private getFloat32;
    private getString;
    private skip;
}
//# sourceMappingURL=vmd-loader.d.ts.map