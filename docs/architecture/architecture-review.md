# Architecture and interfaces review

A review of module boundaries, encapsulation and interfaces across `src/`: which layer imports which,
where state hides in module globals, and where an interface is missing or bypassed. It follows the whole-codebase sweep
in [maintenance.md](maintenance.md) and does not repeat its findings; scene layout and test-only changes
were left to other work.

## In one paragraph

The layering is sound and mostly enforced. Counting every relative import between the top folders of `src/` (tests left
out), dependencies run one way: the composition root (`src/main.ts`, `src/compose.ts`, `src/profileSetup.ts`) builds
everything; `dev` builds on `game`, `io` and `core`; `game` uses `core` (91 imports) and only the interface files of `io`
(5); `io` uses `core` (15) and nothing above it; `core` imports nothing outside itself but zod and content JSON; `spike`
uses one `io` file. The gaps were in what the lint rules did not say and in two places where state or an implementation
slipped past an interface. In C/C++ terms: the HAL is clean, but two drivers were reached by a direct call instead of
through the function table, and one module kept a private copy of a peripheral's state that callers had to refresh by hand.

## Layer map

| From \ to | core | io | game | dev | root (`src/*.ts`) |
|---|---|---|---|---|---|
| **core** | | 0 | 0 | 0 | 0 |
| **io** | 15 | | 0 | 0 | 0 |
| **game** | 91 | 5 (interfaces) | | 0 | 3 (`appConfig`) |
| **dev** | 12 | 12 | 7 | | 3 |
| **root** | 3 | 6 | 18 | 6 | |

`game` also imports `src/core/piece/check.ts` (in `game/editor/OwnPieces.ts`), which is the documented seam in
`eslint.config.js`: the piece compiler and linter are pure so the browser can reuse them.

## Fixed in this pull request

- **The editor reached the browser's file API directly.** `EditorScene` imported `downloadTextFile` and `pickTextFile`
  from `io/files/textFiles`, an implementation, which the `src/game` lint boundary did not list. There is now a
  `TextFiles` interface in `src/io/files.ts` (the same pattern as `io/audio.ts` and `io/keyboard.ts`), `GameContext.files`
  carries it, `src/main.ts` and the preview page wire in `browserTextFiles`, and `**/io/files/**` is in the restricted
  patterns.
- **A hand-refreshed copy of the own pieces.** `game/content.ts` kept its own `let ownPieces: Piece[]`, and every place
  that changed the player's pieces had to remember to call `setOwnPieces(context.ownPieces.pieces())` (start-up, editor
  save, editor import). A new path that forgot, for example `OwnPieces.remove`, which no screen calls yet, would have
  left a deleted piece in the menu. Now the composition root registers the source once (`setOwnPiecesSource`) and
  `loadPieces` reads it on every call, so `OwnPieces` is the one place the list lives.
- **Lint boundaries that were only habit.** Nothing stopped `src/io` from importing scenes, Phaser or the dev pages, or
  `src/game` and `src/core` from importing `src/dev` or `src/spike`. `eslint.config.js` now says so: `src/io` may not import
  Phaser, `game`, `dev`, `spike`, `tools` or the composition root; `src/game` may not import `dev` or `spike`; `src/core`
  may not import `dev`, `spike` or the composition root. The rules use `regex` patterns on relative paths, because a glob
  like `**/dev/**` also matches `content/dev/`, the hand-written dev charts that core tests read. No existing import
  breaks any of the new rules.

## Proposals

Larger than a maintenance fix, or touching a seam; each names its issue when one was filed.

1. **Page flags reach scenes through a global.** `BootScene`, `MenuScene` and `game/content.ts` import `appConfig`, the
   one config object built from `window.location.search`, and `StaffDemoScene` reads the URL itself. A scene cannot
   then be shown with other flags in a test without changing the page URL. Put the flags the game needs
   (`battle`, `editor`, `showDraftContent`, `demo`) into `GameContext`, read the URL only in `src/config.ts`, and add the
   root files to the `src/game` lint boundary, with item 2. **Done:** `GameContext.flags` (battle, editor,
   demo and the staff demo's view settings); `src/game` may not import the root files or read `location` (lint).
2. **The piece catalogue is a set of module functions with hidden state.** `loadPieces`, `findPiece` and
   `bundledPieceIds` in `game/content.ts` read the build's pieces, the dev samples, the own-pieces source and the
   `appConfig` default; there is no object to hand a scene or a test. A `PieceCatalogue` in `GameContext` (built in
   `main.ts`, with the own pieces and the draft flag passed in) would be the natural home for the caching a faster start
   needs, and would let `ProfileService`'s `catalogue` and the autoplay director use the same instance.
   **Done:** `PieceCatalogue` (`src/game/pieceCatalogue.ts`) in `GameContext.pieces`, built once in `main.ts` from
   `bundledPieceSources()` (`game/content.ts`); the profile service, the scenes and the director all use it.
3. **Barrels used half the time.** Five core folders have an `index.ts` (`battle`, `chart`, `judge`, `progression`,
   `transport`), the others do not, and code outside core imports `core/judge/types`, `core/judge/playSettings` and
   core/battle/battleSettings directly 17 times although the barrel exports them. `core/chart/tempoLabel.ts` is
   not in its barrel at all. Pick one rule: either every core folder has a barrel and outside code imports only that
   (a lint pattern `**/core/*/*` for `src/game` and `src/io` enforces it), or barrels go. The first gives each core
   module a declared public interface, which is the encapsulation the rest of the design assumes. A choice for the
   architect, and mechanical once chosen, with items 4 and 5.
4. **Application services outside the coverage gate.** `game/profile/ProfileService.ts` (300 lines) and
   `game/editor/OwnPieces.ts` import no Phaser and no DOM: they are the application layer between the scenes and core
   (saves, unlocks, own-piece compile and storage). Living in `src/game` puts them outside the 90% gate on `src/core`
   and lets them import anything a scene may. A src/app folder (pure TypeScript plus io interfaces, with its own lint
   boundary and a coverage report) would state what they are. `OwnPieces` would then import the piece checker through
   the same seam as today.
5. **`tools/piece` is a library the browser ships.** The game's editor and the preview page import
   `src/core/piece/check.ts` and its dependencies, so "tools" holds runtime code. The lint seam keeps those files free of
   Node APIs, which works; moving them to src/core/piece (or a src/content package) would make the folder name
   match its role and put them under the core coverage gate. This touches `docs/futureproofing.md`, so it is an
   architect question.

## How this was checked

An import scan of every non-test `.ts` file under `src/` (relative imports resolved to their top folder), a search for
module-level `let` and `var` (four: `content.ts`, `profileSetup.ts`'s store choice, a texture counter in
`PixelObjects.ts`, the spike page's render flag; only the first was state a caller had to keep in step), and a lint run
with temporary files that broke each new boundary rule to confirm it fires.
