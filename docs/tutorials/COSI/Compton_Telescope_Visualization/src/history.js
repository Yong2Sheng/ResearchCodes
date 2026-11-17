/**
 * Historical centre-track storage.
 *
 * This module knows nothing about Three.js, the current phi, or the current
 * camera. Every point is written once and keeps the phi and beta that produced
 * it. Segments are never connected across a phi change, and only clear()
 * deletes data.
 */

export const DEFAULT_HISTORY_STEP_DEG = 0.25;
export const MIN_BETA_EPS = 1e-9;

export class TrailHistory {
  constructor({ stepDeg = DEFAULT_HISTORY_STEP_DEG } = {}) {
    if (!(stepDeg > 0 && stepDeg <= 0.5)) {
      throw new Error('Trail sampling step must be in (0, 0.5] degrees.');
    }
    this.stepDeg = stepDeg;
    this.segments = [];
    this.activeId = null;
    this.activePhiDeg = null;
    this.lastBetaDeg = null;
    this.currentPhiDeg = null;
    this._nextSegmentId = 1;
  }

  setPhi(phiDeg) {
    if (this.activePhiDeg !== null && Math.abs(phiDeg - this.activePhiDeg) > MIN_BETA_EPS) {
      this._detachActive();
    }
    this.currentPhiDeg = phiDeg;
  }

  clear() {
    this.segments = [];
    this._detachActive();
  }

  get activeSegment() {
    if (this.activeId === null) return null;
    return this.segments.find((segment) => segment.id === this.activeId) ?? null;
  }

  get totalPointCount() {
    return this.segments.reduce((sum, segment) => sum + segment.points.length, 0);
  }

  /**
   * Append the exact current endpoint to the active segment. Used when an
   * interaction ends or before phi changes. Never creates a segment.
   */
  finalize(phiDeg, betaDeg, dirAtBeta) {
    if (this.activeId === null) return false;
    if (this.activePhiDeg === null) return false;
    if (Math.abs(phiDeg - this.activePhiDeg) > MIN_BETA_EPS) return false;
    if (this.lastBetaDeg === null) return false;
    if (Math.abs(betaDeg - this.lastBetaDeg) < MIN_BETA_EPS) return false;
    this._append(this.activeId, betaDeg, dirAtBeta(betaDeg));
    this.lastBetaDeg = betaDeg;
    return true;
  }

  /**
   * Advance the trail from its last recorded sample toward toBeta.
   *
   * Sampling is by unwrapped beta angle (not by animation frame): intermediate
   * points are inserted every stepDeg. finish=true writes the exact endpoint;
   * otherwise the endpoint is left to the next interaction/pause finalizer.
   *
   * The current marker may move between calls while the stored trail lags by
   * at most stepDeg. No points are appended when beta is stationary.
   */
  advance({ phiDeg, fromBeta, toBeta, dirAtBeta, finish = false }) {
    // Defensive guard: even if a caller forgets to notify a phi change, never
    // add a point to a segment belonging to another phi.
    if (this.activePhiDeg !== null && Math.abs(phiDeg - this.activePhiDeg) > MIN_BETA_EPS) {
      this._detachActive();
    }
    this.currentPhiDeg = phiDeg;

    if (!Number.isFinite(fromBeta) || !Number.isFinite(toBeta)) {
      return null;
    }

    const initialMovement = Math.abs(toBeta - fromBeta) >= MIN_BETA_EPS;
    if (this.activeId === null) {
      if (!initialMovement) return null;
      this._startSegment(phiDeg, fromBeta, dirAtBeta(fromBeta));
      this.lastBetaDeg = fromBeta;
    }

    if (this.activeId === null) return null;
    const segment = this.activeSegment;
    if (!segment) {
      this._detachActive();
      return null;
    }

    let cursor = this.lastBetaDeg ?? fromBeta;
    const sign = Math.sign(toBeta - cursor);
    if (sign !== 0) {
      const step = this.stepDeg;
      let guard = 0;
      while (Math.abs(toBeta - cursor) >= step * (1 - 1e-12)) {
        cursor += sign * step;
        this._append(this.activeId, cursor, dirAtBeta(cursor));
        guard += 1;
        if (guard > 2_000_000) throw new Error('Trail sampling exceeded safety limit.');
      }
      if (finish && Math.abs(toBeta - cursor) >= MIN_BETA_EPS) {
        cursor = toBeta;
        this._append(this.activeId, cursor, dirAtBeta(cursor));
      }
    }
    this.lastBetaDeg = cursor;
    segment.endBetaDeg = cursor;
    segment.updated = true;
    return segment;
  }

  /** Mark the active segment as no longer accepting points, keeping history. */
  detach() {
    this._detachActive();
  }

  /** Plain snapshot useful for tests and diagnostics. */
  snapshot() {
    return this.segments.map((segment) => ({
      id: segment.id,
      phiDeg: segment.phiDeg,
      startBetaDeg: segment.startBetaDeg,
      endBetaDeg: segment.endBetaDeg,
      style: { ...segment.style },
      points: segment.points.map((point) => ({
        betaDeg: point.betaDeg,
        dir: point.dir.slice(),
      })),
    }));
  }

  _startSegment(phiDeg, betaDeg, dir) {
    const segment = {
      id: this._nextSegmentId++,
      phiDeg,
      startBetaDeg: betaDeg,
      endBetaDeg: betaDeg,
      style: {
        color: '#4ea8ff',
        width: 3.2,
        role: 'axis-A-history',
      },
      points: [{ betaDeg, dir: dir.slice() }],
      updated: true,
    };
    this.segments.push(segment);
    this.activeId = segment.id;
    this.activePhiDeg = phiDeg;
    this.lastBetaDeg = betaDeg;
    return segment;
  }

  _append(segmentId, betaDeg, dir) {
    const segment = this.segments.find((item) => item.id === segmentId);
    if (!segment) return;
    const last = segment.points[segment.points.length - 1];
    if (last) {
      const sameBeta = Math.abs(betaDeg - last.betaDeg) < MIN_BETA_EPS;
      const sameDir =
        Math.abs(dir[0] - last.dir[0]) < 1e-14 &&
        Math.abs(dir[1] - last.dir[1]) < 1e-14 &&
        Math.abs(dir[2] - last.dir[2]) < 1e-14;
      if (sameBeta && sameDir) return;
    }
    segment.points.push({ betaDeg, dir: dir.slice() });
    segment.endBetaDeg = betaDeg;
    segment.updated = true;
  }

  _detachActive() {
    this.activeId = null;
    this.activePhiDeg = null;
    this.lastBetaDeg = null;
  }
}
