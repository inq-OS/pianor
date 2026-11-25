---
covers: ["tools/release/"]
---
# Releases

A release is a zip for Windows that a player unpacks and starts with a double-click: no Node, no installer, no
internet. It holds the production build (approved pieces only, `npm run build`) in `game/`, a small local web server in
PowerShell (`pianor.ps1`, part of every Windows PC) and two start files (Estonian, English), plus `README.txt` for the
player. The launcher opens the game the way `npm run start:local` does (ft_0_14, d105): Edge or Chrome in app mode,
full screen, with its own browser profile in `%LOCALAPPDATA%\Pianor\browser`, where the saves live. It serves on
`http://localhost:4173/`, a secure context, so Web MIDI works without a certificate.

## Make one

The first release waits until the open work it needs (learning a piece, the tug) is finished. A fresh install has no premade players, and the photo import (Audiveris, installed separately) is not in the zip.

1. In a clean clone (no `private/` folder: private pieces and a private portrait are built in where they exist, so the
   script refuses), on the commit to release: `bash tools/release/pack.sh <version>`. It writes
   `release/pianor-<version>-windows.zip`.
2. Unpack it on a Windows PC and start it once with a keyboard attached (needs human: the launcher is not tested by CI).
3. Make the GitHub release as a draft with the zip attached; the maintainer publishes it.

## What a shared copy must not carry

Anything from `private/`, contact addresses and saves. A new install makes no
player (it asks for the first name, ft_1_07.AC1), and the default passwords are public child locks (`pianor` for Admin and for
the teacher, each its own record), written in the zip's `README.txt`.

- TODO(builder, R2): a release build hides the settings' bug-report button.
- NEEDS-HUMAN: approve the fisherman's level 1 phrase (`fisherman-1`, Row, Row, Row Your Boat) on the review board. A release build leaves out every draft piece, so until then the fisherman has no level 1 to teach.
- TODO(architect, R2): once Puuvaim's phrases are approved and the week's learning goal is on `main`, run `bash tools/release/pack.sh 0.1b` from a clean clone and hand the zip to the maintainer.
- NEEDS-HUMAN: run that zip once on a Windows PC with a keyboard attached (step 2 above).
- TODO(architect, R2): after that run, make the 0.1b draft release with the zip attached.
- TODO(builder, R2): a device with only damaged players saves a default Player 1; it should offer the first-name box instead.
- TODO(builder, R2): a unit test that an old single-profile record never gets the first-name box.
