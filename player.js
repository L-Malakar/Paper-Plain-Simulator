import * as THREE from 'https://unpkg.com/three@0.136.0/build/three.module.js';

export class Player {
    constructor(scene) {
        this.group = new THREE.Group();
        this.paperMat = new THREE.MeshStandardMaterial({ color: 0xe0e0e0, side: THREE.DoubleSide, flatShading: true });
        
        // Store base vertices to reference during the crumple animation
        this.baseVertices = new Float32Array([
            0, 0, 0.8, -0.8, 0.2, -0.4, 0, 0, -0.2,     
            0, 0, 0.8, 0.8, 0.2, -0.4, 0, 0, -0.2,     
            0, 0, 0.8, 0, -0.3, -0.2, 0, 0, -0.2,      
            0, 0, -0.2, -0.3, 0.0, -0.5, 0, 0.1, -0.3,
            0, 0, -0.2, 0.3, 0.0, -0.5, 0, 0.1, -0.3
        ]);
        
        // FIX 4: Generate spherical target points for a smoother "paper ball" shape.
        // Use a fixed seed-like distribution so the ball always looks consistently round.
        this.crumpleTargets = new Float32Array(45);
        for(let i = 0; i < 45; i += 3) {
            const u = Math.random();
            const v = Math.random();
            const theta = u * 2.0 * Math.PI;
            const phi = Math.acos(2.0 * v - 1.0);
            const radius = 0.15 + Math.random() * 0.05; // Tight radius for a dense round ball
            
            this.crumpleTargets[i] = radius * Math.sin(phi) * Math.cos(theta);
            this.crumpleTargets[i+1] = radius * Math.sin(phi) * Math.sin(theta);
            this.crumpleTargets[i+2] = radius * Math.cos(phi);
        }

        const indices = [0, 1, 2, 3, 5, 4, 6, 7, 8, 9, 10, 11, 12, 14, 13];
        const planeGeo = new THREE.BufferGeometry();
        // Create a copy of the base vertices for the live geometry so we don't mutate the original array
        planeGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.baseVertices), 3));
        planeGeo.setIndex(indices);
        planeGeo.computeVertexNormals();

        this.mesh = new THREE.Mesh(planeGeo, this.paperMat);
        this.mesh.rotation.y = Math.PI; 
        this.group.add(this.mesh);

        // --- HURT BOX (HITBOX) ---
        // FIX: Enlarged to better match the visible wingspan and body of the plane
        // so players don't clip through obstacles without crashing.
        const hitboxGeo = new THREE.BoxGeometry(1.4, 0.35, 1.0); 
        const hitboxMat = new THREE.MeshBasicMaterial({ visible: false }); 
        this.hitbox = new THREE.Mesh(hitboxGeo, hitboxMat);
        this.group.add(this.hitbox);

        this.group.position.set(-5, 3, 0);
        scene.add(this.group);

        // FIX 4: Crash Animation States — added pre-crash tumble phase
        this.crumpleFactor = 0;
        this.fallVelocity = 0;
        this._crashPhase = 0;       // 0 = not crashing, 1 = impact tumble, 2 = falling ball
        this._crashTimer = 0;       // tracks time in current phase
        this._impactRotX = 0;
        this._impactRotZ = 0;
        this._impactDirX = (Math.random() - 0.5) * 2; // Random left/right tumble direction

        // Ghost / invincibility state
        this.isGhost = false;
        this._glitchTimer = 0;
        // Second mesh for the glitch chromatic-offset wireframe clone
        this.ghostMat = new THREE.MeshStandardMaterial({
            color: 0x00ff41,
            side: THREE.DoubleSide,
            flatShading: true,
            transparent: true,
            opacity: 0,
            wireframe: true
        });
        this.ghostMesh = new THREE.Mesh(planeGeo, this.ghostMat);
        this.ghostMesh.rotation.y = Math.PI;
        this.group.add(this.ghostMesh);
    }

    // Enable or disable ghost (invincible glitch) mode
    setGhost(active) {
        this.isGhost = active;
        if (!active) {
            this.paperMat.transparent = false;
            this.paperMat.opacity = 1;
            this.ghostMat.opacity = 0;
            this.ghostMesh.position.set(0, 0, 0);
        }
    }

    // FIX 1: Call every frame — works on MENU screen too so the glitch effect
    // is visible when the plane flies in the background on the home page.
    // t = clock elapsed time
    updateGlitch(t) {
        if (!this.isGhost) return;
        // Flicker main mesh opacity for an unstable, electric look
        const flicker = 0.5 + 0.35 * Math.sin(t * 28 + Math.sin(t * 73));
        this.paperMat.transparent = true;
        this.paperMat.opacity = flicker;
        // Green wireframe ghost offsets slightly for a chromatic-split effect
        this.ghostMat.opacity = 0.35 + 0.25 * Math.sin(t * 40);
        this.ghostMesh.position.x = Math.sin(t * 60) * 0.08;
        this.ghostMesh.position.y = Math.cos(t * 55) * 0.05;
        // Occasional micro-jitter on the group for glitch feel
        this._glitchTimer -= 1;
        if (this._glitchTimer <= 0) {
            this._glitchTimer = 3 + Math.floor(Math.random() * 8);
            this.group.position.x += (Math.random() - 0.5) * 0.06;
        }
    }

    updateMenuAnimation(t) {
        this.mesh.rotation.z = Math.sin(t * 2) * 0.1;
    }

    updateFlightAnimation(t, ctrl) {
        this.group.rotation.z = THREE.MathUtils.lerp(this.group.rotation.z, ctrl.targetBank, 0.1);
        this.group.rotation.x = THREE.MathUtils.lerp(this.group.rotation.x, ctrl.targetPitch, 0.1);
        this.mesh.rotation.z = Math.sin(t * 5) * 0.05;
    }

    // FIX 4: Rewritten crash animation for a smooth, cinematic feel.
    // Phase 1 (first ~0.35s): The plane takes a brief "impact hit" — it jolts,
    //   tilts, and begins to fold, as if the collision just happened.
    // Phase 2 (remainder): The crumpling paper-ball falls with gravity, spinning
    //   naturally. The morph uses a smooth quintic ease so it never looks jerky.
    updateCrashAnimation(delta) {
        this._crashTimer += delta;

        const PHASE1_DURATION = 0.0; // Changed to 0 for instant fall

        if (this._crashTimer < PHASE1_DURATION) {
            // ── Phase 1: Impact jolt ──
            const p = this._crashTimer / PHASE1_DURATION; // 0 → 1
            // Ease out cubic so the jolt is sharp at first then settles
            const ease = 1 - Math.pow(1 - p, 3);

            // Tilt sideways in a random direction as if clipped by something
            this.group.rotation.z = THREE.MathUtils.lerp(
                this.group.rotation.z,
                this._impactDirX * 1.2,
                ease * 0.25
            );
            // Nose tips slightly upward on impact then pitches forward
            this.group.rotation.x = THREE.MathUtils.lerp(
                this.group.rotation.x,
                0.6,
                ease * 0.2
            );

            // Start crumpling gently during the impact phase (0 → 0.3)
            const earlyFactor = ease * 0.3;
            const positions = this.mesh.geometry.attributes.position.array;
            for (let i = 0; i < 45; i++) {
                positions[i] = THREE.MathUtils.lerp(
                    this.baseVertices[i],
                    this.crumpleTargets[i],
                    earlyFactor
                );
            }
            this.mesh.geometry.attributes.position.needsUpdate = true;
            this.mesh.geometry.computeVertexNormals();

        } else {
            // ── Phase 2: Falling paper ball ──
            const fallTime = this._crashTimer - PHASE1_DURATION;

            // Complete the crumple smoothly (0.3 → 1.0)
            if (this.crumpleFactor < 1) {
                this.crumpleFactor = Math.min(1, this.crumpleFactor + delta * 2.8);
                // Quintic ease-out: extremely smooth finish, no sudden snap
                const raw = Math.min((this.crumpleFactor + 0.3), 1); // start from 0.3 offset
                const ease = 1 - Math.pow(1 - Math.min(raw, 1), 5);

                const positions = this.mesh.geometry.attributes.position.array;
                for (let i = 0; i < 45; i++) {
                    positions[i] = THREE.MathUtils.lerp(
                        this.baseVertices[i],
                        this.crumpleTargets[i],
                        ease
                    );
                }
                this.mesh.geometry.attributes.position.needsUpdate = true;
                this.mesh.geometry.computeVertexNormals();
            }

            // Gravity — accelerates like a real falling object
            if (this.group.position.y > 0) {
                this.fallVelocity += 12 * delta;
                this.group.position.y -= this.fallVelocity * delta;

                // Smooth spin that ramps up as it falls (feels like tumbling)
                const spinRamp = Math.min(fallTime * 3, 1);
                this.group.rotation.x += (5 + spinRamp * 6) * delta;
                this.group.rotation.y += (4 + spinRamp * 4) * delta;
                this.group.rotation.z += (8 + spinRamp * 5) * delta;
            } else {
                // Lock on the ground — small bounce settle
                this.group.position.y = 0;
                // Dampen spin to a slow stop after landing
                this.group.rotation.x += 0.8 * delta;
                this.group.rotation.z += 0.5 * delta;
            }
        }
    }
}
