import { installLanguageSwitch } from './i18n.js';
import { typesetEventMath } from './event-cone-math.js';
/**
 * Application/UI state and wiring.
 *
 * Physics, history, rendering and camera control are kept in separate modules.
 * UI edits are the only path that changes phi/beta; camera input changes only
 * the camera rig.
 */

import * as THREE from 'three';
import {
  anglesFromDirection,
  clamp,
  coneAxisDirection,
  degToRad,
  directionFromAngles,
  formatAngleCell,
  makeSourceBasis,
  radToDeg,
  recoilElectronEnergy,
  scatteredPhotonEnergy,
  wrapDeg,
} from './physics.js';
import { TrailHistory } from './history.js';
import { ComptonScene } from './scene.js';
import { CameraRig } from './camera.js';
import { runValidation } from './validation.js';

const SOURCE_CHI_DEG = 145;
const SOURCE_PSI_DEG = 35;
const DEFAULT_PHI_DEG = 35;
const DEFAULT_BETA_DEG = 0;
const R = 1.6;
const INCIDENT_ENERGY_KEV = 1000;

const state = {
  phiDeg: DEFAULT_PHI_DEG,
  betaInternalDeg: DEFAULT_BETA_DEG,
  manualBetaDisplayDeg: null,
  autoPlaying: false,
  autoSpeedDegPerSec: 25,
  historyVisible: true,
  skyVisible: true,
  angleAidsVisible: false,
  theoryVisible: false,
  bVisible: false,
  fontMode: 'large',
};

const element = (id) => {
  const found = document.getElementById(id);
  if (!found) throw new Error(`缺少界面元素 #${id}`);
  return found;
};

function clampPhi(value) {
  return clamp(value, 0, 180);
}

function formatDegrees(value, digits = 1) {
  return `${value.toFixed(digits)}°`;
}

function formatError(value) {
  if (!Number.isFinite(value)) return '—';
  if (value === 0) return '0';
  return value.toExponential(2);
}

function showFatal(message) {
  if (typeof window.__showComptonFatal === 'function') {
    window.__showComptonFatal(message);
    return;
  }
  const overlay = document.getElementById('fatal-error');
  if (overlay) {
    overlay.hidden = false;
    const copy = overlay.querySelector('.fatal-message');
    if (copy) copy.textContent = message;
  }
}

function boot() {
  const dom = {
    viewport: element('viewport'),
    loading: element('loading-overlay'),
    validationBadge: element('validation-badge'),
    helpOpen: element('help-open'),
    readoutToggle: element('readout-toggle'),
    helpOpenSecondary: element('help-open-secondary'),
    helpModal: element('help-modal'),
    validationOpen: element('validation-open'),
    validationModal: element('validation-modal'),
    fullscreen: element('fullscreen-button'),
    versionLabel: element('version-label'),
    phiValue: element('phi-value'),
    phiNumber: element('phi-number'),
    phiRange: element('phi-range'),
    betaValue: element('beta-value'),
    betaNumber: element('beta-number'),
    betaRange: element('beta-range'),
    autoToggle: element('auto-toggle'),
    speedRange: element('speed-range'),
    speedValue: element('speed-value'),
    toggleHistory: element('toggle-history'),
    toggleSky: element('toggle-sky'),
    toggleAngleAids: element('toggle-angle-aids'),
    toggleTheory: element('toggle-theory'),
    toggleB: element('toggle-b'),
    clearTrails: element('clear-trails'),
    resetView: element('reset-view'),
    readoutBeta: element('readout-beta'),
    readoutPhi: element('readout-phi'),
    readoutChiK: element('readout-chi-k'),
    readoutPsiK: element('readout-psi-k'),
    readoutChiA: element('readout-chi-a'),
    readoutPsiA: element('readout-psi-a'),
    readoutCircle: element('readout-circle-state'),
    energyScattered: element('energy-scattered'),
    energyRecoil: element('energy-recoil'),
    historyCount: element('history-count'),
    historyItems: element('history-items'),
    cameraHint: element('camera-hint'),
    modeOrbit: element('mode-orbit'),
    modeFly: element('mode-fly'),
    flyHud: element('fly-hud'),
    flyLockState: element('fly-lock-state'),
    flyExit: element('fly-exit'),
    fontButtons: Array.from(document.querySelectorAll('[data-font-size]')),
    toast: element('toast'),
    validationSummary: element('validation-summary'),
    validationGroups: element('validation-groups'),
    validationChecks: element('validation-checks'),
    validationRun: element('validation-run'),
    modalCloseButtons: Array.from(document.querySelectorAll('[data-close-modal]')),
    modalBackdrops: Array.from(document.querySelectorAll('.modal-backdrop')),
  };

  for (const input of [dom.toggleHistory, dom.toggleSky, dom.toggleAngleAids, dom.toggleTheory, dom.toggleB]) {
    if (!(input instanceof HTMLInputElement)) throw new Error('开关初始化失败。');
  }

  let scene;
  try {
    scene = new ComptonScene(dom.viewport, {
      sourceChiDeg: SOURCE_CHI_DEG,
      sourcePsiDeg: SOURCE_PSI_DEG,
      R,
      ringSegments: 192,
      homePosition: new THREE.Vector3(5.2, 2.15, 2.35),
      homeTarget: new THREE.Vector3(0, 0.03, 0),
    });
  } catch (error) {
    showFatal(error instanceof Error ? error.message : String(error));
    dom.loading?.classList.add('hidden');
    throw error;
  }

  const basis = makeSourceBasis(directionFromAngles(degToRad(SOURCE_CHI_DEG), degToRad(SOURCE_PSI_DEG)));
  const history = new TrailHistory({ stepDeg: 0.25 });
  history.setPhi(state.phiDeg);
  let trailDirty = true;

  let lastFrameTime = performance.now();
  let firstFrame = true;
  let validationResult = null;
  let validationDurationMs = 0;
  let currentModal = null;
  let restoreFocusElement = null;
  let toastTimer = null;
  let betaSliderActive = false;

  const rig = new CameraRig({
    camera: scene.camera,
    domElement: scene.domElement,
    homePosition: scene.homePosition,
    homeTarget: scene.homeTarget,
    minDistance: R * 1.6,
    maxDistance: R * 9,
    onModeChange: () => updateCameraUI(),
    onPointerLockChange: () => updateFlyHud(),
  });
  scene.setCameraRig(rig);

  const dirAtBetaForPhi = (phiDeg) => (betaDeg) =>
    coneAxisDirection(degToRad(phiDeg), degToRad(wrapDeg(betaDeg)), basis).axis;

  function betaDisplayDeg() {
    return state.manualBetaDisplayDeg ?? wrapDeg(state.betaInternalDeg);
  }

  function betaSceneRadians() {
    return degToRad(wrapDeg(state.betaInternalDeg));
  }

  // ---------------------------------------------------------------------
  // Physical state / readouts
  // ---------------------------------------------------------------------
  function updatePhysicsReadouts() {
    const phi = degToRad(state.phiDeg);
    const beta = degToRad(wrapDeg(state.betaInternalDeg));
    const { axis, k } = coneAxisDirection(phi, beta, basis);
    const kAngles = anglesFromDirection(k);
    const aAngles = anglesFromDirection(axis);
    const kCell = formatAngleCell(kAngles);
    const aCell = formatAngleCell(aAngles);
    const display = betaDisplayDeg();

    dom.readoutBeta.textContent = `${formatDegrees(display)} / 累计 ${formatDegrees(state.betaInternalDeg)}`;
    dom.readoutPhi.textContent = formatDegrees(state.phiDeg);
    dom.readoutChiK.textContent = kCell.chi;
    dom.readoutPsiK.textContent = kCell.psi;
    dom.readoutChiA.textContent = aCell.chi;
    dom.readoutPsiA.textContent = aCell.psi;

    const sinPhi = Math.abs(Math.sin(phi));
    if (sinPhi < 1e-9) {
      dom.readoutCircle.textContent =
        state.phiDeg < 90 ? '退化：候选方向 = S 点' : '退化：候选方向 = S 点';
    } else if (Math.abs(Math.cos(phi)) < 1e-9) {
      dom.readoutCircle.textContent = 'φ=90° 大圆 / 平面盘';
    } else {
      dom.readoutCircle.textContent = '小圆 · 数学上经过 S';
    }

    const scattered = scatteredPhotonEnergy(INCIDENT_ENERGY_KEV, phi);
    const recoil = recoilElectronEnergy(INCIDENT_ENERGY_KEV, phi);
    dom.energyScattered.textContent = `${scattered.toFixed(1)} keV`;
    dom.energyRecoil.textContent = `${recoil.toFixed(1)} keV`;
  }

  function syncControls() {
    const display = betaDisplayDeg();
    dom.phiValue.textContent = formatDegrees(state.phiDeg);
    dom.betaValue.textContent = formatDegrees(display);
    dom.phiRange.value = String(state.phiDeg);
    dom.betaRange.value = String(display);
    dom.phiRange.setAttribute('aria-valuetext', formatDegrees(state.phiDeg));
    dom.betaRange.setAttribute('aria-valuetext', formatDegrees(display));
    if (document.activeElement !== dom.phiNumber) {
      dom.phiNumber.value = state.phiDeg.toFixed(1);
    }
    if (document.activeElement !== dom.betaNumber) {
      dom.betaNumber.value = display.toFixed(1);
    }
  }

  function updateAutoUI() {
    dom.autoToggle.classList.toggle('is-playing', state.autoPlaying);
    dom.autoToggle.setAttribute('aria-pressed', String(state.autoPlaying));
    dom.autoToggle.innerHTML = state.autoPlaying
      ? '<span class="button-glyph">Ⅱ</span> 暂停自动旋转'
      : '<span class="button-glyph">▶</span> 开始自动旋转';
  }

  function refreshScene() {
    scene.updateCurrent(degToRad(state.phiDeg), betaSceneRadians());
  }

  function updateHistoryUI() {
    dom.historyCount.textContent = `${history.segments.length} 段`;
    if (history.segments.length === 0) {
      dom.historyItems.innerHTML = '<div class="history-empty">转动 β 后开始记录；每段固定自己的 φ。</div>';
      return;
    }
    dom.historyItems.innerHTML = history.segments
      .map((segment) => {
        const start = wrapDeg(segment.startBetaDeg);
        const end = wrapDeg(segment.endBetaDeg);
        const wrapped = Math.abs(segment.endBetaDeg - segment.startBetaDeg) > 359.999;
        const sweep = segment.endBetaDeg - segment.startBetaDeg;
        const betaText = `${start.toFixed(1)}° → ${end.toFixed(1)}° · 跨 ${sweep.toFixed(0)}°`;
        return `<div class="history-item" title="segment #${segment.id}，${segment.points.length} 个采样点；累计 β 从 ${segment.startBetaDeg.toFixed(1)}° 到 ${segment.endBetaDeg.toFixed(1)}°"><i></i><span class="h-phi">φ=${segment.phiDeg.toFixed(1)}°</span><span class="h-points">${segment.points.length} pts</span><span class="h-beta">β ${betaText}</span></div>`;
      })
      .join('');
  }

  function refreshAll() {
    syncControls();
    updatePhysicsReadouts();
    refreshScene();
    if (trailDirty) {
      scene.setHistory(history.segments, state.historyVisible);
      trailDirty = false;
    }
  }

  // ---------------------------------------------------------------------
  // Toast / modals
  // ---------------------------------------------------------------------
  function toast(message, duration = 2600) {
    dom.toast.textContent = message;
    dom.toast.classList.add('is-visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => dom.toast.classList.remove('is-visible'), duration);
  }

  function openModal(modal) {
    if (!modal) return;
    if (currentModal && currentModal !== modal) closeModal(currentModal, false);
    currentModal = modal;
    restoreFocusElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    modal.hidden = false;
    modal.setAttribute('data-modal-open', 'true');
    modal.classList.add('is-open');
    document.body.classList.add('modal-open');
    rig.setCameraInputEnabled(false);
    const focusTarget = modal.querySelector('.modal-close');
    focusTarget?.focus({ preventScroll: true });
  }

  function closeModal(modal = currentModal, restoreFocus = true) {
    if (!modal) return;
    modal.classList.remove('is-open');
    modal.hidden = true;
    modal.removeAttribute('data-modal-open');
    if (currentModal === modal) currentModal = null;
    if (!document.querySelector('[data-modal-open="true"]')) {
      document.body.classList.remove('modal-open');
      rig.setCameraInputEnabled(true);
    }
    if (restoreFocus && restoreFocusElement?.isConnected) {
      restoreFocusElement.focus({ preventScroll: true });
    }
  }

  // ---------------------------------------------------------------------
  // History-preserving beta / phi operations
  // ---------------------------------------------------------------------
  function finalizeTrail() {
    const changed = history.finalize(
      state.phiDeg,
      state.betaInternalDeg,
      dirAtBetaForPhi(state.phiDeg),
    );
    if (changed) trailDirty = true;
  }

  function stopAutoForManualChange({ silent = false } = {}) {
    if (!state.autoPlaying) return;
    state.autoPlaying = false;
    finalizeTrail();
    updateAutoUI();
    if (!silent) toast('自动旋转已暂停；已有轨迹保留。', 1800);
  }

  function applyBetaDisplayTarget(targetDeg, { finish = true } = {}) {
    const target = clamp(Number(targetDeg), 0, 360);
    if (!Number.isFinite(target)) return false;
    if (state.autoPlaying) stopAutoForManualChange({ silent: true });

    const oldInternal = state.betaInternalDeg;
    const oldDisplay = betaDisplayDeg();
    const delta = target - oldDisplay;
    if (Math.abs(delta) < 1e-12) {
      if (finish) {
        history.finalize(state.phiDeg, oldInternal, dirAtBetaForPhi(state.phiDeg));
        trailDirty = true;
      }
      syncControls();
      updatePhysicsReadouts();
      return false;
    }

    const newInternal = oldInternal + delta;
    history.advance({
      phiDeg: state.phiDeg,
      fromBeta: oldInternal,
      toBeta: newInternal,
      dirAtBeta: dirAtBetaForPhi(state.phiDeg),
      finish,
    });
    state.betaInternalDeg = newInternal;
    // Preserve the manual 360° endpoint, so dragging back to 359.9° records
    // -0.1°, rather than treating the previous position as a wrapped 0°.
    state.manualBetaDisplayDeg = target;
    trailDirty = true;
    syncControls();
    updatePhysicsReadouts();
    refreshScene();
    if (Math.abs(delta) >= 359.999 && Math.abs(newInternal % 360) < 1e-9) {
      toast('已记录完整 360° 旋转；手动端点保留为 360°，自动旋转时连续回绕。', 3400);
    }
    return true;
  }

  function finishBetaInteraction() {
    const changed = history.finalize(
      state.phiDeg,
      state.betaInternalDeg,
      dirAtBetaForPhi(state.phiDeg),
    );
    if (changed) {
      trailDirty = true;
      scene.setHistory(history.segments, state.historyVisible);
      updateHistoryUI();
    }
    syncControls();
    updatePhysicsReadouts();
  }

  function applyPhi(nextPhi) {
    if (!Number.isFinite(nextPhi)) return false;
    const target = clampPhi(nextPhi);
    if (Math.abs(target - state.phiDeg) < 1e-12) {
      syncControls();
      return false;
    }
    if (state.autoPlaying) stopAutoForManualChange({ silent: true });

    // Close any pending old-phi trail at exactly the current beta, then detach
    // so no old-phi point can be connected to a new-phi point.
    finalizeTrail();
    history.finalize(state.phiDeg, state.betaInternalDeg, dirAtBetaForPhi(state.phiDeg));
    history.setPhi(target);
    state.phiDeg = target;
    trailDirty = true;
    syncControls();
    updatePhysicsReadouts();
    refreshScene();
    scene.setHistory(history.segments, state.historyVisible);
    updateHistoryUI();
    trailDirty = false;
    return true;
  }

  function startAuto() {
    if (state.autoPlaying) return;
    state.autoPlaying = true;
    state.manualBetaDisplayDeg = null;
    lastFrameTime = performance.now();
    updateAutoUI();
    toast('自动旋转中：β 均匀增加，蓝色轨迹按角度采样。', 2400);
  }

  function pauseAuto() {
    if (!state.autoPlaying) {
      finalizeTrail();
      return;
    }
    state.autoPlaying = false;
    finalizeTrail();
    updateAutoUI();
    syncControls();
    updatePhysicsReadouts();
    scene.setHistory(history.segments, state.historyVisible);
    updateHistoryUI();
    trailDirty = false;
    toast('自动旋转已暂停；轨迹保留。', 1800);
  }

  function toggleAuto() {
    if (state.autoPlaying) pauseAuto();
    else startAuto();
  }

  function clearTrails() {
    history.clear();
    trailDirty = true;
    scene.setHistory(history.segments, state.historyVisible);
    updateHistoryUI();
    trailDirty = false;
    toast('历史轨迹已清空；φ、β、相机均未重置。', 3000);
  }

  function resetCamera() {
    if (rig.isFlyMode) rig.exitFly();
    rig.resetView();
    toast('观察视角已重置；历史轨迹和物理参数保持不变。', 2600);
  }

  // ---------------------------------------------------------------------
  // Camera mode UI
  // ---------------------------------------------------------------------
  function updateCameraUI() {
    const fly = rig.isFlyMode;
    dom.modeOrbit.classList.toggle('is-active', !fly);
    dom.modeFly.classList.toggle('is-active', fly);
    dom.modeOrbit.setAttribute('aria-pressed', String(!fly));
    dom.modeFly.setAttribute('aria-pressed', String(fly));
    dom.cameraHint.textContent = fly
      ? '鼠标看方向 · W/A/S/D 水平移动 · Q/E 下降/上升 · Shift 加速 · Esc 退出'
      : '左键拖动旋转 · 右键或 Shift+拖动平移 · 滚轮缩放';
    dom.flyHud.hidden = !fly;
    document.body.classList.toggle('fly-mode', fly);
    updateFlyHud();
  }

  function updateFlyHud() {
    if (!dom.flyLockState) return;
    const fly = rig.isFlyMode;
    if (!fly) return;
    if (rig.pointerLocked) {
      dom.flyLockState.textContent = '鼠标已锁定 · 移动鼠标转向 · 按 Esc 返回轨道观察';
    } else {
      dom.flyLockState.textContent = '点击画面可锁定鼠标；未锁定时可直接拖动画面转向';
    }
  }

  // ---------------------------------------------------------------------
  // Presentation text size
  // ---------------------------------------------------------------------
  const FONT_MODES = new Set(['standard', 'large', 'xlarge']);

  function applyFontMode(mode, { persist = true } = {}) {
    const next = FONT_MODES.has(mode) ? mode : 'large';
    state.fontMode = next;
    document.documentElement.dataset.fontSize = next;
    for (const button of dom.fontButtons) {
      const active = button.dataset.fontSize === next;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    }
    scene.invalidateLabelLayout();
    if (persist) {
      try {
        localStorage.setItem('compton-event-font-size', next);
      } catch {
        // Local storage may be unavailable for file:// in some browsers.
      }
    }
  }

  function readInitialFontMode() {
    try {
      const saved = localStorage.getItem('compton-event-font-size');
      if (FONT_MODES.has(saved)) return saved;
    } catch {
      // Ignore unavailable storage.
    }
    return window.innerHeight <= 820 ? 'xlarge' : 'large';
  }

  // ---------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------
  function renderValidation(result, durationMs) {
    const tone = result.passed ? 'success' : 'failure';
    dom.validationSummary.className = `validation-summary ${tone}`;
    dom.validationSummary.innerHTML = `
      <div class="validation-score">
        <strong>${result.passedNumber ?? result.passedCount ?? result.passed}/${result.total}</strong>
        <span>${result.passed ? '全部通过' : '存在失败项'}</span>
      </div>
      <div class="validation-meta">
        <span>双精度容差：<code>${result.tolerance.toExponential(1)}</code></span>
        <span>实际最大误差：<code>${formatError(result.maxError)}</code></span>
        <span>运行耗时：<code>${durationMs.toFixed(1)} ms</code></span>
      </div>`;
    dom.validationGroups.innerHTML = result.groups
      .map(
        (group) => `
          <div class="validation-group ${group.passed ? 'ok' : 'bad'}">
            <div class="validation-group-head">
              <strong>${group.name}</strong>
              <span>${group.passedCount}/${group.total} ${group.passed ? 'PASS' : 'FAIL'}</span>
            </div>
            <p>${group.description}</p>
            <div class="validation-group-foot">组内最大误差 <code>${formatError(group.maxError)}</code></div>
          </div>`,
      )
      .join('');
    dom.validationChecks.innerHTML = result.groups
      .map(
        (group) => `
          <details class="check-details">
            <summary>${group.name} · ${group.passedCount}/${group.total}</summary>
            <ul>
              ${group.checks
                .map(
                  (check) =>
                    `<li class="${check.passed ? 'ok' : 'bad'}"><span>${check.passed ? 'PASS' : 'FAIL'}</span>${check.name}<code>${formatError(check.error)}</code></li>`,
                )
                .join('')}
            </ul>
          </details>`,
      )
      .join('');
    dom.validationBadge.className = `badge ${result.passed ? 'badge-success' : 'badge-failure'}`;
    dom.validationBadge.textContent = `数学自检 ${result.passedCount}/${result.total} ${result.passed ? 'PASS' : 'FAIL'}`;
    dom.validationBadge.title = '点击查看页面内双精度数学验证结果';
  }

  function executeValidation({ open = false } = {}) {
    const t0 = performance.now();
    const result = runValidation();
    validationDurationMs = performance.now() - t0;
    validationResult = result;
    renderValidation(result, validationDurationMs);
    if (open) openModal(dom.validationModal);
    return result;
  }

  function showValidation() {
    if (!validationResult) executeValidation();
    else renderValidation(validationResult, validationDurationMs);
    openModal(dom.validationModal);
  }

  // ---------------------------------------------------------------------
  // Bind UI
  // ---------------------------------------------------------------------
  dom.phiRange.addEventListener('input', () => {
    const value = Number.parseFloat(dom.phiRange.value);
    applyPhi(value);
  });

  dom.phiNumber.addEventListener('change', () => {
    const raw = Number.parseFloat(dom.phiNumber.value);
    if (!Number.isFinite(raw) || raw < 0 || raw > 180) {
      dom.phiNumber.setAttribute('aria-invalid', 'true');
      dom.phiNumber.classList.add('is-invalid');
      toast('φ 必须在 0° 到 180° 之间。', 2600);
      syncControls();
      return;
    }
    dom.phiNumber.removeAttribute('aria-invalid');
    dom.phiNumber.classList.remove('is-invalid');
    applyPhi(raw);
    if (document.activeElement !== dom.phiNumber) syncControls();
  });
  dom.phiNumber.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      dom.phiNumber.blur();
    }
  });
  dom.phiNumber.addEventListener('blur', () => {
    syncControls();
  });

  dom.betaRange.addEventListener('pointerdown', () => {
    betaSliderActive = true;
    if (state.autoPlaying) stopAutoForManualChange({ silent: true });
  });
  dom.betaRange.addEventListener('input', () => {
    betaSliderActive = true;
    applyBetaDisplayTarget(Number.parseFloat(dom.betaRange.value), { finish: false });
  });
  dom.betaRange.addEventListener('change', () => {
    betaSliderActive = false;
    // Finalize regardless of the pointerup/change ordering so the exact last
    // beta endpoint is written even if the final interval is < 0.25 deg.
    finishBetaInteraction();
  });
  dom.betaRange.addEventListener('keyup', () => {
    finishBetaInteraction();
  });
  window.addEventListener('pointerup', () => {
    if (!betaSliderActive) return;
    betaSliderActive = false;
    finishBetaInteraction();
  });

  dom.betaNumber.addEventListener('change', () => {
    const raw = Number.parseFloat(dom.betaNumber.value);
    if (!Number.isFinite(raw) || raw < 0 || raw > 360) {
      dom.betaNumber.setAttribute('aria-invalid', 'true');
      dom.betaNumber.classList.add('is-invalid');
      toast('β 必须在 0° 到 360° 之间。', 2600);
      syncControls();
      return;
    }
    dom.betaNumber.removeAttribute('aria-invalid');
    dom.betaNumber.classList.remove('is-invalid');
    if (state.autoPlaying) stopAutoForManualChange({ silent: true });
    const target = clamp(raw, 0, 360);
    // Treat the number as an absolute display value. A 0 -> 360 input sweeps
    // the full interval; it is not shortened to a zero-length shortest path.
    applyBetaDisplayTarget(target, { finish: true });
  });
  dom.betaNumber.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      dom.betaNumber.blur();
    }
  });
  dom.betaNumber.addEventListener('blur', () => {
    syncControls();
  });

  dom.autoToggle.addEventListener('click', toggleAuto);

  dom.speedRange.addEventListener('input', () => {
    state.autoSpeedDegPerSec = Number.parseFloat(dom.speedRange.value);
    dom.speedValue.textContent = `${state.autoSpeedDegPerSec.toFixed(0)}°/s`;
  });

  dom.toggleHistory.addEventListener('change', () => {
    state.historyVisible = dom.toggleHistory.checked;
    scene.setHistoryVisible(state.historyVisible);
  });
  dom.toggleSky.addEventListener('change', () => {
    state.skyVisible = dom.toggleSky.checked;
    scene.setSkyVisible(state.skyVisible);
  });
  dom.toggleAngleAids.addEventListener('change', () => {
    state.angleAidsVisible = dom.toggleAngleAids.checked;
    scene.setAngleAidsVisible(state.angleAidsVisible);
  });
  dom.toggleTheory.addEventListener('change', () => {
    state.theoryVisible = dom.toggleTheory.checked;
    scene.setTheoryVisible(state.theoryVisible);
  });
  dom.toggleB.addEventListener('change', () => {
    state.bVisible = dom.toggleB.checked;
    scene.setBVisible(state.bVisible);
  });

  dom.clearTrails.addEventListener('click', clearTrails);
  dom.resetView.addEventListener('click', resetCamera);

  dom.modeOrbit.addEventListener('click', () => {
    if (rig.isFlyMode) rig.exitFly();
    updateCameraUI();
  });
  dom.modeFly.addEventListener('click', () => {
    if (!rig.isFlyMode) rig.enterFly();
    else {
      // In unlocked fly mode a click on the button can request lock again.
      if (!rig.pointerLocked) {
        rig.enterFly();
      }
    }
    updateCameraUI();
  });
  dom.flyExit?.addEventListener('click', () => {
    rig.exitFly();
    updateCameraUI();
  });
  for (const button of dom.fontButtons) {
    button.addEventListener('click', () => {
      applyFontMode(button.dataset.fontSize);
    });
  }

  dom.helpOpen.addEventListener('click', () => openModal(dom.helpModal));
  dom.helpOpenSecondary.addEventListener('click', () => openModal(dom.helpModal));
  dom.readoutToggle.addEventListener('click', () => {
    const open = !document.body.classList.contains('show-readout');
    document.body.classList.toggle('show-readout', open);
    dom.readoutToggle.setAttribute('aria-pressed', String(open));
  });
  dom.validationOpen.addEventListener('click', showValidation);
  dom.validationBadge.addEventListener('click', showValidation);
  dom.validationRun.addEventListener('click', () => executeValidation({ open: false }));

  for (const button of dom.modalCloseButtons) {
    button.addEventListener('click', () => closeModal(button.closest('.modal-backdrop')));
  }
  for (const backdrop of dom.modalBackdrops) {
    backdrop.addEventListener('pointerdown', (event) => {
      if (event.target === backdrop) closeModal(backdrop);
    });
  }
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && currentModal) {
      event.preventDefault();
      closeModal(currentModal);
    }
  });

  dom.fullscreen.addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      toast('浏览器拒绝了全屏请求。', 2200);
    }
  });
  document.addEventListener('fullscreenchange', () => {
    dom.fullscreen.textContent = document.fullscreenElement ? '⤡' : '⛶';
    dom.fullscreen.title = document.fullscreenElement ? '退出全屏' : '全屏';
  });

  // Avoid the camera from moving while a form field has focus even in fly mode.
  dom.phiNumber.addEventListener('focus', () => rig.setCameraInputEnabled(false));
  dom.phiNumber.addEventListener('blur', () => {
    if (!currentModal) rig.setCameraInputEnabled(true);
  });
  dom.betaNumber.addEventListener('focus', () => rig.setCameraInputEnabled(false));
  dom.betaNumber.addEventListener('blur', () => {
    if (!currentModal) rig.setCameraInputEnabled(true);
  });

  // ---------------------------------------------------------------------
  // Initial state and animation
  // ---------------------------------------------------------------------
  applyFontMode(readInitialFontMode(), { persist: false });

  dom.toggleHistory.checked = state.historyVisible;
  dom.toggleSky.checked = state.skyVisible;
  dom.toggleAngleAids.checked = state.angleAidsVisible;
  dom.toggleTheory.checked = state.theoryVisible;
  dom.toggleB.checked = state.bVisible;
  dom.speedRange.value = String(state.autoSpeedDegPerSec);
  dom.speedValue.textContent = `${state.autoSpeedDegPerSec.toFixed(0)}°/s`;
  if (dom.versionLabel) dom.versionLabel.textContent = 'v1.0 · real-space geometry';

  scene.updateCurrent(degToRad(state.phiDeg), betaSceneRadians(), { force: true });
  scene.setHistory([], state.historyVisible);
  scene.setSkyVisible(state.skyVisible);
  scene.setAngleAidsVisible(state.angleAidsVisible);
  scene.setTheoryVisible(state.theoryVisible);
  scene.setBVisible(state.bVisible);
  syncControls();
  updatePhysicsReadouts();
  updateAutoUI();
  updateCameraUI();
  executeValidation();
  scene.setHistory([], state.historyVisible);
  updateHistoryUI();
  trailDirty = false;

  function animationLoop(now) {
    const dt = Math.min(0.1, Math.max(0, (now - lastFrameTime) / 1000));
    lastFrameTime = now;

    if (state.autoPlaying) {
      const fromBeta = state.betaInternalDeg;
      const toBeta = fromBeta + state.autoSpeedDegPerSec * dt;
      history.advance({
        phiDeg: state.phiDeg,
        fromBeta,
        toBeta,
        dirAtBeta: dirAtBetaForPhi(state.phiDeg),
        finish: false,
      });
      state.betaInternalDeg = toBeta;
      trailDirty = true;
      syncControls();
      updatePhysicsReadouts();
      scene.updateCurrent(degToRad(state.phiDeg), betaSceneRadians());
    }

    rig.update(dt);

    if (trailDirty) {
      scene.setHistory(history.segments, state.historyVisible);
      updateHistoryUI();
      trailDirty = false;
    }
    scene.render();

    if (firstFrame) {
      firstFrame = false;
      dom.loading.classList.add('hidden');
    }
    requestAnimationFrame(animationLoop);
  }
  requestAnimationFrame(animationLoop);

  // ---------------------------------------------------------------------
  // Debug/verification bridge (also used by the browser acceptance script)
  // ---------------------------------------------------------------------
  window.__COMPTON__ = Object.freeze({
    version: '1.0.0',
    getState: () => {
      const phi = degToRad(state.phiDeg);
      const beta = degToRad(wrapDeg(state.betaInternalDeg));
      const { axis, k } = coneAxisDirection(phi, beta, basis);
      const data = scene.currentData;
      const cameraDirection = new THREE.Vector3();
      scene.camera.getWorldDirection(cameraDirection);
      let eventCircleSourceError = Number.POSITIVE_INFINITY;
      if (data?.ringDirections?.length) {
        eventCircleSourceError = 0;
        for (let i = 0; i < 3; i += 1) {
          eventCircleSourceError = Math.max(
            eventCircleSourceError,
            Math.abs(data.ringDirections[0][i] - basis.s0[i]),
          );
        }
      }
      return {
        phiDeg: state.phiDeg,
        betaInternalDeg: state.betaInternalDeg,
        betaDisplayDeg: betaDisplayDeg(),
        autoPlaying: state.autoPlaying,
        autoSpeedDegPerSec: state.autoSpeedDegPerSec,
        sourceAngles: { chiDeg: SOURCE_CHI_DEG, psiDeg: SOURCE_PSI_DEG },
        sourceDirection: basis.s0.slice(),
        axisA: axis.slice(),
        k: k.slice(),
        anglesK: serializeAngles(anglesFromDirection(k)),
        anglesA: serializeAngles(anglesFromDirection(axis)),
        classification: data?.classification ?? null,
        eventCircleSourceError,
        eventCircleRadius: data?.ringRadius ?? null,
        planeCenterB: data ? scaleToArray(data.centerB) : null,
        history: {
          segmentCount: history.segments.length,
          pointCount: history.totalPointCount,
          renderedLineCount: scene.getHistoryLineCount(),
          segments: history.segments.map((segment) => ({
            id: segment.id,
            phiDeg: segment.phiDeg,
            startBetaDeg: segment.startBetaDeg,
            endBetaDeg: segment.endBetaDeg,
            pointCount: segment.points.length,
          })),
        },
        camera: {
          mode: rig.mode,
          pointerLocked: rig.pointerLocked,
          position: scene.camera.position.toArray(),
          direction: cameraDirection.toArray(),
        },
        renderDiagnostics: scene.getRenderDiagnostics(),
        toggles: {
          historyVisible: state.historyVisible,
          skyVisible: state.skyVisible,
          angleAidsVisible: state.angleAidsVisible,
          theoryVisible: state.theoryVisible,
          bVisible: state.bVisible,
        },
        renderRadius: R,
        fontMode: state.fontMode,
        validation: validationResult
          ? {
              passed: validationResult.passed,
              passedCount: validationResult.passedCount,
              total: validationResult.total,
              maxError: validationResult.maxError,
            }
          : null,
      };
    },
    getHistorySnapshot: () => history.snapshot(),
    getValidation: () => validationResult,
    runValidation: () => executeValidation(),
    setPhi: (deg) => applyPhi(Number(deg)),
    setBeta: (deg) => {
      if (state.autoPlaying) stopAutoForManualChange({ silent: true });
      return applyBetaDisplayTarget(Number(deg), { finish: true });
    },
    setBetaInternal: (deg) => {
      if (!Number.isFinite(Number(deg))) return false;
      const target = Number(deg);
      if (state.autoPlaying) stopAutoForManualChange({ silent: true });
      const old = state.betaInternalDeg;
      history.advance({
        phiDeg: state.phiDeg,
        fromBeta: old,
        toBeta: target,
        dirAtBeta: dirAtBetaForPhi(state.phiDeg),
        finish: true,
      });
      state.betaInternalDeg = target;
      state.manualBetaDisplayDeg = null;
      trailDirty = true;
      syncControls();
      updatePhysicsReadouts();
      refreshScene();
      return true;
    },
    startAuto,
    pauseAuto,
    toggleAuto,
    clearHistory: clearTrails,
    resetCamera,
    setCameraMode: (mode) => {
      if (mode === 'fly' && !rig.isFlyMode) rig.enterFly();
      else if (mode === 'orbit' && rig.isFlyMode) rig.exitFly();
      updateCameraUI();
      return rig.mode;
    },
    setCameraOrbit: ({ thetaDeg = 0, polarDeg = 75, radius = R * 3.8 } = {}) => {
      if (rig.isFlyMode) rig.exitFly();
      rig.setOrbitView({
        theta: degToRad(thetaDeg),
        polar: degToRad(polarDeg),
        radius,
      });
      updateCameraUI();
      return rig.mode;
    },
    setFontMode: (mode) => {
      applyFontMode(String(mode));
      return state.fontMode;
    },
    setToggle: (name, value) => {
      const mapping = {
        history: [dom.toggleHistory, 'historyVisible', () => scene.setHistoryVisible(state.historyVisible)],
        sky: [dom.toggleSky, 'skyVisible', () => scene.setSkyVisible(state.skyVisible)],
        angleAids: [dom.toggleAngleAids, 'angleAidsVisible', () => scene.setAngleAidsVisible(state.angleAidsVisible)],
        theory: [dom.toggleTheory, 'theoryVisible', () => scene.setTheoryVisible(state.theoryVisible)],
        b: [dom.toggleB, 'bVisible', () => scene.setBVisible(state.bVisible)],
      };
      const entry = mapping[name];
      if (!entry) return false;
      entry[0].checked = Boolean(value);
      state[entry[1]] = Boolean(value);
      entry[2]();
      return true;
    },
  });

  // Focus indicator prevents the physical UI from being confused with camera
  // input; it has no effect on beta.
  window.addEventListener('resize', () => scene.resize());
}

function serializeAngles(angles) {
  return {
    chiDeg: radToDeg(angles.chi),
    psiDeg: angles.pole || angles.psi === null ? null : radToDeg(angles.psi),
    pole: Boolean(angles.pole),
  };
}

function scaleToArray(point) {
  return [point[0], point[1], point[2]];
}

try {
  installLanguageSwitch();
  boot();
  typesetEventMath(document);
} catch (error) {
  console.error('[Compton visualization] initialization failed', error);
  showFatal(error instanceof Error ? error.message : String(error));
  const loading = document.getElementById('loading-overlay');
  loading?.classList.add('hidden');
}
