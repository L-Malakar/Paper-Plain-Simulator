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
        chunkSize: 40         // Used for world wrapping
    },

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
    update(playerGroup, currentWorldShiftX) {
        let nextWorldShiftX = currentWorldShiftX;

        // 1. Horizontal Movement (Shifting the world via A/D)
        if (this.keys.a) nextWorldShiftX += this.config.moveSpeed;
        if (this.keys.d) nextWorldShiftX -= this.config.moveSpeed;

        // World Wrapping Logic
        if (nextWorldShiftX > this.config.chunkSize) nextWorldShiftX -= this.config.chunkSize;
        if (nextWorldShiftX < -this.config.chunkSize) nextWorldShiftX += this.config.chunkSize;

        // 2. Vertical Movement (Moving the plane via W/S)
        if (this.keys.w && playerGroup.position.y < this.config.maxHeight) {
            playerGroup.position.y += this.config.verticalSpeed;
        }
        if (this.keys.s) {
            playerGroup.position.y -= this.config.verticalSpeed;
        }

        // 3. Ground Touch Detection
        const isCrashed = playerGroup.position.y <= this.config.minHeight;

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
};u
