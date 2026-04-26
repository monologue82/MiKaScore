let ammoInstance = null;
let ammoPromise = null;
export async function loadAmmo() {
    // Return cached instance if available
    if (ammoInstance) {
        return ammoInstance;
    }
    // Return existing promise if already loading
    if (ammoPromise) {
        return ammoPromise;
    }
    // Start loading Ammo
    ammoPromise = (async () => {
        try {
            const { Ammo } = await import("@fred3d/ammo");
            ammoInstance = await Ammo();
            return ammoInstance;
        }
        catch (error) {
            console.error("[Ammo] Failed to load:", error);
            ammoPromise = null; // Reset promise so it can be retried
            throw error;
        }
    })();
    return ammoPromise;
}
