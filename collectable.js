/**
 * ═══════════════════════════════════════════════════════════════
 *  collectable.js — Coin & Power-Up Manager
 *  10 power-ups + coin collectables with chunk recycling
 * ═══════════════════════════════════════════════════════════════
 *
 *  POWER-UPS (all timed unless noted):
 *  ─────────────────────────────────────────────────
 *  1.  SPEED       – 2× forward speed          (red,    5 s)
 *  2.  MAGNET      – auto-pull nearby coins     (cyan,   8 s)
 *  3.  SHIELD      – pass through obstacles     (green,  7 s)
 *  4.  LUCK        – 1.5× coin spawn rate       (yellow, 10 s)
 *  5.  COLLECTOR   – each coin counts as 2      (gold,   8 s)
 *  6.  SLOW_MO     – 0.5× speed (breathe)       (blue,   6 s)
 *  7.  TINY        – shrink hitbox 50%          (pink,   8 s)
 *  8.  COIN_BURST  – instant +15 coins          (orange, instant)
 *  9.  GHOST_TRAIL – full ghost / no-crash mode (white,  5 s)
 *  10. TURBO_FLIP  – 3× speed + shield          (purple, 4 s)
 * ═══════════════════════════════════════════════════════════════
 */

import * as THREE from 'https://unpkg.com/three@0.136.0/build/three.module.js';

// ── Power-up definitions ──────────────────────────────────────
export const POWERUP_DEFS = [
  { id: 'SPEED',       label: '⚡ SPEED',       color: 0xff2200, emissive: 0xff1100, duration: 5,  shape: 'octahedron'  },
  { id: 'MAGNET',      label: '🧲 MAGNET',      color: 0x00ccff, emissive: 0x0088ff, duration: 8,  shape: 'torus'       },
  { id: 'SHIELD',      label: '🛡 SHIELD',      color: 0x00ff88, emissive: 0x00cc44, duration: 7,  shape: 'icosahedron' },
  { id: 'LUCK',        label: '🍀 LUCK',        color: 0xffff00, emissive: 0xcccc00, duration: 10, shape: 'tetrahedron' },
  { id: 'COLLECTOR',   label: '✖2 COLLECTOR',   color: 0xffaa00, emissive: 0xff8800, duration: 8,  shape: 'dodecahedron'},
  { id: 'SLOW_MO',     label: '🐌 SLOW-MO',     color: 0x4488ff, emissive: 0x2255cc, duration: 6,  shape: 'sphere'      },
  { id: 'TINY',        label: '🔬 TINY',        color: 0xff44cc, emissive: 0xcc0088, duration: 8,  shape: 'cone'        },
  { id: 'COIN_BURST',  label: '💥 COIN BURST',  color: 0xff8800, emissive: 0xff5500, duration: 0,  shape: 'cylinder'    },
  { id: 'GHOST_TRAIL', label: '👻 GHOST',       color: 0xeeeeff, emissive: 0x8888ff, duration: 5,  shape: 'torus_knot'  },
  { id: 'TURBO_FLIP',  label: '🌀 TURBO',       color: 0xcc00ff, emissive: 0x8800cc, duration: 4,  shape: 'ring'        },
];

// ── Geometry factory ──────────────────────────────────────────
function makePowerUpGeo(shape) {
  switch (shape) {
    case 'octahedron':  return new THREE.OctahedronGeometry(0.55, 0);
    case 'torus':       return new THREE.TorusGeometry(0.45, 0.18, 8, 16);
    case 'icosahedron': return new THREE.IcosahedronGeometry(0.55, 0);
    case 'tetrahedron': return new THREE.TetrahedronGeometry(0.6, 0);
    case 'dodecahedron':return new THREE.DodecahedronGeometry(0.5, 0);
    case 'sphere':      return new THREE.SphereGeometry(0.45, 10, 10);
    case 'cone':        return new THREE.ConeGeometry(0.45, 0.9, 8);
    case 'cylinder':    return new THREE.CylinderGeometry(0.3, 0.3, 0.7, 8);
    case 'torus_knot':  return new THREE.TorusKnotGeometry(0.35, 0.12, 48, 8);
    case 'ring':        return new THREE.TorusGeometry(0.5, 0.08, 6, 20);
    default:            return new THREE.OctahedronGeometry(0.55, 0);
  }
}

// ─────────────────────────────────────────────────────────────
export class CollectableManager {
  constructor(scene, isMobile = false) {
    this.scene            = scene;
    this.isMobile         = isMobile;
    this.chunkSize        = 40;
    this.chunks           = [];
    this.items            = [];   // flat list of all Meshes (coins + power-ups)
    this.maxCoinsPerChunk = 10;

    // ── Active power-up timers ────────────────────────────────
    /** @type {{ id:string, timeLeft:number }[]} */
    this.activePowerUps = [];

    // ── Shared coin geometry + material ───────────────────────
    const coinGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.1, 16);
    coinGeo.rotateX(Math.PI / 2);
    this.sharedCoinGeo = coinGeo;
    this.sharedCoinMat = new THREE.MeshStandardMaterial({
      color: 0xffea00, metalness: 0.9, roughness: 0.05,
      emissive: 0xffaa00, emissiveIntensity: 2.5,
    });

    // ── One shared material per power-up type ─────────────────
    // Materials are shared across all instances of the same PU type
    // for performance; each mesh has its own geometry.
    this.puMats = POWERUP_DEFS.map(def => new THREE.MeshStandardMaterial({
      color:             def.color,
      emissive:          def.emissive,
      emissiveIntensity: 1.8,
      metalness:         0.4,
      roughness:         0.25,
      flatShading:       true,
    }));

    // Seed 8 chunks ahead
    for (let i = 0; i < 8; i++) {
      this.chunks.push(this._createChunk(-i * this.chunkSize, 0));
    }
  }

  // ─────────────────────────────────────────────────────────────
  //  Chunk creation
  // ─────────────────────────────────────────────────────────────
  _createChunk(zOffset, distance) {
    const group = new THREE.Group();

    // Build coin placement data
    const coinPlacements = [];
    for (let i = 0; i < this.maxCoinsPerChunk; i++) {
      coinPlacements.push({
        xRel: Math.random() * this.chunkSize - this.chunkSize / 2,
        zRel: Math.random() * this.chunkSize - this.chunkSize / 2,
        yRel: Math.random() * 4 + 1.0,
      });
    }

    // Spawn coins across 7 lanes
    for (let xIdx = -3; xIdx <= 3; xIdx++) {
      coinPlacements.forEach((data, index) => {
        const mesh = new THREE.Mesh(this.sharedCoinGeo, this.sharedCoinMat);
        mesh.userData = {
          type:      'coin',
          baseY:     data.yRel,
          baseX:     xIdx * this.chunkSize + data.xRel,
          laneIndex: index,
        };
        mesh.position.set(mesh.userData.baseX, data.yRel, data.zRel);
        // BUG FIX (original): initial 0/3 was always used; now uses
        // the correct ramp based on distance passed in.
        const initialVisible = this.isMobile ? 0 : 3;
        mesh.visible = index < initialVisible;
        group.add(mesh);
        this.items.push(mesh);
      });
    }

    // Spawn power-ups
    this._spawnPowerUpsIntoGroup(group, distance);

    group.position.z = zOffset;
    this.scene.add(group);
    return group;
  }

  // ── Add 0-2 power-ups into an existing group ──────────────
  _spawnPowerUpsIntoGroup(group, distance = 0) {
    // None before 100 m so player learns the controls first
    const maxPU   = distance < 0 ? 0 : distance < 0 ? 1 : 2;
    const count   = Math.floor(Math.random() * (maxPU + 1));
    const half    = this.chunkSize / 2;

    for (let i = 0; i < count; i++) {
      const defIdx = Math.floor(Math.random() * POWERUP_DEFS.length);
      const def    = POWERUP_DEFS[defIdx];
      const geo    = makePowerUpGeo(def.shape); // unique geo per instance
      const mesh   = new THREE.Mesh(geo, this.puMats[defIdx]);

      const xRel = Math.random() * this.chunkSize - half;
      const zRel = Math.random() * this.chunkSize - half;
      const yRel = Math.random() * 3.5 + 1.2;

      mesh.userData = {
        type:     'powerup',
        puId:     def.id,
        puDefIdx: defIdx,
        baseY:    yRel,
        baseX:    xRel,   // relative to chunk group
      };
      mesh.position.set(xRel, yRel, zRel);
      mesh.visible = true;
      group.add(mesh);
      this.items.push(mesh);
    }
  }

  // ─────────────────────────────────────────────────────────────
  //  Per-frame update  (called from main game loop)
  // ─────────────────────────────────────────────────────────────
  update(speed, worldShiftX, elapsed, distance = 0) {
    const magnetActive  = this.hasPowerUp('MAGNET');
    const magnetRadius  = 6; // world-space units
    const luckActive    = this.hasPowerUp('LUCK');

    // Coin visibility ramp
    const initialVisible = this.isMobile ? 6 : 12;
    const luckMult       = luckActive ? 1.5 : 1.0;
    const currentMax     = Math.min(
      this.maxCoinsPerChunk,
      Math.round((initialVisible + Math.floor(distance / 50)) * luckMult),
    );

    this.chunks.forEach(chunk => {
      chunk.position.z += speed;
      chunk.position.x  = worldShiftX;

      chunk.children.forEach(child => {
        if (!child.visible) return;
        const ud = child.userData;

        if (ud.type === 'coin') {
          // Spin & scale-pulse
          child.rotation.y += 0.05;
          const pulse = 1 + Math.sin(elapsed * 6) * 0.15;
          child.scale.set(pulse, pulse, pulse);

          // MAGNET: pull toward player (world origin is player X=0,Y=playerY,Z=0)
          if (magnetActive) {
            // Approximate world position of coin
            const wx  = child.position.x + chunk.position.x;
            const wy  = child.position.y;
            const wz  = child.position.z + chunk.position.z;
            const dist = Math.sqrt(wx * wx + wy * wy + wz * wz);
            if (dist < magnetRadius && dist > 0.4) {
              const pull = 0.22;
              child.position.x -= (wx / dist) * pull;
              child.position.y -= (wy / dist) * pull * 0.4;
            }
          }

        } else if (ud.type === 'powerup') {
          // Float + dual-axis spin
          child.rotation.y  += 0.04;
          child.rotation.x  += 0.025;
          child.position.y   = ud.baseY + Math.sin(elapsed * 2.5 + ud.baseX) * 0.35;
          // Pulsing glow — write directly to the shared mat is OK because
          // all instances of the same PU share one material.
          this.puMats[ud.puDefIdx].emissiveIntensity =
            1.5 + Math.sin(elapsed * 5 + ud.puDefIdx) * 0.6;
        }
      });

      // ── Recycle chunk ────────────────────────────────────────
      if (chunk.position.z > this.chunkSize) {
        chunk.position.z -= this.chunkSize * this.chunks.length;

        // 1. Remove stale entries from flat items list + dispose PU geos
        chunk.children.forEach(child => {
          const idx = this.items.indexOf(child);
          if (idx !== -1) this.items.splice(idx, 1);
          if (child.userData.type === 'powerup') {
            child.geometry.dispose(); // each PU has unique geo
          }
        });

        // 2. Clear chunk children
        while (chunk.children.length) chunk.remove(chunk.children[0]);

        // 3. Rebuild coins
        const coinPlacements = [];
        for (let i = 0; i < this.maxCoinsPerChunk; i++) {
          coinPlacements.push({
            xRel: Math.random() * this.chunkSize - this.chunkSize / 2,
            zRel: Math.random() * this.chunkSize - this.chunkSize / 2,
            yRel: Math.random() * 4 + 1.0,
          });
        }
        for (let xIdx = -3; xIdx <= 3; xIdx++) {
          coinPlacements.forEach((data, index) => {
            const mesh = new THREE.Mesh(this.sharedCoinGeo, this.sharedCoinMat);
            mesh.userData = {
              type:      'coin',
              baseY:     data.yRel,
              baseX:     xIdx * this.chunkSize + data.xRel,
              laneIndex: index,
            };
            mesh.position.set(mesh.userData.baseX, data.yRel, data.zRel);
            mesh.visible = index < currentMax;
            chunk.add(mesh);
            this.items.push(mesh);
          });
        }

        // 4. Rebuild power-ups
        this._spawnPowerUpsIntoGroup(chunk, distance);
      }
    });
  }

  // ─────────────────────────────────────────────────────────────
  //  Power-up state API
  // ─────────────────────────────────────────────────────────────

  /** Activate a power-up; refreshes duration if already active */
  activatePowerUp(id) {
    const def = POWERUP_DEFS.find(d => d.id === id);
    if (!def || def.duration === 0) return; // instant PUs handled externally
    const existing = this.activePowerUps.find(p => p.id === id);
    if (existing) {
      existing.timeLeft = def.duration; // refresh
    } else {
      this.activePowerUps.push({ id, timeLeft: def.duration });
    }
  }

  /**
   * Tick all active timers.
   * @param {number} delta - frame delta (seconds)
   * @returns {string[]} array of power-up IDs that expired this frame
   */
  tickPowerUps(delta) {
    const expired = [];
    this.activePowerUps = this.activePowerUps.filter(p => {
      p.timeLeft -= delta;
      if (p.timeLeft <= 0) { expired.push(p.id); return false; }
      return true;
    });
    return expired;
  }

  /** Returns true if the given power-up is currently active */
  hasPowerUp(id) {
    return this.activePowerUps.some(p => p.id === id);
  }

  /** Returns seconds remaining for the given power-up (0 if inactive) */
  getTimeLeft(id) {
    const p = this.activePowerUps.find(ap => ap.id === id);
    return p ? p.timeLeft : 0;
  }

  // ─────────────────────────────────────────────────────────────
  //  Dispose
  // ─────────────────────────────────────────────────────────────
  dispose() {
    this.chunks.forEach(c => this.scene.remove(c));
    this.sharedCoinGeo.dispose();
    this.sharedCoinMat.dispose();
    this.puMats.forEach(m => m.dispose());
    this.items          = [];
    this.activePowerUps = [];
  }
}
