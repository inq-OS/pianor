# Dependencies

Add an entry before adding any dependency: what it is for, licence, and why the platform API is not enough. Every dependency, tool and asset must have a FOSS-compatible licence (d068): code under MIT, BSD, ISC, Apache-2.0 or MPL-2.0; assets under CC0, CC-BY or CC-BY-SA; never NC, ND or personal-use-only licences. Versions below are as installed at scaffold time.

| Package | Version | Licence | Why |
|---|---|---|---|
| phaser | ^4.2.1 | MIT | Game framework: scenes, sprites, pixel-art scaling. See decision log: v4 chosen over v3 (latest stable line) |
| zod | ^4.6.5 | MIT | Schemas for chart, meta, save data and content |
| typescript | ^6.0.3 (dev) | Apache-2.0 | Strict typing |
| vite | ^8.3.3 (dev) | MIT | Dev server and bundler |
| vitest | ^5.0.3 (dev) | MIT | Unit, golden and replay tests |
| @vitest/coverage-v8 | ^5.0.3 (dev) | MIT | Coverage report and 90% gate on src/core and tools/ |
| eslint, @eslint/js, typescript-eslint, globals (dev) | see package.json | MIT / BSD-2-Clause | Lint and import-boundary rules |
| knip | ^6.41.0 (dev) | ISC | `npm run analyze:unused`: unused files, exports and packages (d063) |
| jscpd | ^5.4.1 (dev) | MIT | `npm run analyze:dupes`: copy-paste detection (d063) |
| fast-check | ^4.10.2 (dev) | MIT | Property tests for tick math, staff positions and schema round-trips (added in ft_0_02) |
| @playwright/test | ^1.63.0 (dev) | Apache-2.0 | End-to-end and screenshot tests in a real Chromium (added in ft_0_09b). Downloads browsers to `%LOCALAPPDATA%\ms-playwright` (about 700 MB with the headless shell and ffmpeg) |
| tsx | ^4.23.15 (dev) | MIT | Runs the `tools/` scripts |
| @types/node (dev) | see package.json | MIT | Types for tools and config |
| remark, remark-frontmatter, remark-validate-links, vfile | ^15, ^5, ^13, ^6 (dev) | MIT | `docs:check` (d041): a real markdown syntax tree, and the check that links point at files and headings that exist. Used through their API from `tools/docs/` (no CLI) |
| jpeg-js | ^0.4.4 (dev) | BSD-3-Clause | Decodes a phone photo of a sheet for the photo cleaning of `npm run piece:photo` (ft_Y_04 slice 3, `tools/import/clean.ts`); Node has no image decoder, and ImageMagick would be a second program to install |
| fast-png | ^8.0.0 (dev) | MIT | Reads a scanned PNG and writes the cleaned picture Audiveris reads (same use as jpeg-js) |
| Audiveris (Java program, optional, not in package.json; installed separately by hand) | 5.11 | AGPL-3.0 | Optical music recognition for `npm run piece:photo` (ft_Y_04 slice 3): a separate program the menu starts and whose MusicXML it reads; never bundled, linked or copied, so the AGPL does not reach this repo. No MIT recogniser reads scans as well; oemer (MIT) is slower and gives no positions, homr is AGPL as well |
| code-review-graph (Python, optional, not in package.json) | 2.3.9 | MIT | Local code knowledge graph served over MCP (`.mcp.json`) for agents wherever it is installed, for example by a setup script that runs `pip install --user code-review-graph==2.3.9` and `code-review-graph build`; the hooks in `.claude/settings.json` skip it where it is not installed. Its index `.code-review-graph/` is gitignored |

Considered and not added:
- **remark-cli** and **remark-lint-frontmatter-schema** (ISC/MIT): together they bring 9 `npm audit` advisories (old pinned `ajv`, `minimatch`, `yaml`, `chokidar`) into a repo that had 0, and the schema plugin would duplicate the zod validation the index generator needs anyway (d041).
- **markdown-magic** (MIT): 18 direct dependencies to save about 60 lines of marker handling in `tools/docs/blocks.ts` (d041).
- **tracey, reqcov, Doorstop**: traceability tools made for formal standards; `tools/docs/criteria.ts` does the small part needed (d041).
- **abcjs** (MIT) as the ABC parser. It parses fingerings, voices and clefs but silently accepts unsupported syntax and gives no line numbers, so ft_0_03 uses an own strict parser instead.
- **smplr** (MIT) for the piano sound (checked). It has precise scheduling, velocity, note-off and a generic sampler, but its piano is a different sample set loaded from the internet, it is pre-1.0, and the game must work offline (ft_0_14). `SamplerPiano` is about 150 lines on the Salamander samples, tested, placed on the song clock. Revisit if ft_0_13 wants more instruments or effects.
- **VexFlow** (MIT) and **OpenSheetMusicDisplay** (BSD-3) for the staff. Not used because the staff must be restyled as pixel art, show per-note state and cursor, and run in a Phaser loop. Re-evaluated for beams and sixteenths in [d155](decisions/notation.md#d155): VexFlow stays a reference for beam rules only; look again only for two voices in one hand or cross-staff beams.
- **musicjson** (MIT, last updated 2012) and **xml2abc** (Python, LGPL) for import: see `docs/features/ft_Y_04-piece-import.md`. When import is scheduled: MusicXML parsing with the platform DOMParser in the browser or a small MIT XML parser in Node, `@tonejs/midi` (MIT) for MIDI, and xml2abc only as an optional external tool whose output our strict parser then checks.
- **Sightread** (GPL-3.0), Neothesia (GPL-3.0), PianoBooster (GPL): reference only, no code taken.

Assets (not packages): the piano samples are CC BY 3.0, listed with credit in `docs/assets.md`. No new npm packages were added for sound; it uses the Web Audio API directly.

Licence of Pianor itself: MIT (code). Original pieces: CC0 or CC-BY, recorded per piece. ft_0_12 added no packages (seeded random numbers are a few lines in `src/core/random.ts`; the command line uses Node's `util.parseArgs`). A local-only, gitignored `private/` folder may use code under other licences; nothing committed may import it (see `docs/decisions/workflow.md#d026`).

## TODO

Work tags ([todo-tags.md](automation/todo-tags.md)); the closed issue in brackets keeps the earlier discussion.

- TODO(builder, R2): clear the 18 moderate `npm audit` advisories in the dev tooling (eslint, `@eslint/js`, typescript-eslint, remark-validate-links and their `minimatch` and `glob`) by upgrading one at a time with `npm run check` green after each; decide on any without a fix; never `npm audit fix --force`, and no TypeScript major. Package files: the maintainer merges.
