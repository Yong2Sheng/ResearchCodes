import assert from 'node:assert/strict';
import { directionFromAngles, anglesFromDirection, degToRad, dot, normalize } from '../src/physics.js';
import { makeDirectionAngleAids } from '../src/geometry.js';
let cases = 0;
for (const chi of [1, 35, 69.82078340706946, 90, 145, 179]) {
  for (const psi of [0, 1, 39.7, 90, 179.9, 180, 219.6736419092159, 270, 359.9]) {
    const k = directionFromAngles(degToRad(chi), degToRad(psi));
    const angles = anglesFromDirection(k);
    const aids = makeDirectionAngleAids(k, angles.chi, angles.psi, !angles.pole);
    const end = aids.psiArc.at(-1);
    const projection = normalize([k[0], k[1], 0]);
    assert.ok(Math.hypot(...end.map((x, i) => x - projection[i])) < 1e-10);
    assert.ok(Math.hypot(...aids.psiArc[0].map((x, i) => x - [0, 1, 0][i])) < 1e-10);
    assert.ok(aids.psiArc.every((p) => p[2] === 0 && Math.abs(dot(p, p) - 1) < 1e-10));
    let sweep = 0;
    for (let i = 1; i < aids.psiArc.length; i++) {
      const a = aids.psiArc[i - 1], b = aids.psiArc[i];
      // Positive rotation is +y toward +x, so negate the z cross product.
      sweep += Math.atan2(a[1] * b[0] - a[0] * b[1], dot(a, b));
    }
    assert.ok(Math.abs(sweep - degToRad(psi)) < 1e-10);
    cases++;
  }
}
for (const k of [[0, 0, 1], [0, 0, -1]]) {
  const angles = anglesFromDirection(k);
  const aids = makeDirectionAngleAids(k, angles.chi, angles.psi, !angles.pole);
  assert.equal(angles.psi, null);
  assert.equal(aids.psiArc.length, 0);
  assert.equal(aids.psiHorizontal, null);
  cases++;
}
console.log(`PASS: ${cases} ψ cases; +y reference, signed full sweep, xy endpoint, and poles verified.`);
