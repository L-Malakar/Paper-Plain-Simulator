import * as THREE from 'https://unpkg.com/three@0.136.0/build/three.module.js';

export class WorldManager {
    constructor(scene) {
        this.scene = scene;
        this.chunks = [];
        this.obstacles = [];
        this.chunkSize = 40;

        for (let i = 0; i < 8; i++) {
            this.chunks.push(this.createChunk(-i * this.chunkSize));
        }
    }

    createChunk(zOffset) {
        const group = new THREE.Group();
        const chunkObstaclesData = [];
        
        // Increased count to fill the wider spawn area
        const obstacleCount = 10; 

        for (let i = 0; i < obstacleCount; i++) {
            const rand = Math.random();
            let category = "basic";
            if (rand > 0.95) category = "impossible";
            else if (rand > 0.8) category = "hard";
            else if (rand > 0.5) category = "moving";

            chunkObstaclesData.push({
                category: category,
                type: Math.floor(Math.random() * 10),
                // FIX: Spread obstacles across the FULL width of the tile (40 units)
                // instead of just the center 24 units.
                xRel: Math.random() * this.chunkSize - (this.chunkSize / 2),
                zRel: (Math.random() * this.chunkSize - this.chunkSize / 2),
                yRel: Math.random() * 5 + 0.5,
                color: this.getRandomColor(),
                phase: Math.random() * Math.PI * 2
            });
        }

        for (let xIdx = -3; xIdx <= 3; xIdx++) {
            const grid = new THREE.GridHelper(this.chunkSize, 20, 0x00ff41, 0x111111);
            grid.position.x = xIdx * this.chunkSize;
            group.add(grid);

            chunkObstaclesData.forEach(data => {
                const mesh = this.createObstacleMesh(data, xIdx);
                if (mesh) {
                    group.add(mesh);
                    this.obstacles.push(mesh);
                }
            });
        }
        group.position.z = zOffset;
        this.scene.add(group);
        return group;
    }

    getRandomColor() {
        const colors = [0xff0000, 0xff00ff, 0xff8800, 0x00ffff, 0xffff00];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    createObstacleMesh(data, xIdx) {
        let geo;
        let mesh;
        const obsMat = new THREE.MeshStandardMaterial({ 
            color: data.color, 
            emissive: data.color, 
            emissiveIntensity: 0.5,
            flatShading: true 
        });

        switch (data.type) {
            case 0: geo = new THREE.BoxGeometry(1.2, 12, 1.2); break;
            case 1: geo = new THREE.SphereGeometry(1.2, 8, 8); break;
            case 2: geo = new THREE.BoxGeometry(4, 0.8, 0.8); break;
            case 3: geo = new THREE.CylinderGeometry(0.5, 0.5, 6, 8); break;
            case 4: geo = new THREE.TorusGeometry(1.5, 0.4, 8, 16); break;
            case 5: geo = new THREE.ConeGeometry(1.5, 4, 8); break;
            default: geo = new THREE.BoxGeometry(2, 2, 2); break;
        }

        mesh = new THREE.Mesh(geo, obsMat);
        mesh.userData = {
            category: data.category,
            phase: data.phase,
            baseY: data.yRel,
            baseX: (xIdx * this.chunkSize) + data.xRel
        };
        
        mesh.position.set(mesh.userData.baseX, mesh.userData.baseY, data.zRel);
        return mesh;
    }

    update(speed, worldShiftX) {
        this.chunks.forEach((chunk) => {
            chunk.position.z += speed;
            chunk.position.x = ((worldShiftX % this.chunkSize) + this.chunkSize) % this.chunkSize;

            chunk.children.forEach(child => {
                if (child.type === "Mesh" && child.userData.category) {
                    const ud = child.userData;
                    child.rotation.y += 0.02;
                    child.rotation.z += 0.01;

                    if (ud.category === "moving") {
                        child.position.x = ud.baseX + Math.sin(Date.now() * 0.002 + ud.phase) * 5;
                    } else if (ud.category === "hard") {
                        child.position.y = ud.baseY + Math.cos(Date.now() * 0.003 + ud.phase) * 2;
                    } else if (ud.category === "impossible") {
                        child.rotation.x += 0.05;
                    }
                }
            });

            if (chunk.position.z > this.chunkSize) {
                chunk.position.z -= this.chunkSize * this.chunks.length;
            }
        });
    }
}
