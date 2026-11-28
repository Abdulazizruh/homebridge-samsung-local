/**
 * Counts connection losses per appliance so stability can be judged from one
 * log line per appliance a day: how many times the link was lost and the
 * longest gap.
 *
 * - The figures are kept on disk, so an update or restart of the bridge does
 *   not throw away the day measured so far. The restart itself is never
 *   counted as a loss, and the time the bridge was down is not measured.
 * - A loss that continues from one period into the next is counted once, in
 *   the period it began; the next report names it as continuing.
 * - An appliance that never connected during the period is reported as such.
 */
const PERIOD_MS = 24 * 60 * 60 * 1000;

export class DropLog {
  #now;
  #save;
  #state;
  #up = new Map(); // name -> connected in this run of the bridge
  #since = new Map(); // name -> when the loss still open began (this run)
  #carried = new Set(); // names whose open loss began in an earlier period

  constructor({ now = Date.now, load = () => null, save = () => {}, periodMs = PERIOD_MS } = {}) {
    this.#now = now;
    this.#save = save;
    this.periodMs = periodMs;
    const stored = load();
    this.#state = stored && Number.isFinite(stored.periodStart) && stored.devices && typeof stored.devices === 'object'
      ? stored : { periodStart: now(), devices: {} };
  }

  #entry(name) {
    return (this.#state.devices[name] ??= { connected: false, drops: 0, longestMs: 0 });
  }

  /** Name an appliance that is expected to connect, so its absence shows. */
  expect(name) {
    this.#entry(name);
  }

  /** Record a change of availability for one appliance. */
  note(name, online) {
    const entry = this.#entry(name);
    if (online) {
      if (this.#since.has(name)) {
        entry.longestMs = Math.max(entry.longestMs, this.#now() - Math.max(this.#since.get(name), this.#state.periodStart));
        this.#since.delete(name);
      }
      entry.connected = true;
      this.#up.set(name, true);
    } else if (this.#up.get(name) && !this.#since.has(name)) {
      this.#since.set(name, this.#now());
      entry.drops += 1;
    } else {
      return;
    }
    this.#save(this.#state);
  }

  /**
   * Record a power command that did not go through the first time and was sent once more:
   * 'retried-ok' when the second try worked, 'not-carried' when it did not. Nobody has to
   * report it: the daily line says it.
   */
  command(name, outcome) {
    const entry = this.#entry(name);
    if (outcome === 'retried-ok') {
      entry.retriedOk = (entry.retriedOk ?? 0) + 1;
    } else if (outcome === 'not-carried') {
      entry.notCarried = (entry.notCarried ?? 0) + 1;
    } else {
      return;
    }
    this.#save(this.#state);
  }

  /** True once a full period has passed since the last report. */
  due() {
    return this.#now() - this.#state.periodStart >= this.periodMs;
  }

  /** One line per appliance for the period, then a new period starts. */
  report() {
    const now = this.#now();
    const hours = Math.max(1, Math.round((now - this.#state.periodStart) / 3_600_000));
    const period = `last ${hours} ${hours === 1 ? 'hour' : 'hours'}`;
    const lines = [];
    for (const [name, entry] of Object.entries(this.#state.devices)) {
      const open = this.#since.has(name);
      const carried = this.#carried.has(name);
      const longest = Math.max(entry.longestMs, open ? now - Math.max(this.#since.get(name), this.#state.periodStart) : 0);
      const notes = [
        carried ? 'one loss continued from the period before and is not counted again' : null,
        open ? 'still not reachable' : null,
      ].filter(Boolean);
      const tail = notes.length ? ` (${notes.join('; ')})` : '';
      const ok = entry.retriedOk ?? 0;
      const failed = entry.notCarried ?? 0;
      const commands = ok + failed === 0 ? ''
        : `; power ${ok + failed === 1 ? 'command' : 'commands'} that did not go through the first time: ${ok + failed}`
          + ` (${[ok ? `${ok} worked when sent again` : '', failed ? `${failed} did not` : ''].filter(Boolean).join(', ')})`;
      if (!entry.connected && !open) {
        lines.push(`[${name}] ${period}: did not connect during the period${commands}.`);
      } else if (entry.drops === 0 && !open && !carried) {
        lines.push(`[${name}] ${period}: no connection losses${commands}.`);
      } else {
        const count = `${entry.drops} new connection ${entry.drops === 1 ? 'loss' : 'losses'}`;
        lines.push(`[${name}] ${period}: ${count}${longest ? `, longest gap ${span(longest)}` : ''}${tail}${commands}.`);
      }
      if (open) {
        this.#carried.add(name);
      } else {
        this.#carried.delete(name);
      }
      this.#state.devices[name] = { connected: Boolean(this.#up.get(name)) && !open, drops: 0, longestMs: 0 };
    }
    this.#state.periodStart = now;
    this.#save(this.#state);
    return lines;
  }

  /** Forget appliances that are no longer configured. */
  keepOnly(names) {
    for (const name of Object.keys(this.#state.devices)) {
      if (!names.includes(name)) {
        delete this.#state.devices[name];
      }
    }
  }
}

function span(ms) {
  const seconds = Math.round(ms / 1000);
  return seconds < 60 ? `${seconds}s` : seconds < 3600 ? `${Math.floor(seconds / 60)}m ${seconds % 60}s` : `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}
