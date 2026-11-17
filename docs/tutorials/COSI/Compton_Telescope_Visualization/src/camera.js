/**
 * Two deliberately separate camera modes:
 *   - orbit: drag to look around the model, wheel zoom, right/shift-drag pan;
 *   - fly:   game-like yaw/pitch look with W/A/S/D and Q/E height.
 *
 * Camera input never touches the Compton state. The event-cone rotation is
 * controlled only by beta in the physics UI.
 */

import * as THREE from 'three';

const Y_AXIS = new THREE.Vector3(0, 1, 0);
const EPS = 1e-6;

function clamp(value, low, high) {
  return Math.min(high, Math.max(low, value));
}

function isTextInput(target) {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest('input, textarea, select, [contenteditable="true"]'),
  );
}

export class CameraRig {
  constructor({
    camera,
    domElement,
    homePosition,
    homeTarget = new THREE.Vector3(0, 0, 0),
    minDistance = 2.4,
    maxDistance = 15,
    onModeChange = () => {},
    onPointerLockChange = () => {},
  }) {
    this.camera = camera;
    this.domElement = domElement;
    this.homePosition = homePosition.clone();
    this.homeTarget = homeTarget.clone();
    this.minDistance = minDistance;
    this.maxDistance = maxDistance;
    this.onModeChange = onModeChange;
    this.onPointerLockChange = onPointerLockChange;

    this.mode = 'orbit';
    this.orbit = {
      target: homeTarget.clone(),
      theta: 0,
      polar: 0,
      radius: 0,
    };
    this.fly = {
      yaw: 0,
      pitch: 0,
      keys: new Set(),
      speed: 1.6,
      shiftMultiplier: 3.2,
      dragging: false,
      lastClientX: 0,
      lastClientY: 0,
      pointerLocked: false,
      pointerLockRequested: false,
    };
    this._preFlyOrbit = null;
    this._activeOrbitPointer = null;
    this._activeOrbitAction = null;
    this._exitingFly = false;
    this._cameraInputEnabled = true;

    const offset = homePosition.clone().sub(homeTarget);
    const radius = Math.max(offset.length(), 1e-3);
    this.orbit.radius = radius;
    this.orbit.theta = Math.atan2(offset.x, offset.z);
    this.orbit.polar = Math.acos(clamp(offset.y / radius, -1, 1));
    this.camera.up.copy(Y_AXIS);
    this.camera.rotation.order = 'YXZ';
    this._applyOrbit();

    this._onPointerDown = this._handlePointerDown.bind(this);
    this._onPointerMove = this._handlePointerMove.bind(this);
    this._onPointerUp = this._handlePointerUp.bind(this);
    this._onWheel = this._handleWheel.bind(this);
    this._onKeyDown = this._handleKeyDown.bind(this);
    this._onKeyUp = this._handleKeyUp.bind(this);
    this._onMouseLook = this._handleMouseLook.bind(this);
    this._onPointerLockChange = this._handlePointerLockChange.bind(this);
    this._onPointerLockError = this._handlePointerLockError.bind(this);
    this._onWindowBlur = () => this.fly.keys.clear();

    domElement.addEventListener('pointerdown', this._onPointerDown, { passive: false });
    window.addEventListener('pointermove', this._onPointerMove, { passive: false });
    window.addEventListener('pointerup', this._onPointerUp);
    window.addEventListener('pointercancel', this._onPointerUp);
    domElement.addEventListener('wheel', this._onWheel, { passive: false });
    domElement.addEventListener('contextmenu', (event) => event.preventDefault());
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onWindowBlur);
    document.addEventListener('mousemove', this._onMouseLook);
    document.addEventListener('pointerlockchange', this._onPointerLockChange);
    document.addEventListener('pointerlockerror', this._onPointerLockError);
  }

  setCameraInputEnabled(enabled) {
    this._cameraInputEnabled = Boolean(enabled);
    if (!enabled) this.fly.keys.clear();
  }

  get isOrbitMode() {
    return this.mode === 'orbit';
  }

  get isFlyMode() {
    return this.mode === 'fly';
  }

  get pointerLocked() {
    return this.fly.pointerLocked;
  }

  enterFly() {
    if (this.mode === 'fly') return;
    this._preFlyOrbit = {
      target: this.orbit.target.clone(),
      theta: this.orbit.theta,
      polar: this.orbit.polar,
      radius: this.orbit.radius,
    };
    const direction = new THREE.Vector3();
    this.camera.getWorldDirection(direction);
    this.fly.yaw = Math.atan2(-direction.x, -direction.z);
    this.fly.pitch = Math.asin(clamp(direction.y, -1, 1));
    this.fly.keys.clear();
    this.fly.dragging = false;
    this.mode = 'fly';
    this._applyFlyOrientation();
    this.onModeChange('fly');

    this.fly.pointerLockRequested = false;
    if (this.domElement.requestPointerLock) {
      try {
        const maybePromise = this.domElement.requestPointerLock();
        this.fly.pointerLockRequested = true;
        if (maybePromise && typeof maybePromise.catch === 'function') {
          maybePromise.catch(() => {
            this.fly.pointerLockRequested = false;
            this.onPointerLockChange(false);
          });
        }
      } catch {
        this.fly.pointerLockRequested = false;
        this.onPointerLockChange(false);
      }
    }
  }

  exitFly() {
    if (this.mode !== 'fly') return;
    this._exitingFly = true;
    this.fly.keys.clear();
    this.fly.dragging = false;
    if (document.pointerLockElement === this.domElement && document.exitPointerLock) {
      document.exitPointerLock();
    }
    this.fly.pointerLocked = false;
    this.fly.pointerLockRequested = false;
    this.mode = 'orbit';
    if (this._preFlyOrbit) {
      this.orbit.target.copy(this._preFlyOrbit.target);
      this.orbit.theta = this._preFlyOrbit.theta;
      this.orbit.polar = this._preFlyOrbit.polar;
      this.orbit.radius = this._preFlyOrbit.radius;
      this._preFlyOrbit = null;
    }
    this._applyOrbit();
    this._exitingFly = false;
    this.onModeChange('orbit');
    this.onPointerLockChange(false);
  }

  resetView() {
    if (this.mode === 'fly') this.exitFly();
    const offset = this.homePosition.clone().sub(this.homeTarget);
    this.orbit.target.copy(this.homeTarget);
    this.orbit.radius = offset.length();
    this.orbit.theta = Math.atan2(offset.x, offset.z);
    this.orbit.polar = Math.acos(clamp(offset.y / this.orbit.radius, -1, 1));
    this._applyOrbit();
  }

  /**
   * Deterministic orbit pose, used by the automated visual acceptance script.
   * Angles are in radians. This is camera-only and never touches physics state.
   */
  setOrbitView({ theta, polar, radius, target = null }) {
    if (this.mode === 'fly') this.exitFly();
    if (target) this.orbit.target.copy(target);
    if (Number.isFinite(theta)) this.orbit.theta = theta;
    if (Number.isFinite(polar)) this.orbit.polar = clamp(polar, 0.06, Math.PI - 0.06);
    if (Number.isFinite(radius)) {
      this.orbit.radius = clamp(radius, this.minDistance, this.maxDistance);
    }
    this._applyOrbit();
  }

  update(dt) {
    if (this.mode !== 'fly' || !this._cameraInputEnabled) return;
    const keys = this.fly.keys;
    if (keys.size === 0) return;
    const yaw = this.fly.yaw;
    const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    const movement = new THREE.Vector3();
    if (keys.has('KeyW')) movement.add(forward);
    if (keys.has('KeyS')) movement.sub(forward);
    if (keys.has('KeyD')) movement.add(right);
    if (keys.has('KeyA')) movement.sub(right);
    if (keys.has('KeyE')) movement.add(Y_AXIS);
    if (keys.has('KeyQ')) movement.sub(Y_AXIS);
    if (movement.lengthSq() === 0) return;
    movement.normalize();
    const speed =
      this.fly.speed * (keys.has('ShiftLeft') || keys.has('ShiftRight') ? this.fly.shiftMultiplier : 1);
    this.camera.position.addScaledVector(movement, speed * Math.min(dt, 0.1));
    this._applyFlyOrientation();
  }

  dispose() {
    this.domElement.removeEventListener('pointerdown', this._onPointerDown);
    window.removeEventListener('pointermove', this._onPointerMove);
    window.removeEventListener('pointerup', this._onPointerUp);
    window.removeEventListener('pointercancel', this._onPointerUp);
    this.domElement.removeEventListener('wheel', this._onWheel);
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onWindowBlur);
    document.removeEventListener('mousemove', this._onMouseLook);
    document.removeEventListener('pointerlockchange', this._onPointerLockChange);
    document.removeEventListener('pointerlockerror', this._onPointerLockError);
  }

  _applyOrbit() {
    const { target, radius, theta, polar } = this.orbit;
    const sinPolar = Math.sin(polar);
    this.camera.position.set(
      target.x + radius * sinPolar * Math.sin(theta),
      target.y + radius * Math.cos(polar),
      target.z + radius * sinPolar * Math.cos(theta),
    );
    this.camera.up.copy(Y_AXIS);
    this.camera.lookAt(target);
  }

  _applyFlyOrientation() {
    this.camera.rotation.set(this.fly.pitch, this.fly.yaw, 0, 'YXZ');
  }

  _requestPointerLockIfNeeded() {
    if (
      this.mode === 'fly' &&
      !this.fly.pointerLocked &&
      this.domElement.requestPointerLock
    ) {
      try {
        const maybePromise = this.domElement.requestPointerLock();
        this.fly.pointerLockRequested = true;
        if (maybePromise && typeof maybePromise.catch === 'function') {
          maybePromise.catch(() => {
            this.fly.pointerLockRequested = false;
            this.onPointerLockChange(false);
          });
        }
      } catch {
        this.fly.pointerLockRequested = false;
      }
    }
  }

  _handlePointerDown(event) {
    if (!this._cameraInputEnabled) return;
    if (this.mode === 'orbit') {
      if (![0, 1, 2].includes(event.button)) return;
      event.preventDefault();
      this._activeOrbitPointer = event.pointerId;
      const pan =
        event.button === 2 || event.button === 1 || event.shiftKey || event.ctrlKey || event.metaKey;
      this._activeOrbitAction = pan ? 'pan' : 'rotate';
      this._lastOrbitX = event.clientX;
      this._lastOrbitY = event.clientY;
      if (this.domElement.setPointerCapture) {
        try {
          this.domElement.setPointerCapture(event.pointerId);
        } catch {
          // Ignore capture failures on older browsers.
        }
      }
      return;
    }

    if (this.mode === 'fly') {
      if (this.fly.pointerLocked) return;
      event.preventDefault();
      this._requestPointerLockIfNeeded();
      this.fly.dragging = true;
      this.fly.lastClientX = event.clientX;
      this.fly.lastClientY = event.clientY;
      if (this.domElement.setPointerCapture) {
        try {
          this.domElement.setPointerCapture(event.pointerId);
        } catch {
          // Ignore.
        }
      }
    }
  }

  _handlePointerMove(event) {
    if (!this._cameraInputEnabled) return;
    if (this.mode === 'orbit' && this._activeOrbitPointer !== null) {
      if (event.pointerId !== this._activeOrbitPointer) return;
      event.preventDefault();
      const dx = event.clientX - this._lastOrbitX;
      const dy = event.clientY - this._lastOrbitY;
      this._lastOrbitX = event.clientX;
      this._lastOrbitY = event.clientY;

      if (this._activeOrbitAction === 'rotate') {
        this.orbit.theta -= dx * 0.006;
        this.orbit.polar = clamp(this.orbit.polar - dy * 0.006, 0.06, Math.PI - 0.06);
      } else {
        const panScale =
          (2 * this.orbit.radius * Math.tan((this.camera.fov * Math.PI) / 360)) /
          Math.max(this.domElement.clientHeight, 1);
        this.camera.updateMatrix();
        const right = new THREE.Vector3();
        const up = new THREE.Vector3();
        this.camera.matrix.extractBasis(right, up, new THREE.Vector3());
        this.orbit.target.addScaledVector(right, -dx * panScale * 0.85);
        this.orbit.target.addScaledVector(up, dy * panScale * 0.85);
        this._clampOrbitTarget();
      }
      this._applyOrbit();
      return;
    }

    if (this.mode === 'fly' && this.fly.dragging && !this.fly.pointerLocked) {
      event.preventDefault();
      const dx = event.clientX - this.fly.lastClientX;
      const dy = event.clientY - this.fly.lastClientY;
      this.fly.lastClientX = event.clientX;
      this.fly.lastClientY = event.clientY;
      this._lookBy(dx, dy);
    }
  }

  _handlePointerUp(event) {
    if (this.mode === 'orbit' && this._activeOrbitPointer !== null) {
      if (event.pointerId !== this._activeOrbitPointer) return;
      if (this.domElement.releasePointerCapture) {
        try {
          this.domElement.releasePointerCapture(event.pointerId);
        } catch {
          // Ignore.
        }
      }
      this._activeOrbitPointer = null;
      this._activeOrbitAction = null;
    }
    if (this.mode === 'fly') {
      this.fly.dragging = false;
    }
  }

  _handleWheel(event) {
    if (!this._cameraInputEnabled || this.mode !== 'orbit') return;
    event.preventDefault();
    const unit =
      event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 100 : 1;
    const scale = Math.exp(event.deltaY * unit * 0.0012);
    this.orbit.radius = clamp(this.orbit.radius * scale, this.minDistance, this.maxDistance);
    this._applyOrbit();
  }

  _handleMouseLook(event) {
    if (!this._cameraInputEnabled) return;
    if (this.mode !== 'fly' || !this.fly.pointerLocked) return;
    this._lookBy(event.movementX || 0, event.movementY || 0);
  }

  _lookBy(dx, dy) {
    const sensitivity = 0.0022;
    this.fly.yaw -= dx * sensitivity;
    this.fly.pitch = clamp(this.fly.pitch - dy * sensitivity, -1.45, 1.45);
    this._applyFlyOrientation();
  }

  _handleKeyDown(event) {
    if (!this._cameraInputEnabled || this.mode !== 'fly') return;
    if (isTextInput(event.target) || this._isModalOpen()) return;
    if (event.code === 'Escape') {
      this.exitFly();
      return;
    }
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'ShiftLeft', 'ShiftRight'].includes(event.code)) {
      this.fly.keys.add(event.code);
      event.preventDefault();
    }
  }

  _handleKeyUp(event) {
    this.fly.keys.delete(event.code);
  }

  _isModalOpen() {
    return Boolean(document.querySelector('[data-modal-open="true"]'));
  }

  _handlePointerLockChange() {
    const locked = document.pointerLockElement === this.domElement;
    this.fly.pointerLocked = locked;
    if (locked) {
      this.fly.pointerLockRequested = false;
      this.onPointerLockChange(true);
      return;
    }
    this.onPointerLockChange(false);
    if (this.mode === 'fly' && this.fly.pointerLockRequested && !this._exitingFly) {
      // A previous request ended without ever locking. Keep fly mode available
      // with drag-look rather than trapping the user.
      this.fly.pointerLockRequested = false;
      return;
    }
    if (this.mode === 'fly' && !this._exitingFly) {
      // Esc / browser-initiated unlock: leave free-look mode and restore the
      // saved orbit view. Camera state is independent of physics state.
      this.exitFly();
    }
  }

  _handlePointerLockError() {
    this.fly.pointerLockRequested = false;
    this.onPointerLockChange(false);
    // Free-look still works by dragging while unlocked.
  }

  _clampOrbitTarget() {
    const offset = this.orbit.target.clone().sub(this.homeTarget);
    const limit = this.homeTarget.distanceTo(this.homePosition) * 0.18;
    if (offset.length() > limit) {
      offset.setLength(limit);
      this.orbit.target.copy(this.homeTarget).add(offset);
    }
  }
}
