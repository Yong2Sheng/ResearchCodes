/**
 * Run the same executable mathematical validation as the in-page self-test.
 * Usage: npm test
 */

import assert from 'node:assert/strict';
import { runValidation, VALIDATION_TOLERANCE } from '../src/validation.js';

const startedAt = performance.now();
const result = runValidation();
const elapsedMs = performance.now() - startedAt;

console.log('');
console.log('Compton real-space geometry — independent numerical validation');
console.log('===============================================================');
console.log(`checks             : ${result.passedCount}/${result.total}`);
console.log(`result             : ${result.passed ? 'PASS' : 'FAIL'}`);
console.log(`double tolerance   : ${VALIDATION_TOLERANCE.toExponential(1)}`);
console.log(`measured max error : ${result.maxError.toExponential(6)}`);
console.log(`elapsed (Node)     : ${elapsedMs.toFixed(2)} ms`);
console.log('');
console.log('Groups');
console.log('------');
for (const group of result.groups) {
  console.log(
    `${group.passed ? 'PASS' : 'FAIL'}  ${String(group.passedCount).padStart(2)}/${String(group.total).padEnd(2)}  ${group.name.padEnd(22)}  maxErr=${group.maxError.toExponential(3)}`,
  );
  if (!group.passed) {
    for (const failure of group.failures) {
      console.log(`      FAIL: ${failure.name} (error=${failure.error})`);
    }
  }
}
console.log('');
console.log('Independent example');
console.log('-------------------');
console.log('s0=(0,0,1), b1=(1,0,0), b2=(0,1,0), R=1, φ=60°');
console.log('A track: z = 0.5, x²+y² = 0.75, Euclidean radius = √3/2 = 0.8660254038');
console.log('β=0° and β=360° have the same pose, but the 0°→360° sweep is recorded.');
console.log('');

if (!result.passed) {
  console.error('Validation FAILED');
  for (const failure of result.failures) {
    console.error(`- [${failure.group}] ${failure.name}: ${failure.error} > ${failure.tolerance}`);
  }
  process.exitCode = 1;
} else {
  console.log('Validation PASSED');
}
assert.equal(result.failedCount, 0, 'All executable mathematical checks must pass.');
