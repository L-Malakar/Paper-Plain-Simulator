/**
 * ═══════════════════════════════════════════════════════════════
 *  player.js — Paper Plane Player
 *  Manages geometry, hitbox, ghost mode, crash animation, map skin
 * ═══════════════════════════════════════════════════════════════
 */

import * as THREE from 'https://unpkg.com/three@0.136.0/build/three.module.js';

// Accent colours per map skin
const SKIN_ACCENTS = {
  classic: { accent: 0x00ff88, ghost: 0x88ffcc },
  night:   { accent: 0x00e5ff, ghost: 0x7c4dff },
};

export class Player {
  constructor(scene) {
    this.group = new THREE.Group();
    this._mapSkin = 'night';

    // ── Shared materials ───────────────────────────────────────
    this.paperMat = new THREE.MeshStandardMaterial({
      color: 0xe8eef4, side: THREE.DoubleSide, flatShading: true,
      emissive: 0x1a2a3a, emissiveIntensity: 0.3,
    });

    this.ghostMat = new THREE.MeshStandardMaterial({
      color: SKIN_ACCENTS.night.accent, side: THREE.DoubleSide, flatShading: true,
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
      const radius = 0.25 + Math.random() * 0.15;
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

    // ── Engine glow ────────────────────────────────────────────
    this.engineGlow = new THREE.PointLight(SKIN_ACCENTS.night.accent, 0.6, 4);
    this.engineGlow.position.set(0, 0, 0.5);
    this.group.add(this.engineGlow);

    // ── Trail afterimages (group children, fixed local offsets) ─
    this.trail = [];
    for (let i = 0; i < 3; i++) {
      const tMesh = new THREE.Mesh(
        planeGeo.clone(),
        new THREE.MeshBasicMaterial({
          color: SKIN_ACCENTS.night.accent, transparent: true, opacity: 0,
          wireframe: true, side: THREE.DoubleSide,
        })
      );
      tMesh.rotation.y = Math.PI;
      tMesh.position.z = (i + 1) * 0.22;
      tMesh.visible = false;
      this.group.add(tMesh);
      this.trail.push({ mesh: tMesh });
    }

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

  // ── Apply map skin colours ────────────────────────────────────
  setMapSkin(skinId) {
    this._mapSkin = skinId;
    const colors = SKIN_ACCENTS[skinId] || SKIN_ACCENTS.night;
    this.ghostMat.color.setHex(colors.accent);
    if (!this.isGhost) {
      this.engineGlow.color.setHex(colors.accent);
    }
    this.trail.forEach(t => t.mesh.material.color.setHex(colors.accent));
  }

  // ── Set plane type (scales geometry) ─────────────────────────
  setPlaneType(index) {
    const def      = this.planeDefs[index];
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

    // Sync trail meshes
    this.trail.forEach(t => {
      const tp = t.mesh.geometry.attributes.position.array;
      for (let i = 0; i < 45; i++) tp[i] = newVerts[i];
      t.mesh.geometry.attributes.position.needsUpdate = true;
    });

    // Resize hitbox
    this.hitbox.geometry.dispose();
    this.hitbox.geometry = new THREE.BoxGeometry(...def.hitbox);
  }

  // ── Ghost / invincibility ─────────────────────────────────────
  setGhost(active) {
    this.isGhost = active;
    const colors = SKIN_ACCENTS[this._mapSkin] || SKIN_ACCENTS.night;
    if (active) {
      this.engineGlow.color.setHex(colors.ghost);
      this.engineGlow.intensity = 1.2;
    } else {
      this.paperMat.transparent = false;
      this.paperMat.opacity     = 1;
      this.ghostMat.opacity     = 0;
      this.ghostMesh.position.set(0, 0, 0);
      this.engineGlow.color.setHex(colors.accent);
      this.engineGlow.intensity = 0.6;
      this.trail.forEach(t => { t.mesh.visible = false; t.mesh.material.opacity = 0; });
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
    this.group.position.y = 3 + Math.sin(t * 1.5) * 0.3;
    this.mesh.rotation.z = Math.sin(t * 2) * 0.08;
    this.mesh.rotation.x = Math.sin(t * 1.3) * 0.03;
    this.engineGlow.intensity = 0.4 + Math.sin(t * 3) * 0.2;
  }

  // ── In-flight animation ───────────────────────────────────────
  updateFlightAnimation(t, ctrl) {
    this.group.rotation.z = THREE.MathUtils.lerp(this.group.rotation.z, ctrl.targetBank,  0.1);
    this.group.rotation.x = THREE.MathUtils.lerp(this.group.rotation.x, ctrl.targetPitch, 0.1);
    this.mesh.rotation.z  = Math.sin(t * 5) * 0.05;

    // Engine glow pulse
    this.engineGlow.intensity = 0.5 + Math.sin(t * 8) * 0.15;

    // Trail afterimages
    const baseOpacity = this.isGhost ? 0.18 : 0.08;
    this.trail.forEach((tr, i) => {
      const target = baseOpacity * (1 - i * 0.3);
      tr.mesh.material.opacity = THREE.MathUtils.lerp(tr.mesh.material.opacity, target, 0.08);
      tr.mesh.visible = tr.mesh.material.opacity > 0.005;
      if (!tr.mesh.visible) return;
      tr.mesh.rotation.x = this.mesh.rotation.x;
      tr.mesh.rotation.z = this.mesh.rotation.z;
      tr.mesh.scale.setScalar(1 - i * 0.12);
    });
  }

  // ── Crash animation ───────────────────────────────────────────
  updateCrashAnimation(delta) {
    this._crashTimer += delta;

    // Kill trail on crash
    this.trail.forEach(t => { t.mesh.visible = false; t.mesh.material.opacity = 0; });

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
