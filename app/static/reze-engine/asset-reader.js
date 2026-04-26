/** Unified binary I/O for PMX/VMD/textures: HTTP(s) or user folder (File map). */
/** Normalize PMX-style paths: backslashes, trim, strip leading ./ */
export function normalizeAssetPath(p) {
    let s = p.replace(/\\/g, "/").trim();
    if (s.startsWith("./"))
        s = s.slice(2);
    return s;
}
/** Join PMX directory prefix and texture-relative path (both may be ""). */
export function joinAssetPath(baseDir, relative) {
    const rel = normalizeAssetPath(relative);
    if (!rel)
        return normalizeAssetPath(baseDir);
    const base = baseDir.endsWith("/") ? baseDir.slice(0, -1) : baseDir;
    if (!base)
        return rel;
    return `${base}/${rel}`;
}
/** Same rules as the original engine string split: supports absolute site paths like `/models/a/b.pmx`. */
export function deriveBasePathFromPmxPath(pmxPath) {
    const pathParts = pmxPath.replace(/\\/g, "/").split("/");
    pathParts.pop();
    return pathParts.join("/") + (pathParts.length > 0 ? "/" : "");
}
export function createFetchAssetReader() {
    return {
        async readBinary(logicalPath) {
            const r = await fetch(logicalPath);
            if (!r.ok)
                throw new Error(`Failed to fetch ${logicalPath}: ${r.status} ${r.statusText}`);
            return r.arrayBuffer();
        },
    };
}
/** Keys must be normalized paths relative to the selected folder root (see fileListToMap). */
export function createFileMapAssetReader(files) {
    return {
        async readBinary(logicalPath) {
            const key = normalizeAssetPath(logicalPath);
            let file = files.get(key);
            if (!file) {
                const lower = key.toLowerCase();
                for (const [k, f] of files) {
                    if (k.toLowerCase() === lower) {
                        file = f;
                        break;
                    }
                }
            }
            if (!file)
                throw new Error(`Missing file in folder: ${key}`);
            return file.arrayBuffer();
        },
    };
}
export function fileListToMap(files) {
    const m = new Map();
    for (const f of Array.from(files)) {
        const rel = f.webkitRelativePath ?? f.name;
        m.set(normalizeAssetPath(rel), f);
    }
    return m;
}
export function findFirstPmxFileInList(files) {
    const list = Array.from(files).filter((f) => f.name.toLowerCase().endsWith(".pmx"));
    if (list.length === 0)
        return null;
    list.sort((a, b) => {
        const pa = a.webkitRelativePath ?? a.name;
        const pb = b.webkitRelativePath ?? b.name;
        return pa.localeCompare(pb);
    });
    return list[0] ?? null;
}
