/**
 * Counts connection losses per appliance so stability can be judged from one
 * log line a day: how many times the link was lost and the longest gap.
 * Restarts of the bridge are never counted: counting starts after the first
 * connection and nothing is carried across a restart.
 */
export class DropLog {
  #devices = new Map();
  #now;

  constructor(now = Date.now) {
    this.#now = now;
  }

  /** Record a change of availability for one appliance. */
  note(name, online) {
    const entry = this.#devices.get(name) ?? { seen: false, since: null, drops: 0, longestMs: 0 };
    this.#devices.set(name, entry);
    if (online) {
      if (entry.since !== null) {
        entry.longestMs = Math.max(entry.longestMs, this.#now() - entry.since);
        entry.since = null;
      }
      entry.seen = true;
    } else if (entry.seen && entry.since === null) {
      entry.since = this.#now();
      entry.drops += 1;
    }
  }

  /** One line per appliance for the period since the last call, then start a new period. */
  report(period = '24 hours') {
    const lines = [];
    for (const [name, entry] of this.#devices) {
      if (!entry.seen) {
        continue;
      }
      const open = entry.since !== null;
      const longest = Math.max(entry.longestMs, open ? this.#now() - entry.since : 0);
      lines.push(entry.drops === 0 && !open
        ? `[${name}] last ${period}: no connection losses.`
        : `[${name}] last ${period}: ${entry.drops} connection ${entry.drops === 1 ? 'loss' : 'losses'}, longest ${span(longest)}${open ? ' (still not reachable)' : ''}.`);
      // A loss still open is carried into the next period as its first.
      entry.drops = open ? 1 : 0;
      entry.longestMs = 0;
    }
    return lines;
  }
}

function span(ms) {
  const seconds = Math.round(ms / 1000);
  return seconds < 60 ? `${seconds}s` : seconds < 3600 ? `${Math.floor(seconds / 60)}m ${seconds % 60}s` : `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}
