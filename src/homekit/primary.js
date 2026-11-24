/**
 * Marks one tile of an accessory as its face. The Home app shows the tiles of one accessory as a
 * group and puts the primary one in front; without one it picks by itself, sometimes a sensor.
 * Only one tile is primary: a tile that was before and is no longer chosen is unmarked.
 */
export function markPrimary(accessory, primary) {
  for (const service of accessory.services) {
    const want = service === primary;
    if (Boolean(service.isPrimaryService) !== want) {
      service.setPrimaryService(want);
    }
  }
}
