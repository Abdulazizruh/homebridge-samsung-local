/**
 * The iPhone remote sends finger movements on its touch area (0..1000 on both
 * axes). A TV only understands steps, so the area works as on an Apple TV:
 * while the finger slides, the selection moves one step for every stretch of
 * the way, and a tap is Select. Tap and flick thresholds follow atvr4samsung (MIT).
 */
const TAP_MAX = 60;
const SWIPE_MIN = 120; // a short flick is one step
const STEP = 170; // a longer slide: one more step for every stretch this long
const DOMINANT = 1.3;
export const PHASE = { 1: 'press', 2: 'hold', 3: 'hold', 4: 'release', 5: 'click' };

export class Swipes {
  constructor() { this.anchor = null; this.steps = 0; this.travel = 0; }

  /** Returns 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | 'SELECT' | null. */
  feed(phase, x, y) {
    if (phase === 'press') { this.anchor = { x, y }; this.last = { x, y }; this.steps = 0; this.travel = 0; return null; }
    if (phase === 'click') { this.anchor = null; return 'SELECT'; }
    if (!this.anchor || (phase !== 'hold' && phase !== 'release')) { return null; }
    this.travel += Math.abs(x - this.last.x) + Math.abs(y - this.last.y);
    this.last = { x, y };
    const dx = x - this.anchor.x; const dy = y - this.anchor.y;
    const ax = Math.abs(dx); const ay = Math.abs(dy);
    const need = phase === 'release' && this.steps === 0 ? SWIPE_MIN : STEP;
    let direction = null;
    if (Math.max(ax, ay) >= need) {
      if (ax >= ay * DOMINANT) { direction = dx > 0 ? 'RIGHT' : 'LEFT'; } else if (ay >= ax * DOMINANT) { direction = dy > 0 ? 'DOWN' : 'UP'; }
    }
    if (direction) {
      this.steps += 1;
      this.anchor = { x, y }; // the next step is counted from here
    }
    if (phase === 'release') {
      const tap = this.steps === 0 && this.travel <= TAP_MAX;
      this.anchor = null;
      return direction ?? (tap ? 'SELECT' : null);
    }
    return direction;
  }
}
