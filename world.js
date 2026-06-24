/**
 * ═══════════════════════════════════════════════════════════════
 *  world.js — WorldManager
 *  Manages terrain chunks, obstacles, progressive difficulty, map skins.
 * ═══════════════════════════════════════════════════════════════
 */

import * as THREE from 'https://unpkg.com/three@0.136.0/build/three.module.js';

// ── Obstacle catalogue ────────────────────────────────────────
const OBSTACLE_DEFS = [
  { tier: 0, make: () => new THREE.BoxGeometry(1.2, 10, 1.2)             },
  { tier: 0, make: () => new THREE.SphereGeometry(1.1, 8, 8)             },
  { tier: 0, make: () => new THREE.ConeGeometry(1.3, 4, 8)               },
  { tier: 0, make: () => new THREE.CylinderGeometry(0.5, 0.5, 6, 8)     },
  { tier: 1, make: () => new THREE.BoxGeometry(5, 0.6, 0.6)              },
  { tier: 1, make: () => new THREE.TorusGeometry(1.4, 0.35, 8, 16)      },
  { tier: 1, make: () => new THREE.OctahedronGeometry(1.2, 0)            },
  { tier: 2, make: () => new THREE.TorusKnotGeometry(0.9, 0.28, 80, 12) },
  { tier: 2, make: () => new THREE.BoxGeometry(0.6, 8, 4)               },
  { tier: 2, make: () => new THREE.IcosahedronGeometry(1.1, 0)          },
  { tier: 3, make: () => new THREE.DodecahedronGeometry(1.2, 0)         },
  { tier: 3, make: () => new THREE.BoxGeometry(3, 3, 0.5)               },
  { tier: 3, make: () => new THREE.CylinderGeometry(2, 0.3, 5, 6)      },
];

// ── Map skin configurations ────────────────────────────────────
export const SKIN_CONFIGS = {
  classic: {
    label: 'CLASSIC',
    desc:  'Original neon void',
    price: 0,
    img: 'https://yt3.ggpht.com/kG4oRn-w3vaKb5JPH4ocCTRIBszKJL1Axis4tiNNTqXkLLvObjEf6a_UH1bsCPZnyRcCjco04OXHtLQ=s640-c-fcrop64=1,38130000c7ecffff-rw-nd-v1',
    bg:        0x030508,
    fogColor:  0x030508,
    fogNear:   6,
    fogFar:    50,
    gridColor1: 0x00ff88,
    gridColor2: 0x0a0f0a,
    gridDiv:   20,
    colors: [0xff2255, 0xff00cc, 0xff8800, 0x00ccff, 0xffff00, 0xcc00ff, 0x00ffcc],
    emissiveIntensity: 0.6,
    spinMult:     1.0,
    hasGround:    false,
    hasStars:     false,
    baseDensity:  { mobile: 6, desktop: 12 },
    rimLight:   { color: 0x00ccff, intensity: 0.4 },
    hemiLight:  { sky: 0xc8e6ff, ground: 0x1a2a1a, intensity: 0.5 },
  },
  night: {
    label: 'NIGHT',
    desc:  'Deep space traverse',
    price: 800,
    img: 'https://yt3.ggpht.com/zAn-HG7qTNlHdvXCONin8aXkuoTlgtE_APljrNLP1yTiw4RDxBqOxKrCjwCPmbfK-kKGPEAjN_w=s640-c-fcrop64=1,38130000c7ecffff-rw-nd-v1',
    bg:        0x06090f,
    fogColor:  0x06090f,
    fogNear:   8,
    fogFar:    55,
    gridColor1: 0x0a2a3a,
    gridColor2: 0x080e16,
    gridDiv:   16,
    colors: [0x00e5ff, 0x00bcd4, 0x0097a7, 0x7c4dff, 0x651fff, 0xff1744],
    emissiveIntensity: 0.25,
    spinMult:     0.4,
    hasGround:    true,
    hasStars:     true,
    baseDensity:  { mobile: 5, desktop: 9 },
    rimLight:   { color: 0x7c4dff, intensity: 0.35 },
    hemiLight:  { sky: 0x8eb8e0, ground: 0x0a1020, intensity: 0.45 },
  },
  beach: {
    label: 'BEACH SUNSET',
    desc:  'Golden shores at dusk',
    price: 1000,
    img: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=640&q=80',
    bg:        0x1a0a2e,
    fogColor:  0xff6b35,
    fogNear:   10,
    fogFar:    48,
    gridColor1: 0xf4a261,
    gridColor2: 0xe76f51,
    gridDiv:   18,
    colors: [0xff6b35, 0xf4a261, 0xe9c46a, 0x2a9d8f, 0x264653, 0xff9f1c, 0xffbf69],
    emissiveIntensity: 0.45,
    spinMult:     0.6,
    hasGround:    true,
    hasSand:      true,
    hasStars:     false,
    hasClouds:    true,
    baseDensity:  { mobile: 5, desktop: 9 },
    rimLight:   { color: 0xff6b35, intensity: 0.6 },
    hemiLight:  { sky: 0xffb347, ground: 0xc2956c, intensity: 0.7 },
  },
};

export class WorldManager {
  constructor(scene, isMobile = false, skinId = 'night') {
    this.scene     = scene;
    this.chunks    = [];
    this.obstacles = [];
    this.chunkSize = 40;
    this.isMobile  = isMobile;
    this.distance  = 0;
    this.skin      = SKIN_CONFIGS[skinId] || SKIN_CONFIGS.night;

    // ── Ground plane ───────────────────────────────────────────
    if (this.skin.hasGround) {
      const groundGeo = new THREE.PlaneGeometry(400, 400);
      let groundMat;
      if (this.skin.hasSand) {
        // Beach: gradient from sand near camera to ocean blue far away
        groundMat = new THREE.MeshStandardMaterial({
          color: 0xc2956c, roughness: 0.9, metalness: 0.0,
        });
      } else {
        groundMat = new THREE.MeshStandardMaterial({
          color: 0x060a10, roughness: 0.95, metalness: 0.05,
        });
      }
      this.ground = new THREE.Mesh(groundGeo, groundMat);
      this.ground.rotation.x = -Math.PI / 2;
      this.ground.position.y = -0.05;
      this.scene.add(this.ground);

      // Ocean plane (beach only) — sits just below sand, offset forward
      if (this.skin.hasSand) {
        const seaGeo = new THREE.PlaneGeometry(400, 200);
        const seaMat = new THREE.MeshStandardMaterial({
          color: 0x2a9d8f, roughness: 0.1, metalness: 0.4,
          transparent: true, opacity: 0.82,
        });
        this.sea = new THREE.Mesh(seaGeo, seaMat);
        this.sea.rotation.x = -Math.PI / 2;
        this.sea.position.set(0, -0.04, -100);
        this.scene.add(this.sea);
      } else {
        this.sea = null;
      }
    } else {
      this.ground = null;
      this.sea    = null;
    }

    // ── Star field ─────────────────────────────────────────────
    if (this.skin.hasStars) {
      const starCount = this.isMobile ? 500 : 1500;
      const starPos   = new Float32Array(starCount * 3);
      for (let i = 0; i < starCount * 3; i += 3) {
        starPos[i]   = (Math.random() - 0.5) * 160;
        starPos[i+1] = Math.random() * 50 + 5;
        starPos[i+2] = (Math.random() - 0.5) * 300 - 60;
      }
      const starGeo = new THREE.BufferGeometry();
      starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
      const starMat = new THREE.PointsMaterial({
        color: 0xc8d8e8, size: 0.12, sizeAttenuation: true,
        transparent: true, opacity: 0.55,
      });
      this.stars = new THREE.Points(starGeo, starMat);
      this.scene.add(this.stars);
    } else {
      this.stars = null;
    }

    // ── Cloud layer (beach only) ───────────────────────────────
    if (this.skin.hasClouds) {
      const cloudCount = this.isMobile ? 12 : 24;
      this.clouds = [];
      for (let i = 0; i < cloudCount; i++) {
        const puffs = 3 + Math.floor(Math.random() * 3);
        const cloudGroup = new THREE.Group();
        for (let p = 0; p < puffs; p++) {
          const r   = 0.8 + Math.random() * 1.2;
          const geo = new THREE.SphereGeometry(r, 7, 5);
          const mat = new THREE.MeshStandardMaterial({
            color: 0xfff5e4, transparent: true,
            opacity: 0.55 + Math.random() * 0.25,
            roughness: 1, metalness: 0,
          });
          const puff = new THREE.Mesh(geo, mat);
          puff.position.set(
            (Math.random() - 0.5) * r * 2.5,
            (Math.random() - 0.5) * r * 0.5,
            (Math.random() - 0.5) * r
          );
          cloudGroup.add(puff);
        }
        cloudGroup.position.set(
          (Math.random() - 0.5) * 80,
          6 + Math.random() * 6,
          -20 - Math.random() * 120
        );
        cloudGroup.userData.speed = 0.008 + Math.random() * 0.012;
        this.scene.add(cloudGroup);
        this.clouds.push(cloudGroup);
      }
    } else {
      this.clouds = null;
    }

    // Seed initial chunks ahead of the camera
    for (let i = 0; i < 8; i++) {
      this.chunks.push(this._createChunk(-i * this.chunkSize));
    }
  }

  // ── Clean teardown ───────────────────────────────────────────
  dispose() {
    this.chunks.forEach(chunk => {
      chunk.children.forEach(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
      this.scene.remove(chunk);
    });
    this.chunks = [];
    this.obstacles = [];

    if (this.ground) {
      this.ground.geometry.dispose();
      this.ground.material.dispose();
      this.scene.remove(this.ground);
      this.ground = null;
    }
    if (this.stars) {
      this.stars.geometry.dispose();
      this.stars.material.dispose();
      this.scene.remove(this.stars);
      this.stars = null;
    }
    if (this.sea) {
      this.sea.geometry.dispose();
      this.sea.material.dispose();
      this.scene.remove(this.sea);
      this.sea = null;
    }
    if (this.clouds) {
      this.clouds.forEach(cg => {
        cg.children.forEach(p => {
          if (p.geometry) p.geometry.dispose();
          if (p.material) p.material.dispose();
        });
        this.scene.remove(cg);
      });
      this.clouds = null;
    }
  }

  // ── Tier gating ───────────────────────────────────────────────
  _maxTier() {
    if (this.distance >= 1000) return 3;
    if (this.distance >= 500)  return 2;
    if (this.distance >= 200)  return 1;
    return 0;
  }

  // ── Chunk creation ─────────────────────────────────────────────
  _createChunk(zOffset) {
    const group      = new THREE.Group();
    const maxTier    = this._maxTier();
    const placements = this._generatePlacements(maxTier);

    for (let xIdx = -3; xIdx <= 3; xIdx++) {
      const grid = new THREE.GridHelper(
        this.chunkSize, this.skin.gridDiv,
        this.skin.gridColor1, this.skin.gridColor2
      );
      grid.position.x = xIdx * this.chunkSize;
      group.add(grid);

      placements.forEach(p => {
        const mesh = this._makeMesh(p, xIdx);
        if (mesh) { group.add(mesh); this.obstacles.push(mesh); }
      });
    }

    group.position.z = zOffset;
    this.scene.add(group);
    return group;
  }

  // ── Obstacle placement generator ──────────────────────────────
  _generatePlacements(maxTier) {
    const available   = OBSTACLE_DEFS.filter(d => d.tier <= maxTier);
    const densityMult = 1 + maxTier * 0.2;
    const count       = Math.floor(
      (this.isMobile ? this.skin.baseDensity.mobile : this.skin.baseDensity.desktop) * densityMult
    );
    const placements  = [];

    for (let i = 0; i < count; i++) {
      const def      = available[Math.floor(Math.random() * available.length)];
      const color    = this.skin.colors[Math.floor(Math.random() * this.skin.colors.length)];
      const catRoll  = Math.random();
      let   category = 'static';

      if      (catRoll > 0.96 && maxTier >= 2) category = 'impossible';
      else if (catRoll > 0.85 && maxTier >= 2) category = 'sweeping';
      else if (catRoll > 0.72 && maxTier >= 1) category = 'bobbing';
      else if (catRoll > 0.55 && maxTier >= 1) category = 'moving';
      else if (catRoll > 0.40) category = 'spinning';

      const yRel = Math.random() < 0.7
        ? 1.5 + Math.random() * 3.0
        : 0.5 + Math.random() * 4.5;

      placements.push({
        def, category, color,
        xRel:  Math.random() * this.chunkSize - this.chunkSize / 2,
        zRel:  Math.random() * this.chunkSize - this.chunkSize / 2,
        yRel:  yRel,
        phase: Math.random() * Math.PI * 2,
        speed: 0.8 + Math.random() * 1.4,
      });
    }
    return placements;
  }

  // ── Mesh factory ──────────────────────────────────────────────
  _makeMesh(p, xIdx) {
    const geo       = p.def.make();
    const styleRoll = Math.random();
    const ei        = this.skin.emissiveIntensity;
    let mat;

    if (styleRoll > 0.88) {
      mat = new THREE.MeshStandardMaterial({
        color: p.color, emissive: p.color, emissiveIntensity: ei + 0.1,
        wireframe: true, transparent: true, opacity: 0.55,
      });
    } else if (styleRoll > 0.76) {
      mat = new THREE.MeshStandardMaterial({
        color: p.color, emissive: p.color, emissiveIntensity: ei * 0.6,
        transparent: true, opacity: 0.28, flatShading: true,
      });
    } else {
      mat = new THREE.MeshStandardMaterial({
        color: p.color, emissive: p.color, emissiveIntensity: ei,
        flatShading: true,
      });
    }

    const mesh  = new THREE.Mesh(geo, mat);
    const baseX = (xIdx * this.chunkSize) + p.xRel;

    mesh.userData = { category: p.category, phase: p.phase, speed: p.speed, baseY: p.yRel, baseX };
    mesh.position.set(baseX, p.yRel, p.zRel);
    return mesh;
  }

  // ── Per-frame update ──────────────────────────────────────────
  update(speed, worldShiftX, elapsed) {
    const sm = this.skin.spinMult;

    if (this.ground) {
      this.ground.position.z += speed;
      this.ground.position.x  = worldShiftX;
    }
    if (this.sea) {
      this.sea.position.z += speed;
      this.sea.position.x  = worldShiftX;
      // Gentle wave shimmer
      this.sea.material.opacity = 0.78 + Math.sin(elapsed * 1.4) * 0.06;
    }
    if (this.stars) {
      this.stars.position.z += speed * 0.12;
      this.stars.position.x  = worldShiftX * 0.3;
    }
    if (this.clouds) {
      this.clouds.forEach(cg => {
        cg.position.x -= cg.userData.speed * sm;
        // Wrap clouds horizontally
        if (cg.position.x < -50) cg.position.x = 50;
        // Gentle bob
        cg.position.y += Math.sin(elapsed * 0.4 + cg.userData.speed * 100) * 0.002;
      });
    }

    this.chunks.forEach(chunk => {
      chunk.position.z += speed;
      chunk.position.x  = worldShiftX;

      chunk.children.forEach(child => {
        if (child.type !== 'Mesh' || !child.userData.category) return;
        const ud = child.userData;

        child.rotation.y += 0.007 * sm;

        switch (ud.category) {
          case 'spinning':
            child.rotation.x += 0.015 * ud.speed * sm;
            child.rotation.z += 0.008 * sm;
            break;
          case 'moving':
            child.position.x = ud.baseX + Math.sin(elapsed * ud.speed + ud.phase) * 5;
            break;
          case 'bobbing':
            child.position.y = ud.baseY + Math.cos(elapsed * ud.speed + ud.phase) * 2;
            break;
          case 'sweeping':
            child.position.x = ud.baseX + Math.sin(elapsed * ud.speed + ud.phase) * 6;
            child.position.y = ud.baseY + Math.sin(elapsed * ud.speed * 2 + ud.phase) * 2;
            break;
          case 'impossible':
            child.rotation.x += 0.025 * sm;
            child.rotation.z += 0.018 * sm;
            child.position.x  = ud.baseX + Math.sin(elapsed * 3 + ud.phase) * 3;
            child.position.y  = ud.baseY + Math.cos(elapsed * 2.5 + ud.phase) * 1.5;
            break;
          default: break;
        }
      });

      // Recycle chunk
      if (chunk.position.z > this.chunkSize) {
        chunk.position.z -= this.chunkSize * this.chunks.length;

        const maxTier    = this._maxTier();
        const placements = this._generatePlacements(maxTier);

        const toRemove = chunk.children.filter(c => c.userData.category);
        toRemove.forEach(child => {
          const idx = this.obstacles.indexOf(child);
          if (idx !== -1) this.obstacles.splice(idx, 1);
          child.geometry.dispose();
          child.material.dispose();
          chunk.remove(child);
        });

        for (let xIdx = -3; xIdx <= 3; xIdx++) {
          placements.forEach(p => {
            const mesh = this._makeMesh(p, xIdx);
            if (mesh) { chunk.add(mesh); this.obstacles.push(mesh); }
          });
        }
      }
    });
  }
}
