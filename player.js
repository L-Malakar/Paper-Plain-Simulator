/**
 * ═══════════════════════════════════════════════════════════════
 *  player.js — Paper Plane Player
 *  Manages geometry, hitbox, ghost mode, crash animation
 * ═══════════════════════════════════════════════════════════════
 */

import * as THREE from 'https://unpkg.com/three@0.136.0/build/three.module.js';

export class Player {
  constructor(scene) {
    this.group = new THREE.Group();

    // ── Shared materials ───────────────────────────────────────
    this.paperMat = new THREE.MeshStandardMaterial({
      color: 0xe8eef4, side: THREE.DoubleSide, flatShading: true,
    });

    this.ghostMat = new THREE.MeshStandardMaterial({
      color: 0x00ff88, side: THREE.DoubleSide, flatShading: true,
      transparent: true, opacity: 0, wireframe: true,
    });

    // ── Base vertices (Classic paper-plane shape, 5 tris × 9 floats) ──
    this.absoluteBaseVerts = new Float32Array([
      0, 0, 0.8,  -0.8, 0.2, -0.4,  0, 0, -0.2,   // left wing top
      0, 0, 0.8,   0.8, 0.2, -0.4,  0, 0, -0.2,   // right wing top
      0, 0, 0.8,   0,  -0.3, -0.2,  0, 0, -0.2,   // belly
      0, 0, -0.2, -0.3, 0.0, -0.5,  0, 0.1,-0.3,  // left tail
      0, 0, -0.2,  0.3, 0.0, -0.5,  0, 0.1,-0.3,  // right tail
    ]);
    this.baseVertices = new Float32Array(this.absoluteBaseVerts);

    // ── Random crumple target (for crash animation) ────────────
    this.crumpleTargets = new Float32Array(45);
    for (let i = 0; i < 45; i += 3) {
      const theta  = Math.random() * 2 * Math.PI;
      const phi    = Math.acos(2 * Math.random() - 1);
      const radius = 0.15 + Math.random() * 0.05;
      this.crumpleTargets[i]   = radius * Math.sin(phi) * Math.cos(theta);
      this.crumpleTargets[i+1] = radius * Math.sin(phi) * Math.sin(theta);
      this.crumpleTargets[i+2] = radius * Math.cos(phi);
    }

    // ── Build geometry ─────────────────────────────────────────
    const indices = [0,1,2, 3,5,4, 6,7,8, 9,10,11, 12,14,13];
    const planeGeo = new THREE.BufferGeometry();
    planeGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.baseVertices), 3));
    planeGeo.setIndex(indices);
    planeGeo.computeVertexNormals();

    this.mesh = new THREE.Mesh(planeGeo, this.paperMat);
    this.mesh.rotation.y = Math.PI;
    this.group.add(this.mesh);

    // Ghost overlay
    this.ghostMesh = new THREE.Mesh(planeGeo.clone(), this.ghostMat);
    this.ghostMesh.rotation.y = Math.PI;
    this.group.add(this.ghostMesh);

    // ── Plane type definitions ─────────────────────────────────
    this.planeDefs = [
      { name: 'CLASSIC',  price: 0,   scale: [1.0, 1.0, 1.0], hitbox: [1.4, 0.35, 1.0] },
      { name: 'DART',     price: 50,  scale: [0.5, 1.0, 1.5], hitbox: [0.7, 0.35, 1.5] },
      { name: 'GLIDER',   price: 100, scale: [1.8, 1.0, 0.6], hitbox: [2.5, 0.35, 0.6] },
      { name: 'JET',      price: 200, scale: [1.2, 1.0, 1.1], hitbox: [1.6, 0.35, 1.1] },
      { name: 'BULLDOG',  price: 500, scale: [1.0, 1.0, 0.5], hitbox: [1.4, 0.35, 0.5] },
    ];

    // ── Invisible hitbox ───────────────────────────────────────
    const hitboxGeo = new THREE.BoxGeometry(1.4, 0.35, 1.0);
    const hitboxMat = new THREE.MeshBasicMaterial({ visible: false });
    this.hitbox     = new THREE.Mesh(hitboxGeo, hitboxMat);
    this.group.add(this.hitbox);

    // ── Initial placement ──────────────────────────────────────
    this.group.position.set(-5, 3, 0);
    scene.add(this.group);

    // ── Animation state ────────────────────────────────────────
    this.crumpleFactor = 0;
    this.fallVelocity  = 0;
    this._crashTimer   = 0;
    this._glitchTimer  = 0;
    this.isGhost       = false;
  }

  // ── Set plane type (scales geometry) ─────────────────────────
  setPlaneType(index) {
    const def     = this.planeDefs[index];
    const newVerts = new Float32Array(this.absoluteBaseVerts);

    for (let i = 0; i < 45; i += 3) {
      newVerts[i]   *= def.scale[0];
      newVerts[i+1] *= def.scale[1];
      newVerts[i+2] *= def.scale[2];
    }
    this.baseVertices = newVerts;

    // Sync main mesh
    const pos = this.mesh.geometry.attributes.position.array;
    for (let i = 0; i < 45; i++) pos[i] = newVerts[i];
    this.mesh.geometry.attributes.position.needsUpdate = true;
    this.mesh.geometry.computeVertexNormals();

    // Sync ghost mesh
    const gpos = this.ghostMesh.geometry.attributes.position.array;
    for (let i = 0; i < 45; i++) gpos[i] = newVerts[i];
    this.ghostMesh.geometry.attributes.position.needsUpdate = true;

    // Resize hitbox
    this.hitbox.geometry.dispose();
    this.hitbox.geometry = new THREE.BoxGeometry(...def.hitbox);
  }

  // ── Ghost / invincibility ─────────────────────────────────────
  setGhost(active) {
    this.isGhost = active;
    if (!active) {
      this.paperMat.transparent = false;
      this.paperMat.opacity     = 1;
      this.ghostMat.opacity     = 0;
      this.ghostMesh.position.set(0, 0, 0);
    }
  }

  // ── Ghost glitch animation ────────────────────────────────────
  updateGlitch(t) {
    if (!this.isGhost) return;
    const flicker = 0.5 + 0.35 * Math.sin(t * 28 + Math.sin(t * 73));
    this.paperMat.transparent = true;
    this.paperMat.opacity     = flicker;
    this.ghostMat.opacity     = 0.35 + 0.25 * Math.sin(t * 40);
    this.ghostMesh.position.x = Math.sin(t * 60) * 0.08;
    this.ghostMesh.position.y = Math.cos(t * 55) * 0.05;

    this._glitchTimer -= 1;
    if (this._glitchTimer <= 0) {
      this._glitchTimer = 3 + Math.floor(Math.random() * 8);
      this.group.position.x += (Math.random() - 0.5) * 0.06;
    }
  }

  // ── Menu idle animation ───────────────────────────────────────
  updateMenuAnimation(t) {
    this.mesh.rotation.z = Math.sin(t * 2) * 0.1;
  }

  // ── In-flight animation ───────────────────────────────────────
  updateFlightAnimation(t, ctrl) {
    this.group.rotation.z = THREE.MathUtils.lerp(this.group.rotation.z, ctrl.targetBank,  0.1);
    this.group.rotation.x = THREE.MathUtils.lerp(this.group.rotation.x, ctrl.targetPitch, 0.1);
    this.mesh.rotation.z  = Math.sin(t * 5) * 0.05; // subtle wing wobble
  }

  // ── Crash animation ───────────────────────────────────────────
  updateCrashAnimation(delta) {
    this._crashTimer += delta;

    // Crumple geometry
    if (this.crumpleFactor < 1) {
      this.crumpleFactor = Math.min(1, this.crumpleFactor + delta * 2.8);
      const raw  = Math.min(this.crumpleFactor + 0.3, 1);
      const ease = 1 - Math.pow(1 - Math.min(raw, 1), 5);

      const positions = this.mesh.geometry.attributes.position.array;
      for (let i = 0; i < 45; i++) {
        positions[i] = THREE.MathUtils.lerp(this.baseVertices[i], this.crumpleTargets[i], ease);
      }
      this.mesh.geometry.attributes.position.needsUpdate = true;
      this.mesh.geometry.computeVertexNormals();
    }

    // Falling physics + tumbling
    if (this.group.position.y > 0) {
      this.fallVelocity += 12 * delta;
      this.group.position.y -= this.fallVelocity * delta;

      const spinRamp = Math.min(this._crashTimer * 3, 1);
      this.group.rotation.x += (5 + spinRamp * 6) * delta;
      this.group.rotation.y += (4 + spinRamp * 4) * delta;
      this.group.rotation.z += (8 + spinRamp * 5) * delta;
    } else {
      this.group.position.y  = 0;
      this.group.rotation.x += 0.8 * delta;
      this.group.rotation.z += 0.5 * delta;
    }
  }
}
