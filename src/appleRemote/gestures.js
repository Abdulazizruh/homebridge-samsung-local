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
