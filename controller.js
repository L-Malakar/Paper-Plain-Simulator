/**
 * Controller Logic for 3D Paper Plane
 * Manages Key States, World Horizontal Movement, and Plane Vertical Movement
 */

export const Controller = {
    // --- STATE ---
    keys: {
        w: false,
        s: false,
        a: false,
        d: false
    },
    
    // --- CONFIGURATION ---
    config: {
        moveSpeed: 0.22,      // Speed of world shifting (A/D)
        verticalSpeed: 0.1,  // Speed of plane climbing/diving (W/S)
        maxHeight: 6,        // Reduced Ceiling limit to prevent escaping pillars
        minHeight: 0,         // Ground level
        // FIX 5: Minimum height enforced during ghost/glitch mode so the plane
        // cannot fly below ground level even when invincible.
        ghostMinHeight: 0.5,
        chunkSize: 40         // Used for world wrapping
    },

    // FIX 5: Set by the game loop when ghost mode is active
    isGhostMode: false,

    // --- INITIALIZATION ---
    init() {
        window.addEventListener('keydown', (e) => this.handleKey(e, true));
        window.addEventListener('keyup', (e) => this.handleKey(e, false));
    },

    handleKey(event, isPressed) {
        const key = event.key.toLowerCase();
        if (Object.keys(this.keys).includes(key)) {
            this.keys[key] = isPressed;
        }
    },

    // --- MOVEMENT LOGIC ---
    update(playerGroup, currentWorldShiftX, delta) {
        let nextWorldShiftX = currentWorldShiftX;
        const scale = delta * 60; // Normalise to 60fps so speed is frame-rate independent

        // 1. Horizontal Movement (Shifting the world via A/D)
        if (this.keys.a) nextWorldShiftX += this.config.moveSpeed * scale;
        if (this.keys.d) nextWorldShiftX -= this.config.moveSpeed * scale;

        // World Wrapping Logic
        if (nextWorldShiftX > this.config.chunkSize) nextWorldShiftX -= this.config.chunkSize;
        if (nextWorldShiftX < -this.config.chunkSize) nextWorldShiftX += this.config.chunkSize;

        // 2. Vertical Movement (Moving the plane via W/S)
        if (this.keys.w && playerGroup.position.y < this.config.maxHeight) {
            playerGroup.position.y += this.config.verticalSpeed * scale;
        }
        if (this.keys.s) {
            playerGroup.position.y -= this.config.verticalSpeed * scale;
        }

        // FIX 5: Enforce floor barrier during ghost mode — player cannot go
        // below ghostMinHeight while invincible, preventing ground clipping.
        const floorLimit = this.isGhostMode
            ? this.config.ghostMinHeight
            : this.config.minHeight;

        if (playerGroup.position.y < floorLimit) {
            playerGroup.position.y = floorLimit;
        }

        // 3. Ground Touch Detection (only triggers a crash outside ghost mode)
        const isCrashed = !this.isGhostMode && playerGroup.position.y <= this.config.minHeight;

        // 4. Calculate Visual Rotations (Banking and Pitching)
        const targetBank = (this.keys.a ? 0.6 : this.keys.d ? -0.6 : 0);
        const targetPitch = (this.keys.w ? -0.3 : this.keys.s ? 0.3 : 0);

        return {
            worldShiftX: nextWorldShiftX,
            isCrashed: isCrashed,
            targetBank: targetBank,
            targetPitch: targetPitch
        };
    }
};
