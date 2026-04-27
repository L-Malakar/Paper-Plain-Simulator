/**
 * ═══════════════════════════════════════════════════════════════
 *  controller.js — Desktop Keyboard Controller
 *  Supports custom remappable keybinds stored in localStorage
 * ═══════════════════════════════════════════════════════════════
 */

// ── Default keybind map ─────────────────────────────────────────
const DEFAULT_BINDS = {
  up:       'w',
  down:     's',
  left:     'a',
  right:    'd',
  pause:    'Escape',
  restart:  'r',
  home:     'h',
  settings: 'o',
};

/**
 * Load keybinds from localStorage, falling back to defaults.
 * Stored as a flat object: { up: 'w', down: 's', ... }
 */
function loadBinds() {
  try {
    const saved = localStorage.getItem('paperPlane_keybinds');
    return saved ? { ...DEFAULT_BINDS, ...JSON.parse(saved) } : { ...DEFAULT_BINDS };
  } catch {
    return { ...DEFAULT_BINDS };
  }
}

function saveBinds(binds) {
  localStorage.setItem('paperPlane_keybinds', JSON.stringify(binds));
}

export const Controller = {
  // ── Runtime state ─────────────────────────────────────────────
  keys: { up: false, down: false, left: false, right: false },
  binds: loadBinds(),

  // ── Config ────────────────────────────────────────────────────
  config: {
    moveSpeed:     0.22,
    verticalSpeed: 0.10,
    maxHeight:     6,
    minHeight:     0,
    ghostMinHeight:0.5,
    chunkSize:     40,
  },

  // Set to true by game loop during ghost/invincibility window
  isGhostMode: false,

  // ── Initialise keyboard listeners ────────────────────────────
  init() {
    window.addEventListener('keydown', (e) => this._handleKey(e, true));
    window.addEventListener('keyup',   (e) => this._handleKey(e, false));
  },

  _handleKey(event, isPressed) {
    const k = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (k === this.binds.up)    { this.keys.up    = isPressed; event.preventDefault(); }
    if (k === this.binds.down)  { this.keys.down  = isPressed; event.preventDefault(); }
    if (k === this.binds.left)  { this.keys.left  = isPressed; event.preventDefault(); }
    if (k === this.binds.right) { this.keys.right = isPressed; event.preventDefault(); }
  },

  // ── Rebind an action (called from Settings UI) ───────────────
  rebind(action, newKey) {
    this.binds[action] = newKey;
    saveBinds(this.binds);
  },

  resetBinds() {
    this.binds = { ...DEFAULT_BINDS };
    saveBinds(this.binds);
  },

  getDefaultBinds() { return { ...DEFAULT_BINDS }; },

  // ── Per-frame update ─────────────────────────────────────────
  update(playerGroup, currentWorldShiftX, delta) {
    const scale = delta * 60; // Normalise to 60 fps
    let nextX = currentWorldShiftX;

    // Horizontal
    if (this.keys.left)  nextX += this.config.moveSpeed * scale;
    if (this.keys.right) nextX -= this.config.moveSpeed * scale;

    // World wrapping
    if (nextX >  this.config.chunkSize) nextX -= this.config.chunkSize;
    if (nextX < -this.config.chunkSize) nextX += this.config.chunkSize;

    // Vertical
    if (this.keys.up   && playerGroup.position.y < this.config.maxHeight)
      playerGroup.position.y += this.config.verticalSpeed * scale;
    if (this.keys.down)
      playerGroup.position.y -= this.config.verticalSpeed * scale;

    // Floor clamp
    const floor = this.isGhostMode ? this.config.ghostMinHeight : this.config.minHeight;
    if (playerGroup.position.y < floor) playerGroup.position.y = floor;

    // Crash detection (only outside ghost window)
    const isCrashed = !this.isGhostMode && playerGroup.position.y <= this.config.minHeight;

    return {
      worldShiftX: nextX,
      isCrashed,
      isGroundHit: isCrashed,
      targetBank:  this.keys.left  ?  0.6 : this.keys.right ? -0.6 : 0,
      targetPitch: this.keys.up    ? -0.3 : this.keys.down  ?  0.3 : 0,
    };
  },
};
