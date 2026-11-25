/**
 * The last name given to each appliance in this plugin's settings, kept in the plugin's own folder
 * so an appliance removed and added again comes back with its name. Keyed on the appliance's own
 * stable ID; its MAC address is kept too, so it is still matched if only the MAC is known. Nothing
 * here leaves the Homebridge machine, and "Delete this plugin's data" removes it with the rest.
 */
import { readJson, writeJson } from './storage.js';

const macKey = (mac) => String(mac ?? '').toLowerCase().replace(/[^0-9a-f]/g, '');

/** Remember the names of the given appliances (entries as saved in the settings). */
export function rememberNames(file, devices, now = Date.now()) {
  const saved = readJson(file) ?? {};
  let changed = false;
  for (const dev of devices ?? []) {
    const name = typeof dev?.name === 'string' ? dev.name.trim() : '';
    // A suggested name left as it was (numbered, or a TV's own) is not a name given: not remembered.
    if (!dev?.id || !name || dev.nameSuggested) {
      continue;
    }
    const before = saved[dev.id];
    const entry = {
      name,
      mac: dev.mac ? String(dev.mac).toLowerCase() : before?.mac ?? null,
      type: dev.type === 'tv' ? 'tv' : before?.type ?? null,
      model: dev.model ?? before?.model ?? null,
      savedAt: before?.name === name ? before.savedAt : new Date(now).toISOString(),
    };
    if (JSON.stringify(entry) !== JSON.stringify(before)) {
      saved[dev.id] = entry;
      changed = true;
    }
  }
  if (changed) {
    writeJson(file, saved);
  }
  return saved;
}

/** The remembered name of one appliance, by its ID or else by its MAC address; null when none. */
export function rememberedName(saved, { id, mac } = {}) {
  if (id && saved?.[id]?.name) {
    return saved[id].name;
  }
  const m = macKey(mac);
  if (m) {
    const hit = Object.values(saved ?? {}).find((v) => macKey(v?.mac) === m && v?.name);
    if (hit) {
      return hit.name;
    }
  }
  return null;
}
