/**
 * Optional, one-time import of appliance names from SmartThings, to name and
 * match the appliances found on the home network. Read only: nothing here
 * controls an appliance. The token is used for these few reads and then
 * dropped: it is never written to a file or to the log.
 */

const API = 'https://api.smartthings.com/v1';

// SmartThings device types the plugin can find on the home network, by kind.
export const ST_KIND = {
  'oic.d.airconditioner': 'airConditioner',
  'oic.d.tv': 'tv',
  'oic.d.washer': 'washer',
  'oic.d.dryer': 'dryer',
  'oic.d.refrigerator': 'refrigerator',
  'oic.d.dishwasher': 'dishwasher',
  'oic.d.oven': 'oven',
  'oic.d.range': 'range',
  'oic.d.cooktop': 'cooktop',
  'oic.d.microwave': 'microwave',
  'oic.d.hood': 'hood',
  'oic.d.airpurifier': 'airPurifier',
  'x.com.st.d.airpurifier': 'airPurifier',
  'oic.d.robotcleaner': 'robotVacuum',
  'oic.d.dehumidifier': 'dehumidifier',
};

/** The same appliance ID whatever its spelling: a TV's "tv-" and "uuid:" are dropped. */
export function idKey(id) {
  const key = String(id ?? '').trim().toLowerCase().replace(/^tv-/, '').replace(/^uuid:/, '');
  return key || null;
}

/** The model without the version parts SmartThings adds after "|". */
export function modelKey(model) {
  const key = String(model ?? '').split('|')[0].trim().toLowerCase();
  return key || null;
}

function stError(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

const TOKEN = /^[A-Za-z0-9._~+/=-]{20,2048}$/;

/**
 * Read the appliance list from SmartThings with a personal access token.
 * Returns names, rooms and what is needed to match each one on the network.
 */
export async function readSmartThings(token, { fetchImpl = globalThis.fetch, timeoutMs = 15000, maxStatus = 80 } = {}) {
  token = String(token ?? '').trim();
  if (!TOKEN.test(token)) {
    throw stError('st_format', 'Paste the token exactly as SmartThings shows it.');
  }
  const get = async (url, { quiet = false } = {}) => {
    let res;
    try {
      res = await fetchImpl(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      throw stError('st_unreachable', 'SmartThings could not be reached.');
    }
    if (res.ok) {
      return res.json();
    }
    if (quiet) {
      return null;
    }
    if (res.status === 401) { throw stError('st_token', 'SmartThings refused the token.'); }
    if (res.status === 403) { throw stError('st_scope', 'The token lacks a permission.'); }
    if (res.status === 429) { throw stError('st_busy', 'SmartThings asked to wait.'); }
    throw stError('st_error', `SmartThings answered ${res.status}.`);
  };

  // Every page of the device list; a next page is followed only on SmartThings itself.
  const items = [];
  let url = `${API}/devices?includeHealth=true`;
  for (let page = 0; url && page < 20; page += 1) {
    const body = await get(url);
    items.push(...(Array.isArray(body?.items) ? body.items : []));
    const next = body?._links?.next?.href;
    url = typeof next === 'string' && next.startsWith(`${API}/`) ? next : null;
  }

  // Room names, when the token may see locations; without them the import still works.
  const rooms = new Map();
  let roomsRead = false;
  const locations = new Set(items.map((d) => d.locationId).filter(Boolean));
  for (const loc of locations) {
    const body = await get(`${API}/locations/${encodeURIComponent(loc)}/rooms`, { quiet: true });
    if (body) {
      roomsRead = true;
      for (const r of body.items ?? []) { if (r.roomId) { rooms.set(r.roomId, r.name ?? ''); } }
    }
  }

  const devices = items.map((d) => {
    const ocfType = d.ocf?.ocfDeviceType ?? null;
    return {
      stId: d.deviceId ?? null,
      name: String(d.label || d.name || '').trim(),
      room: (d.roomId && rooms.get(d.roomId)) || null,
      kind: ST_KIND[ocfType] ?? null,
      // Samsung Wi-Fi appliances and TVs are OCF devices; sensors, plugs and hubs are not.
      local: d.type === 'OCF' || Boolean(d.ocf),
      model: d.ocf?.modelNumber ? String(d.ocf.modelNumber).split('|')[0] : null,
      online: d.healthState?.state ? d.healthState.state === 'ONLINE' : null,
      lastSeen: d.healthState?.lastUpdatedDate ?? null,
      di: null,
    };
  });

  // The local ID of each appliance that can be on the network, from its status.
  let statusRead = false;
  const wanted = devices.filter((d) => d.local && d.stId).slice(0, maxStatus);
  for (let i = 0; i < wanted.length; i += 4) {
    await Promise.all(wanted.slice(i, i + 4).map(async (d) => {
      const body = await get(`${API}/devices/${encodeURIComponent(d.stId)}/status`, { quiet: true });
      const ocf = body?.components?.main?.ocf;
      if (!ocf) { return; }
      statusRead = true;
      d.di = idKey(ocf.di?.value);
      const mnmo = ocf.mnmo?.value;
      if (mnmo) { d.model = String(mnmo).split('|')[0]; }
    }));
  }
  return { devices, roomsRead, statusRead };
}

/**
 * Match the SmartThings list to the appliances found on the network: first by
 * the appliance's own ID, then by model when only one of that model is left
 * on each side, and by the owner's own pick when given.
 * locals: [{ deviceId, model, pick }] where pick is an index into stDevices.
 * Returns, per local, { st, how } (st is an index or null) and the indexes
 * of SmartThings appliances found on no line.
 */
export function matchDevices(stDevices, locals) {
  const used = new Set();
  const out = locals.map(() => ({ st: null, how: null }));
  const candidates = stDevices.map((d, i) => ({ d, i })).filter(({ d }) => d.local);
  // 1. The owner's own pick wins.
  locals.forEach((l, li) => {
    if (Number.isInteger(l.pick) && stDevices[l.pick] && !used.has(l.pick)) {
      out[li] = { st: l.pick, how: 'pick' };
      used.add(l.pick);
    }
  });
  // 2. Same appliance ID.
  locals.forEach((l, li) => {
    if (out[li].st !== null) { return; }
    const key = idKey(l.deviceId);
    const hit = key && candidates.find(({ d, i }) => !used.has(i) && d.di && d.di === key);
    if (hit) { out[li] = { st: hit.i, how: 'id' }; used.add(hit.i); }
  });
  // 3. The only one of its model left on both sides.
  const left = (model) => candidates.filter(({ d, i }) => !used.has(i) && modelKey(d.model) === model);
  const localLeft = (model) => locals.filter((l, li) => out[li].st === null && modelKey(l.model) === model);
  locals.forEach((l, li) => {
    const model = modelKey(l.model);
    if (out[li].st !== null || !model) { return; }
    const st = left(model);
    if (st.length === 1 && localLeft(model).length === 1) { out[li] = { st: st[0].i, how: 'model' }; used.add(st[0].i); }
  });
  const stOnly = candidates.filter(({ i }) => !used.has(i)).map(({ i }) => i);
  return { locals: out, stOnly };
}
