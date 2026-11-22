/**
 * What the Home app needs to add a TV tile: the setup code and the same
 * code as a scannable address. Read from the accessory Homebridge published
 * and kept in the plugin folder, so the settings page can show it and nobody
 * has to search the log. The file never leaves the plugin folder and is not
 * part of a diagnostics file.
 */
import { readJson, writeJson } from '../storage.js';

/** { pin, uri, paired } for a published accessory, or null while not ready. */
export function setupOf(accessory) {
  const hap = accessory?._associatedHAPAccessory;
  const info = hap?._accessoryInfo;
  if (!info?.pincode) {
    return null;
  }
  let uri = null;
  try {
    uri = hap.setupURI();
  } catch { /* no scannable code; the digits still work */ }
  return { pin: String(info.pincode), uri, paired: typeof info.paired === 'function' ? Boolean(info.paired()) : false };
}

/** Keep the setup details of one TV up to date in the plugin folder. */
export function trackSetup({ accessory, deviceId, name, file, timers, log, tries = 15, everyMs = 1000 }) {
  const save = () => {
    const setup = setupOf(accessory);
    if (!setup) {
      return false;
    }
    try {
      writeJson(file, { ...(readJson(file) ?? {}), [deviceId]: { name, ...setup } });
    } catch (err) {
      log.debug(`could not save the TV setup code: ${err.message}`);
    }
    return true;
  };
  let left = tries;
  const attempt = () => {
    if (save()) {
      const hap = accessory._associatedHAPAccessory;
      hap.on?.('paired', save);
      hap.on?.('unpaired', save);
      return;
    }
    left -= 1;
    if (left > 0) {
      const timer = setTimeout(attempt, everyMs);
      timer.unref?.();
      timers.add(timer);
    }
  };
  attempt();
}

/** Drop TVs that are no longer published as a tile. */
export function pruneSetup(file, keepIds) {
  const stored = readJson(file);
  if (!stored) {
    return;
  }
  const kept = Object.fromEntries(Object.entries(stored).filter(([id]) => keepIds.includes(id)));
  if (Object.keys(kept).length !== Object.keys(stored).length) {
    writeJson(file, kept);
  }
}
