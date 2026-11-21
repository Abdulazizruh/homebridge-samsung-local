# Changelog

Versions follow [Semantic Versioning](https://semver.org/). Stable releases are published under the npm tag `latest`. Pre-releases use `beta` once a stable release exists; until then they are also `latest`.

## 0.1.0-beta.3 — 2026-11-22

First fixes from a real installation (Homebridge in Docker on a Raspberry Pi).

### Fixed
- The settings page now hands its configuration to Homebridge on load, so SAVE works on a fresh install and the child bridge option appears.

### Added
- A failed discovery shows technical details: which ports were tried, what the appliance advertised, and the DTLS outcome or alert it answered with.

### Changed
- Fan slider: 0 % now selects Auto (and shows Auto as 0 %), matching homebridge-smartthings-oauth. It still never powers the unit off.
- Discovery may take up to three minutes before giving up (was 90 seconds).

## 0.1.0-beta.2 — 2026-11-22

No functional change. Still not run against real hardware.

### Changed
- First version published to npm, so it can be found and installed from the Homebridge Plugins search.
- Supported Node.js stated as 22.12+ and 24 (the versions tested in CI).
- Install instructions corrected.

## 0.1.0-beta.1 — 2026-11-22

First trial release. Not yet run against real hardware.

### Added
- Local connection to Samsung appliances through `smartthings-local` 0.1.25, driven by a helper process the plugin starts and stops.
- Private Python environment prepared automatically inside the Homebridge storage folder.
- Settings page (Arabic and English): add by IP address, test and discover, function table, per-appliance HomeKit options, diagnostics download, data deletion with confirmation.
- Air conditioners: thermostat, fan with Auto and Turbo as explicit choices, Dry and Fan Only switches, WindFree / Fast / Quiet and other comfort modes, swing, display light, humidity, filter, power and energy for Eve-compatible apps.
- Stable device ID for accessory identity; accessories restored from cache while an appliance is unreachable.
- Automatic reconnect with backoff, ordered command queue, shielding of fresh writes from stale reads.

### Known limits
- Washers and other appliance types connect for diagnostics only.
- Samsung TVs, TCP 8888 appliances and appliances that refuse the automatic certificate are not supported.
- No brightness for the display light. No voltage, current or occupancy readings.
- 32-bit systems are not supported.
