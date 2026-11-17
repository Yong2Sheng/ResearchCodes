/**
 * Pure Compton geometry and angular-convention utilities.
 *
 * Conventions (fixed for this project):
 *   - Right-handed physical frame x, y, z.
 *   - chi (polar angle) is measured from -z: 0 <= chi <= pi.
 *   - psi (azimuth) is measured in the xy plane from +y toward +x.
 *   - d(chi, psi) = (sin chi sin psi, sin chi cos psi, -cos chi).
 *
 *   - psi has no unique value at the poles chi = 0 or pi.  Those points are
 *     reported explicitly instead of returning a jittering angle.
 *
 * No rendering-library types are used here. All functions operate on plain
 * numeric arrays so the complete geometry can be validated independently.
 */

export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;
export const MEC2_KEV = 510.99895;
export const POLE_EPS = 1e-10;

export function clamp(value, low, high) {
  return Math.min(high, Math.max(low, value));
}

export function degToRad(degrees) {
  return degrees * DEG;
}

export function radToDeg(radians) {
  return radians / DEG;
}

/** Wrap to [0, TAU). A tiny negative value never leaks out as TAU. */
export function wrapTwoPi(angle) {
  let wrapped = angle % TAU;
  if (wrapped < 0) wrapped += TAU;
  // Guard against `-1e-18 % TAU + TAU === TAU` in floating point.
  if (wrapped >= TAU) wrapped = 0;
  return wrapped;
}

export function wrapDeg(degrees) {
  const wrapped = ((degrees % 360) + 360) % 360;
  return Object.is(wrapped, -0) ? 0 : wrapped;
}

export function vec3(x = 0, y = 0, z = 0) {
  return [x, y, z];
}

export function add(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

export function sub(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

export function scale(a, scalar) {
  return [a[0] * scalar, a[1] * scalar, a[2] * scalar];
}

export function neg(a) {
  return [-a[0], -a[1], -a[2]];
}

export function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

export function length(a) {
  return Math.hypot(a[0], a[1], a[2]);
}

export function distance(a, b) {
  return length(sub(a, b));
}

export function normalize(a, fallback = [0, 0, 1]) {
  const len = length(a);
  if (!Number.isFinite(len) || len < 1e-15) return fallback.slice();
  return scale(a, 1 / len);
}

export function lerp(a, b, t) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

export function isFiniteVec(a) {
  return a.every(Number.isFinite);
}

/**
 * Unit direction from the project's sky coordinates.
 * chi = 0 points to -z; psi is measured from +y toward +x.
 */
export function directionFromAngles(chi, psi) {
  const sinChi = Math.sin(chi);
  return [
    sinChi * Math.sin(psi),
    sinChi * Math.cos(psi),
    -Math.cos(chi),
  ];
}

/**
 * Inverse of directionFromAngles.
 *
 * At chi = 0 or pi, psi is physically undefined; return psi = null and
 * pole = true rather than amplifying floating-point noise into an angle.
 */
export function anglesFromDirection(direction) {
  const d = normalize(direction);
  const dz = clamp(d[2], -1, 1);
  const chi = Math.acos(clamp(-dz, -1, 1));
  const transverse = Math.hypot(d[0], d[1]);
  if (transverse < POLE_EPS) {
    return { chi, psi: null, pole: true, transverse };
  }
  return {
    chi,
    psi: wrapTwoPi(Math.atan2(d[0], d[1])),
    pole: false,
    transverse,
  };
}

/**
 * Coordinates of the back-projection axis a = -k.
 * They satisfy chi_a = pi - chi_k, psi_a = wrap(psi_k + pi).
 */
export function anglesOfBackprojectionAxis(axisDirection) {
  return anglesFromDirection(axisDirection);
}

export function anglesOfScatteredPhoton(k) {
  return anglesFromDirection(k);
}

export function angleDifferenceRad(a, b) {
  return Number.isNaN(a) || Number.isNaN(b) ? NaN : Math.abs(wrapTwoPi(a - b));
}

/**
 * Deterministic orthonormal basis perpendicular to the source direction.
 * b2 = s0 x b1.  Once created for a fixed source this basis is reused; it is
 * not rebuilt from a changing or random auxiliary vector every frame.
 */
export function makeSourceBasis(sourceDirection, auxiliary = [1, 0, 0]) {
  const s0 = normalize(sourceDirection);
  const candidates = [auxiliary, [0, 1, 0], [0, 0, 1], [1, 0, 0]];
  let q = null;
  for (const candidate of candidates) {
    const c = normalize(candidate, [0, 1, 0]);
    if (Math.abs(dot(c, s0)) <= 0.9) {
      q = c;
      break;
    }
  }
  if (!q) {
    // The candidates above cover the sphere; this branch is defensive only.
    const seed = Math.abs(s0[0]) < 0.8 ? [1, 0, 0] : [0, 1, 0];
    q = normalize(seed);
  }

  let tangent = sub(q, scale(s0, dot(q, s0)));
  if (length(tangent) < 1e-8) {
    // Defensive fallback: pick any vector not parallel to s0.
    const seed = Math.abs(s0[0]) < 0.8 ? [1, 0, 0] : [0, 1, 0];
    tangent = sub(seed, scale(s0, dot(seed, s0)));
  }
  const b1 = normalize(tangent);
  const b2 = normalize(cross(s0, b1));
  return { s0, b1, b2 };
}

/**
 * Real back-projection-axis direction for a Compton event cone.
 *
 *   a(phi, beta) = cos(phi) s0 + sin(phi) (b1 cos(beta) + b2 sin(beta))
 *   k = -a
 *
 * beta is the independent rotation about the O-S axis. It is not psi.
 */
export function coneAxisDirection(phi, beta, basis) {
  const { s0, b1, b2 } = basis;
  const c = Math.cos(phi);
  const h = Math.sin(phi);
  const w = add(scale(b1, Math.cos(beta)), scale(b2, Math.sin(beta)));
  const axis = add(scale(s0, c), scale(w, h));
  const k = neg(axis);
  return { axis, k, w, c, h };
}

/**
 * Stable orthonormal basis of the event circle.
 *
 * Normally u = (s0 - cos(phi) a) / sin(phi).  Near the degenerate endpoints
 * that expression loses precision, so we use the algebraically identical,
 * division-free form
 *
 *   u = sin(phi) s0 - cos(phi) w,
 *   v = a x u.
 *
 * It is valid at phi = 0 and phi = 180 degrees as well.  At t = 0 the circle
 * point is exactly s0 because
 *   cos(phi) a + sin(phi) u = s0.
 */
export function eventCircleFrame(phi, beta, basis) {
  const { s0, b1, b2 } = basis;
  const c = Math.cos(phi);
  const h = Math.sin(phi);
  const w = add(scale(b1, Math.cos(beta)), scale(b2, Math.sin(beta)));
  const axis = add(scale(s0, c), scale(w, h));
  const u = sub(scale(s0, h), scale(w, c));
  const v = cross(axis, u);
  return { axis, u, v, c, h, w };
}

/** Candidate source direction s(t) on the event circle. */
export function eventCircleDirection(frame, t) {
  const { axis, u, v, c, h } = frame;
  return add(
    scale(axis, c),
    add(scale(u, h * Math.cos(t)), scale(v, h * Math.sin(t))),
  );
}

/** Closed event circle in direction space, including t=0 and t=TAU. */
export function makeEventCircleDirections(phi, beta, basis, segments = 144) {
  const frame = eventCircleFrame(phi, beta, basis);
  const count = Math.max(3, Math.round(segments));
  const points = [];
  for (let i = 0; i <= count; i += 1) {
    const t = (i / count) * TAU;
    points.push(eventCircleDirection(frame, t));
  }
  return { frame, points };
}

/**
 * Theoretical full orbit of A for fixed phi:
 *   A(beta) - O = R a(phi, beta),
 *   |A-O| = R,
 *   (A-O) . s0 = R cos(phi).
 */
export function makeFullAxisTrack(phi, basis, R = 1, samples = 720) {
  const count = Math.max(8, Math.round(samples));
  const points = [];
  for (let i = 0; i <= count; i += 1) {
    const beta = (i / count) * TAU;
    points.push(scale(coneAxisDirection(phi, beta, basis).axis, R));
  }
  return points;
}

/** The source marker S = O + R s0. */
export function sourcePosition(basis, R = 1) {
  return scale(basis.s0, R);
}

/** A = O + R a, the point recorded by the project (NOT the planar center B). */
export function axisTrackPoint(phi, beta, basis, R = 1) {
  return scale(coneAxisDirection(phi, beta, basis).axis, R);
}

/**
 * Euclidean center of the event-circle plane:
 *   B = O + R cos(phi) a.
 * Usually inside the sky sphere and generally different from A.
 */
export function eventCirclePlaneCenter(phi, beta, basis, R = 1) {
  const { axis } = coneAxisDirection(phi, beta, basis);
  return scale(axis, R * Math.cos(phi));
}

/** Great-circle slerp between two unit directions. */
export function slerpDirection(a, b, t) {
  const u = normalize(a);
  const v = normalize(b);
  const cosine = clamp(dot(u, v), -1, 1);
  const omega = Math.acos(cosine);
  if (omega < 1e-9) return normalize(lerp(u, v, t));
  if (Math.PI - omega < 1e-8) {
    // There is no unique great circle for an exact antipodal pair; use a
    // deterministic half-turn about a vector orthogonal to u. Display code
    // avoids requesting this for the φ arc, but the primitive stays NaN-free.
    let tangent = cross(u, Math.abs(u[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0]);
    if (length(tangent) < 1e-10) tangent = cross(u, [0, 1, 0]);
    tangent = normalize(tangent);
    return add(scale(u, Math.cos(Math.PI * t)), scale(tangent, Math.sin(Math.PI * t)));
  }
  const sinOmega = Math.sin(omega);
  const wa = Math.sin((1 - t) * omega) / sinOmega;
  const wb = Math.sin(t * omega) / sinOmega;
  return add(scale(u, wa), scale(v, wb));
}

/** Unit directions along the short great-circle arc from u to v. */
export function greatCircleArcDirections(u, v, steps = 48) {
  const omega = Math.acos(clamp(dot(normalize(u), normalize(v)), -1, 1));
  if (!Number.isFinite(omega) || omega < 1e-9) return [normalize(u), normalize(v)];
  const count = Math.max(2, Math.round(steps));
  const points = [];
  for (let i = 0; i <= count; i += 1) {
    points.push(slerpDirection(u, v, i / count));
  }
  return points;
}

/**
 * Azimuth arc in the xy plane, measured from +y toward +x.
 * Returned points are unit directions at z = 0.
 */
export function azimuthArcDirections(psi, steps = 48) {
  const wrapped = wrapTwoPi(psi);
  const count = Math.max(2, Math.ceil(steps * Math.max(wrapped / TAU, 1 / steps)));
  const points = [];
  for (let i = 0; i <= count; i += 1) {
    const t = (i / count) * wrapped;
    points.push([Math.sin(t), Math.cos(t), 0]);
  }
  return points;
}

/** Energy of the scattered photon, in the same unit as E (keV by default). */
export function scatteredPhotonEnergy(E, phi) {
  return E / (1 + (E / MEC2_KEV) * (1 - Math.cos(phi)));
}

/** Recoil electron kinetic energy. */
export function recoilElectronEnergy(E, phi) {
  return E - scatteredPhotonEnergy(E, phi);
}

/**
 * Reconstruct the Compton angle from energy deposits:
 *   cos(phi) = 1 - m_e c^2 (1/E_gamma - 1/(E_e + E_gamma))
 * where E_e is the first-scatter electron energy deposit and E_gamma is the
 * fully absorbed scattered photon energy.  Returns radians.
 */
export function phiFromEnergyDeposits(Ee, Eg) {
  if (!(Ee > 0) || !(Eg > 0)) return NaN;
  const cosine = 1 - MEC2_KEV * (1 / Eg - 1 / (Ee + Eg));
  return Math.acos(clamp(cosine, -1, 1));
}

export function degreesLabel(value, digits = 1) {
  return `${value.toFixed(digits)}°`;
}

export function formatAngleCell(angles, digits = 1) {
  if (!angles || angles.pole || angles.psi === null) {
    return { chi: `${radToDeg(angles ? angles.chi : NaN).toFixed(digits)}°`, psi: '未定义（极点）' };
  }
  return {
    chi: `${radToDeg(angles.chi).toFixed(digits)}°`,
    psi: `${radToDeg(angles.psi).toFixed(digits)}°`,
  };
}
