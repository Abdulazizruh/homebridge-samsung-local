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
/** Resources this model reads; anything else is listed as not used yet. */
export const LAUNDRY_CONSUMED = new Set([
  '/operational/state/vs/0', '/operational/state/0', '/energy/consumption/vs/0', '/information/vs/0',
  '/kidslock/vs/0', '/kidslock/0', '/alarms/vs/0', '/course/vs/0',
]);
const UNLOCKED = new Set(['ready', 'off', 'false', 'unlock', 'unlocked', 'none', 'disable', 'disabled', '']);

/** Child lock: the plain boolean when present, else the vendor word. */
function kidsLock(resources) {
  const plain = resources['/kidslock/0']?.value;
  const word = resources['/kidslock/vs/0']?.[`${V}kidsLock`];
  if (typeof plain !== 'boolean' && word === undefined) {
    return null;
  }
  return plain === true || (word !== undefined && !UNLOCKED.has(lower(String(word))));
}

/** Active alarm codes; rows ending in _OFF are placeholders. */
function alarmCodes(resources) {
  const items = resources['/alarms/vs/0']?.[`${V}items`];
  if (!Array.isArray(items)) {
    return [];
  }
  return items
    .filter((i) => i && typeof i === 'object' && !['deleted', 'none'].includes(lower(String(i[`${V}state`] ?? ''))))
    .map((i) => String(i[`${V}code`] ?? ''))
    .filter((code) => code && !/_OFF$/i.test(code));
}

/** A numeric option such as "WashingTimes_211" from the course resource. */
function optionNumber(resources, prefix) {
  const options = resources['/course/vs/0']?.[`${V}options`];
  const token = Array.isArray(options) ? options.find((o) => typeof o === 'string' && o.startsWith(`${prefix}_`)) : null;
  const n = token ? Number(token.slice(prefix.length + 1)) : NaN;
  return Number.isFinite(n) ? n : null;
}

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
  const locked = kidsLock(resources);
  const alarms = alarmCodes(resources);
  const percent = number(vs[`${V}progressPercentage`] ?? std.progressPercentage);
  const washCount = optionNumber(resources, 'WashingTimes');

  return {
    model: info[`${V}description`] || null,
    supports: {
      cycle: hasState,
      remainingTime: remaining !== null,
      powerWatts: watts !== null,
      energyKWh: total !== null,
      kidsLock: locked !== null,
      progress: percent !== null,
      alarms: '/alarms/vs/0' in resources,
      washCount: washCount !== null,
    },
    state: {
      running,
      paused,
      finished,
      inCycle: running || paused,
      progress: progress || null,
      // Outside a cycle the appliance keeps a stale figure; show nothing then.
      percent: running || paused ? Math.min(100, Math.max(0, percent ?? 0)) : 0,
      kidsLock: locked === true,
      alarms,
      washCount,
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
    row('progress', s.progress, 'home', st.percent, '%'),
    row('kidsLock', s.kidsLock, 'home', st.kidsLock),
    row('alarms', s.alarms, 'home', st.alarms.join(', ') || 'none'),
    row('washCount', s.washCount, 'plugin-ui', st.washCount),
    row('powerWatts', s.powerWatts, 'eve', st.powerWatts, 'W'),
    row('energyKWh', s.energyKWh, 'eve', st.energyKWh, 'kWh'),
  ];
}
