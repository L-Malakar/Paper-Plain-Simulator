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
        
        // Generate spherical target points for a smoother "paper ball" shape
        this.crumpleTargets = new Float32Array(15);
        for(let i = 0; i < 15; i += 3) {
            // Distribute points on a sphere to resemble a crushed round ball
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
        const hitboxGeo = new THREE.BoxGeometry(0.4, 0.2, 0.6); 
        const hitboxMat = new THREE.MeshBasicMaterial({ visible: false }); 
        this.hitbox = new THREE.Mesh(hitboxGeo, hitboxMat);
        this.group.add(this.hitbox);

        this.group.position.set(-5, 3, 0);
        scene.add(this.group);

        // Crash Animation States
        this.crumpleFactor = 0;
        this.fallVelocity = 0;
    }

    updateMenuAnimation(t) {
        this.mesh.rotation.z = Math.sin(t * 2) * 0.1;
    }

    updateFlightAnimation(t, ctrl) {
        this.group.rotation.z = THREE.MathUtils.lerp(this.group.rotation.z, ctrl.targetBank, 0.1);
        this.group.rotation.x = THREE.MathUtils.lerp(this.group.rotation.x, ctrl.targetPitch, 0.1);
        this.mesh.rotation.z = Math.sin(t * 5) * 0.05;
    }

    updateCrashAnimation(delta) {
        // 1. Morph plane into a round paper ball smoothly
        if (this.crumpleFactor < 1) {
            this.crumpleFactor += delta * 3.5; // Slower, smoother transition speed
            if (this.crumpleFactor > 1) this.crumpleFactor = 1;

            // Cubic ease-out for a much smoother, natural crumple effect
            const easeFactor = 1 - Math.pow(1 - this.crumpleFactor, 3);

            const positions = this.mesh.geometry.attributes.position.array;
            for(let i = 0; i < 15; i++) {
                positions[i] = THREE.MathUtils.lerp(this.baseVertices[i], this.crumpleTargets[i], easeFactor);
            }
            this.mesh.geometry.attributes.position.needsUpdate = true;
        }

        // 2. Fall to the ground and spin out of control smoothly
        if (this.group.position.y > 0) {
            this.fallVelocity += 15 * delta; // Slightly reduced simulated gravity
            this.group.position.y -= this.fallVelocity * delta;
            
            // Smoother, slightly slower random spinning
            this.group.rotation.x += 8 * delta;
            this.group.rotation.y += 6 * delta;
            this.group.rotation.z += 12 * delta;
        } else {
            // Lock position on the ground
            this.group.position.y = 0;
        }
    }
}
