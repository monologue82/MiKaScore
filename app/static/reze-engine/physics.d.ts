import { Quat, Vec3, Mat4 } from "./math";
export declare enum RigidbodyShape {
    Sphere = 0,
    Box = 1,
    Capsule = 2
}
export declare enum RigidbodyType {
    Static = 0,
    Dynamic = 1,
    Kinematic = 2
}
export interface Rigidbody {
    name: string;
    englishName: string;
    boneIndex: number;
    group: number;
    collisionMask: number;
    shape: RigidbodyShape;
    size: Vec3;
    shapePosition: Vec3;
    shapeRotation: Vec3;
    mass: number;
    linearDamping: number;
    angularDamping: number;
    restitution: number;
    friction: number;
    type: RigidbodyType;
    bodyOffsetMatrixInverse: Mat4;
    bodyOffsetMatrix?: Mat4;
}
export interface Joint {
    name: string;
    englishName: string;
    type: number;
    rigidbodyIndexA: number;
    rigidbodyIndexB: number;
    position: Vec3;
    rotation: Vec3;
    positionMin: Vec3;
    positionMax: Vec3;
    rotationMin: Vec3;
    rotationMax: Vec3;
    springPosition: Vec3;
    springRotation: Vec3;
}
export interface PhysicsOptions {
    constraintSolverKeywords?: string[];
}
export declare class Physics {
    private rigidbodies;
    private joints;
    private gravity;
    private constraintSolverPattern;
    private ammoInitialized;
    private ammoPromise;
    private ammo;
    private dynamicsWorld;
    private ammoRigidbodies;
    private ammoConstraints;
    private rigidbodiesInitialized;
    private jointsCreated;
    private firstFrame;
    private zeroVector;
    constructor(rigidbodies: Rigidbody[], joints?: Joint[], options?: PhysicsOptions);
    private initAmmo;
    setGravity(gravity: Vec3): void;
    getGravity(): Vec3;
    getRigidbodies(): Rigidbody[];
    getJoints(): Joint[];
    getRigidbodyTransforms(): Array<{
        position: Vec3;
        rotation: Quat;
    }>;
    private createAmmoWorld;
    private createAmmoRigidbodies;
    private createAmmoJoints;
    private normalizeAngle;
    reset(boneWorldMatrices: Mat4[]): void;
    step(dt: number, boneWorldMatrices: Mat4[], boneInverseBindMatrices: Float32Array): void;
    private computeBodyOffsets;
    private positionBodiesFromBones;
    private syncFromBones;
    private stepAmmoPhysics;
    private applyAmmoRigidbodiesToBones;
}
//# sourceMappingURL=physics.d.ts.map