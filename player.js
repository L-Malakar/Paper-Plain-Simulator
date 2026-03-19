import * as THREE from 'https://unpkg.com/three@0.136.0/build/three.module.js';

export class Player {
    constructor(scene) {
        this.group = new THREE.Group();
        this.paperMat = new THREE.MeshStandardMaterial({ color: 0xe0e0e0, side: THREE.DoubleSide, flatShading: true });
        
        const vertices = new Float32Array([
            0, 0, 0.8, -0.8, 0.2, -0.4, 0, 0, -0.2,     
            0, 0, 0.8, 0.8, 0.2, -0.4, 0, 0, -0.2,     
            0, 0, 0.8, 0, -0.3, -0.2, 0, 0, -0.2,      
            0, 0, -0.2, -0.3, 0.0, -0.5, 0, 0.1, -0.3,
            0, 0, -0.2, 0.3, 0.0, -0.5, 0, 0.1, -0.3
        ]);
        const indices = [0, 1, 2, 3, 5, 4, 6, 7, 8, 9, 10, 11, 12, 14, 13];
        const planeGeo = new THREE.BufferGeometry();
        planeGeo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        planeGeo.setIndex(indices);
        planeGeo.computeVertexNormals();

        this.mesh = new THREE.Mesh(planeGeo, this.paperMat);
        this.mesh.rotation.y = Math.PI; 
        this.group.add(this.mesh);
        this.group.position.set(-5, 3, 0);
        scene.add(this.group);
    }

    updateMenuAnimation(t) {
        this.mesh.rotation.z = Math.sin(t * 2) * 0.1;
    }

    updateFlightAnimation(t, ctrl) {
        this.group.rotation.z = THREE.MathUtils.lerp(this.group.rotation.z, ctrl.targetBank, 0.1);
        this.group.rotation.x = THREE.MathUtils.lerp(this.group.rotation.x, ctrl.targetPitch, 0.1);
        this.mesh.rotation.z = Math.sin(t * 5) * 0.05;
    }
}