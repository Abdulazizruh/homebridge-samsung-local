/**
 * The iPhone remote sends finger movements on its touch area (0..1000 on both
 * axes). A TV only understands steps, so a swipe becomes one arrow and a tap
 * becomes Select. Thresholds follow atvr4samsung (MIT).
 */
const TAP_MAX = 60;
const SWIPE_MIN = 120;
const DOMINANT = 1.3;
export const PHASE = { 1: 'press', 2: 'hold', 3: 'hold', 4: 'release', 5: 'click' };

export class Swipes {
  constructor() { this.start = null; }

  /** Returns 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | 'SELECT' | null. */
  feed(phase, x, y) {
    if (phase === 'press') { this.start = { x, y }; return null; }
    if (phase === 'click') { this.start = null; return 'SELECT'; }
    if (phase !== 'release' || !this.start) { return null; }
    const dx = x - this.start.x; const dy = y - this.start.y;
    this.start = null;
    const ax = Math.abs(dx); const ay = Math.abs(dy);
    if (Math.max(ax, ay) <= TAP_MAX) { return 'SELECT'; }
    if (Math.max(ax, ay) < SWIPE_MIN) { return null; }
    if (ax >= ay) { return ax < ay * DOMINANT ? null : dx > 0 ? 'RIGHT' : 'LEFT'; }
    return ay < ax * DOMINANT ? null : dy > 0 ? 'DOWN' : 'UP';
  }
}

/**
 * The other way to read the touch area: as a trackpad. Every finger movement
 * becomes a small step of the TV's pointer and a tap becomes a click.
 */
const GAIN = 1.6; // touch area units to TV pointer units

const TAP_MS = 300; // a slow small movement is a movement, never a click

export class Pointer {
  constructor(now = Date.now) { this.last = null; this.travel = 0; this.now = now; }

  /** Returns { dx, dy } | 'CLICK' | null. */
  feed(phase, x, y) {
    if (phase === 'click') { this.last = null; return 'CLICK'; }
    if (phase === 'press') { this.last = { x, y }; this.travel = 0; this.since = this.now(); return null; }
    if (!this.last) { return null; }
    const dx = x - this.last.x; const dy = y - this.last.y;
    this.last = phase === 'release' ? null : { x, y };
    this.travel += Math.abs(dx) + Math.abs(dy);
    if (phase === 'release' && this.travel <= TAP_MAX && this.now() - this.since <= TAP_MS) { return 'CLICK'; }
    return dx || dy ? { dx: dx * GAIN, dy: dy * GAIN } : null;
  }
}
