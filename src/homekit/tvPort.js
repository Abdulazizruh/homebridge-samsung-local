/**
 * A TV tile is its own accessory, and Homebridge gives such an accessory a
 * new network port at every start unless the owner set a port range by hand.
 * A phone then has to find the tile again after each restart, and until it
 * does, the Home remote does not answer. Here the tile keeps one port: the
 * first free one it got is remembered and asked for again at every start.
 */
import net from 'node:net';
import { readJson, writeJson } from '../storage.js';

/** `wanted` if it is free, otherwise any free port. */
export function freePort(wanted = 0) {
  const ask = (port) => new Promise((resolve) => {
    const probe = net.createServer();
    probe.once('error', () => resolve(0));
    probe.listen(port, () => { const got = probe.address().port; probe.close(() => resolve(got)); });
  });
  return ask(wanted).then((got) => got || ask(0));
}

/**
 * Make the accessory publish on its remembered port. Only fills in a port
 * when Homebridge chose none, so a port range set by the owner still wins.
 */
export function keepPort({ accessory, deviceId, file, log }) {
  const hap = accessory?._associatedHAPAccessory;
  if (!hap || typeof hap.publish !== 'function' || hap.slKeepsPort) {
    return false;
  }
  const publish = hap.publish.bind(hap);
  hap.slKeepsPort = true;
  hap.publish = async (info = {}, ...rest) => {
    if (info.port) {
      return publish(info, ...rest);
    }
    let port = 0;
    try {
      const kept = Number((readJson(file) ?? {})[deviceId]?.homePort) || 0;
      port = await freePort(kept);
      if (port && port !== kept) {
        // Several TVs start at the same moment: the file is read again here and written in one go,
        // or each TV would write back the list it read before the others had added their port.
        const facts = readJson(file) ?? {};
        writeJson(file, { ...facts, [deviceId]: { ...facts[deviceId], homePort: port } });
        if (kept) { log?.info?.(`[${accessory.displayName}] its usual port for Apple Home was taken; it now keeps ${port}.`); }
      }
    } catch { /* without a remembered port the tile still works, on a port of the day */ }
    return publish({ ...info, port }, ...rest);
  };
  return true;
}
