import assert from 'node:assert/strict';
import test from 'node:test';
import { DropLog } from '../src/dropLog.js';

test('daily stability line: counts losses and the longest gap, never the start-up or a restart', () => {
  let now = 0;
  const log = new DropLog(() => now);
  log.note('AC', false); // not yet connected at start-up: not a loss
  log.note('AC', true);
  log.note('Washer', true);
  now = 60_000; log.note('Washer', false); log.note('Washer', false);
  now = 218_000; log.note('Washer', true);
  now = 300_000; log.note('Washer', false);
  now = 320_000; log.note('Washer', true);
  log.note('Never', false);
  assert.deepEqual(log.report(), [
    '[AC] last 24 hours: no connection losses.',
    '[Washer] last 24 hours: 2 connection losses, longest 2m 38s.',
  ]);
  // A new period starts clean; a loss still open is reported as such.
  now = 400_000; log.note('AC', false);
  now = 4_000_000;
  assert.deepEqual(log.report(), [
    '[AC] last 24 hours: 1 connection loss, longest 1h 0m (still not reachable).',
    '[Washer] last 24 hours: no connection losses.',
  ]);
});
