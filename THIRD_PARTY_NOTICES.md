# Third-party notices

## SmartThings-Local

- https://github.com/QuiteYellow/SmartThings-Local — MIT License, Copyright (c) 2026 Jack Nagy
- Used at runtime as the unmodified PyPI package `smartthings-local` (pinned in `python/requirements.txt`). Not bundled in this repository.
- `python/bridge.py` follows its documented session, discovery and probing API, and reuses the published client identity constant and the self-signed certificate recipe described in its `docs/certificates.md` and `setup_cert.py`.

## LocalThings

- https://github.com/mbillow/localthings — MIT License, Copyright (c) 2026 Marc Billow
- `src/capabilities/ac.js` is a JavaScript port of parts of its air-conditioner registry (`registry/capabilities/airconditioner.py`, `climate.py`, `registry/capabilities/common.py`): resource paths, field names, value codes and the measured device quirks noted in the comments.
- `python/bridge.py` follows its probing order, `/device/0` batch parsing and fixed per-device source port approach.
- `test/fixtures/ac_standard.json` and `test/fixtures/ac_windfree.json` are reshaped copies of its already-redacted test fixtures.

MIT License (applies to both projects above):

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## homebridge-smartthings-oauth

- https://github.com/aziz66/homebridge-smartthings — Apache License 2.0
- No code is copied. The HomeKit service layout for air conditioners (thermostat, fan, optional-mode switches, display light, humidity sensor) follows the same idea.

## Python packages installed at runtime

cbor2 (MIT), cryptography (Apache-2.0 OR BSD-3-Clause), pyOpenSSL (Apache-2.0), cffi (MIT), pycparser (BSD-3-Clause). Downloaded from PyPI by pip into the plugin's own environment; not redistributed here.

## JavaScript engine

The transport code in `engine/vendor/` (DTLS transport, CoAP, CBOR helpers, port discovery, client certificate) and the simulated appliance in `test/sim/` come from [homebridge-samsung-ocf](https://github.com/aziz66/homebridge-samsung-ocf) by aziz66 (MIT); see `engine/vendor/LICENSE` and `engine/vendor/NOTICE.md`. npm packages used by the engine and by TV support: werift-dtls (MIT), @peculiar/x509 (MIT), cbor-x (MIT), ws (MIT).

## Icon

`assets/icon.svg` is an original design made for this project. It contains no Samsung, SmartThings or Homebridge logo.

## Trademarks

"Samsung" and "SmartThings" are trademarks of Samsung Electronics Co., Ltd. This is an independent, unofficial project.
