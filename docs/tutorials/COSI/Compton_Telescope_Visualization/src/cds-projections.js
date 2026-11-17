import {clamp, dot} from './physics.js';

const PI = Math.PI;
const TAU = 2 * PI;
const unit = q => {
  const n = Math.hypot(...q);
  return q.map(x => x / n);
};
const wrapDelta = angle => Math.atan2(Math.sin(angle), Math.cos(angle));

export function displayDirection(q, basis) {
  return [basis.s0, basis.b1, basis.b2].map(e => dot(q, e));
}

export function mollweideAngles(lon, lat) {
  if (Math.abs(Math.abs(lat) - PI / 2) < 1e-12) return [0, Math.sign(lat) * Math.SQRT2];
  let t = lat;
  for (let i = 0; i < 30; i++) {
    const den = 2 + 2 * Math.cos(2 * t);
    if (Math.abs(den) < 1e-12) break;
    const dt = (2 * t + Math.sin(2 * t) - PI * Math.sin(lat)) / den;
    t -= clamp(dt, -.5, .5);
    if (Math.abs(dt) < 1e-12) break;
  }
  return [2 * Math.SQRT2 / PI * lon * Math.cos(t), Math.SQRT2 * Math.sin(t)];
}

export function projectDirection(q, basis, mode = 'standard') {
  const d = displayDirection(q, basis);
  if (mode === 'mollweide') return mollweideAngles(Math.atan2(d[1], d[0]), Math.asin(clamp(d[2], -1, 1)));
  const tangent = Math.hypot(d[1], d[2]);
  const rho = Math.atan2(tangent, clamp(d[0], -1, 1));
  if (tangent < 1e-14) return rho < PI / 2 ? [0, 0] : null;
  return [rho * d[1] / tangent, rho * d[2] / tangent];
}

function clipLongitude(poly, bound, greater) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const ia = greater ? a[0] >= bound : a[0] <= bound;
    const ib = greater ? b[0] >= bound : b[0] <= bound;
    if (ia) out.push(a);
    if (ia !== ib) {
      const t = (bound - a[0]) / (b[0] - a[0]);
      out.push([bound, a[1] + t * (b[1] - a[1])]);
    }
  }
  return out;
}

/** Refine the supplied spherical boundary before longitude clipping.
 * HEALPix edges are already sampled in the asset; short great-circle segments
 * approximate the intervals between those samples, rather than inventing chords
 * in the projected map near a pole.
 */
function refinedBoundary(vs, basis) {
  const points = [];
  function appendEdge(a, b, depth = 0) {
    const mid = unit(a.map((x, j) => x + b[j]));
    const poleA = Math.hypot(a[0], a[1]) < 1e-11;
    const poleB = Math.hypot(b[0], b[1]) < 1e-11;
    const poleMid = Math.hypot(mid[0], mid[1]) < 1e-11;
    const latA = Math.atan2(a[2], Math.hypot(a[0], a[1]));
    const latB = Math.atan2(b[2], Math.hypot(b[0], b[1]));
    const latMid = Math.atan2(mid[2], Math.hypot(mid[0], mid[1]));
    const lonA = Math.atan2(a[1], a[0]);
    const delta = wrapDelta(Math.atan2(b[1], b[0]) - lonA);
    const midDelta = wrapDelta(Math.atan2(mid[1], mid[0]) - lonA);
    const chartBends = !poleA && !poleB && (Math.abs(delta) > .04 || Math.abs(midDelta - delta / 2) > .00005);
    const latitudeBends = Math.abs(latMid - (latA + latB) / 2) > .000005;
    if (depth < 18 && (chartBends || latitudeBends || poleMid && !poleA && !poleB)) {
      appendEdge(a, mid, depth + 1);
      appendEdge(mid, b, depth + 1);
    } else points.push(a);
  }
  for (let i = 0; i < vs.length; i++) {
    const a = unit(vs[i]), b = unit(vs[(i + 1) % vs.length]);
    const angle = Math.acos(clamp(dot(a, b), -1, 1));
    const steps = Math.max(1, Math.ceil(angle / .004));
    for (let j = 0; j < steps; j++) {
      const t = j / steps, u = (j + 1) / steps;
      const start = unit(displayDirection(unit(a.map((x, k) => x * (1 - t) + b[k] * t)), basis));
      const end = unit(displayDirection(unit(a.map((x, k) => x * (1 - u) + b[k] * u)), basis));
      appendEdge(start, end);
    }
  }
  return points;
}

let cachedBasis = null;
let cachedPixels = new WeakMap();

/** Project a spherical pixel, including pixels containing a display pole.
 * Longitude winds by +/-2π around a pole. Close that polygon THROUGH the pole,
 * not with a spurious chord across its longitude chart. Once clipped, subdivide
 * seam edges so their images follow the Mollweide ellipse rather than its chord.
 */
export function projectMollweidePixel(vs, basis) {
  if (cachedBasis !== basis) {cachedBasis = basis; cachedPixels = new WeakMap()}
  if (cachedPixels.has(vs)) return cachedPixels.get(vs);
  const points = refinedBoundary(vs, basis);
  const raw = [];
  for (let i = 0; i < points.length; i++) {
    const q = points[i], lat = Math.asin(clamp(q[2], -1, 1));
    if (Math.hypot(q[0], q[1]) < 1e-11) {
      // A pole on the boundary has two limiting longitudes, one per incident edge.
      const before = points[(i + points.length - 1) % points.length];
      const after = points[(i + 1) % points.length];
      raw.push([Math.atan2(before[1], before[0]), lat], [Math.atan2(after[1], after[0]), lat]);
    } else raw.push([Math.atan2(q[1], q[0]), lat]);
  }
  if (raw.length < 3) return [];
  let angular = [raw[0].slice()];
  for (let i = 1; i < raw.length; i++) {
    angular.push([angular.at(-1)[0] + wrapDelta(raw[i][0] - raw[i - 1][0]), raw[i][1]]);
  }
  const closingLon = angular.at(-1)[0] + wrapDelta(raw[0][0] - raw.at(-1)[0]);
  const turns = Math.round((closingLon - angular[0][0]) / TAU);
  if (turns !== 0) {
    // Choose the actual map seam as the chart cut. Closing at an arbitrary
    // first vertex would create an extra, artificial grid edge inside the pixel.
    let cut = null;
    for (let i = 0; i < angular.length && !cut; i++) {
      const a = angular[i], b = i + 1 < angular.length ? angular[i + 1] : [closingLon, raw[0][1]];
      if (Math.abs(b[0] - a[0]) < 1e-14) continue;
      const low = Math.min(a[0], b[0]), high = Math.max(a[0], b[0]);
      const seam = PI + TAU * Math.ceil((low - PI) / TAU);
      if (seam <= high + 1e-12) {
        const t = clamp((seam - a[0]) / (b[0] - a[0]), 0, 1);
        cut = {i, seam, lat: a[1] + t * (b[1] - a[1])};
      }
    }
    if (cut) {
      const reordered = [[cut.seam, cut.lat]];
      for (let j = cut.i + 1; j < angular.length; j++) reordered.push(angular[j]);
      for (let j = 0; j <= cut.i; j++) reordered.push([angular[j][0] + turns * TAU, angular[j][1]]);
      reordered.push([cut.seam + turns * TAU, cut.lat]);
      angular = reordered;
    } else angular.push([closingLon, raw[0][1]]);
    const poleLat = Math.sign(points.reduce((s, q) => s + q[2], 0)) * PI / 2;
    angular.push([angular.at(-1)[0], poleLat], [angular[0][0], poleLat]);
  }
  const minLon = Math.min(...angular.map(p => p[0]));
  const maxLon = Math.max(...angular.map(p => p[0]));
  const parts = [];
  for (let window = Math.ceil((minLon - PI) / TAU); window <= Math.floor((maxLon + PI) / TAU); window++) {
    let poly = angular.map(([lon, lat]) => [lon - window * TAU, lat]);
    poly = clipLongitude(poly, -PI, true);
    if (poly.length) poly = clipLongitude(poly, PI, false);
    if (poly.length < 3) continue;
    const projected = [];
    function appendProjectedEdge(a, b, depth = 0) {
      const pa = mollweideAngles(...a), pb = mollweideAngles(...b);
      const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const pm = mollweideAngles(...mid);
      const error = Math.hypot(pm[0] - (pa[0] + pb[0]) / 2, pm[1] - (pa[1] + pb[1]) / 2);
      if (depth < 20 && error > .000001) {
        appendProjectedEdge(a, mid, depth + 1);
        appendProjectedEdge(mid, b, depth + 1);
      } else projected.push(pa);
    }
    for (let i = 0; i < poly.length; i++) appendProjectedEdge(poly[i], poly[(i + 1) % poly.length]);
    const distinct = projected.filter((p, i) => i === 0 || Math.hypot(p[0] - projected[i - 1][0], p[1] - projected[i - 1][1]) > 1e-12);
    if (distinct.length > 1 && Math.hypot(distinct[0][0] - distinct.at(-1)[0], distinct[0][1] - distinct.at(-1)[1]) < 1e-12) distinct.pop();
    const twiceArea = Math.abs(distinct.reduce((sum, a, i) => {const b = distinct[(i + 1) % distinct.length];return sum + a[0] * b[1] - b[0] * a[1]}, 0));
    if (distinct.length >= 3 && twiceArea > 1e-13) parts.push(distinct);
  }
  cachedPixels.set(vs, parts);
  return parts;
}

/** Split curves by the actual longitude seam, not an arbitrary map-distance
 * threshold (which misses crossings at high latitude). Add matching endpoints
 * on +/-π so the curve reaches both sides of the map boundary.
 */
export function projectDirectionCurve(directions, basis, mode = 'standard') {
  const parts = [];
  let part = [], previous = null;
  for (const q of directions) {
    const d = unit(displayDirection(q, basis));
    const lon = Math.atan2(d[1], d[0]);
    if (mode === 'mollweide' && previous && Math.abs(lon - previous.lon) > PI) {
      const denominator = previous.d[1] - d[1];
      const t = Math.abs(denominator) > 1e-15 ? previous.d[1] / denominator : .5;
      const seam = unit(previous.d.map((x, j) => x * (1 - t) + d[j] * t));
      const lat = Math.asin(clamp(seam[2], -1, 1));
      const edge = previous.lon > 0 ? PI : -PI;
      part.push(mollweideAngles(edge, lat));
      if (part.length > 1) parts.push(part);
      part = [mollweideAngles(-edge, lat)];
    }
    const xy = projectDirection(q, basis, mode);
    if (xy) part.push(xy);
    previous = {d, lon};
  }
  if (part.length > 1) parts.push(part);
  return parts;
}
