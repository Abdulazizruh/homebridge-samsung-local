/**
 * Laundry appliances (washer, dryer, dishwasher): a read-only view of the
 * cycle. Values come from the appliance's own reports; spellings differ
 * between model families, so matching is case-insensitive and tolerant.
 *
 * Seen in captures: state "Ready" | "Run" (also "Pause", "Finish"),
 * machine state "Ready" | "Running" | "Paused" | "Finish" | "idle" | "active" | "pause",
 * progress "None" | "Weightsensing" | "Wash" | "Rinse" | "Spin" | "Finish" | ...
 */
const V = 'x.com.samsung.da.';
export const LAUNDRY_KINDS = new Set(['washer', 'dryer', 'dishwasher']);

const RUNNING = new Set(['run', 'running', 'active']);
const PAUSED = new Set(['pause', 'paused']);
const FINISHED = new Set(['finish', 'finished', 'end', 'complete', 'completed']);
const lower = (v) => (typeof v === 'string' ? v.trim().toLowerCase() : '');

/** "HH:MM:SS" (or "HH:MM") to seconds; null when it is not a duration. */
export function parseDuration(text) {
  const m = /^(\d{1,3}):(\d{2})(?::(\d{2}))?$/.exec(String(text ?? '').trim());
  if (!m) {
    return null;
  }
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3] ?? 0);
}

const number = (v) => {
  const n = Number(v);
  return v === null || v === undefined || v === '' || !Number.isFinite(n) ? null : n;
};

export function buildWasherModel(resources = {}) {
  const vs = resources['/operational/state/vs/0'] ?? {};
  const std = resources['/operational/state/0'] ?? {};
  const info = resources['/information/vs/0'] ?? {};
  const energy = resources['/energy/consumption/vs/0'] ?? {};

  const states = [lower(vs[`${V}state`]), lower(std.currentMachineState)].filter(Boolean);
  const progress = lower(vs[`${V}progress`]) || lower(std.currentJobState);
  const running = states.some((s) => RUNNING.has(s));
  const paused = !running && states.some((s) => PAUSED.has(s));
  const finished = !running && !paused && (states.some((s) => FINISHED.has(s)) || FINISHED.has(progress));
  const remaining = parseDuration(vs[`${V}remainingTime`] ?? std.remainingTime);

  const watts = number(energy[`${V}instantaneousPower`]);
  const total = number(energy[`${V}cumulativePower`]);
  const unit = lower(energy[`${V}cumulativeUnit`]) || 'wh';
  const hasState = states.length > 0;

  return {
    model: info[`${V}description`] || null,
    supports: {
      cycle: hasState,
      remainingTime: remaining !== null,
      powerWatts: watts !== null,
      energyKWh: total !== null,
    },
    state: {
      running,
      paused,
      finished,
      inCycle: running || paused,
      progress: progress || null,
      percent: number(vs[`${V}progressPercentage`] ?? std.progressPercentage),
      // The idle value is the length of the selected course, not a countdown.
      remainingSeconds: running || paused ? (remaining ?? 0) : 0,
      // Idle appliances report a negative placeholder.
      powerWatts: watts === null ? null : Math.max(0, watts),
      energyKWh: total === null ? null : Math.round((unit === 'kwh' ? total : total / 1000) * 100) / 100,
    },
  };
}

export function washerFeatureRows(model) {
  const { supports: s, state: st } = model;
  const row = (id, device, where, value, note = null) => ({
    id, device, plugin: device !== false, where: device === false ? 'none' : where, write: false, value, note,
  });
  return [
    row('cycle', s.cycle, 'home', st.running ? 'running' : st.paused ? 'paused' : 'idle', st.progress ? `stage-${st.progress}` : null),
    row('remainingTime', s.remainingTime, 'home', Math.round(st.remainingSeconds / 60), 'min'),
    row('cycleFinished', s.cycle, 'home', st.finished),
    row('powerWatts', s.powerWatts, 'eve', st.powerWatts, 'W'),
    row('energyKWh', s.energyKWh, 'eve', st.energyKWh, 'kWh'),
  ];
}
