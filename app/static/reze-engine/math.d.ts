export declare function easeInOut(t: number): number;
export declare class Vec3 {
    x: number;
    y: number;
    z: number;
    constructor(x: number, y: number, z: number);
    static zeros(): Vec3;
    add(other: Vec3): Vec3;
    subtract(other: Vec3): Vec3;
    length(): number;
    normalize(): Vec3;
    cross(other: Vec3): Vec3;
    dot(other: Vec3): number;
    scale(scalar: number): Vec3;
    set(other: Vec3): Vec3;
    setXYZ(x: number, y: number, z: number): Vec3;
    static subtractInto(a: Vec3, b: Vec3, out: Vec3): Vec3;
    static crossInto(a: Vec3, b: Vec3, out: Vec3): Vec3;
    static setFromMat4Translation(m: Float32Array, out: Vec3): Vec3;
    static transformMat4RotationInto(normal: Vec3, m: Float32Array, out: Vec3): Vec3;
    normalizeInPlace(): Vec3;
}
export declare class Quat {
    x: number;
    y: number;
    z: number;
    w: number;
    constructor(x: number, y: number, z: number, w: number);
    static identity(): Quat;
    add(other: Quat): Quat;
    clone(): Quat;
    multiply(other: Quat): Quat;
    conjugate(): Quat;
    length(): number;
    normalize(): Quat;
    static fromAxisAngle(axis: Vec3, angle: number): Quat;
    toArray(): [number, number, number, number];
    set(other: Quat): Quat;
    static slerp(a: Quat, b: Quat, t: number): Quat;
    static multiplyInto(a: Quat, b: Quat, out: Quat): Quat;
    static fromAxisAngleInto(ax: number, ay: number, az: number, angle: number, out: Quat): Quat;
    static slerpInto(a: Quat, b: Quat, t: number, out: Quat): Quat;
    setXYZW(x: number, y: number, z: number, w: number): Quat;
    setIdentity(): Quat;
    static fromEuler(rotX: number, rotY: number, rotZ: number): Quat;
}
export declare class Mat4 {
    values: Float32Array;
    constructor(values: Float32Array);
    static identity(): Mat4;
    static perspective(fov: number, aspect: number, near: number, far: number): Mat4;
    static lookAt(eye: Vec3, target: Vec3, up: Vec3): Mat4;
    static orthographicLh(left: number, right: number, bottom: number, top: number, near: number, far: number): Mat4;
    multiply(other: Mat4): Mat4;
    static multiplyArrays(a: Float32Array, aOffset: number, b: Float32Array, bOffset: number, out: Float32Array, outOffset: number): void;
    clone(): Mat4;
    static fromQuatInto(x: number, y: number, z: number, w: number, out: Float32Array, offset?: number): void;
    static localTransformInto(bx: number, by: number, bz: number, qx: number, qy: number, qz: number, qw: number, lx: number, ly: number, lz: number, out: Float32Array): void;
    static fromPositionRotationInto(px: number, py: number, pz: number, qx: number, qy: number, qz: number, qw: number, out: Float32Array): void;
    static inverseInto(m: Float32Array, out: Float32Array): boolean;
    static copyRotationInto(src: Float32Array, dst: Float32Array): void;
    static fromQuat(x: number, y: number, z: number, w: number): Mat4;
    static fromPositionRotation(position: Vec3, rotation: Quat): Mat4;
    getPosition(): Vec3;
    toQuat(): Quat;
    static toQuatFromArrayInto(m: Float32Array, offset: number, out: Quat): Quat;
    static toQuatFromArray(m: Float32Array, offset: number): Quat;
    setIdentity(): this;
    translateInPlace(tx: number, ty: number, tz: number): this;
    inverse(): Mat4;
}
export declare const scratchMat4Values: Float32Array[];
export declare const scratchVec3: Vec3[];
export declare const scratchQuat: Quat[];
//# sourceMappingURL=math.d.ts.map