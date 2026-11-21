/** Elgato Eve's custom characteristics for power (W) and energy (kWh).
 * Apple's Home app ignores them; Eve and some other HomeKit apps show them. */
const cache = new WeakMap();

export function eveCharacteristics(hap) {
  if (cache.has(hap)) {
    return cache.get(hap);
  }
  const { Characteristic, Formats, Perms } = hap;

  class Consumption extends Characteristic {
    static UUID = 'E863F10D-079E-48FF-8F27-9C2605A29F52';
    constructor() {
      super('Consumption', Consumption.UUID, {
        format: Formats.FLOAT, unit: 'W', minValue: 0, maxValue: 100000, minStep: 0.1,
        perms: [Perms.PAIRED_READ, Perms.NOTIFY],
      });
      this.value = this.getDefaultValue();
    }
  }

  class TotalConsumption extends Characteristic {
    static UUID = 'E863F10C-079E-48FF-8F27-9C2605A29F52';
    constructor() {
      super('Total Consumption', TotalConsumption.UUID, {
        format: Formats.FLOAT, unit: 'kWh', minValue: 0, maxValue: 100000000, minStep: 0.01,
        perms: [Perms.PAIRED_READ, Perms.NOTIFY],
      });
      this.value = this.getDefaultValue();
    }
  }

  const out = { Consumption, TotalConsumption };
  cache.set(hap, out);
  return out;
}
