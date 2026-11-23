# Origin of this folder

Apple does not publish the protocol its iPhone remote speaks to an Apple TV
("Companion Link"). The code here was written for this plugin in JavaScript,
following two open-source projects that worked the protocol out:

- **pyatv** by Pierre Ståhl — MIT licence — https://github.com/postlund/pyatv
  (OPACK serialisation, the pairing and session steps, the keyboard payloads)
- **atvr4samsung** by vb3 — MIT licence — https://github.com/vb3/atvr4samsung
  (what a current iPhone expects from the device side: touch device id,
  media-control flags, button codes for Mute and Power, swipe thresholds)

Both licences permit this use with attribution, which this file gives.
Apple TV is a trademark of Apple Inc.; this project is not affiliated with Apple.
