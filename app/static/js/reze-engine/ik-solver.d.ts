import { Mat4, Quat, Vec3 } from "./math";
import { Bone, IKSolver, IKChainInfo } from "./model";
export type UpdateWorldMatrixFn = (boneIndex: number, applyIK: boolean) => void;
export declare class IKSolverSystem {
    private static readonly EPSILON;
    private static readonly THRESHOLD;
    static solve(ikSolvers: IKSolver[], bones: Bone[], localRotations: Quat[], localTranslations: Vec3[], worldMatrices: Mat4[], ikChainInfo: IKChainInfo[], updateWorldMatrix?: UpdateWorldMatrixFn): void;
    private static solveIK;
    private static solveChain;
    private static limitAngle;
    private static getDistance;
    private static readonly EULER_AXES;
    private static extractEulerAnglesInto;
    private static limitEulerAnglesInto;
    private static reconstructQuatFromEulerInto;
    private static getParentWorldRotationMatrixInto;
    private static updateWorldMatrix;
}
//# sourceMappingURL=ik-solver.d.ts.map