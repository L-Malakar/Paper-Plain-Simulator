/**
 * ═══════════════════════════════════════════════════════════════
 *  world.js — WorldManager
 *  Manages terrain chunks, obstacles, and progressive difficulty.
 * ═══════════════════════════════════════════════════════════════
 */

import * as THREE from 'https://unpkg.com/three@0.136.0/build/three.module.js';

// ── Obstacle catalogue ────────────────────────────────────────
// Each entry: { geo: fn(THREE) → Geometry, tier: 0-3 (0=easy,3=hard) }
const OBSTACLE_DEFS = [
  // Tier 0 — always spawn
  { tier: 0, make: () => new THREE.BoxGeometry(1.2, 10, 1.2)           }, // tall pillar
  { tier: 0, make: () => new THREE.SphereGeometry(1.1, 8, 8)           }, // sphere
  { tier: 0, make: () => new THREE.ConeGeometry(1.3, 4, 8)             }, // cone
  { tier: 0, make: () => new THREE.CylinderGeometry(0.5, 0.5, 6, 8)   }, // cylinder

  // Tier 1 — spawn after 200 m
  { tier: 1, make: () => new THREE.BoxGeometry(5, 0.6, 0.6)            }, // horizontal bar
  { tier: 1, make: () => new THREE.TorusGeometry(1.4, 0.35, 8, 16)    }, // ring
  { tier: 1, make: () => new THREE.OctahedronGeometry(1.2, 0)          }, // diamond

  // Tier 2 — spawn after 500 m
  { tier: 2, make: () => new THREE.TorusKnotGeometry(0.9, 0.28, 80, 12)}, // knot
  { tier: 2, make: () => new THREE.BoxGeometry(0.6, 8, 4)             }, // flat wall
  { tier: 2, make: () => new THREE.IcosahedronGeometry(1.1, 0)        }, // icosahedron

  // Tier 3 — spawn after 1000 m
  { tier: 3, make: () => new THREE.DodecahedronGeometry(1.2, 0)       }, // dodecahedron
  { tier: 3, make: () => new THREE.BoxGeometry(3, 3, 0.5)             }, // large slab
  { tier: 3, make: () => new THREE.CylinderGeometry(2, 0.3, 5, 6)    }, // spike
];

// Obstacle behaviour categories
const CATEGORIES = ['static', 'moving', 'bobbing', 'spinning', 'sweeping', 'impossible'];

// Neon colour palette
const COLORS = [0xff2255, 0xff00cc, 0xff8800, 0x00ccff, 0xffff00, 0xcc00ff, 0x00ffcc];

export class WorldManager {
  /**
   * @param {THREE.Scene} scene
   * @param {boolean} isMobile
   */
  constructor(scene, isMobile = false) {
    this.scene      = scene;
    this.chunks     = [];
    this.obstacles  = [];
    this.chunkSize  = 40;
    this.isMobile   = isMobile;
    this.distance   = 0; // synced by main loop for tier gating

    // Seed initial chunks ahead of the camera
    for (let i = 0; i < 8; i++) {
      this.chunks.push(this._createChunk(-i * this.chunkSize));
    }
  }

  // ── Tier gating ───────────────────────────────────────────────
  /** Max tier unlocked based on current distance */
  _maxTier() {
    if (this.distance >= 1000) return 3;
    if (this.distance >= 500)  return 2;
    if (this.distance >= 200)  return 1;
    return 0;
  }

  // ── Chunk creation ─────────────────────────────────────────────
  _createChunk(zOffset) {
    const group = new THREE.Group();
    const maxTier = this._maxTier();

    // Filter obstacle catalogue to unlocked tiers
    const available = OBSTACLE_DEFS.filter(d => d.tier <= maxTier);
    const count     = this.isMobile ? 6 : 12;

    const placements = [];
    for (let i = 0; i < count; i++) {
      const def      = available[Math.floor(Math.random() * available.length)];
      const color    = COLORS[Math.floor(Math.random() * COLORS.length)];
      const catRoll  = Math.random();
      let   category = 'static';

      // Harder categories unlock progressively
      if      (catRoll > 0.96 && maxTier >= 2) category = 'impossible';
      else if (catRoll > 0.85 && maxTier >= 2) category = 'sweeping';
      else if (catRoll > 0.72 && maxTier >= 1) category = 'bobbing';
      else if (catRoll > 0.55 && maxTier >= 1) category = 'moving';
      else if (catRoll > 0.40) category = 'spinning';

      placements.push({
        def,
        category,
        color,
        xRel:  Math.random() * this.chunkSize - this.chunkSize / 2,
        zRel:  Math.random() * this.chunkSize - this.chunkSize / 2,
        yRel:  Math.random() * 4.5 + 0.5,
        phase: Math.random() * Math.PI * 2,
        speed: 0.8 + Math.random() * 1.4,
      });
    }

    // Spread across 7 lanes
    for (let xIdx = -3; xIdx <= 3; xIdx++) {
      // Grid
      const grid = new THREE.GridHelper(this.chunkSize, 20, 0x00ff88, 0x0a0f0a);
      grid.position.x = xIdx * this.chunkSize;
      group.add(grid);

      // Obstacles
      placements.forEach(p => {
        const mesh = this._makeMesh(p, xIdx);
        if (mesh) { group.add(mesh); this.obstacles.push(mesh); }
      });
    }

    group.position.z = zOffset;
    this.scene.add(group);
    return group;
  }

  // ── Mesh factory ──────────────────────────────────────────────
  _makeMesh(p, xIdx) {
    const geo = p.def.make();
    const mat = new THREE.MeshStandardMaterial({
      color:             p.color,
      emissive:          p.color,
      emissiveIntensity: 0.6,
      flatShading:       true,
    });

    const mesh = new THREE.Mesh(geo, mat);
    const baseX = (xIdx * this.chunkSize) + p.xRel;

    mesh.userData = {
      category: p.category,
      phase:    p.phase,
      speed:    p.speed,
      baseY:    p.yRel,
      baseX,
    };

    mesh.position.set(baseX, p.yRel, p.zRel);
    return mesh;
  }

  // ── Per-frame update ──────────────────────────────────────────
  /**
   * @param {number} speed        Forward scroll speed
   * @param {number} worldShiftX  Lateral world offset
   * @param {number} elapsed      Total game time (seconds)
   */
  update(speed, worldShiftX, elapsed) {
    this.chunks.forEach(chunk => {
      chunk.position.z += speed;
      chunk.position.x  = worldShiftX;

      chunk.children.forEach(child => {
        if (child.type !== 'Mesh' || !child.userData.category) return;
        const ud = child.userData;

        // Universal slow spin
        child.rotation.y += 0.018;

        switch (ud.category) {
          case 'spinning':
            child.rotation.x += 0.04 * ud.speed;
            child.rotation.z += 0.025;
            break;
          case 'moving':
            // Oscillate along X across ~5 units
            child.position.x = ud.baseX + Math.sin(elapsed * ud.speed + ud.phase) * 5;
            break;
          case 'bobbing':
            // Oscillate along Y
            child.position.y = ud.baseY + Math.cos(elapsed * ud.speed + ud.phase) * 2;
            break;
          case 'sweeping':
            // Figure-eight path
            child.position.x = ud.baseX + Math.sin(elapsed * ud.speed + ud.phase) * 6;
            child.position.y = ud.baseY + Math.sin(elapsed * ud.speed * 2 + ud.phase) * 2;
            break;
          case 'impossible':
            // Fast full rotation + erratic movement
            child.rotation.x += 0.07;
            child.rotation.z += 0.05;
            child.position.x  = ud.baseX + Math.sin(elapsed * 3 + ud.phase) * 3;
            child.position.y  = ud.baseY + Math.cos(elapsed * 2.5 + ud.phase) * 1.5;
            break;
          default: break; // 'static' — no extra movement
        }
      });

      // Recycle chunk once it scrolls past the camera
      if (chunk.position.z > this.chunkSize) {
        chunk.position.z -= this.chunkSize * this.chunks.length;

        // Regenerate obstacles inside this chunk with current difficulty
        const maxTier   = this._maxTier();
        const available = OBSTACLE_DEFS.filter(d => d.tier <= maxTier);
        const count     = this.isMobile ? 6 : 12;

        // Remove old obstacle refs from master list
        chunk.children.forEach(child => {
          if (child.userData.category) {
            const idx = this.obstacles.indexOf(child);
            if (idx !== -1) this.obstacles.splice(idx, 1);
            child.geometry.dispose();
          }
        });

        // Rebuild children
        const toRemove = chunk.children.filter(c => c.userData.category);
        toRemove.forEach(c => chunk.remove(c));

        for (let xIdx = -3; xIdx <= 3; xIdx++) {
          for (let i = 0; i < count; i++) {
            const def   = available[Math.floor(Math.random() * available.length)];
            const color = COLORS[Math.floor(Math.random() * COLORS.length)];
            const catRoll = Math.random();
            let category = 'static';
            if      (catRoll > 0.96 && maxTier >= 2) category = 'impossible';
            else if (catRoll > 0.85 && maxTier >= 2) category = 'sweeping';
            else if (catRoll > 0.72 && maxTier >= 1) category = 'bobbing';
            else if (catRoll > 0.55 && maxTier >= 1) category = 'moving';
            else if (catRoll > 0.40) category = 'spinning';

            const p = {
              def, category, color,
              xRel:  Math.random() * this.chunkSize - this.chunkSize / 2,
              zRel:  Math.random() * this.chunkSize - this.chunkSize / 2,
              yRel:  Math.random() * 4.5 + 0.5,
              phase: Math.random() * Math.PI * 2,
              speed: 0.8 + Math.random() * 1.4,
            };
            const mesh = this._makeMesh(p, xIdx);
            if (mesh) { chunk.add(mesh); this.obstacles.push(mesh); }
          }
        }
      }
    });
  }
}
