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
        for (let i = 0; i < 3; i++) {
            chunkObstaclesData.push({
                h: Math.random() * 8 + 2,
                xRel: Math.random() * 20 - 10,
                zRel: (Math.random() * this.chunkSize - this.chunkSize / 2)
            });
        }

        for (let xIdx = -3; xIdx <= 3; xIdx++) {
            const grid = new THREE.GridHelper(this.chunkSize, 20, 0x00ff41, 0x111111);
            grid.position.x = xIdx * this.chunkSize;
            group.add(grid);

            if (xIdx >= -1 && xIdx <= 1) {
                chunkObstaclesData.forEach(data => {
                    const obsGeo = new THREE.BoxGeometry(1.2, data.h, 1.2);
                    const obsMat = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 0.5 });
                    const mesh = new THREE.Mesh(obsGeo, obsMat);
                    mesh.position.set((xIdx * this.chunkSize) + data.xRel, data.h / 2 - 0.5, data.zRel);
                    group.add(mesh);
                    this.obstacles.push(mesh);
                });
            }
        }
        group.position.z = zOffset;
        this.scene.add(group);
        return group;
    }

    update(speed, worldShiftX) {
        this.chunks.forEach((chunk) => {
            chunk.position.z += speed;
            chunk.position.x = worldShiftX;
            if (chunk.position.z > this.chunkSize) {
                chunk.position.z -= this.chunkSize * this.chunks.length;
            }
        });
    }
}