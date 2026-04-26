/** Unified binary I/O for PMX/VMD/textures: HTTP(s) or user folder (File map). */
export type AssetReader = {
    readBinary(logicalPath: string): Promise<ArrayBuffer>;
};
/** Normalize PMX-style paths: backslashes, trim, strip leading ./ */
export declare function normalizeAssetPath(p: string): string;
/** Join PMX directory prefix and texture-relative path (both may be ""). */
export declare function joinAssetPath(baseDir: string, relative: string): string;
/** Same rules as the original engine string split: supports absolute site paths like `/models/a/b.pmx`. */
export declare function deriveBasePathFromPmxPath(pmxPath: string): string;
export declare function createFetchAssetReader(): AssetReader;
/** Keys must be normalized paths relative to the selected folder root (see fileListToMap). */
export declare function createFileMapAssetReader(files: Map<string, File>): AssetReader;
export declare function fileListToMap(files: FileList | File[]): Map<string, File>;
export declare function findFirstPmxFileInList(files: FileList | File[]): File | null;
//# sourceMappingURL=asset-reader.d.ts.map