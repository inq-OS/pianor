---
id: "ft_Y_15"
title: "Built-in debug log"
scope: "`?debug=1` keeps the last few hundred events (screens, keys, presses, notes, piece-maker edits, errors) in memory and offers them as a text file from a small download button; off, it costs one test per call"
effort: "simple"
status: "built: the log, its capture and the download button; trying it in `npm run start:local` open (Human)"
completeness: 90
---

# ft_Y_15: Built-in debug log

Index: [FEATURES.md](FEATURES.md). Made after the piece maker froze in `npm run start:local`: a log
to send with a bug, at no cost to the game's speed. A bug that is found and fixed quickly keeps the student reading and playing (AX-0).

## Rules

1. **Off by default.** The page address switch `?debug=1` turns it on (for `npm run start:local` too: it is not dev only, since
   that is where real bugs happen). Off, every log call is one test of a flag and returns, like a print behind
   `#ifdef DEBUG`; the browser listeners, the timer and the button do not exist.
2. **What it records** (`src/core/debug/debugLog.ts`, `src/io/debug/debugCapture.ts`, wired in `src/main.ts`): the page
   (address, build, window, browser) at start, each screen that starts (its key and the names of the data it was given, never
   their values), computer keys (`Control+z`, `ArrowLeft`), mouse presses (position, button), keys played (note on or off,
   MIDI number, velocity, source), MIDI connects and disconnects, the piece maker's edits, refusals, undo and redo, errors
   nobody caught and promise rejections nobody handled (with their stacks).
3. **No child data.** No player name, progress or typed text: on the name and password screens and in any text field of the page
   (the piece maker's title) a typed letter or digit is written `*`. The file stays on the computer; it goes into an issue only when a person attaches it.
4. **Bounded.** The last 500 entries in a ring, each cut at 2000 characters: the log never grows.
5. **Survives a reload.** Every 2 seconds, when anything changed, and at once after an error, the log is copied to the tab's
   session storage (gone when the tab closes); a page that froze and was reloaded in the same tab starts with the earlier
   page's log above a `--- page reloaded ---` line.
6. **Download.** A small button with a down arrow and no text in the bottom-left corner, faded until the pointer is over it
   (the clean UI rule), saves `pianor-debug-<time>.txt` (one line per entry: time, kind, detail). Shown only with `?debug=1`.

## Acceptance criteria

- **ft_Y_15.AC1** Off, a log call records nothing and the capture adds no listener; on, entries come out oldest first and the
  ring keeps only the newest 500.
- **ft_Y_15.AC2** On, an uncaught error and an unhandled rejection are recorded with their stacks and copied to session
  storage at once; the copy is restored, above the reload line, when the page starts again.
- **ft_Y_15.AC3** On, keys, presses and played notes are recorded; on a text screen and in a text field typed characters are masked.
- **ft_Y_15.AC4** [human] The maintainer opens `npm run start:local` with `?debug=1`, uses the piece maker, presses the button and
  gets the text file.

Not verified by an agent: where Edge or Chrome in app mode puts the downloaded file (the Downloads folder is expected).
