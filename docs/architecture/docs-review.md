# Docs review

A pass over the top-level docs (`README.md`, `docs/*.md`) against the code, after the maintenance sweep
in [maintenance.md](maintenance.md). The feature, decision, authoring and architect folders were not
re-read line by line; `npm run docs:check` already holds their links, paths and ids.

## Gaps left open

- **Nothing keeps the URL table true.** A `<!-- docs:... -->` block generated from `createConfig` would, but four
  switches are read outside it (`src/main.ts` `keys`, the staff demo and the spike page). Moving those into
  `AppConfig.flags` first makes a generated table possible; the table's own "Adding a switch" section asks for that.
- **`docs:stale` tracks three docs, and none has ever been verified** (`architecture.md`, `futureproofing.md`,
  `testing.md`; now also the two new ones). The stamp is for a person (`npm run docs:verify`), so the maintainer may want to
  re-read and stamp them once, or the report stays all red and stops being read.
- **The docs index pages are for agents first.** A newcomer opening `docs/` sees 13 files and seven folders with no
  "start here"; `README.md` is that page today. If the docs grow, a short README in the docs folder (read in this order) helps.
