# Dependencies

Add an entry before adding any dependency: what it is for, licence, and why the platform API is not enough. Every dependency, tool and asset must have a FOSS-compatible licence (d068): code under MIT, BSD, ISC, Apache-2.0 or MPL-2.0; assets under CC0, CC-BY or CC-BY-SA; never NC, ND or personal-use-only licences. Versions below are as installed at scaffold time.

| Package | Version | Licence | Why |
|---|---|---|---|
| phaser | ^4.2.1 | MIT | Game framework: scenes, sprites, pixel-art scaling. See decision log: v4 chosen over v3 (latest stable line) |
| zod | ^4.6.5 | MIT | Schemas for chart, meta, save data and content |
| typescript | ^6.0.3 (dev) | Apache-2.0 | Strict typing |
| typescript-native (npm alias of typescript 7) | ^7.0.2 (dev) | Apache-2.0 | `npm run typecheck`: the native compiler checks the project in about 4 seconds instead of 19 on four cores. TypeScript 6 stays for ESLint (typescript-eslint) and knip, which use its library. Both ship a `tsc` command, so the script names the native one by path |
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
| Audiveris (Java program, optional, not in package.json; installed separately by hand) | 5.11 | AGPL-3.0 | Optical music recognition for `npm run piece:photo` (ft_Y_04 slice 3): a separate program the menu starts and whose MusicXML it reads; never bundled, linked or copied, so the AGPL does not reach this repo. |
| abcjs (not in package.json; loaded by the review board page from the jsdelivr CDN, pinned) | 6.7.2 | MIT | Draws a draft piece's ABC as a sheet on the phone review board (`npm run piece:board`, au10); the game's own staff needs Phaser and a build, too much for a page in the Claude app. Never used by the game |
| code-review-graph (Python, optional, not in package.json) | 2.3.9 | MIT | Local code knowledge graph served over MCP (`.mcp.json`) for agents wherever it is installed, for example by a setup script that runs `pip install --user code-review-graph==2.3.9` and `code-review-graph build`; the hooks in `.claude/settings.json` skip it where it is not installed. Its index `.code-review-graph/` is gitignored |

Assets (not packages): the piano samples are CC BY 3.0, listed with credit in `docs/assets.md`. No new npm packages were added for sound; it uses the Web Audio API directly.

Licence of Pianor itself: MIT (code). Original pieces: CC0 or CC-BY, recorded per piece. ft_0_12 added no packages (seeded random numbers are a few lines in `src/core/random.ts`; the command line uses Node's `util.parseArgs`). A local-only, gitignored `private/` folder may use code under other licences; nothing committed may import it (see `docs/decisions/workflow.md#d026`).

## TODO

Work tags ([todo-tags.md](automation/todo-tags.md)); the closed issue in brackets keeps the earlier discussion.

- TODO(builder, R2): clear the 18 moderate `npm audit` advisories in the dev tooling (eslint, `@eslint/js`, typescript-eslint, remark-validate-links and their `minimatch` and `glob`) by upgrading one at a time with `npm run check` green after each; decide on any without a fix; never `npm audit fix --force`, and no TypeScript major. Package files: the maintainer merges.
