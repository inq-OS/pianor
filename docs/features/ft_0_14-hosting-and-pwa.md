---
id: "ft_0_14"
title: "Run locally"
scope: "One command serves the production build on localhost; works with no internet; tested on a modest laptop at 1920x1080 with the EZ-220"
effort: "simple"
status: "not started; local only, no hosting (d068)"
completeness: 0
---
# ft_0_14: Run locally

Index: [FEATURES.md](FEATURES.md).

Pianor runs on the player's own laptop, never on a public host (`docs/decisions/stack.md#d068`). Web MIDI needs a secure context, and `localhost` is one, so no certificate is needed. One command builds and serves the production build (approved pieces only) on `localhost`, with every asset local, including the 21 piano samples in `public/audio/salamander/` (about 1.4 MB), so nothing needs the internet. The target is a modest laptop with Chrome or Edge, at 1920x1080.

`npm run start:local` (`tools/start-local/`) opens the served game as its own window (d105): Edge, else Chrome, in app mode (no tabs, no bookmarks) and full screen, with a browser profile of its own (`%LOCALAPPDATA%\Pianor\browser` on Windows), so it never opens inside the normal browser profile. Saves live in that profile: saves made in a normal browser tab move there once with Admin Export and Import. Not yet checked on the target laptop (needs human).

Out of scope until tablets are supported: a public or LAN host with HTTPS, the PWA install and the offline cache.

## Acceptance criteria

- **ft_0_14.AC1** One documented `npm run` command builds the game and serves it on `localhost`. (`npm run start` opens the game in Vite mode `start`, where draft pieces are hidden; the admin Pages list the dev pages only in a dev server.)
- **ft_0_14.AC2** The served game loads and plays with the network switched off (no request leaves the machine). [human]
- **ft_0_14.AC3** [human] On a modest laptop with the EZ-220, MIDI permission works and a piece can be played from the menu.
