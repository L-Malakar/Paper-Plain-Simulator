/**
 * Mobile Controller Logic for 3D Paper Plane
 * Implements Dynamic Virtual Joystick for Touch Devices
 */

export const MController = {
    // --- STATE ---
    input: { x: 0, y: 0 },
    joystickActive: false,
    enabled: true,
    
    // --- CONFIGURATION ---
    config: {
        moveSpeed: 0.22,
        verticalSpeed: 0.1,
        maxHeight: 6, // Reduced Ceiling limit
        minHeight: 0,
        chunkSize: 40
    },

    // --- INITIALIZATION ---
    init() {
        this.createJoystickUI();
    },

    showJoystick() {
        const container = document.getElementById('joystick-container');
        container.style.display = 'block';

        const pad = document.getElementById('joystick-pad');
        const knob = document.getElementById('joystick-knob');

        const handleTouch = (e) => {
            if (e.target.tagName === 'BUTTON') return;
            if (!this.enabled) return;

            e.preventDefault();
            const touch = e.touches[0];
            
            if (!this.joystickActive) {
                const isBottomHalf = touch.clientY > window.innerHeight / 2;
                const isLeftHalf = touch.clientX < window.innerWidth / 2;
                
                if (isBottomHalf && isLeftHalf) {
                    pad.style.left = `${touch.clientX - 60}px`;
                    pad.style.top = `${touch.clientY - 60}px`;
                    pad.style.opacity = '1';
                    this.joystickActive = true;
                } else {
                    return;
                }
            }

            const rect = pad.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            
            let dx = touch.clientX - centerX;
            let dy = touch.clientY - centerY;
            
            const distance = Math.sqrt(dx * dx + dy * dy);
            const radius = rect.width / 2;

            if (distance > radius) {
                dx *= radius / distance;
                dy *= radius / distance;
            }

            knob.style.transform = `translate(${dx}px, ${dy}px)`;
            
            this.input.x = dx / radius;
            this.input.y = dy / radius;
        };

        window.addEventListener('touchstart', (e) => handleTouch(e), { passive: false });
        window.addEventListener('touchmove', (e) => { if(this.joystickActive) handleTouch(e); }, { passive: false });
        window.addEventListener('touchend', () => {
            this.joystickActive = false;
            this.input.x = 0;
            this.input.y = 0;
            knob.style.transform = `translate(0px, 0px)`;
            pad.style.opacity = '0.3';
        });
    },

    createJoystickUI() {
        const container = document.createElement('div');
        container.id = 'joystick-container';
        container.style.cssText = 'position:absolute; top:0; left:0; width:100%; height:100%; z-index:100; pointer-events:none; display:none;';
        
        const pad = document.createElement('div');
        pad.id = 'joystick-pad';
        pad.style.cssText = 'width:120px; height:120px; background:rgba(255,255,255,0.1); border:2px solid #00ff41; border-radius:50%; position:absolute; bottom:50px; left:50px; opacity:0.3; transition: opacity 0.2s; pointer-events: none;';
        
        const knob = document.createElement('div');
        knob.id = 'joystick-knob';
        knob.style.cssText = 'width:40%; height:40%; background:#00ff41; border-radius:50%; position:absolute; top:30%; left:30%;';
        
        pad.appendChild(knob);
        container.appendChild(pad);
        document.body.appendChild(container);
    },

    disable() {
        this.enabled = false;
        this.joystickActive = false;
        this.input = { x: 0, y: 0 };
        const container = document.getElementById('joystick-container');
        if (container) container.style.display = 'none';
    },

    reset() {
        this.enabled = true;
        this.joystickActive = false;
        this.input = { x: 0, y: 0 };
    },

    update(playerGroup, currentWorldShiftX) {
        if (!this.enabled) return { worldShiftX: currentWorldShiftX, isGroundHit: false, targetBank: 0, targetPitch: 0 };

        let nextWorldShiftX = currentWorldShiftX;
        nextWorldShiftX -= this.input.x * this.config.moveSpeed;

        if (nextWorldShiftX > this.config.chunkSize) nextWorldShiftX -= this.config.chunkSize;
        if (nextWorldShiftX < -this.config.chunkSize) nextWorldShiftX += this.config.chunkSize;

        const verticalMove = -this.input.y * this.config.verticalSpeed;
        
        if (verticalMove > 0 && playerGroup.position.y < this.config.maxHeight) {
            playerGroup.position.y += verticalMove;
        } else if (verticalMove < 0) {
            playerGroup.position.y += verticalMove;
        }

        const isCrashed = playerGroup.position.y <= this.config.minHeight;
        if (isCrashed) this.disable();

        return {
            worldShiftX: nextWorldShiftX,
            isGroundHit: isCrashed,
            targetBank: -this.input.x * 0.6,
            targetPitch: -this.input.y * 0.3
        };
    }
};