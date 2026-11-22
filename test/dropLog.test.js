import assert from 'node:assert/strict';
import test from 'node:test';
import { DropLog } from '../src/dropLog.js';

const H = 3_600_000;

test('daily stability line: counts losses and the longest gap, never the start-up', () => {
  let now = 0;
  const log = new DropLog({ now: () => now });
  for (const name of ['AC', 'Washer', 'Never']) { log.expect(name); }
  log.note('AC', false); // not yet connected at start-up: not a loss
  log.note('AC', true);
  log.note('Washer', true);
  now = 60_000; log.note('Washer', false); log.note('Washer', false);
  now = 218_000; log.note('Washer', true);
  now = 300_000; log.note('Washer', false);
  now = 320_000; log.note('Washer', true);
  log.note('Never', false);
  assert.equal(log.due(), false);
  now = 24 * H;
  assert.equal(log.due(), true);
  assert.deepEqual(log.report(), [
    '[AC] last 24 hours: no connection losses.',
    '[Washer] last 24 hours: 2 new connection losses, longest gap 2m 38s.',
    '[Never] last 24 hours: did not connect during the period.',
  ]);
});

test('daily stability line: a loss running across two periods is counted once', () => {
  let now = 0;
  const log = new DropLog({ now: () => now });
  log.note('AC', true);
  now = 23 * H; log.note('AC', false);
  now = 24 * H;
  assert.deepEqual(log.report(), ['[AC] last 24 hours: 1 new connection loss, longest gap 1h 0m (still not reachable).']);
  now = 26 * H; log.note('AC', true);
  now = 48 * H;
  assert.deepEqual(log.report(), ['[AC] last 24 hours: 0 new connection losses, longest gap 2h 0m (one loss continued from the period before and is not counted again).']);
  now = 72 * H;
  assert.deepEqual(log.report(), ['[AC] last 24 hours: no connection losses.']);
});

test('daily stability line: figures survive a restart of the bridge, and the restart is not a loss', () => {
  let now = 0;
  let disk = null;
  const io = { now: () => now, load: () => structuredClone(disk), save: (state) => { disk = structuredClone(state); } };
  const first = new DropLog(io);
  first.note('AC', true);
  now = 2 * H; first.note('AC', false);
  now = 2 * H + 90_000; first.note('AC', true);
  // The plugin is updated after 23 hours: a new process starts.
  now = 23 * H;
  const second = new DropLog(io);
  second.note('AC', false); // helper not up yet
  second.note('AC', true);
  assert.equal(second.due(), false);
  now = 24 * H;
  assert.equal(second.due(), true);
  assert.deepEqual(second.report(), ['[AC] last 24 hours: 1 new connection loss, longest gap 1m 30s.']);
});
