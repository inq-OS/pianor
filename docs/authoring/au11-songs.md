---
id: "au11"
summary: "Song files (`content/songs/<id>/song.json`): a tree of pieces, groups, links and blanks with the song's tempo, key and meter"
---
# au11: Song files

Part of [piece authoring](AUTHORING.md). The rules are those of [ft_1_36](../features/ft_1_36-songs.md); this page is how a song is written.

A bundled song is one folder, `content/songs/<id>/song.json`, its folder name equal to its `id`. Its pieces are ordinary pieces in `content/pieces/`, each in one song at most. The example is Morning Song (`tests/fixtures/e2e/songs/morning-song/`, one of the end-to-end tests' own, its pieces in `tests/fixtures/e2e/pieces/`): an intro and an outro of 12 bars each, written, with 58 bars between them planned as blanks.

```json
{
  "schemaVersion": 1, "id": "morning-song", "title": "Morning Song", "status": "draft",
  "source": "original", "license": "CC0-1.0",
  "bpm": 80, "key": { "fifths": 0, "mode": "major" }, "meter": { "num": 4, "den": 4 },
  "nodes": [
    { "kind": "piece", "id": "intro", "piece": "morning-song-intro", "name": "Intro", "labels": ["intro"] },
    { "kind": "group", "id": "middle", "name": "Verses and chorus", "nodes": [
      { "kind": "blank", "id": "verse-1", "name": "Verse 1", "bars": 24, "labels": ["verse"] }
    ] },
    { "kind": "link", "id": "intro-again", "to": "intro" }
  ]
}
```

- **Nodes.** `group` (a `name` and `nodes`), `piece` (`piece`, the piece's id; `name` shown in place of its title), `link` (`to`, a piece node earlier in the song) and `blank` (`name` and planned `bars`). Every node has an `id` of lowercase words joined by dashes, unique in the song and never changed, since saves and links point at it. At most four levels of groups.
- **Values.** `bpm` (quarter notes a minute), `key` (`fifths` as in a chart, -7 to 7, and `mode`) and `meter` on the song; a group, a piece or a blank may set its own, every other node follows its parent. A piece holds its own numbers in its ABC (`Q:`, `K:`, `M:`), and `piece:lint` refuses a piece whose tempo or key differs from the value its node takes. A piece written in another meter shows that meter as its own, with nothing written in the song file.
- **Labels.** Words from `content/songs/labels.json` (intro, verse, chorus, bridge, solo, outro, etude, practice) or the author's own; `piece:lint` warns of a word not on the list.
- **Checks.** `npm run piece:lint` checks every song after the pieces: the schema, a missing piece, a piece in two songs, a link that does not point at an earlier piece, a duplicate id, a song id that is not its folder, and a piece in another tempo or key than it should follow. Each message names the song and the node.

The core reads a song with `resolveSong` (the outline's rows: song bars from 1 through the whole song, blanks and parts that are off counted, each value own or followed) and `songChart` (the written parts that are on joined into one chart, every part a phrase, the left-out parts as folds), both in `src/core/song/`.
