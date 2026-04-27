/**
 * ═══════════════════════════════════════════════════════════════
 *  Mcontroller.js — Mobile Controller
 *  Modes: virtual-joystick | dpad | gyroscope
 * ═══════════════════════════════════════════════════════════════
 */

export const MController = {
  // ── State ────────────────────────────────────────────────────
  input: { x: 0, y: 0 },
  joystickActive: false,
  enabled: true,
  isGhostMode: false,

  /** @type {'joystick'|'dpad'|'gyro'} */
  mode: localStorage.getItem('paperPlane_mobileCtrl') || 'joystick',

  // ── Config ───────────────────────────────────────────────────
  config: {
    moveSpeed:      0.22,
    verticalSpeed:  0.10,
    maxHeight:      6,
    minHeight:      0,
    ghostMinHeight: 0.5,
    chunkSize:      40,
    gyroSensX:      3.0,   // tilt sensitivity horizontal (gamma)
    gyroSensY:      2.0,   // tilt sensitivity vertical (beta offset)
    gyroDeadzone:   2.0,   // degrees ignored near centre
  },

  // ── Internal refs ────────────────────────────────────────────
  _listenersAdded: false,
  _gyroListenerAdded: false,
  _gyroOrientation: null,  // last DeviceOrientationEvent
  _dpadState: { up: false, down: false, left: false, right: false },

  // ── Init ─────────────────────────────────────────────────────
  init() {
    this._buildJoystickUI();
    this._buildDpadUI();
  },

  // ── Show / hide correct input layer ──────────────────────────
  showControls() {
    document.getElementById('joystick-container').style.display = 'none';
    document.getElementById('dpad-container').style.display     = 'none';
    if (this.mode === 'joystick') this._showJoystick();
    else if (this.mode === 'dpad') this._showDpad();
    else if (this.mode === 'gyro') this._startGyro();
  },

  setMode(mode) {
    this.mode = mode;
    localStorage.setItem('paperPlane_mobileCtrl', mode);
  },

  // ─────────────────────────────────────────────────────────────
  //  JOYSTICK
  // ─────────────────────────────────────────────────────────────
  _buildJoystickUI() {
    if (document.getElementById('joystick-container')) return;
    const container = document.createElement('div');
    container.id = 'joystick-container';

    const pad = document.createElement('div');
    pad.id = 'joystick-pad';
    const knob = document.createElement('div');
    knob.id = 'joystick-knob';
    pad.appendChild(knob);
    container.appendChild(pad);
    document.body.appendChild(container);
  },

  _showJoystick() {
    const container = document.getElementById('joystick-container');
    container.style.display = 'block';
    if (this._listenersAdded) return;
    this._listenersAdded = true;

    const pad  = document.getElementById('joystick-pad');
    const knob = document.getElementById('joystick-knob');

    const handleTouch = (e) => {
      if (e.target.tagName === 'BUTTON') return;
      if (!this.enabled) return;
      e.preventDefault();
      const touch = e.touches[0];

      if (!this.joystickActive) {
        const isBottomHalf = touch.clientY > window.innerHeight * 0.45;
        const isLeftHalf   = touch.clientX < window.innerWidth  * 0.55;
        if (!isBottomHalf || !isLeftHalf) return;
        pad.style.left    = `${touch.clientX - 55}px`;
        pad.style.top     = `${touch.clientY - 55}px`;
        pad.style.opacity = '1';
        this.joystickActive = true;
      }

      const rect    = pad.getBoundingClientRect();
      const centerX = rect.left + rect.width  / 2;
      const centerY = rect.top  + rect.height / 2;
      let dx = touch.clientX - centerX;
      let dy = touch.clientY - centerY;
      const dist   = Math.sqrt(dx * dx + dy * dy);
      const radius = rect.width / 2;

      if (dist > radius) { dx *= radius / dist; dy *= radius / dist; }

      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      this.input.x = dx / radius;
      this.input.y = dy / radius;
    };

    window.addEventListener('touchstart', handleTouch, { passive: false });
    window.addEventListener('touchmove',  (e) => { if (this.joystickActive) handleTouch(e); }, { passive: false });
    window.addEventListener('touchend',   () => {
      this.joystickActive = false;
      this.input.x = 0;
      this.input.y = 0;
      knob.style.transform = 'translate(0px, 0px)';
      pad.style.opacity = '0.3';
    });
  },

  // ─────────────────────────────────────────────────────────────
  //  D-PAD
  // ─────────────────────────────────────────────────────────────
  _buildDpadUI() {
    if (document.getElementById('dpad-container')) return;
    const wrap = document.createElement('div');
    wrap.id = 'dpad-container';

    const dirs = [
      { id: 'dpad-up',    label: '▲', row: 0, dir: 'up'    },
      { id: 'dpad-left',  label: '◀', row: 1, dir: 'left'  },
      { id: 'dpad-down',  label: '▼', row: 2, dir: 'down'  },
      { id: 'dpad-right', label: '▶', row: 1, dir: 'right' },
    ];

    // Build a 3×3 grid
    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid; grid-template-columns: 56px 56px 56px; grid-template-rows: 56px 56px 56px; gap:4px;';

    const posMap = { up: '1/2', left: '2/1', down: '3/2', right: '2/3' };

    dirs.forEach(({ id, label, dir }) => {
      const btn = document.createElement('div');
      btn.id = id;
      btn.className = 'dpad-btn';
      btn.textContent = label;
      btn.style.gridArea = posMap[dir];

      const press   = (e) => { e.preventDefault(); this._dpadState[dir] = true;  btn.classList.add('pressed');    this._updateDpadInput(); };
      const release = (e) => { e.preventDefault(); this._dpadState[dir] = false; btn.classList.remove('pressed'); this._updateDpadInput(); };

      btn.addEventListener('touchstart', press,   { passive: false });
      btn.addEventListener('touchend',   release, { passive: false });
      btn.addEventListener('touchcancel',release, { passive: false });
      btn.addEventListener('mousedown',  press);
      btn.addEventListener('mouseup',    release);
      btn.addEventListener('mouseleave', release);

      grid.appendChild(btn);
    });

    wrap.appendChild(grid);
    document.body.appendChild(wrap);
  },

  _updateDpadInput() {
    const s = this._dpadState;
    this.input.x = s.right ? 1 : s.left  ? -1 : 0;
    this.input.y = s.down  ? 1 : s.up    ? -1 : 0;
  },

  _showDpad() {
    document.getElementById('dpad-container').style.display = 'block';
  },

  // ─────────────────────────────────────────────────────────────
  //  GYROSCOPE
  // ─────────────────────────────────────────────────────────────
  _startGyro() {
    if (this._gyroListenerAdded) return;
    const requestGyro = () => {
      if (typeof DeviceOrientationEvent !== 'undefined' &&
          typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission()
          .then(state => { if (state === 'granted') this._addGyroListener(); })
          .catch(console.warn);
      } else {
        this._addGyroListener();
      }
    };
    // On iOS we need a user gesture first
    window.addEventListener('touchstart', requestGyro, { once: true });
  },

  _addGyroListener() {
    this._gyroListenerAdded = true;
    window.addEventListener('deviceorientation', (e) => {
      this._gyroOrientation = e;
    });
  },

  _updateGyroInput() {
    const e = this._gyroOrientation;
    if (!e) return;
    const dz = this.config.gyroDeadzone;

    // gamma = left/right tilt (-90…90). beta = front/back tilt (-180…180)
    let gx = (e.gamma || 0);
    let gy = ((e.beta  || 0) - 30); // 30° tilt is "neutral" for held phone

    if (Math.abs(gx) < dz) gx = 0;
    if (Math.abs(gy) < dz) gy = 0;

    this.input.x = Math.max(-1, Math.min(1, gx / (45 / this.config.gyroSensX)));
    this.input.y = Math.max(-1, Math.min(1, gy / (30 / this.config.gyroSensY)));
  },

  // ─────────────────────────────────────────────────────────────
  //  COMMON CONTROLS
  // ─────────────────────────────────────────────────────────────
  disable() {
    this.enabled = false;
    this.joystickActive = false;
    this.input = { x: 0, y: 0 };
    document.getElementById('joystick-container').style.display = 'none';
    document.getElementById('dpad-container').style.display     = 'none';
  },

  reset() {
    this.enabled        = true;
    this.isGhostMode    = false;
    this.joystickActive = false;
    this.input          = { x: 0, y: 0 };
    this._dpadState     = { up: false, down: false, left: false, right: false };
  },

  // ── Per-frame update ─────────────────────────────────────────
  update(playerGroup, currentWorldShiftX, delta) {
    if (!this.enabled) return { worldShiftX: currentWorldShiftX, isGroundHit: false, isCrashed: false, targetBank: 0, targetPitch: 0 };

    // Pull live gyro readings if in that mode
    if (this.mode === 'gyro') this._updateGyroInput();

    const scale = delta * 60;
    let nextX   = currentWorldShiftX;
    nextX -= this.input.x * this.config.moveSpeed * scale;

    if (nextX >  this.config.chunkSize) nextX -= this.config.chunkSize;
    if (nextX < -this.config.chunkSize) nextX += this.config.chunkSize;

    const vMove = -this.input.y * this.config.verticalSpeed * scale;
    if (vMove > 0 && playerGroup.position.y < this.config.maxHeight) playerGroup.position.y += vMove;
    else if (vMove < 0) playerGroup.position.y += vMove;

    const floor = this.isGhostMode ? this.config.ghostMinHeight : this.config.minHeight;
    if (playerGroup.position.y < floor) playerGroup.position.y = floor;

    const isCrashed = !this.isGhostMode && playerGroup.position.y <= this.config.minHeight;
    if (isCrashed) this.disable();

    return {
      worldShiftX: nextX,
      isGroundHit: isCrashed,
      isCrashed,
      targetBank:  -this.input.x * 0.6,
      targetPitch: -this.input.y * 0.3,
    };
  },

  // Legacy compat
  showJoystick() { this.showControls(); },
};
