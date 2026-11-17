/**
 * Browser acceptance checks for the delivered self-contained page.
 *
 * Opens event-cone-rotation.html straight from file:// (no server, no network), drives the
 * actual UI in headless Chrome, reads the explicit debug bridge for numeric
 * assertions, and writes screenshots for visual review.
 *
 * Usage: npm run test:browser
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const pagePath = path.join(root, 'event-cone-rotation.html');
const artifactsDir = path.join(root, 'artifacts');
const pageUrl = pathToFileURL(pagePath).href;
const chromePath = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const viewport = { width: 1600, height: 1000 };

await fs.mkdir(artifactsDir, { recursive: true });

const results = [];
let failures = 0;
let consoleErrors = 0;
let externalRequests = 0;

function record(id, name, condition, detail = '') {
  const passed = Boolean(condition);
  results.push({ id, name, passed, detail });
  if (!passed) failures += 1;
  console.log(`${passed ? 'PASS' : 'FAIL'}  ${id.padEnd(4)} ${name}${detail ? ` — ${detail}` : ''}`);
}

function maxBetaGap(segment) {
  let max = 0;
  for (let i = 1; i < segment.points.length; i += 1) {
    max = Math.max(max, Math.abs(segment.points[i].betaDeg - segment.points[i - 1].betaDeg));
  }
  return max;
}

function compactHistory(history) {
  return JSON.stringify(history);
}

function approx(actual, expected, tolerance = 1e-9) {
  return Math.abs(actual - expected) <= tolerance;
}

function norm(v) {
  return Math.hypot(v[0], v[1], v[2]);
}

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

async function openPage(browser) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors += 1;
      console.log(`[console error] ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => {
    consoleErrors += 1;
    console.log(`[page error] ${error.stack || error.message}`);
  });
  page.on('request', (request) => {
    if (/^https?:/i.test(request.url())) externalRequests += 1;
  });
  await page.goto(pageUrl, { waitUntil: 'load' });
  await page.waitForFunction(() => Boolean(window.__COMPTON__), null, { timeout: 15000 });
  await page.waitForFunction(
    () => window.__COMPTON__?.getState().validation?.passed === true,
    null,
    { timeout: 15000 },
  );
  await page.waitForTimeout(500);
  return page;
}

async function getState(page) {
  return page.evaluate(() => window.__COMPTON__.getState());
}

async function getHistory(page) {
  return page.evaluate(() => window.__COMPTON__.getHistorySnapshot());
}

async function setNumber(page, selector, value) {
  await page.locator(selector).fill(String(value));
  await page.locator(selector).press('Enter');
  await page.waitForTimeout(220);
}

async function setSpeedThroughUI(page, value) {
  await page.evaluate((nextValue) => {
    const input = document.getElementById('speed-range');
    input.value = String(nextValue);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}

async function screenshot(page, name) {
  await page.waitForTimeout(180);
  await page.screenshot({ path: path.join(artifactsDir, name) });
  console.log(`      saved artifacts/${name}`);
}

async function dragView(page, dx, dy) {
  const canvas = page.locator('canvas.webgl-canvas');
  const box = await canvas.boundingBox();
  const x = box.x + box.width * 0.58;
  const y = box.y + box.height * 0.68;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(180);
}

let browser;
try {
  browser = await chromium.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-gpu-sandbox'],
  });
  const page = await openPage(browser);

  const initial = await getState(page);
  record(
    '0.1',
    '页面通过 file:// 直接启动，WebGL 场景与数学自检可用',
    initial.validation?.passed === true && initial.validation.passedCount === 80,
    `validation=${initial.validation?.passedCount}/${initial.validation?.total}`,
  );
  record(
    '0.2',
    '初始参数：φ=35°，β=0°，源 (145°,35°)，历史为空',
    initial.phiDeg === 35 &&
      initial.betaDisplayDeg === 0 &&
      initial.history.segmentCount === 0 &&
      initial.sourceAngles.chiDeg === 145 &&
      initial.sourceAngles.psiDeg === 35,
  );
  record(
    '0.3',
    '运行时没有加载任何 HTTP(S) 外部资源',
    externalRequests === 0,
    `external requests=${externalRequests}`,
  );

  // ------------------------------------------------------------------
  // 1) 35°, manual beta 0 -> 180: half track only
  // ------------------------------------------------------------------
  await setNumber(page, '#beta-number', 180);
  let state = await getState(page);
  let history = await getHistory(page);
  let seg = history[0];
  record(
    '1.1',
    'φ=35° 下手动 β=0°→180° 形成一个独立历史段',
    state.history.segmentCount === 1 &&
      history.length === 1 &&
      seg.phiDeg === 35 &&
      approx(seg.startBetaDeg, 0, 1e-9) &&
      approx(seg.endBetaDeg, 180, 1e-9),
    `segments=${state.history.segmentCount}, points=${seg?.points.length}`,
  );
  record(
    '1.2',
    '只显示已经扫过的半圈（没有预画完整 360°）',
    seg.points.every((point) => point.betaDeg <= 180 + 1e-9) && seg.points.length === 721,
    `points=${seg.points.length}, maxBeta=${Math.max(...seg.points.map((p) => p.betaDeg))}`,
  );
  record(
    '1.3',
    '轨迹按角度取样，最大 β 间隔 ≤ 0.5°',
    maxBetaGap(seg) <= 0.5 + 1e-9,
    `max gap=${maxBetaGap(seg).toFixed(4)}°`,
  );
  record(
    '1.4',
    '最后一个历史顶点是当前 A=O+R a，而不是平面圆心 B',
    Math.abs(norm(seg.points.at(-1).dir) - 1) < 1e-12 &&
      seg.points.at(-1).dir.every((v, i) => Math.abs(v - state.axisA[i]) < 1e-12) &&
      Math.abs(dot(seg.points.at(-1).dir, state.sourceDirection) - Math.cos((35 * Math.PI) / 180)) < 1e-12,
  );
  await screenshot(page, 'acceptance-01-half-circle.png');

  // ------------------------------------------------------------------
  // 2) continue to 360: complete track
  // ------------------------------------------------------------------
  await setNumber(page, '#beta-number', 360);
  state = await getState(page);
  history = await getHistory(page);
  seg = history[0];
  record(
    '2.1',
    'β 继续到 360° 后仍然是同一段，并形成完整轨迹',
    state.history.segmentCount === 1 &&
      approx(seg.endBetaDeg, 360, 1e-9) &&
      seg.points.length > 1000,
    `end=${seg.endBetaDeg}, points=${seg.points.length}`,
  );
  record(
    '2.2',
    '手动 β=360° 保留滑块端点和累计角度',
    approx(state.betaDisplayDeg, 360, 1e-9) && approx(state.betaInternalDeg, 360, 1e-9),
    `display=${state.betaDisplayDeg}, internal=${state.betaInternalDeg}`,
  );
  record(
    '2.3',
    '0°→360° 完整一圈没有被误判为“没有移动”',
    maxBetaGap(seg) <= 0.5 + 1e-9 && seg.points.length >= 1400,
    `points=${seg.points.length}, max gap=${maxBetaGap(seg).toFixed(4)}°`,
  );
  await screenshot(page, 'acceptance-02-full-circle.png');

  // ------------------------------------------------------------------
  // 3) change phi = 55: old history byte-identical, no new points
  // ------------------------------------------------------------------
  const snapshotBeforePhi = compactHistory(history);
  const stateBeforePhi = state;
  await setNumber(page, '#phi-number', 55);
  state = await getState(page);
  history = await getHistory(page);
  record(
    '3.1',
    '改变 φ 后旧轨迹逐字节保持记录时的状态',
    compactHistory(history) === snapshotBeforePhi,
  );
  record(
    '3.2',
    '只改 φ、不转 β 时不新建历史段，也不增加历史点',
    state.history.segmentCount === 1 &&
      state.history.pointCount === stateBeforePhi.history.pointCount &&
      state.phiDeg === 55,
    `segments=${state.history.segmentCount}, points=${state.history.pointCount}`,
  );
  record(
    '3.3',
    '当前 A 随 φ 改变，但 event circle 仍在数学上经过 S',
    Math.hypot(...state.axisA.map((v, i) => v - stateBeforePhi.axisA[i])) > 1e-3 &&
      state.eventCircleSourceError < 1e-12,
    `|Δa|>1e-3, S error=${state.eventCircleSourceError.toExponential(2)}`,
  );
  await screenshot(page, 'acceptance-03-phi-55-preserved.png');

  // ------------------------------------------------------------------
  // 4) phi=55, beta 360 -> 180: second segment; first never changes
  // ------------------------------------------------------------------
  const historyBeforeSecond = compactHistory(history);
  await setNumber(page, '#beta-number', 180);
  state = await getState(page);
  history = await getHistory(page);
  record(
    '4.1',
    'φ=55° 下再转半圈创建第二条历史段',
    state.history.segmentCount === 2 &&
      history[1].phiDeg === 55 &&
      approx(history[0].endBetaDeg, 360, 1e-9),
    `segments=${state.history.segmentCount}`,
  );
  const firstSegmentUnchanged =
    JSON.stringify(history[0]) === JSON.stringify(JSON.parse(historyBeforeSecond)[0]);
  record(
    '4.2',
    '第一条 φ=35° 轨迹在第二段出现后仍逐字节不变',
    firstSegmentUnchanged,
  );
  record(
    '4.3',
    '两个 φ 使用两条独立渲染线，没有合并成一个折线',
    state.history.renderedLineCount === 2,
    `rendered lines=${state.history.renderedLineCount}`,
  );
  await screenshot(page, 'acceptance-04-two-phi-tracks.png');

  // Complete a full reverse sweep 360 -> 180 -> 0. Manual 360 now remains
  // the right endpoint rather than snapping to 0 when the drag finishes.
  await setNumber(page, '#beta-number', 0);
  state = await getState(page);
  history = await getHistory(page);
  const secondIsFull = Math.abs(Math.abs(history[1].endBetaDeg - history[1].startBetaDeg) - 360) < 1e-9;
  record(
    '4.4',
    'φ=55° 下继续转满一圈，形成第二条完整轨迹；第一条仍逐字节不变',
    secondIsFull &&
      state.history.segmentCount === 2 &&
      JSON.stringify(history[0]) === JSON.stringify(JSON.parse(historyBeforeSecond)[0]),
    `sweep=${(history[1].endBetaDeg - history[1].startBetaDeg).toFixed(1)}°, points=${history[1].points.length}`,
  );
  await screenshot(page, 'acceptance-04b-two-phi-full-tracks.png');

  // ------------------------------------------------------------------
  // 5) change phi only to 75: no third segment, no cross-phi connector
  // ------------------------------------------------------------------
  const beforePhi75 = compactHistory(history);
  await setNumber(page, '#phi-number', 75);
  state = await getState(page);
  history = await getHistory(page);
  record(
    '5.1',
    '再次只改 φ=75° 不新增段/点，旧段仍不变',
    state.history.segmentCount === 2 &&
      state.history.pointCount === 2882 &&
      compactHistory(history) === beforePhi75,
    `segments=${state.history.segmentCount}, points=${state.history.pointCount}`,
  );
  record(
    '5.2',
    '各段保留自己的 φ，没有把旧点重新算成最新 φ，且仍是两条独立渲染线',
    history[0].phiDeg === 35 &&
      history[1].phiDeg === 55 &&
      state.phiDeg === 75 &&
      state.history.renderedLineCount === 2,
  );
  await screenshot(page, 'acceptance-05-no-cross-phi.png');

  // ------------------------------------------------------------------
  // 6) auto rotation across the 360/0 wrap, no trail break
  // ------------------------------------------------------------------
  await setNumber(page, '#beta-number', 350);
  const preAuto = await getState(page);
  await setSpeedThroughUI(page, 90);
  await page.locator('#auto-toggle').click();
  await page.waitForFunction(
    () => window.__COMPTON__.getState().autoPlaying === true,
    null,
    { timeout: 3000 },
  );
  const autoStart = await getState(page);
  record(
    '6.1',
    '自动旋转开关启动，速度通过 UI 改为 90°/s',
    autoStart.autoPlaying === true && autoStart.autoSpeedDegPerSec === 90,
    `speed=${autoStart.autoSpeedDegPerSec}°/s`,
  );
  await page.waitForFunction(
    (target) => window.__COMPTON__.getState().betaInternalDeg > target,
    preAuto.betaInternalDeg + 380,
    { timeout: 12000 },
  );
  await page.locator('#auto-toggle').click();
  await page.waitForTimeout(350);
  state = await getState(page);
  history = await getHistory(page);
  const phi75Segments = history.filter((item) => item.phiDeg === 75);
  record(
    '6.2',
    '自动旋转跨越 360°/0° 后轨迹连续，仍在同一 φ=75° 段',
    state.autoPlaying === false &&
      phi75Segments.length === 1 &&
      phi75Segments[0].endBetaDeg - phi75Segments[0].startBetaDeg > 380,
    `auto end=${state.betaInternalDeg.toFixed(1)}, φ75 segments=${phi75Segments.length}`,
  );
  record(
    '6.3',
    '自动旋转期间采样仍是角度间隔，最大 β 间隔 ≤ 0.5°',
    maxBetaGap(phi75Segments[0]) <= 0.5 + 1e-9,
    `max gap=${maxBetaGap(phi75Segments[0]).toFixed(4)}°`,
  );
  record(
    '6.4',
    '跨越回绕后 β 显示值在 [0,360)，累计值继续增长',
    state.betaDisplayDeg >= 0 &&
      state.betaDisplayDeg < 360 &&
      state.betaInternalDeg > preAuto.betaInternalDeg + 380,
    `display=${state.betaDisplayDeg.toFixed(2)}, internal=${state.betaInternalDeg.toFixed(2)}`,
  );
  await screenshot(page, 'acceptance-06-auto-wrap.png');

  // ------------------------------------------------------------------
  // 7) orbit camera changes do not touch physics/history
  // ------------------------------------------------------------------
  const beforeCamera = await getState(page);
  const historyBeforeCamera = compactHistory(await getHistory(page));
  await dragView(page, 95, -38);
  const canvas = page.locator('canvas.webgl-canvas');
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.55);
  await page.mouse.wheel(0, -120);
  await page.waitForTimeout(250);
  state = await getState(page);
  history = await getHistory(page);
  record(
    '7.1',
    '拖动/滚轮改变相机位置后，φ、β 与历史轨迹不变',
    Math.hypot(
      ...state.camera.position.map((v, i) => v - beforeCamera.camera.position[i]),
    ) > 1e-3 &&
      state.phiDeg === beforeCamera.phiDeg &&
      state.betaInternalDeg === beforeCamera.betaInternalDeg &&
      compactHistory(history) === historyBeforeCamera,
  );
  record(
    '7.2',
    '相机仍在轨道观察模式，不是 β 旋转',
    state.camera.mode === 'orbit',
  );
  await screenshot(page, 'acceptance-07-camera-only.png');

  // History visibility cannot delete data.
  await page.locator('label.toggle').filter({ hasText: '历史轨迹' }).click();
  await page.waitForTimeout(180);
  let hiddenState = await getState(page);
  record(
    '7.3',
    '隐藏历史轨迹不删除历史数据，重新显示后仍在',
    hiddenState.toggles.historyVisible === false &&
      hiddenState.history.pointCount === beforeCamera.history.pointCount,
    `points after hide=${hiddenState.history.pointCount}`,
  );
  await page.locator('label.toggle').filter({ hasText: '历史轨迹' }).click();
  await page.waitForTimeout(180);

  // ------------------------------------------------------------------
  // 8) free-look mode from a different height
  // ------------------------------------------------------------------
  const orbitBeforeFly = await getState(page);
  await page.locator('#mode-fly').click();
  await page.waitForTimeout(450);
  const flyState = await getState(page);
  record(
    '8.1',
    '显式点击进入自由观察模式',
    flyState.camera.mode === 'fly',
    `pointer lock=${flyState.camera.pointerLocked}`,
  );
  const positionBeforeKeys = flyState.camera.position;
  await page.keyboard.down('w');
  await page.waitForTimeout(450);
  await page.keyboard.up('w');
  await page.keyboard.down('e');
  await page.waitForTimeout(350);
  await page.keyboard.up('e');
  await page.waitForTimeout(250);
  state = await getState(page);
  const positionAfterKeys = state.camera.position;
  record(
    '8.2',
    'W/A/S/D 与 Q/E 改变自由相机的位置与高度',
    Math.hypot(
      positionAfterKeys[0] - positionBeforeKeys[0],
      positionAfterKeys[1] - positionBeforeKeys[1],
      positionAfterKeys[2] - positionBeforeKeys[2],
    ) > 1e-2 &&
      positionAfterKeys[1] > positionBeforeKeys[1],
    `y ${positionBeforeKeys[1].toFixed(2)}→${positionAfterKeys[1].toFixed(2)}`,
  );
  record(
    '8.3',
    '自由观察相机操作不改变物理参数',
    state.phiDeg === orbitBeforeFly.phiDeg &&
      state.betaInternalDeg === orbitBeforeFly.betaInternalDeg &&
      state.history.pointCount === orbitBeforeFly.history.pointCount,
  );
  await screenshot(page, 'acceptance-08-free-look.png');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  state = await getState(page);
  record(
    '8.4',
    'Esc 退出自由观察并回到保存的轨道视角',
    state.camera.mode === 'orbit' &&
      Math.hypot(
        ...state.camera.position.map((v, i) => v - orbitBeforeFly.camera.position[i]),
      ) < 1e-6,
  );

  // ------------------------------------------------------------------
  // 9) reset view does not clear history
  // ------------------------------------------------------------------
  const beforeReset = await getState(page);
  const historyBeforeReset = compactHistory(await getHistory(page));
  await page.locator('#reset-view').click();
  await page.waitForTimeout(350);
  state = await getState(page);
  history = await getHistory(page);
  record(
    '9.1',
    '重置视角恢复相机，但历史、φ、β 保持不变',
    state.camera.mode === 'orbit' &&
      compactHistory(history) === historyBeforeReset &&
      state.phiDeg === beforeReset.phiDeg &&
      state.betaInternalDeg === beforeReset.betaInternalDeg &&
      state.camera.position[0] !== 0,
  );
  await screenshot(page, 'acceptance-09-reset-view-keeps-trails.png');

  // ------------------------------------------------------------------
  // 10) clear trails only clears trails
  // ------------------------------------------------------------------
  const beforeClear = await getState(page);
  const cameraBeforeClear = beforeClear.camera.position;
  await page.locator('#clear-trails').click();
  await page.waitForTimeout(300);
  state = await getState(page);
  record(
    '10.1',
    '清空轨迹删除全部历史线与点',
    state.history.segmentCount === 0 &&
      state.history.pointCount === 0 &&
      state.history.renderedLineCount === 0,
  );
  record(
    '10.2',
    '清空轨迹不重置 φ、β 或相机',
    state.phiDeg === beforeClear.phiDeg &&
      state.betaInternalDeg === beforeClear.betaInternalDeg &&
      Math.hypot(...state.camera.position.map((v, i) => v - cameraBeforeClear[i])) < 1e-9,
    `φ=${state.phiDeg}, β=${state.betaInternalDeg.toFixed(1)}`,
  );

  // ------------------------------------------------------------------
  // 11) event circle passes S at multiple phi/beta, including degeneracies
  // ------------------------------------------------------------------
  const cases = [
    { phi: 35, beta: 0, classification: 'cone' },
    { phi: 35, beta: 90, classification: 'cone' },
    { phi: 55, beta: 180, classification: 'cone' },
    { phi: 90, beta: 30, classification: 'plane' },
    { phi: 145, beta: 220, classification: 'cone' },
    { phi: 0, beta: 0, classification: 'ray' },
    { phi: 180, beta: 0, classification: 'ray' },
  ];
  for (const item of cases) {
    await page.evaluate(({ phi, beta }) => {
      window.__COMPTON__.setPhi(phi);
      window.__COMPTON__.setBeta(beta);
    }, item);
    await page.waitForTimeout(200);
    state = await getState(page);
    const cosPhi = Math.cos((item.phi * Math.PI) / 180);
    const checks = [
      Number.isFinite(state.eventCircleSourceError),
      state.eventCircleSourceError < 1e-12,
      Math.abs(norm(state.axisA) - 1) < 1e-12,
      Math.abs(norm(state.k) - 1) < 1e-12,
      Math.abs(dot(state.sourceDirection, state.axisA) - cosPhi) < 1e-12,
      Math.abs(dot(state.sourceDirection.map((v) => -v), state.k) - cosPhi) < 1e-12,
      state.classification === item.classification,
    ];
    record(
      `11.${cases.indexOf(item) + 1}`,
      `φ=${item.phi}°, β=${item.beta}°：圆形经过 S，无量值 NaN，分类=${item.classification}`,
      checks.every(Boolean),
      `S error=${Number.isFinite(state.eventCircleSourceError) ? state.eventCircleSourceError.toExponential(2) : 'NaN'}`,
    );
    if (item.phi === 90) await screenshot(page, 'acceptance-11a-phi90-plane.png');
    if (item.phi === 180) await screenshot(page, 'acceptance-11b-phi180-degenerate.png');
  }

  // Also verify χ_a / ψ_a are the antipodal relation of χ_k / ψ_k.
  const relations = await page.evaluate(() => {
    window.__COMPTON__.setPhi(55);
    window.__COMPTON__.setBeta(180);
    return window.__COMPTON__.getState();
  });
  const chiRelation = Math.abs(relations.anglesA.chiDeg - (180 - relations.anglesK.chiDeg));
  const psiRelation = Math.abs(((relations.anglesA.psiDeg - relations.anglesK.psiDeg - 180 + 540) % 360) - 180);
  record(
    '11.8',
    'χ_a = 180°−χ_k，ψ_a = ψ_k+180°（界面标注为 k 与 a 两套角）',
    chiRelation < 1e-9 && psiRelation < 1e-9,
    `Δχ=${chiRelation.toExponential(2)}, Δψ=${psiRelation.toExponential(2)}`,
  );

  // ------------------------------------------------------------------
  // 12) side view: A on the sky vs planar centre B
  // ------------------------------------------------------------------
  await page.evaluate(() => {
    window.__COMPTON__.clearHistory();
    window.__COMPTON__.setPhi(35);
    window.__COMPTON__.setBeta(0);
    window.__COMPTON__.setCameraOrbit({ thetaDeg: 19.8, polarDeg: 76, radius: 6.2 });
  });
  await page.waitForTimeout(400);
  await page.locator('label.toggle').filter({ hasText: '平面圆心 B' }).click();
  await page.waitForTimeout(400);
  state = await getState(page);
  const aPosition = state.axisA.map((v) => v * state.renderRadius);
  const bPosition = state.planeCenterB;
  const labelBoxes = await page.evaluate(() => {
    const a = document.querySelector('.scene-label.label-a');
    const b = document.querySelector('.scene-label.label-b');
    const rect = (el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2, display: getComputedStyle(el).display };
    };
    return { a: rect(a), b: rect(b) };
  });
  record(
    '12.1',
    'B 辅助标记可显示，几何上 A=O+Ra 与 B=O+R cosφ a 不同',
    state.toggles.bVisible === true &&
      Math.hypot(...aPosition.map((v, i) => v - bPosition[i])) > 0.2 &&
      Math.abs(norm(aPosition) - 1.6) < 1e-12 &&
      Math.abs(norm(bPosition) - 1.6 * Math.cos((35 * Math.PI) / 180)) < 1e-12,
    `|A−B|=${Math.hypot(...aPosition.map((v, i) => v - bPosition[i])).toFixed(3)}`,
  );
  record(
    '12.2',
    'A 与 B 的屏幕位置明显不同，没有把平面圆心记录成 A',
    labelBoxes.a.display === 'block' &&
      labelBoxes.b.display === 'block' &&
      labelBoxes.b.x !== labelBoxes.a.x,
    `A screen (${labelBoxes.a.x.toFixed(0)},${labelBoxes.a.y.toFixed(0)}), B screen (${labelBoxes.b.x.toFixed(0)},${labelBoxes.b.y.toFixed(0)})`,
  );
  await screenshot(page, 'acceptance-12-A-vs-B-side-view.png');

  // Toggle modes via real UI clicks at the end.
  await page.locator('label.toggle').filter({ hasText: '角度辅助' }).click();
  await page.waitForTimeout(300);
  state = await getState(page);
  record(
    '13.1',
    '角度辅助线可通过真实 UI 开关显示，φ/χ/ψ 弧存在',
    state.toggles.angleAidsVisible === true &&
      state.renderDiagnostics.phiArcVisible === true &&
      state.renderDiagnostics.chiArcVisible === true &&
      state.renderDiagnostics.psiArcVisible === true,
    `phi=${state.renderDiagnostics.phiArcVisible}, chi=${state.renderDiagnostics.chiArcVisible}, psi=${state.renderDiagnostics.psiArcVisible}`,
  );
  await screenshot(page, 'acceptance-13-angle-aids.png');
  await page.locator('label.toggle').filter({ hasText: '理论小圆' }).click();
  await page.waitForTimeout(300);
  state = await getState(page);
  record(
    '13.2',
    '理论小圆（虚线）可通过真实 UI 单独开关，且与历史线分离',
    state.toggles.theoryVisible === true &&
      state.renderDiagnostics.theoryVisible === true &&
      state.renderDiagnostics.theoryPoints > 100,
    `points=${state.renderDiagnostics.theoryPoints}`,
  );
  await screenshot(page, 'acceptance-13b-theory-track.png');
  await page.locator('label.toggle').filter({ hasText: '理论小圆' }).click();
  await page.locator('label.toggle').filter({ hasText: '角度辅助' }).click();
  await page.waitForTimeout(200);

  // Slider controls (real range elements, not only numeric inputs).
  await page.evaluate(() => {
    window.__COMPTON__.setPhi(35);
    window.__COMPTON__.setBeta(0);
    window.__COMPTON__.clearHistory();
  });
  await page.waitForTimeout(200);
  const phiSliderBox = await page.locator('#phi-range').boundingBox();
  await page.mouse.click(phiSliderBox.x + phiSliderBox.width * 0.5, phiSliderBox.y + phiSliderBox.height / 2);
  await page.waitForTimeout(250);
  const phiSliderState = await getState(page);
  record(
    '13.3',
    'φ 滑块可手动改变角度（中点附近约 90°）',
    phiSliderState.phiDeg > 84 && phiSliderState.phiDeg < 96,
    `φ=${phiSliderState.phiDeg.toFixed(1)}°`,
  );
  const betaSliderBox = await page.locator('#beta-range').boundingBox();
  await page.mouse.click(betaSliderBox.x + betaSliderBox.width * 0.4, betaSliderBox.y + betaSliderBox.height / 2);
  await page.waitForTimeout(400);
  const betaSliderState = await getState(page);
  record(
    '13.4',
    'β 滑块可手动旋转并创建历史轨迹',
    betaSliderState.betaDisplayDeg > 120 &&
      betaSliderState.betaDisplayDeg < 170 &&
      betaSliderState.history.segmentCount >= 1 &&
      betaSliderState.history.pointCount > 10,
    `β=${betaSliderState.betaDisplayDeg.toFixed(1)}°, segments=${betaSliderState.history.segmentCount}, points=${betaSliderState.history.pointCount}`,
  );

  // Direct absolute β input 0° -> 360° must sweep the full interval, not take
  // a zero-length shortest path.
  await page.evaluate(() => {
    window.__COMPTON__.setPhi(35);
    window.__COMPTON__.setBetaInternal(0);
    window.__COMPTON__.clearHistory();
  });
  await page.waitForTimeout(250);
  await setNumber(page, '#beta-number', 360);
  await page.waitForTimeout(300);
  state = await getState(page);
  const directLoopHistory = await getHistory(page);
  record(
    '13.5',
    'β 数字输入直接 0°→360° 记录完整一圈，不按最短角路径缩短',
    Math.abs(state.betaDisplayDeg - 360) < 1e-9 &&
      Math.abs(state.betaInternalDeg - 360) < 1e-9 &&
      directLoopHistory.length === 1 &&
      Math.abs(directLoopHistory[0].endBetaDeg - directLoopHistory[0].startBetaDeg - 360) < 1e-9 &&
      directLoopHistory[0].points.length === 1441,
    `sweep=${(directLoopHistory[0].endBetaDeg - directLoopHistory[0].startBetaDeg).toFixed(1)}°, points=${directLoopHistory[0].points.length}`,
  );

  // Energy readout sanity at φ=90° (E=1000 keV default).
  await page.evaluate(() => window.__COMPTON__.setPhi(90));
  await page.waitForTimeout(200);
  const energyText = await page.evaluate(() => ({
    scattered: document.getElementById('energy-scattered').textContent,
    recoil: document.getElementById('energy-recoil').textContent,
  }));
  const scatteredValue = Number.parseFloat(energyText.scattered);
  const recoilValue = Number.parseFloat(energyText.recoil);
  record(
    '13.6',
    'φ=90° 时 E′=338.2 keV、Tₑ=661.8 keV 的页面读数正确',
    Math.abs(scatteredValue - 338.2) < 0.15 &&
      Math.abs(recoilValue - 661.8) < 0.15 &&
      Math.abs(scatteredValue + recoilValue - 1000) < 0.15,
    `E′=${energyText.scattered}, Tₑ=${energyText.recoil}`,
  );

  // Regression: growing an already-rendered Line2 must grow the actual draw,
  // not just its CPU-side history. r160 caches a maximum instance count.
  await page.evaluate(() => {
    const api = window.__COMPTON__;
    api.setPhi(35);
    api.setBetaInternal(0);
    api.clearHistory();
    api.setBeta(1);
  });
  await page.waitForTimeout(250);
  state = await getState(page);
  const initialDraw = state.renderDiagnostics.historyLines[0];
  record('15.1', '轨迹首次绘制 1° 时实际绘制 4 个线段', initialDraw.drawnSegments === 4);
  await setNumber(page, '#beta-number', 180);
  state = await getState(page);
  const grownDraw = state.renderDiagnostics.historyLines[0];
  const expectedEnd = [state.axisA[0], state.axisA[2], -state.axisA[1]].map((x) => x * state.renderRadius);
  const endpointError = Math.hypot(...expectedEnd.map((x, i) => x - grownDraw.lastRenderedPoint[i]));
  record(
    '15.2',
    '轨迹从 1° 增长到 180° 后实际绘制全部 720 个线段，末端到达 A',
    grownDraw.drawnSegments === 720 && grownDraw.expectedSegments === 720 && endpointError < 1e-6,
    `drawn=${grownDraw.drawnSegments}, expected=${grownDraw.expectedSegments}, endpointError=${endpointError.toExponential(2)}`,
  );
  await screenshot(page, 'regression-growing-trail.png');
  await setNumber(page, '#phi-number', 55);
  await setNumber(page, '#beta-number', 181);
  await setNumber(page, '#beta-number', 360);
  state = await getState(page);
  record(
    '15.3',
    '切换 φ 后新旧两条轨迹都完整绘制',
    state.renderDiagnostics.historyLines.length === 2 &&
      state.renderDiagnostics.historyLines.every((line) => line.visible && line.drawnSegments === line.expectedSegments && line.drawnSegments === 720),
  );
  await screenshot(page, 'regression-two-growing-trails.png');
  await setNumber(page, '#beta-number', 350);
  await page.evaluate(() => window.__COMPTON__.clearHistory());
  await setNumber(page, '#beta-number', 360);
  await setNumber(page, '#beta-number', 359.9);
  state = await getState(page);
  const endpointHistory = await getHistory(page);
  record(
    '15.4',
    '手动 350°→360°→359.9° 不额外记录一整圈',
    approx(state.betaDisplayDeg, 359.9) &&
      approx(endpointHistory[0].endBetaDeg - endpointHistory[0].startBetaDeg, 9.9) &&
      endpointHistory[0].points.length < 50,
    `points=${endpointHistory[0].points.length}, sweep=${endpointHistory[0].endBetaDeg - endpointHistory[0].startBetaDeg}`,
  );

  record('14.1', '主页面运行期间无 console error / page error', consoleErrors === 0, `errors=${consoleErrors}`);

  await page.close();

  // ------------------------------------------------------------------
  // WebGL unavailable error path (fresh page with mocked canvas contexts)
  // ------------------------------------------------------------------
  const noWebglBrowser = await chromium.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-gpu-sandbox'],
  });
  const noWebglPage = await noWebglBrowser.newPage({ viewport });
  await noWebglPage.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function patchedGetContext(type, ...args) {
      if (String(type).toLowerCase().includes('webgl')) return null;
      return original.call(this, type, ...args);
    };
  });
  await noWebglPage.goto(pageUrl, { waitUntil: 'load' });
  await noWebglPage.waitForTimeout(1700);
  const fatalVisible = await noWebglPage.locator('#fatal-error').isVisible();
  const fatalText = await noWebglPage.locator('#fatal-error').innerText();
  record(
    '14.2',
    'WebGL 不可用时显示清楚的错误提示',
    fatalVisible && /WebGL|三维场景|硬件加速/i.test(fatalText),
    fatalText.replace(/\s+/g, ' ').slice(0, 120),
  );
  await noWebglBrowser.close();

  console.log('');
  console.log(`RESULT: ${results.length - failures}/${results.length} checks passed, ${failures} failed.`);
  if (failures > 0) process.exitCode = 1;
} catch (error) {
  console.error('Browser acceptance crashed:', error);
  process.exitCode = 2;
} finally {
  if (browser) await browser.close();
}
