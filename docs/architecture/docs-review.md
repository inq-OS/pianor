# Docs review

A pass over the top-level docs (`README.md`, `docs/*.md`) against the code, after the maintenance sweep
in [maintenance.md](maintenance.md). The feature, decision, authoring and architect folders were not
re-read line by line; `npm run docs:check` already holds their links, paths and ids.

## Fixed in the same pull request

- **New: `docs/url-switches.md`**, one table of every `?switch=` the game and the spike page read, with what it does,
  whether a production build ignores it and where it is read. It closes the "one table of URL parameters" proposal of the
  maintenance report. `?demo=art`, `?keys=1`, `?monitor=1`, `?clicks=` and the staff demo's `piece`, `hints`, `vw`,
  `vh`, `zoom`, `cx`, `cy` were in no doc, or only in one test checklist.
- **New: `docs/web-for-c-developers.md`**, the toolchain and the layers in C/C++ terms and one key press traced from the
  USB-MIDI bytes to the screen, for a developer who knows C and microcontrollers but not the web stack.
- `README.md`: "Planned stack" said the game runs as a PWA; it runs in the browser and the offline app (ft_0_14) is
  not started. The `npm run dev` line carried half the URL switches; it now points at the table. Both new docs are in
  the documentation table.
- `docs/architecture.md`: the scene list named 8 of the 14 scenes (Boot, Pieces, Rundown, BattleResults and the two dev
  scenes were missing), `profileSetup.ts` and `game/menu/` were missing, and the risks still listed the project licence
  as open although it is MIT.
- `docs/testing.md`: fast-check was marked "verify licence before adding" (it is in, MIT); the coverage gate was a
  "suggested starting point" of lines and branches, while `vite.config.ts` enforces 90% on all four measures.
- `docs/dependencies.md`: the coverage gate covers `tools/` as well as `src/core`.
- `docs/futureproofing.md`: the `NoteEvent` shape had a `songTimeTicks or ms` field; the type has `kind` and `timeMs`.

## Proposed for `CLAUDE.md` (merged by the maintainer, not changed here)

- The intro says the MVP is "`ft_0_00` to `ft_0_16`"; `ft_0_17` (note-name trainer) exists and `FEATURES.md` says
  "ft_0_00 to ft_0_17".
- "Stack" says "IndexedDB/localStorage for saves"; only `localStorage` is used (`src/profileSetup.ts`). IndexedDB is a
  seam named in a comment in `src/core/progression/repository.ts`, not a dependency.
- "Where things are" writes `game/*Scene.ts`, `game/ui/...`; the paths start with `src/`.
- `npm run test:coverage` says "90% on `src/core`"; the gate also covers `tools/`.
- The `npm run dev` line lists five URL switches; a pointer to `docs/url-switches.md` would keep it short and true.

## Gaps left open

- **Nothing keeps the URL table true.** A `<!-- docs:... -->` block generated from `createConfig` would, but four
  switches are read outside it (`src/main.ts` `keys`, the staff demo and the spike page). Moving those into
  `AppConfig.flags` first makes a generated table possible; the table's own "Adding a switch" section asks for that.
- **`docs:stale` tracks three docs, and none has ever been verified** (`architecture.md`, `futureproofing.md`,
  `testing.md`; now also the two new ones). The stamp is for a person (`npm run docs:verify`), so the maintainer may want to
  re-read and stamp them once, or the report stays all red and stops being read.
- **The docs index pages are for agents first.** A newcomer opening `docs/` sees 13 files and seven folders with no
  "start here"; `README.md` is that page today. If the docs grow, a short README in the docs folder (read in this order) helps.
