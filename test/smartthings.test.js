import { test } from 'node:test';
import assert from 'node:assert/strict';
import { idKey, matchDevices, modelKey, readSmartThings } from '../src/smartthings.js';

const TOKEN = '11111111-2222-3333-4444-555555555555';
const API = 'https://api.smartthings.com/v1';

function fakeSmartThings(routes, seen = []) {
  return async (url, opts) => {
    seen.push({ url, auth: opts?.headers?.Authorization });
    const hit = routes[url];
    if (hit === undefined) { return { ok: false, status: 404, json: async () => ({}) }; }
    if (typeof hit === 'number') { return { ok: false, status: hit, json: async () => ({}) }; }
    return { ok: true, status: 200, json: async () => hit };
  };
}

const LIST = {
  items: [
    { deviceId: 'st-ac', label: 'مكيف الصالة', type: 'OCF', locationId: 'loc', roomId: 'r1', ocf: { ocfDeviceType: 'oic.d.airconditioner' }, healthState: { state: 'ONLINE' } },
    { deviceId: 'st-wash', label: 'الغسالة', type: 'OCF', locationId: 'loc', roomId: 'r2', ocf: { ocfDeviceType: 'oic.d.washer', modelNumber: 'WA80F|1|2' }, healthState: { state: 'OFFLINE', lastUpdatedDate: '2026-11-20T10:00:00Z' } },
  ],
  _links: { next: { href: `${API}/devices?page=2` } },
};
const PAGE2 = { items: [{ deviceId: 'st-sensor', label: 'Door', type: 'ZIGBEE', locationId: 'loc' }], _links: {} };

test('SmartThings import: reads every page, rooms and each appliance\'s local ID with the token, read only', async () => {
  const seen = [];
  const fetchImpl = fakeSmartThings({
    [`${API}/devices?includeHealth=true`]: LIST,
    [`${API}/devices?page=2`]: PAGE2,
    [`${API}/locations/loc/rooms`]: { items: [{ roomId: 'r1', name: 'الصالة' }, { roomId: 'r2', name: 'الغسيل' }] },
    [`${API}/devices/st-ac/status`]: { components: { main: { ocf: { di: { value: 'ABC-1' }, mnmo: { value: 'ARTIK051_PRAC_20K|10193441|600' } } } } },
    [`${API}/devices/st-wash/status`]: { components: { main: { ocf: { di: { value: 'wash-1' } } } } },
  }, seen);
  const out = await readSmartThings(` ${TOKEN} `, { fetchImpl });
  assert.equal(out.roomsRead, true);
  assert.equal(out.statusRead, true);
  const [ac, wash, door] = out.devices;
  assert.deepEqual([ac.name, ac.room, ac.kind, ac.local, ac.di, ac.model, ac.online], ['مكيف الصالة', 'الصالة', 'airConditioner', true, 'abc-1', 'ARTIK051_PRAC_20K', true]);
  assert.deepEqual([wash.model, wash.online, wash.lastSeen], ['WA80F', false, '2026-11-20T10:00:00Z']);
  assert.equal(door.local, false);
  assert.ok(seen.every((s) => s.auth === `Bearer ${TOKEN}` && s.url.startsWith(`${API}/`)));
  assert.ok(!seen.some((s) => s.url.includes('st-sensor')), 'no status read for what cannot be on the network');
});

test('SmartThings import: a refused token, a missing permission and a bad paste each say so; rooms are optional', async () => {
  await assert.rejects(readSmartThings('short'), { code: 'st_format' });
  await assert.rejects(readSmartThings(TOKEN, { fetchImpl: fakeSmartThings({ [`${API}/devices?includeHealth=true`]: 401 }) }), { code: 'st_token' });
  await assert.rejects(readSmartThings(TOKEN, { fetchImpl: fakeSmartThings({ [`${API}/devices?includeHealth=true`]: 403 }) }), { code: 'st_scope' });
  await assert.rejects(readSmartThings(TOKEN, { fetchImpl: async () => { throw new Error('offline'); } }), { code: 'st_unreachable' });
  const out = await readSmartThings(TOKEN, { fetchImpl: fakeSmartThings({ [`${API}/devices?includeHealth=true`]: { items: [LIST.items[0]] }, [`${API}/locations/loc/rooms`]: 403 }) });
  assert.equal(out.roomsRead, false);
  assert.equal(out.devices[0].room, null);
  assert.equal(out.devices[0].name, 'مكيف الصالة');
});

test('SmartThings import: a next page elsewhere than SmartThings is never followed', async () => {
  const seen = [];
  await readSmartThings(TOKEN, { fetchImpl: fakeSmartThings({ [`${API}/devices?includeHealth=true`]: { items: [], _links: { next: { href: 'https://example.com/steal' } } } }, seen) });
  assert.ok(seen.every((s) => s.url.startsWith(`${API}/`)));
});

test('SmartThings matching: by ID first, then by the only one of its model, then the owner\'s pick; the rest is listed', () => {
  assert.equal(idKey('tv-UUID:AbC'), 'abc');
  assert.equal(modelKey('ARTIK051_PRAC_20K|1|2'), 'artik051_prac_20k');
  const st = [
    { name: 'Living', local: true, di: 'ac-1', model: 'ARTIK051_PRAC_20K' },
    { name: 'Office', local: true, di: 'x-9', model: 'TP1X' },
    { name: 'Bedroom', local: true, di: 'x-8', model: 'TP1X' },
    { name: 'TV', local: true, di: '0f1e', model: 'UA55KU7000' },
    { name: 'Washer', local: true, di: null, model: 'WA80F' },
    { name: 'Sensor', local: false },
  ];
  const locals = [
    { deviceId: 'AC-1', model: 'ARTIK051_PRAC_20K' }, // ID
    { deviceId: 'tv-uuid:0F1E', model: 'other' }, // TV ID with its prefixes
    { deviceId: 'w-1', model: 'WA80F' }, // the only washer of that model
    { deviceId: 'y-1', model: 'TP1X' }, // two of that model in SmartThings: no guess
  ];
  let m = matchDevices(st, locals);
  assert.deepEqual(m.locals.map((x) => [x.st, x.how]), [[0, 'id'], [3, 'id'], [4, 'model'], [null, null]]);
  assert.deepEqual(m.stOnly, [1, 2]);
  m = matchDevices(st, locals.map((l, i) => (i === 3 ? { ...l, pick: 2 } : l)));
  assert.deepEqual(m.locals[3], { st: 2, how: 'pick' });
  assert.deepEqual(m.stOnly, [1]);
  // An appliance already in the list that is off now: found by its name.
  m = matchDevices(st, [{ deviceId: 'tv-other', model: null, name: ' office ' }]);
  assert.deepEqual(m.locals[0], { st: 1, how: 'name' });
});
