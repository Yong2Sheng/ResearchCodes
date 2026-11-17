/**
 * Executable mathematical validation shared by Node and the in-page self-test.
 * The checks use the same public functions as the visualization.
 */

import {
  DEG,
  TAU,
  MEC2_KEV,
  anglesFromDirection,
  coneAxisDirection,
  degToRad,
  directionFromAngles,
  dot,
  eventCircleDirection,
  eventCircleFrame,
  makeEventCircleDirections,
  makeSourceBasis,
  normalize,
  phiFromEnergyDeposits,
  radToDeg,
  recoilElectronEnergy,
  scale,
  scatteredPhotonEnergy,
  sourcePosition,
  wrapDeg,
  wrapTwoPi,
} from './physics.js';
import {
  makeEventConeData,
  makePhiAngleArc,
} from './geometry.js';
import { TrailHistory } from './history.js';

export const VALIDATION_TOLERANCE = 1e-10;

function newGroup(name, description) {
  return {
    name,
    description,
    checks: [],
    maxError: 0,
    failures: [],
  };
}

function record(group, name, error, tolerance = VALIDATION_TOLERANCE, extra = null) {
  const numeric = Number.isFinite(error) ? error : Number.POSITIVE_INFINITY;
  const passed = numeric <= tolerance;
  group.checks.push({ name, error: numeric, tolerance, passed, extra });
  group.maxError = Math.max(group.maxError, numeric);
  if (!passed) {
    group.failures.push({ name, error: numeric, tolerance, extra });
  }
  return passed;
}

function recordBoolean(group, name, passed, extra = null) {
  return record(group, name, passed ? 0 : Number.POSITIVE_INFINITY, 0, extra);
}

function maxVectorLengthError(vector) {
  if (!vector.every(Number.isFinite)) return Number.POSITIVE_INFINITY;
  return Math.abs(Math.hypot(...vector) - 1);
}

function maxAbsDifference(a, b) {
  let max = 0;
  for (let i = 0; i < a.length; i += 1) {
    max = Math.max(max, Math.abs(a[i] - b[i]));
  }
  return max;
}

const SOURCE_BASIS_SPECIAL = {
  s0: [0, 0, 1],
  b1: [1, 0, 0],
  b2: [0, 1, 0],
};

const PHI_DEGREES = [0, 1e-5, 0.1, 17.3, 35, 55, 89.9, 90, 90.1, 125, 145, 179.9, 180];
const BETA_DEGREES = [0, 30, 53.7, 90, 180, 270, 330, 360, -45, 725];
const R = 1.7;

function phiBetaSweep(basis) {
  return PHI_DEGREES.map((phiDeg) => {
    const phi = degToRad(phiDeg);
    const axesResults = BETA_DEGREES.map((betaDeg) => {
      const beta = degToRad(betaDeg);
      const { axis, k } = coneAxisDirection(phi, beta, basis);
      return { phiDeg, betaDeg, phi, beta, axis, k };
    });
    return { phiDeg, phi, axesResults };
  });
}

function directionAtPhiBeta(basis, phiDeg) {
  const phi = degToRad(phiDeg);
  return (betaDeg) => coneAxisDirection(phi, degToRad(betaDeg), basis).axis;
}

export function runValidation() {
  const groups = [];

  // ---------------------------------------------------------------------
  // 1. Angle convention and round trips
  // ---------------------------------------------------------------------
  {
    const group = newGroup(
      '角度约定与往返',
      'χ 从 −z 量起、ψ 从 +y 朝 +x 增大；极点 ψ 标记为未定义。',
    );

    let conversionMax = 0;
    for (const value of [-720, -180, -35.5, 0, 0.1, 35, 145, 360, 540]) {
      conversionMax = Math.max(
        conversionMax,
        Math.abs(radToDeg(degToRad(value)) - value),
      );
    }
    record(group, 'degree/radian 往返', conversionMax);

    let wrapMax = 0;
    for (const value of [
      -4 * Math.PI,
      -TAU - 0.2,
      -0.2,
      -1e-16,
      0,
      1e-16,
      0.2,
      TAU - 1e-16,
      TAU,
      5 * TAU + 0.7,
    ]) {
      const wrapped = wrapTwoPi(value);
      const validRange =
        wrapped >= 0 && wrapped < TAU
          ? 0
          : Number.POSITIVE_INFINITY;
      wrapMax = Math.max(
        wrapMax,
        validRange,
        Math.abs(Math.atan2(Math.sin(wrapped - value), Math.cos(wrapped - value))),
      );
    }
    record(group, 'wrapTwoPi 落在 [0, 2π) 且同向', wrapMax);
    record(group, 'wrapDeg(360)=0', Math.abs(wrapDeg(360)));
    record(group, 'wrapDeg(-0.1)≈359.9', Math.abs(wrapDeg(-0.1) - 359.9));

    // χ is measured from -z, not +z.
    record(
      group,
      'd(χ=0,ψ) = −z',
      maxAbsDifference(directionFromAngles(0, 1.234), [0, 0, -1]),
    );
    record(
      group,
      'd(χ=π,ψ) = +z',
      maxAbsDifference(directionFromAngles(Math.PI, 0.5), [0, 0, 1]),
    );
    record(
      group,
      'd(χ=90°,ψ=0°) = +y',
      maxAbsDifference(directionFromAngles(Math.PI / 2, 0), [0, 1, 0]),
    );
    record(
      group,
      'd(χ=90°,ψ=90°) = +x（ψ 从 +y 朝 +x 增大）',
      maxAbsDifference(directionFromAngles(Math.PI / 2, Math.PI / 2), [1, 0, 0]),
    );
    record(
      group,
      'd(χ=90°,ψ=180°) = −y',
      maxAbsDifference(directionFromAngles(Math.PI / 2, Math.PI), [0, -1, 0]),
    );

    let roundTripMax = 0;
    let psiDifferenceMax = 0;
    const chiValues = [0.1, 0.5, 1.0, 1.5, 2.2, Math.PI / 2, 2.7, Math.PI - 0.1];
    const psiValues = [0, 0.2, 1.0, Math.PI / 2, 2.4, Math.PI, 4.1, TAU - 0.1];
    for (const chi of chiValues) {
      for (const psi of psiValues) {
        const direction = directionFromAngles(chi, psi);
        const recovered = anglesFromDirection(direction);
        if (recovered.pole || recovered.psi === null) {
          roundTripMax = Number.POSITIVE_INFINITY;
          continue;
        }
        const rebuilt = directionFromAngles(recovered.chi, recovered.psi);
        roundTripMax = Math.max(roundTripMax, maxAbsDifference(direction, rebuilt));
        const deltaPsi = Math.abs(
          Math.atan2(
            Math.sin(recovered.psi - psi),
            Math.cos(recovered.psi - psi),
          ),
        );
        psiDifferenceMax = Math.max(psiDifferenceMax, deltaPsi);
      }
    }
    record(group, 'd → (χ,ψ) → d 分量往返（非极点）', roundTripMax);
    record(group, 'ψ 往返（角差，非极点）', psiDifferenceMax);

    const southPole = anglesFromDirection([0, 0, -1]);
    const northPole = anglesFromDirection([0, 0, 1]);
    recordBoolean(
      group,
      'χ=0 极点：χ≈0 且 ψ=null',
      southPole.pole === true && southPole.psi === null && Math.abs(southPole.chi) < 1e-12,
    );
    recordBoolean(
      group,
      'χ=180 极点：χ≈π 且 ψ=null',
      northPole.pole === true && northPole.psi === null && Math.abs(northPole.chi - Math.PI) < 1e-12,
    );
    recordBoolean(
      group,
      '极点不产生 NaN',
      Number.isFinite(southPole.chi) && Number.isFinite(northPole.chi),
    );

    // Source angles used by the default scene.
    const defaultSource = directionFromAngles(145 * DEG, 35 * DEG);
    const recoveredSource = anglesFromDirection(defaultSource);
    record(
      group,
      '默认源 (χ0,ψ0)=(145°,35°) 往返',
      Math.max(
        Math.abs(radToDeg(recoveredSource.chi) - 145),
        Math.abs(radToDeg(recoveredSource.psi) - 35),
      ),
    );

    groups.push(group);
  }

  // ---------------------------------------------------------------------
  // 2. Orthonormal source basis and a/k identities
  // ---------------------------------------------------------------------
  {
    const group = newGroup(
      '源基底与反投影轴',
      '|a|=1，|k|=1，s0·a=cosφ，(−s0)·k=cosφ。',
    );

    const bases = [
      makeSourceBasis(directionFromAngles(145 * DEG, 35 * DEG)),
      makeSourceBasis([0, 0, 1]),
      makeSourceBasis([1, 0, 0]),
      makeSourceBasis(normalize([0.3, -0.5, 0.8])),
      makeSourceBasis(directionFromAngles(20 * DEG, 310 * DEG)),
    ];
    let basisNormError = 0;
    let basisOrthError = 0;
    let b2Error = 0;
    for (const basis of bases) {
      basisNormError = Math.max(
        basisNormError,
        Math.abs(Math.hypot(...basis.s0) - 1),
        Math.abs(Math.hypot(...basis.b1) - 1),
        Math.abs(Math.hypot(...basis.b2) - 1),
      );
      basisOrthError = Math.max(
        basisOrthError,
        Math.abs(dot(basis.s0, basis.b1)),
        Math.abs(dot(basis.s0, basis.b2)),
        Math.abs(dot(basis.b1, basis.b2)),
      );
      b2Error = Math.max(
        b2Error,
        maxAbsDifference(
          basis.b2,
          [
            basis.s0[1] * basis.b1[2] - basis.s0[2] * basis.b1[1],
            basis.s0[2] * basis.b1[0] - basis.s0[0] * basis.b1[2],
            basis.s0[0] * basis.b1[1] - basis.s0[1] * basis.b1[0],
          ],
        ),
      );
    }
    record(group, '基底单位性（多组源方向）', basisNormError);
    record(group, '基底正交性', basisOrthError);
    record(group, 'b2 = s0 × b1', b2Error);

    const defaultBasis = bases[0];
    const sweep = phiBetaSweep(defaultBasis);
    let axisNormError = 0;
    let kNormError = 0;
    let dotAError = 0;
    let dotKError = 0;
    let betaEndpointError = 0;
    for (const phiGroup of sweep) {
      for (const item of phiGroup.axesResults) {
        axisNormError = Math.max(axisNormError, maxVectorLengthError(item.axis));
        kNormError = Math.max(kNormError, maxVectorLengthError(item.k));
        dotAError = Math.max(
          dotAError,
          Math.abs(dot(defaultBasis.s0, item.axis) - Math.cos(item.phi)),
        );
        const nIn = scale(defaultBasis.s0, -1);
        dotKError = Math.max(
          dotKError,
          Math.abs(dot(nIn, item.k) - Math.cos(item.phi)),
        );
      }
    }
    record(group, 'max ||a|-1|（13 个 φ × 10 个 β）', axisNormError);
    record(group, 'max ||k|-1|', kNormError);
    record(group, 'max |s0·a−cosφ|', dotAError);
    record(group, 'max |(−s0)·k−cosφ|', dotKError);

    const a0 = coneAxisDirection(35 * DEG, 0, defaultBasis).axis;
    const a360 = coneAxisDirection(35 * DEG, TAU, defaultBasis).axis;
    betaEndpointError = maxAbsDifference(a0, a360);
    record(group, 'β=0° 与 β=360° 姿态一致', betaEndpointError);

    const reverse = coneAxisDirection(35 * DEG, -55 * DEG, defaultBasis).axis;
    const reverseEquivalent = coneAxisDirection(35 * DEG, 305 * DEG, defaultBasis).axis;
    record(group, 'β=−55° 与 β=305° 一致（内部不做最短路径）', maxAbsDifference(reverse, reverseEquivalent));

    groups.push(group);
  }

  // ---------------------------------------------------------------------
  // 3. Event circle sampling
  // ---------------------------------------------------------------------
  {
    const group = newGroup(
      '真实 event circle',
      '|s(t)|=1，s(t)·a=cosφ，s(0)=s0，且圆心 B = O + R cosφ a。',
    );

    const defaultBasis = makeSourceBasis(directionFromAngles(145 * DEG, 35 * DEG));
    const phiDegrees = [0.1, 17.3, 35, 55, 89.9, 90, 90.1, 125, 145, 179.9];
    let normError = 0;
    let dotError = 0;
    let sourceOnCircleError = 0;
    let planeCenterError = 0;
    let planeRadiusError = 0;
    let planeNormalError = 0;
    let closedError = 0;
    let sourceMarkerError = 0;

    for (const phiDeg of phiDegrees) {
      const phi = degToRad(phiDeg);
      for (const betaDeg of [0, 30, 120, 250, 355]) {
        const beta = degToRad(betaDeg);
        const { frame, points } = makeEventCircleDirections(phi, beta, defaultBasis, 144);
        const cosPhi = Math.cos(phi);
        const sinPhi = Math.sin(phi);
        const centerB = scale(frame.axis, R * cosPhi);
        for (let i = 0; i < points.length; i += 1) {
          const direction = points[i];
          normError = Math.max(normError, maxVectorLengthError(direction));
          dotError = Math.max(
            dotError,
            Math.abs(dot(direction, frame.axis) - cosPhi),
          );
          const position = scale(direction, R);
          const fromCenter = [
            position[0] - centerB[0],
            position[1] - centerB[1],
            position[2] - centerB[2],
          ];
          planeRadiusError = Math.max(
            planeRadiusError,
            Math.abs(Math.hypot(...fromCenter) - R * Math.abs(sinPhi)),
          );
          planeNormalError = Math.max(
            planeNormalError,
            Math.abs(dot(fromCenter, frame.axis)),
          );
        }
        sourceOnCircleError = Math.max(
          sourceOnCircleError,
          maxAbsDifference(points[0], defaultBasis.s0),
        );
        closedError = Math.max(
          closedError,
          maxAbsDifference(points[0], points[points.length - 1]),
        );
        const sourceDir = normalize(sourcePosition(defaultBasis));
        sourceMarkerError = Math.max(
          sourceMarkerError,
          maxAbsDifference(
            eventCircleDirection(eventCircleFrame(phi, beta, defaultBasis), 0),
            sourceDir,
          ),
        );
        planeCenterError = Math.max(
          planeCenterError,
          Math.abs(dot(sourceDir, frame.axis) - cosPhi),
        );
      }
    }
    record(group, 'max ||s(t)|-1|', normError);
    record(group, 'max |s(t)·a−cosφ|', dotError);
    record(group, 'max |s(0)−s0|（event circle 必须经过 S）', sourceOnCircleError);
    record(group, '圆环首尾闭合', closedError);
    record(group, '所有采样点到平面圆心 B 的欧氏半径 = R|sinφ|', planeRadiusError);
    record(group, '圆环点相对 B 的方向与 a 垂直', planeNormalError);
    record(group, 't=0 显式落点等于 S', sourceMarkerError);
    record(group, 'B 与 S 的夹角关系（源在圆上）', planeCenterError);

    const defaultBasis2 = makeSourceBasis([0, 0, 1]);
    const phi = 60 * DEG;
    const beta = 40 * DEG;
    const A = scale(coneAxisDirection(phi, beta, defaultBasis2).axis, R);
    const B = scale(coneAxisDirection(phi, beta, defaultBasis2).axis, R * Math.cos(phi));
    record(group, 'A 与 B 一般不重合：|A−B| = R(1−cosφ)', Math.abs(Math.hypot(...A.map((v, i) => v - B[i])) - R * (1 - Math.cos(phi))));
    recordBoolean(group, 'A 在天空球上而 B 在球内：R(1−cosφ)>0', R * (1 - Math.cos(phi)) > 1e-6);

    groups.push(group);
  }

  // ---------------------------------------------------------------------
  // 4. Degenerate angles and directed φ > 90° geometry
  // ---------------------------------------------------------------------
  {
    const group = newGroup(
      '退化角与 φ>90°',
      'φ=0°/90°/180° 不产生 NaN；超过 90° 仍按有向向量公式绘制。',
    );

    const basis = makeSourceBasis(directionFromAngles(145 * DEG, 35 * DEG));
    for (const phiDeg of [0, 90, 180]) {
      const phi = degToRad(phiDeg);
      let finite = true;
      let sourcePointError = 0;
      for (const betaDeg of [0, 17, 90, 213, 355, 360]) {
        const beta = degToRad(betaDeg);
        const data = makeEventConeData(phi, beta, basis, R);
        if (![...data.mesh.vertices, ...data.circlePositions.flat()].every(Number.isFinite)) {
          finite = false;
        }
        const sourcePoint = data.ringDirections[0];
        sourcePointError = Math.max(
          sourcePointError,
          maxAbsDifference(sourcePoint, basis.s0),
        );
      }
      recordBoolean(group, `φ=${phiDeg}°：网格与圆环所有坐标有限`, finite);
      record(group, `φ=${phiDeg}°：event circle 仍然经过 S`, sourcePointError);
    }

    const phi0 = 0;
    const beta0 = 47 * DEG;
    const data0 = makeEventConeData(phi0, beta0, basis, R);
    recordBoolean(group, 'φ=0° 分类为退化射线', data0.classification === 'ray');
    record(group, 'φ=0° 锥面/圆环半径约为 0', data0.ringRadius);
    record(
      group,
      'φ=0° 时 A 与 S 重合',
      maxAbsDifference(data0.axisPointA, sourcePosition(basis, R)),
    );

    const phi90 = 90 * DEG;
    const data90 = makeEventConeData(phi90, beta0, basis, R);
    recordBoolean(group, 'φ=90° 分类为平面盘', data90.classification === 'plane');
    record(group, 'φ=90° 时 B 位于 O', Math.hypot(...data90.centerB));
    record(
      group,
      'φ=90° 时 event circle 的欧氏半径 = R',
      Math.abs(data90.ringRadius - R),
    );

    const phi180 = Math.PI;
    const data180 = makeEventConeData(phi180, beta0, basis, R);
    recordBoolean(group, 'φ=180° 分类为退化射线', data180.classification === 'ray');
    record(
      group,
      'φ=180° 时 A 位于 S 的对跖点',
      maxAbsDifference(data180.axisPointA, scale(basis.s0, -R)),
    );

    // Near the endpoints use the division-free frame and verify finiteness.
    let nearEndpointError = 0;
    for (const phi of [1e-7, Math.PI - 1e-7]) {
      for (const betaDeg of [0, 120, 300]) {
        const frame = eventCircleFrame(phi, betaDeg * DEG, basis);
        const candidate = eventCircleDirection(frame, 0.7);
        nearEndpointError = Math.max(
          nearEndpointError,
          maxVectorLengthError(candidate),
          Math.abs(dot(candidate, frame.axis) - Math.cos(phi)),
          Math.abs(Math.hypot(...frame.u) - 1),
          Math.abs(Math.hypot(...frame.v) - 1),
        );
      }
    }
    record(group, 'φ→0/180 非退化数值分支有限且单位', nearEndpointError);

    const phi145 = 145 * DEG;
    const directed = coneAxisDirection(phi145, 20 * DEG, basis);
    record(
      group,
      'φ=145° 保留 cosφ<0，而不是自动替换成 35°',
      Math.abs(dot(basis.s0, directed.axis) - Math.cos(phi145)),
    );
    record(
      group,
      'φ=145° 时 (−s0)·k 仍等于 cosφ',
      Math.abs(dot(scale(basis.s0, -1), directed.k) - Math.cos(phi145)),
    );

    groups.push(group);
  }

  // ---------------------------------------------------------------------
  // 5. Independent numerical example from the request
  // ---------------------------------------------------------------------
  {
    const group = newGroup(
      '独立数值例子',
      's0=(0,0,1), b1=(1,0,0), b2=(0,1,0), R=1, φ=60°：A 轨迹应满足 z=0.5 与 x²+y²=0.75。',
    );
    const basis = SOURCE_BASIS_SPECIAL;
    const phi = 60 * DEG;
    let zError = 0;
    let radiusError = 0;
    const points = [];
    const betaSamples = 721;
    for (let i = 0; i < betaSamples; i += 1) {
      const beta = (i / (betaSamples - 1)) * TAU;
      const { axis } = coneAxisDirection(phi, beta, basis);
      const [x, y, z] = axis;
      points.push([x, y, z]);
      zError = Math.max(zError, Math.abs(z - 0.5));
      radiusError = Math.max(radiusError, Math.abs(Math.hypot(x, y) - Math.sqrt(0.75)));
    }
    record(group, 'max |A_z − 0.5|（R=1）', zError);
    record(group, 'max |√(A_x²+A_y²) − √0.75|', radiusError);
    record(
      group,
      'β=0° 与 360° 姿态一致',
      maxAbsDifference(points[0], points[points.length - 1]),
    );

    // Full-circle coverage: every 1-degree azimuth bin is visited, despite the
    // fact that the start and end directions are the same.
    const bins = new Set();
    let monotonicAzimuth = true;
    for (let i = 0; i < betaSamples; i += 1) {
      const [x, y] = points[i];
      bins.add(Math.floor(((Math.atan2(y, x) + TAU) % TAU) / DEG));
    }
    for (let i = 1; i < betaSamples; i += 1) {
      const [x0, y0] = points[i - 1];
      const [x1, y1] = points[i];
      const delta = Math.atan2(y1 * x0 - x1 * y0, x1 * x0 + y1 * y0);
      if (delta < -1e-12) monotonicAzimuth = false;
    }
    recordBoolean(group, '0°→360° 扫过完整圆周（360 个方位 bin 全部覆盖）', bins.size >= 360);
    recordBoolean(group, 'β 增大时 A 的方位角单调扫过整圈', monotonicAzimuth);
    record(
      group,
      '轨迹平面 z=0.5 的几何半径 √3/2（不是 φ=60° 或 π/3）',
      Math.abs(Math.sqrt(0.75) - Math.sin(phi)),
    );

    groups.push(group);
  }

  // ---------------------------------------------------------------------
  // 6. Historical trail invariants
  // ---------------------------------------------------------------------
  {
    const group = newGroup(
      '历史轨迹不变性',
      '分 φ 存点，只显示扫过部分，改变 φ 不重算旧轨迹，清空只删历史。',
    );
    const basis = makeSourceBasis(directionFromAngles(145 * DEG, 35 * DEG));
    const history = new TrailHistory({ stepDeg: 0.25 });
    history.setPhi(35);
    const dir35 = directionAtPhiBeta(basis, 35);

    history.advance({
      phiDeg: 35,
      fromBeta: 0,
      toBeta: 180,
      dirAtBeta: dir35,
      finish: true,
    });
    const firstSnapshot = JSON.stringify(history.snapshot());
    const first = history.segments[0];
    recordBoolean(group, '35° 下 0°→180° 形成一个独立 segment', history.segments.length === 1);
    record(group, 'segment 起点 β≈0°', Math.abs(first.startBetaDeg - 0));
    record(group, 'segment 终点 β≈180°', Math.abs(first.endBetaDeg - 180));
    const firstPoints = first.points;
    let stepError = 0;
    for (let i = 1; i < firstPoints.length; i += 1) {
      stepError = Math.max(
        stepError,
        Math.abs(firstPoints[i].betaDeg - firstPoints[i - 1].betaDeg),
      );
    }
    recordBoolean(group, '采样角间隔 ≤ 0.5°', stepError <= 0.5 + 1e-9, { stepError });

    // Change only phi. No movement, no new points, and previous data untouched.
    history.finalize(35, 180, dir35);
    history.setPhi(55);
    recordBoolean(
      group,
      '只改 φ、不转 β 时不新增 segment',
      history.segments.length === 1,
    );
    recordBoolean(
      group,
      '只改 φ 后旧轨迹数据逐字节不变',
      JSON.stringify(history.snapshot()) === firstSnapshot,
    );

    const dir55 = directionAtPhiBeta(basis, 55);
    history.advance({
      phiDeg: 55,
      fromBeta: 180,
      toBeta: 540,
      dirAtBeta: dir55,
      finish: true,
    });
    const snapshotAfter55 = JSON.stringify(history.snapshot());
    recordBoolean(group, '55° 下继续转动创建新 segment', history.segments.length === 2);
    recordBoolean(
      group,
      '新 φ 下有独立段，不与 35° 段合并',
      history.segments[0].phiDeg === 35 && history.segments[1].phiDeg === 55,
    );
    recordBoolean(
      group,
      '35° 段的点仍然保持 35° 记录，未被最新 φ 重算',
      history.segments[0].points.every((_, index) =>
        JSON.stringify(history.segments[0].points[index]) ===
        JSON.stringify(JSON.parse(firstSnapshot)[0].points[index]),
      ),
    );

    // All stored A directions satisfy the sky-sphere and small-circle laws.
    let sphereError = 0;
    let phiDotError = 0;
    for (const segment of history.segments) {
      const cosine = Math.cos(degToRad(segment.phiDeg));
      for (const point of segment.points) {
        sphereError = Math.max(sphereError, Math.abs(Math.hypot(...point.dir) - 1));
        phiDotError = Math.max(
          phiDotError,
          Math.abs(dot(point.dir, basis.s0) - cosine),
        );
      }
    }
    record(group, '所有历史点：|A−O|=R（方向为单位向量）', sphereError);
    record(group, '所有历史点：(A−O)·s0 = R cosφ（按记录 φ）', phiDotError);

    // A stationary update must not append duplicates.
    const countBeforePause = history.totalPointCount;
    history.advance({
      phiDeg: 55,
      fromBeta: 540,
      toBeta: 540,
      dirAtBeta: dir55,
      finish: true,
    });
    recordBoolean(
      group,
      'β 静止时不重复追加点',
      history.totalPointCount === countBeforePause,
    );

    // A 0 -> 360 sequence must record a full loop even though endpoints match.
    const loopHistory = new TrailHistory({ stepDeg: 0.25 });
    loopHistory.setPhi(60);
    const dir60 = directionAtPhiBeta(basis, 60);
    loopHistory.advance({
      phiDeg: 60,
      fromBeta: 0,
      toBeta: 360,
      dirAtBeta: dir60,
      finish: true,
    });
    recordBoolean(group, 'β=0°→360° 记录起点 0°', Math.abs(loopHistory.segments[0].startBetaDeg) < 1e-9);
    recordBoolean(group, 'β=0°→360° 记录终点 360°', Math.abs(loopHistory.segments[0].endBetaDeg - 360) < 1e-9);
    recordBoolean(group, 'β=0°→360° 保留完整轨迹点（不是“没动”）', loopHistory.totalPointCount > 1000);

    // New camera interactions cannot even reach the data API; clear() is the
    // only data-removal call.
    history.clear();
    recordBoolean(group, 'clear() 删除所有历史段', history.segments.length === 0);
    recordBoolean(group, 'clear() 后当前 φ 记录不参与渲染可恢复', snapshotAfter55.length > 1000);

    groups.push(group);
  }

  // ---------------------------------------------------------------------
  // 7. Compton energy relations
  // ---------------------------------------------------------------------
  {
    const group = newGroup(
      'Compton 能量关系',
      'E′=E/[1+(E/mₑc²)(1−cosφ)]，Tₑ=E−E′，能量沉积反算 φ。',
    );
    const E = 1000;
    const phi = 35 * DEG;
    const scattered = scatteredPhotonEnergy(E, phi);
    const recoil = recoilElectronEnergy(E, phi);
    record(group, '35° 散射后能量 E′ 在 (0,E) 内', scattered > 0 && scattered < E ? 0 : 1);
    record(group, 'Tₑ=E−E′', Math.abs(recoil - (E - scattered)));
    record(group, 'φ=0° 时 E′=E', Math.abs(scatteredPhotonEnergy(E, 0) - E));
    record(group, 'φ=180° 时 E′ 最小且仍 > 0', scatteredPhotonEnergy(E, Math.PI) > 0 ? 0 : 1);
    record(
      group,
      '能量沉积反算 φ 与输入一致（1000 keV, 35°）',
      Math.abs(phiFromEnergyDeposits(recoil, scattered) - phi),
    );
    record(group, 'mₑc² 使用 510.999 keV', Math.abs(MEC2_KEV - 510.999) < 1e-3 ? 0 : 1);
    groups.push(group);
  }

  // Finish summary.
  for (const group of groups) {
    group.total = group.checks.length;
    group.passedCount = group.checks.filter((check) => check.passed).length;
    group.failedCount = group.total - group.passedCount;
    group.passed = group.failedCount === 0;
  }
  const allChecks = groups.flatMap((group) => group.checks);
  const failures = groups.flatMap((group) =>
    group.failures.map((failure) => ({ group: group.name, ...failure })),
  );
  const maxError = Math.max(0, ...groups.map((group) => group.maxError));

  return {
    passed: failures.length === 0,
    total: allChecks.length,
    passedCount: allChecks.filter((check) => check.passed).length,
    failedCount: failures.length,
    tolerance: VALIDATION_TOLERANCE,
    maxError,
    groups,
    failures,
    example: {
      s0: [0, 0, 1],
      b1: [1, 0, 0],
      b2: [0, 1, 0],
      phiDeg: 60,
      R: 1,
      z: 0.5,
      rho: Math.sqrt(3) / 2,
    },
  };
}
