/** After choosing a path from `multiple`, get the `File` for `loadModel(..., { files, pmxFile })`. */
export declare function pmxFileAtRelativePath(files: File[], relativePath: string): File | undefined;
/** Result of reading a folder input — switch on `status` in your UI. */
export type PmxFolderInputResult = {
    status: "empty";
} | {
    status: "not_directory";
} | {
    status: "no_pmx";
} | {
    status: "single";
    files: File[];
    pmxFile: File;
} | {
    status: "multiple";
    files: File[];
    pmxRelativePaths: string[];
};
/**
 * One call from `onChange`: snapshots files, validates folder pick, resolves a single PMX or asks you to pick among several.
 * Reset the input after: `e.target.value = ""`.
 */
export declare function parsePmxFolderInput(fileList: FileList | null | undefined): PmxFolderInputResult;
//# sourceMappingURL=folder-upload.d.ts.map