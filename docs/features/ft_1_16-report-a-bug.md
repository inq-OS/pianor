---
id: "ft_1_16"
title: "Report a bug from the game"
scope: "A Report a bug button opens GitHub's new-issue page filled in with where it was pressed (slice A, built); later a bug icon on every screen, a text box, a screenshot with marked areas and picking a button or area on the screen (slices B to D)"
effort: "medium"
status: "slice A in review: the settings screen's Report a bug opens a filled-in GitHub issue; slices B to D planned"
completeness: 11
depends_on: ["ft_0_13"]
---
# ft_1_16: Report a bug from the game

Index: [FEATURES.md](FEATURES.md).

A bug noticed while the student plays becomes an issue with little retyping and the facts a developer needs (screen, piece, build). Fixing what the student trips over keeps them reading and playing (AX-0). Constraints: the game runs on the player's own machine, never hosted (d068); no secret (a GitHub token) ships in the page; player data never goes into an issue.

## Rules

**A. Filled-in issue link (built).** The settings screen (reachable from every toolbar) has the item *Report a bug* (*Teata veast*). It opens GitHub's new-issue page in a browser window with:

1. the title `Bug: <screen> (<piece>)`, the label `bug`, and empty *What happened*, *What should have happened* and *Steps* sections;
2. under *Where (filled in by the game)*: the screen settings were opened from, its piece and section when it had them, the page address with its URL switches (the port tells `npm run start:local` from dev servers), dev server or production build, language, window size, and the browser as its name and major version only (such as `Chrome 141`, `browserName`); no time of the press;
3. nothing else from the screen's data, no player name or progress (`screenFacts`, `src/core/report/bugReportLink.ts`).

The game sends nothing: the person edits the text and presses GitHub's own Submit. The browser must be signed in to GitHub, once, in the profile the game's window uses (`npm run start:local` has its own). A release build (`tools/release/pack.sh`) has no *Report a bug* and carries no issue link: a student's copy reports nothing.

**B. Report screen (planned).** A bug icon on every toolbar (d088) opens a report screen over the current one: a text box (computer keyboard, the student's own words) and Send. Where it goes is open: the same link with the text added, or a local queue (`npm run start:local` saves each report to the gitignored `private/reports/`; works offline). Decide with the maintainer when planned.

**C. Screenshot with marked areas (planned).** A screenshot of the canvas as it was before the report opened; the person draws rectangles over what is wrong; saved with the report (needs the local queue of B, or a file to drag into the issue).

**D. Pick a thing on the screen (planned).** Like browser developer tools: point at a button, item or area, it lights up, a click adds it by name (string key and position). The seam is `PixelScene.button` (rectangle and label key).

## Acceptance criteria

- **ft_1_16.AC1** The link opens a new issue on the repository with the title, the `bug` label, empty questions and the screen's facts in the body.
- **ft_1_16.AC2** Only the piece id and section are taken from the screen's data; a missing one leaves its line out, and long values are cut.
- **ft_1_16.AC4** A release build leaves out the *Report a bug* item and the code that writes the link, so the repository's address is not in the bundle.
- **ft_1_16.AC3** [human] The maintainer presses *Teata veast* in `npm run start:local` and gets the filled-in issue page in a browser signed in to GitHub.

Not verified by an agent: how Edge or Chrome in app mode opens the new window (a separate window of the same profile is expected) and the GitHub sign-in in that profile.
