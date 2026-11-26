/**
 * Laundry appliances (washer, dryer, dishwasher): a read-only view of the
 * cycle. Values come from the appliance's own reports; spellings differ
 * between model families, so matching is case-insensitive and tolerant.
 *
 * Seen in captures: state "Ready" | "Run" (also "Pause", "Finish"),
 * machine state "Ready" | "Running" | "Paused" | "Finish" | "idle" | "active" | "pause",
 * progress "None" | "Weightsensing" | "Wash" | "Rinse" | "Spin" | "Finish" | ...
 * A top-loader (WA80F, Table_02) reports progress "Drumcleaning" for the whole drum clean,
 * a word missing from its own supportedProgress list.
 */
const V = 'x.com.samsung.da.';
export const LAUNDRY_KINDS = new Set(['washer', 'dryer', 'dishwasher']);
/** Resources this model reads; anything else is listed as not used yet. */
export const LAUNDRY_CONSUMED = new Set([
  '/operational/state/vs/0', '/operational/state/0', '/energy/consumption/vs/0', '/information/vs/0',
  '/kidslock/vs/0', '/kidslock/0', '/alarms/vs/0', '/water/consumption/vs/0', '/course/vs/0', '/st/washercourse/vs/0', '/power/vs/0', '/power/0',
]);
/** The stages a washer names, each shown as its own sensor. */
export const WASHER_STAGES = ['wash', 'rinse', 'spin'];
/**
 * Drum clean courses by course table. Table_02 82 is a WA80F top-loader's own report (its drum
 * clean ran as Course_82 with progress "Drumcleaning"); the rest are LocalThings' tables (MIT).
 */
const DRUM_CLEAN_COURSES = { Table_00: new Set(['63']), Table_02: new Set(['09', '29', '3A', '74', '82']) };
const UNLOCKED = new Set(['ready', 'off', 'false', 'unlock', 'unlocked', 'none', 'disable', 'disabled', '']);

/** Child lock: the plain boolean when present, else the vendor word. */
export function kidsLock(resources) {
  const plain = resources['/kidslock/0']?.value;
  const word = resources['/kidslock/vs/0']?.[`${V}kidsLock`];
  if (typeof plain !== 'boolean' && word === undefined) {
    return null;
  }
  return plain === true || (word !== undefined && !UNLOCKED.has(lower(String(word))));
}

/**
 * What an alarm code means, only where it was confirmed on a real appliance. Any other code is
 * shown as the appliance sends it, without a guess.
 * DC: confirmed by the owner of a WA80F top-loader, who opened the lid during a drum clean.
 */
export const ALARM_MEANINGS = { ErrorCode_DC: 'the lid was opened during a cycle' };
export const alarmText = (code) => (ALARM_MEANINGS[code] ? `${code} (${ALARM_MEANINGS[code]})` : code);

/** Active alarm codes; rows ending in _OFF are placeholders. */
export function alarmCodes(resources) {
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

/** The selected course: its code, the table it belongs to, and whether it is a drum clean. */
export function washerCourse(resources) {
  const options = resources['/course/vs/0']?.[`${V}options`];
  const token = Array.isArray(options) ? options.find((o) => typeof o === 'string' && /^Course_[0-9A-Fa-f]+$/.test(o)) : null;
  if (!token) {
    return null;
  }
  const code = token.slice('Course_'.length).toUpperCase();
  const table = resources['/st/washercourse/vs/0']?.[`${V}st.courseTable`] ?? null;
  return { code, table, drumClean: Boolean(table && DRUM_CLEAN_COURSES[table]?.has(code)) };
}

/** The date of the last drum clean the appliance logged (YYYY-MM-DD), or null. */
export function lastDrumClean(resources) {
  const options = resources['/course/vs/0']?.[`${V}options`];
  const token = Array.isArray(options) ? options.find((o) => typeof o === 'string' && o.startsWith('DrumCleanLog_')) : null;
  const dates = token ? token.slice('DrumCleanLog_'.length).split('|').map((d) => d.slice(0, 10)).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)) : [];
  return dates.length ? dates.sort().at(-1) : null;
}

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
  // Seen on a real top loader over seven cycles: at the end it keeps saying "Run" with the stage
  // "Finish" (100%), for minutes or hours, until someone switches it off. The work is over at that
  // stage, so it counts as finished there and not as running.
  const atEnd = FINISHED.has(progress);
  const running = !atEnd && states.some((s) => RUNNING.has(s));
  const paused = !running && !atEnd && states.some((s) => PAUSED.has(s));
  const finished = !running && !paused && (atEnd || states.some((s) => FINISHED.has(s)));
  const remaining = parseDuration(vs[`${V}remainingTime`] ?? std.remainingTime);

  const watts = number(energy[`${V}instantaneousPower`]);
  const total = number(energy[`${V}cumulativePower`]);
  const unit = lower(energy[`${V}cumulativeUnit`]) || 'wh';
  const hasState = states.length > 0;
  const locked = kidsLock(resources);
  const alarms = alarmCodes(resources);
  const percent = number(vs[`${V}progressPercentage`] ?? std.progressPercentage);
  const washCount = optionNumber(resources, 'WashingTimes');
  // Water used since the washer was new. The unit is not stated; millilitres is inferred from a
  // real top loader (289,513,000 after 1,957 washes is about 148 L a wash), not confirmed.
  const water = number(resources['/water/consumption/vs/0']?.[`${V}cumulativeWater`]);
  const listed = [...(vs[`${V}supportedProgress`] ?? []), ...(std.jobStates ?? [])].map(lower);
  const stages = WASHER_STAGES.filter((x) => listed.includes(x));
  const course = washerCourse(resources);
  const lastClean = lastDrumClean(resources);
  const options = resources['/course/vs/0']?.[`${V}options`] ?? [];
  const cleanKnown = progress === 'drumcleaning' || Boolean(course?.drumClean) || lastClean !== null
    || (Array.isArray(options) && options.some((o) => typeof o === 'string' && o.startsWith('DrumCleanProposal_')));
  const inCycle = running || paused;
  // Switched off: the plain boolean when present, else the vendor word. A WA80F switched off in the
  // middle of a drum clean (from another app) ended its cycle that way; that is not a finish.
  const powerWord = lower(resources['/power/vs/0']?.[`${V}power`]);
  const poweredOff = powerWord ? powerWord === 'off' : resources['/power/0']?.value === false;

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
      waterLitres: water !== null,
      stages,
      drumClean: cleanKnown,
      course: course !== null,
      lastDrumClean: lastClean !== null,
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
      waterLitres: water === null ? null : Math.round(water / 1000),
      // The stage of a running cycle, as one of WASHER_STAGES, "drumcleaning" or another word; null outside one.
      stage: inCycle && progress && progress !== 'none' ? progress : null,
      drumClean: inCycle && (progress === 'drumcleaning' || Boolean(course?.drumClean)),
      course,
      lastDrumClean: lastClean,
      poweredOff,
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
    row('alarms', s.alarms, 'home', st.alarms.join(' / ') || 'none'),
    row('washCount', s.washCount, 'plugin-ui', st.washCount),
    row('stages', s.stages.length > 0, 'home', st.stage && s.stages.includes(st.stage) ? st.stage : 'none', 'trial'),
    row('drumClean', s.drumClean, 'home', st.drumClean, 'trial'),
    row('course', s.course, 'plugin-ui', st.course ? (st.course.drumClean ? 'drumCleanCourse' : `#${st.course.code}`) : null),
    row('lastDrumClean', s.lastDrumClean, 'plugin-ui', st.lastDrumClean),
    row('powerWatts', s.powerWatts, 'eve', st.powerWatts, 'W'),
    row('energyKWh', s.energyKWh, 'eve', st.energyKWh, 'kWh'),
    row('waterLitres', s.waterLitres, 'plugin-ui', st.waterLitres, 'L'),
  ];
}

/**
 * Control trial. Nothing here is confirmed on a real washer yet: each control lists the writes
 * worth trying, in order, built only from what the washer itself reports (its resources, its own
 * lists of supported values). The accessory sends them one at a time and logs each answer.
 */
export const WASHER_CONTROLS = ['ctlPower', 'ctlRun', 'ctlStop', 'ctlKidsLock', 'ctlBuzzer', 'ctlSpin', 'ctlRinse', 'ctlWaterTemp', 'ctlWaterLevel', 'ctlWashTime', 'ctlCourse'];
const STEPS = {
  ctlSpin: ['spinLevel', 'supportedSpinLevel'], ctlRinse: ['rinseCycles', 'supportedRinseCycles'],
  ctlWaterTemp: ['waterValve', 'supportedWaterValve'], ctlWaterLevel: ['waterHeight', 'supportedWaterHeight'],
  ctlWashTime: ['washTime', 'supportedWashTime'],
};
const NOT_A_CHOICE = new Set(['none', 'nodisplay', '']);

export function washerControls(resources = {}) {
  const res = resources ?? {};
  const out = {};
  const power = res['/power/vs/0'];
  if (power) {
    out.ctlPower = {
      kind: 'switch', reads: 'power', current: () => lower(res['/power/vs/0']?.[`${V}power`]) === 'on',
      shown: () => String(res['/power/vs/0']?.[`${V}power`] ?? ''),
      writes: (on) => [
        { path: ['power', 'vs', '0'], body: { [`${V}power`]: on ? 'On' : 'Off' } },
        ...(res['/power/0'] ? [{ path: ['power', '0'], body: { value: Boolean(on) } }] : []),
      ],
    };
  }
  const op = res['/operational/state/vs/0'];
  if (op) {
    const std = res['/operational/state/0'] ? ['operational', 'state', '0'] : null;
    const state = () => String(res['/operational/state/vs/0']?.[`${V}state`] ?? '');
    out.ctlRun = {
      kind: 'switch', reads: 'state', current: () => ['run', 'running', 'active'].includes(lower(state())), shown: state,
      writes: (on) => [
        { path: ['operational', 'state', 'vs', '0'], body: { [`${V}state`]: on ? 'Run' : 'Pause' } },
        ...(std ? [{ path: std, body: { currentMachineState: on ? 'Running' : 'Paused' } }] : []),
      ],
    };
    out.ctlStop = {
      kind: 'press', reads: 'state', shown: state,
      writes: () => [
        { path: ['operational', 'state', 'vs', '0'], body: { [`${V}state`]: 'Ready' } },
        { path: ['operational', 'state', 'vs', '0'], body: { [`${V}state`]: 'Stop' } },
        ...(std ? [{ path: std, body: { currentMachineState: 'Ready' } }] : []),
      ],
    };
  }
  if (res['/kidslock/vs/0'] || res['/kidslock/0']) {
    out.ctlKidsLock = {
      kind: 'lock', reads: 'kidsLock', current: () => kidsLock(res) === true,
      // Both forms are shown: a real washer kept the plain one at "false" while its tile read locked.
      shown: () => [res['/kidslock/0']?.value, res['/kidslock/vs/0']?.[`${V}kidsLock`]].filter((x) => x !== undefined).map(String).join('/'),
      writes: (on) => [
        ...(res['/kidslock/0'] ? [{ path: ['kidslock', '0'], body: { value: Boolean(on) } }] : []),
        ...(res['/kidslock/vs/0'] ? [{ path: ['kidslock', 'vs', '0'], body: { [`${V}kidsLock`]: on ? 'On' : 'Off' } }] : []),
        // "Ready" is what an unlocked top loader reports in the vendor form.
        ...(res['/kidslock/vs/0'] && !on ? [{ path: ['kidslock', 'vs', '0'], body: { [`${V}kidsLock`]: 'Ready' } }] : []),
      ],
    };
  }
  const buzzer = res['/buzzersound/vs/0'];
  if (buzzer && 'setBuzzerSound' in buzzer) {
    out.ctlBuzzer = {
      kind: 'switch', reads: 'setBuzzerSound', current: () => lower(res['/buzzersound/vs/0']?.setBuzzerSound) === 'on',
      shown: () => String(res['/buzzersound/vs/0']?.setBuzzerSound ?? ''),
      writes: (on) => [{ path: ['buzzersound', 'vs', '0'], body: { setBuzzerSound: on ? 'On' : 'Off' } }],
    };
  }
  const washer = res['/washer/vs/0'];
  for (const [id, [key, listKey]] of Object.entries(STEPS)) {
    const list = (Array.isArray(washer?.[`${V}${listKey}`]) ? washer[`${V}${listKey}`] : []).map(String).filter((x) => !NOT_A_CHOICE.has(lower(x)));
    if (washer && `${V}${key}` in washer && list.length > 1) {
      const now = () => String(res['/washer/vs/0']?.[`${V}${key}`] ?? '');
      out[id] = {
        // A level: the washer's own list, lowest first, set directly (a slider in Apple Home).
        kind: 'level', reads: key, shown: now, values: list,
        writes: (target) => [{ path: ['washer', 'vs', '0'], body: { [`${V}${key}`]: String(target) } }],
      };
    }
  }
  const mode = res['/st/washercourse/vs/0']?.[`${V}st.washerMode`];
  const m = /^(.*_Course_)([0-9A-F]{2})$/i.exec(String(mode ?? ''));
  if (m) {
    out.ctlCourse = {
      kind: 'press', reads: 'washerMode', shown: () => String(res['/st/washercourse/vs/0']?.[`${V}st.washerMode`] ?? ''),
      // The washer lists no courses locally: the next course number is tried, and its answer says whether it exists.
      writes: (_on, from) => {
        const cur = /^(.*_Course_)([0-9A-F]{2})$/i.exec(String(from ?? res['/st/washercourse/vs/0']?.[`${V}st.washerMode`] ?? '')) ?? m;
        const next = ((parseInt(cur[2], 16) + 1) % 256).toString(16).toUpperCase().padStart(2, '0');
        return [{ path: ['st', 'washercourse', 'vs', '0'], body: { [`${V}st.washerMode`]: `${cur[1]}${next}` } }];
      },
    };
  }
  return out;
}
