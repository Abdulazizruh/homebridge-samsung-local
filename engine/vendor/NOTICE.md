# Transport code from homebridge-samsung-ocf

The files in this folder (DTLS transport, CoAP codec and session, CBOR
helpers, OCF port discovery, client certificate) are compiled from the
TypeScript sources of [homebridge-samsung-ocf](https://github.com/aziz66/homebridge-samsung-ocf)
by aziz66, used under the MIT licence in `LICENSE`.

One change was made here: `dtls/transport.js` accepts a `localPort` option so
that a reconnect comes from the same UDP port as before.

`test/sim/` in this repository holds the simulated appliance from the same
project, used by the tests only.
