/**
 * Pure geometric mesh/arc data for the event cone, event circle and angular
 * aids. This module deliberately has no Three.js dependency: the renderer only
 * maps these physical-frame coordinates into Three.js world coordinates.
 */

import {
  TAU,
  clamp,
  coneAxisDirection,
  cross,
  dot,
  eventCircleFrame,
  makeEventCircleDirections,
  normalize,
  scale,
  sourcePosition,
  sub,
} from './physics.js';

export const DEGENERATE_ANGLE_EPS = 1e-9;

/**
 * Build the lateral surface of the REAL event cone.
 *
 * The surface is the union of rays O + rho*s(t), 0 <= rho <= R, where s(t) is
 * the actual event circle. It is not a fixed-angle ConeGeometry.
 *
 * At phi = 0 or 180 degrees the circle collapses to S and the cone is a ray.
 * At phi = 90 degrees the surface is a planar disk through O.
 */
export function makeEventConeData(phi, beta, basis, R = 1, ringSegments = 192) {
  const circle = makeEventCircleDirections(phi, beta, basis, ringSegments);
  const { frame, points: directions } = circle;
  const ringCount = ringSegments;
  const positions3D = directions.map((direction) => scale(direction, R));
  const uniqueRing = positions3D.slice(0, ringCount);
  const isRay = Math.abs(frame.h) < DEGENERATE_ANGLE_EPS;
  const isPlane = Math.abs(frame.c) < 1e-9;

  // Apex + one ring vertex per sample. Triangles fan from O to the rim.
  const vertices = [];
  vertices.push(0, 0, 0);
  for (const point of uniqueRing) vertices.push(point[0], point[1], point[2]);

  const indices = [];
  if (!isRay) {
    for (let i = 0; i < ringCount; i += 1) {
      const next = (i + 1) % ringCount;
      indices.push(0, 1 + i, 1 + next);
    }
  }

  // Sparse generatrices make the three-dimensional relationship legible.
  const generatrices = [];
  const lineCount = 18;
  for (let i = 0; i < lineCount; i += 1) {
    const index = Math.round((i / lineCount) * ringCount);
    const endpoint = positions3D[index % ringCount];
    generatrices.push([[0, 0, 0], endpoint]);
  }

  return {
    frame,
    classification: isRay ? 'ray' : isPlane ? 'plane' : 'cone',
    isDegenerate: isRay,
    isPlanar: isPlane,
    apex: [0, 0, 0],
    ringDirections: uniqueRing.map((point) => scale(point, 1 / R)),
    ringPositions: positions3D,
    // The event circle is a red curve; close it explicitly for a line strip.
    circlePositions: [...positions3D, positions3D[0]],
    mesh: { vertices, indices },
    generatrices,
    centerB: scale(frame.axis, R * frame.c),
    axisPointA: scale(frame.axis, R),
    ringRadius: R * Math.abs(frame.h),
    halfAngle: phi,
  };
}

/** Unit directions along the short great-circle arc S -> A. */
export function makePhiAngleArc(phi, beta, basis, steps = 120) {
  if (phi < DEGENERATE_ANGLE_EPS || Math.PI - phi < DEGENERATE_ANGLE_EPS) {
    return [];
  }
  const { axis, k } = coneAxisDirection(phi, beta, basis);
  const s0 = basis.s0;
  // The angle between s0 and a equals the Compton angle. This is a direct
  // slerp on that great circle rather than a chord.
  const cosine = clamp(dot(s0, axis), -1, 1);
  const omega = Math.acos(cosine);
  if (omega < 1e-9) return [];
  // An exact 180-degree arc has no unique great circle; the UI hides it and
  // reports the degenerate geometry instead of inventing an orientation.
  if (Math.PI - omega < 1e-8) return [];
  const sinOmega = Math.sin(omega);
  const count = Math.max(2, Math.round(steps));
  const points = [];
  for (let i = 0; i <= count; i += 1) {
    const t = i / count;
    const wa = Math.sin((1 - t) * omega) / sinOmega;
    const wb = Math.sin(t * omega) / sinOmega;
    points.push([
      s0[0] * wa + axis[0] * wb,
      s0[1] * wa + axis[1] * wb,
      s0[2] * wa + axis[2] * wb,
    ]);
  }
  return points;
}

/**
 * Angular aids based on k (the scattered-photon propagation direction), not
 * on the back-projection axis:
 *   - chi arc: from -z toward k along their common great circle;
 *   - psi arc: in the xy plane from +y toward the azimuth of k.
 * Directions are unit vectors; the renderer applies the display radius.
 */
export function makeDirectionAngleAids(k, chiRad, psiRad, psiDefined) {
  const poleDirection = [0, 0, -1];
  const kUnit = normalize(k);
  const cosChi = clamp(dot(poleDirection, kUnit), -1, 1);
  const omega = Math.acos(cosChi);

  let chiArc = [];
  const steps = 72;
  if (omega < 1e-9) {
    chiArc = [poleDirection.slice(), kUnit.slice()];
  } else if (Math.PI - omega < 1e-8) {
    // Any meridian is a valid short great-circle arc toward the antipode.
    // Choose the deterministic +x meridian instead of dividing by sin(pi).
    for (let i = 0; i <= steps; i += 1) {
      const t = (i / steps) * Math.PI;
      chiArc.push([Math.sin(t), 0, -Math.cos(t)]);
    }
  } else {
    const sinOmega = Math.sin(omega);
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      const wa = Math.sin((1 - t) * omega) / sinOmega;
      const wb = Math.sin(t * omega) / sinOmega;
      chiArc.push([
        poleDirection[0] * wa + kUnit[0] * wb,
        poleDirection[1] * wa + kUnit[1] * wb,
        poleDirection[2] * wa + kUnit[2] * wb,
      ]);
    }
  }

  let psiArc = [];
  let psiHorizontal = null;
  if (psiDefined) {
    const steps = Math.max(2, Math.ceil((psiRad / TAU) * 96));
    for (let i = 0; i <= steps; i += 1) {
      const angle = (i / steps) * psiRad;
      psiArc.push([Math.sin(angle), Math.cos(angle), 0]);
    }
    psiHorizontal = [Math.sin(psiRad), Math.cos(psiRad), 0];
  }

  return { chiArc, psiArc, psiHorizontal, poleDirection, kUnit };
}

/**
 * The current cone axis circle as a mathematical guide. It is not history.
 * A(beta) is on the sky sphere and its plane is perpendicular to s0.
 */
export function makeTheoreticalOrbit(phi, basis, R = 1, steps = 360) {
  const count = Math.max(24, Math.round(steps));
  const points = [];
  for (let i = 0; i <= count; i += 1) {
    const beta = (i / count) * TAU;
    points.push(scale(coneAxisDirection(phi, beta, basis).axis, R));
  }
  return points;
}

/** A finite dashed ray used for the two degenerate phi endpoints. */
export function makeDegenerateRay(basis, R = 1) {
  return [[0, 0, 0], scale(sourcePosition(basis, 1), R)];
}

/** Small centered ring geometry used to frame the O-S source axis. */
export function makeSourceAxis(basis, R = 1) {
  return { start: [0, 0, 0], end: scale(basis.s0, R) };
}

/** Tangent frame for a small "north" marker around S (for label anchoring). */
export function tangentBasisAt(direction, basis) {
  const normal = normalize(direction);
  let tangent = sub(basis.b1, scale(normal, dot(basis.b1, normal)));
  if (Math.hypot(...tangent) < 1e-6) {
    tangent = cross(normal, basis.b2);
  }
  return normalize(tangent);
}
