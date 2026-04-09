import * as THREE from 'https://unpkg.com/three@0.136.0/build/three.module.js';

export class CollectableManager {
    constructor(scene, isMobile = false) {
        this.scene = scene;
        this.isMobile = isMobile;
        this.chunkSize = 40;
        this.chunks = [];
        this.items = []; 

        // Option A: Realistic 3D Coin Model (Highly Optimized)
        // INCREASED size slightly for better visibility
        const coinGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.1, 16);
        coinGeo.rotateX(Math.PI / 2); // Stand it upright
        const coinMat = new THREE.MeshStandardMaterial({
            color: 0xffea00,       // Brighter Yellow/Gold
            metalness: 0.8,        // Highly reflective
            roughness: 0.1,        // Very shiny
            emissive: 0xffaa00,    // Strong amber/gold glow
            emissiveIntensity: 2.5 // Heavily increased intensity to pop in the dark scene
        });

        this.sharedGeo = coinGeo;
        this.sharedMat = coinMat;

        for (let i = 0; i < 8; i++) {
            this.chunks.push(this.createChunk(-i * this.chunkSize));
        }
    }

    createChunk(zOffset) {
        const group = new THREE.Group();
        const coinCount = this.isMobile ? 2 : 4; // Mobile optimization

        for (let i = 0; i < coinCount; i++) {
            const mesh = new THREE.Mesh(this.sharedGeo, this.sharedMat);
            
            const xRel = Math.random() * this.chunkSize - (this.chunkSize / 2);
            const zRel = Math.random() * this.chunkSize - (this.chunkSize / 2);
            const yRel = Math.random() * 4 + 1.0;

            // Align roughly with the obstacle grid lanes
            const xIdx = Math.floor(Math.random() * 7) - 3;
            
            mesh.userData = {
                category: "coin",
                baseY: yRel,
                baseX: (xIdx * this.chunkSize) + xRel
            };

            mesh.position.set(mesh.userData.baseX, mesh.userData.baseY, zRel);
            group.add(mesh);
            this.items.push(mesh);
        }

        group.position.z = zOffset;
        this.scene.add(group);
        return group;
    }

    update(speed, worldShiftX, elapsed) {
        this.chunks.forEach((chunk) => {
            chunk.position.z += speed;
            chunk.position.x = worldShiftX;

            chunk.children.forEach(child => {
                if (child.visible) {
                    child.rotation.y += 0.05; // Spin on axis
                    
                    // ADDED: Pulsating scale animation to draw the player's eye
                    const pulse = 1.0 + Math.sin(elapsed * 6) * 0.15;
                    child.scale.set(pulse, pulse, pulse);
                }
            });

            if (chunk.position.z > this.chunkSize) {
                chunk.position.z -= this.chunkSize * this.chunks.length;
                // Re-enable collected coins when chunk loops back
                chunk.children.forEach(child => {
                    child.visible = true;
                    child.position.y = child.userData.baseY;
                });
            }
        });
    }

    dispose() {
        this.chunks.forEach(chunk => this.scene.remove(chunk));
        this.sharedGeo.dispose();
        this.sharedMat.dispose();
        this.items = [];
    }
}
