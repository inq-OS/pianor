# Cast, difficulty scale, phrase plan and first lines (WP-02)

Written by the architect: the work package WP-02 of the [programme](program-characters-teacher.md). It follows the answers to Q5 to Q7 and Q10: a character's piece goes learn, practise, show ([d135](../decisions/game.md#d135)); no label word such as VÄLJAKUTSE or TEGELANE on screen, a character's own line invites the tug; a character has a name, a generic name or a generated one. Characters come from Keri's own world (d132, ft_1_21): folk spirits and belief, visitors who really come to the island, ghosts of its past; never a real person and nothing from a copyrighted novel.

**The cast (Q10):** for now a border guard, a Prangli fisherman and a tree spirit (puuvaim). The style of each and the one built first are the architect's (AX-3 provisional: the maintainer may swap them): the tree spirit (classical) first, then the Prangli fisherman (folk) and the border guard (jazz). The other candidates of the first draft (the bonfire's voice, the straw kratt, the old keeper's ghost, the conservatory student, the ship's cook) are dropped; any may come back in a later cast.

## 1. The cast

Every sheet: who it is, the name the student sees (`named`, `generic` or `generated`, A.5 of the programme's appendix), where it is met, how it ties to music, its phrases' style, how it invites the tug, the item a won tug gives, and what the painter needs. Walking figures are built on the template character ([d142](../decisions/art.md#d142)).

**Prize ladders (ft_1_21.AC18):** every level of a character beaten gives a better prize than the one before, a plain thing at level 1 and the character's treasure for the final level (the whole song). Five rungs each (AX-3 provisional: four song levels and the final boss); only Puuvaim's are in the game so far (`content/characters/puuvaim.json`, `content/items/items.json`), the fisherman's and the border guard's go in with their characters (WP-17). The band shows each ladder as its best rung.

### Folk: the oak spirit (built first, WP-11)

**Tammehaldjas** (*Oak spirit* in English; its ids stay `puuvaim`, and it was named *Puuvaim* before; d263). The spirit of the low, twisted tree that overhangs the knoll from the left (painted on purpose, [scene-knoll.md](../keri/scene-knoll.md)). Keri has no real trees ([keri.md](../keri.md)), so this one is old and alone, and has listened for a long time to whatever music the wind and the lighthouse's people brought. Generic name: *Tammehaldjas*, a folklore name (d247), shown as "???" until the student asks who it is (ft_1_22.AC10, d249). Met on the knoll at dusk and at night. Music tie: the old songs nobody wrote down, learned by ear. Phrases: a line in the runo song (regilaul) manner (written for Pianor, CC0: no documented runo tune transcribed yet), the first half of the round Frère Jacques, the opening of Greensleeves, each told about before it is taught (`piece.<id>.about`). Invites: "Mina mängin ette, sina mängid järele. No näita, mida sa oskad!" Prizes, one per level beaten (ft_1_21.AC18): a plain oak leaf (*tammeleht*), an acorn (*tõru*), a golden leaf (*kuldne leht*), a singing branch (*laulev oks*), the seed of life (*eluseeme*). Look: no walking figure: a face in the bark that opens its eyes, and branches that sway with the notes (states: asleep, awake, listening, playing). Why first: no walking, on the knoll that already runs and that WP-05 moves first, and call and response is the whole tie; the shortest path to a playtest of the loop.

### Folk: the Prangli fisherman (WP-17)

**A fisherman from Prangli,** the inhabited island 7 km south ([keri.md](../keri.md)), who rows over to see his nets near Keri. Generated name (*Ats Kala*-style, drawn once per player). Met at the docks in the morning. Music tie: the old songs sung while hauling nets and rowing, one singer leads a line and the crew answers it, which is the tug itself (the regilaul manner). Phrases: two-bar song lines, stepwise, five notes, the last note repeated. Invites: "Kui võrke veetakse, siis lauldakse. Mina alustan, sina vastad. No näita, mida sa oskad!" Prizes, one per level beaten: a cork net float (*võrguujuk*), a net needle (*võrgunõel*), a gull's feather (*kajakasulg*), a sea stone with a hole (*näkikivi*), the ship's bell (*laevakell*). Look: on the template: an oilskin jacket, rubber boots, a knitted cap; states idle, sing, talk. KERI-TODO: where his boat lies when he is there (the port is assumed).

**Built:** `content/characters/fisherman.json`, his talk in `content/conversations/fisherman.json`, his actor on the template (`content/actors/fisherman.json`: a yellow oilskin, a red knitted cap, a white beard, black boots), at the southern port, where visitors land and his tarred rowing boat is painted, not the north jetty the plan assumed. Like every character he shows as "???" until the student asks "Who are you?", and he tells where each of his tunes comes from (`piece.<id>.about`). His tunes are real public-domain tunes of the sea, not original phrases: *Row, Row, Row Your Boat* (level 1, its first and last lines), *Lightly Row* ("Hänschen klein", 8 bars; level 5 because its last bar falls a fifth), the shanty *What Shall We Do with the Drunken Sailor*, titled by its chorus *Hey Ho and Up She Rises* (level 5, in C Dorian). The maintainer picks his name and tunes on a pick board; until then he is the generic *Kalamees* and the tunes stay drafts.

### Jazz: the border guard on his break (WP-17)

**A border guard** who visits the island on patrol and plays the saxophone on the slipway during his coffee break. Generated name. Met at the docks by day. Music tie: trading fours, two players taking turns with the bars of one tune, which is the tug. Phrases: short riffs with a rest and a syncopated note, a flat third at level 3. Invites: "Mul on kakskümmend minutit pausi. Mängime kordamööda, neli takti mina, neli sina!" Prizes, one per level beaten: a sax reed (*saksofonikeel*), his whistle (*vile*), a compass (*kompass*), a golden reed (*kuldne keel*), the golden saxophone (*kuldne saksofon*). Look: on the template: a uniform with an open jacket, a saxophone; states play and talk.

### The teacher

The only one of their kind; tough and demanding because the standard is high, never unkind (the plan, section 5.2). Generic name *Õpetaja*, so any teacher using the screen can stand in it. The teacher arrives by boat as a deadline nears. Look: on the template, a dark coat and scarf against the wind, a music folder under the arm, a small metronome in the coat pocket; states idle, talk, listen. The teacher's lines are short and say what was measured (AX-2.1).

### The character rules

Every character keeps these. The ones a test can judge are held by `src/core/character/content.test.ts` ("every character keeps the character rules"), which runs over every file in `content/characters/`, so a character that misses one cannot merge:

- **"???" until asked** (ft_1_22.AC10): the scene shows `character.unknown` until the flag `known-<id>` is set, and only a node reached by a choice the student picks ("Who are you?") sets it; talking and leaving is not enough. The flag is `knownFlag(id)` in `src/core/character/character.ts`.
- **Open pieces:** every phrase piece is `public-domain` or `CC0-1.0`, with its `source` named; it stays `draft` until the maintainer approves it in the piece preview (d025).
- **It tells about each piece:** a string `piece.<pieceId>.about` (English and Estonian) for every phrase piece, and the node that teaches a piece says that line.
- **The AX-0 test:** its conversation passes `lintConversation`, every branch playing or leaving within 4 presses.

What a test cannot judge, the reviewer checks on every pull request that adds or changes a character:

- [ ] The name comes from Estonian folklore or Keri's own world (a haldjas, a vaim, a kratt; never a real person, never from a copyrighted book; d247).
- [ ] The tunes fit the character's spirit (old and folky for a nature spirit; classical is fine when the motif fits), and they are public domain in their arrangement too.
- [ ] The "who" line teaches something true: folklore, belief, science, Keri's history, philosophy or religion, in words a young student reads.
- [ ] Each about line tells something true about the piece and who made it (or that nobody knows), without praise or a quiz.
- [ ] Estonian first: the Estonian lines read naturally (the `write-ui-text` skill).

## 2. Difficulty scale 1 to 10 (d138)

One scale for phrases and pieces. Since [d157](../decisions/game.md#d157) these ten steps are the Beginner grade of the 0 to 100 points (step N is points 2N-1 and 2N); the meta file's `difficulty` keeps them as half stars, 1 to 10 here, up to 50 for Master. Each step has an anchor a person can play to check a number; core_08's estimator proposes, a person confirms.

| Step | Anchor | Hands | Length | What is new |
|---|---|---|---|---|
| 1 | Three to five notes in the C five-finger position, quarters and halves | one | 4 bars (two-bar turns) | nothing: reading notes on the staff |
| 2 | A line in one five-finger position with steps and thirds | one | 4 bars | skips |
| 3 | A line with eighth-note pairs and a rest | one, or hands taking turns | 4 bars | eighths, rests |
| 4 | A tune over one held note or a drone in the other hand | both, one moving | 4 to 8 bars | the second hand |
| 5 | A tune over a simple pattern (a broken fifth), one accidental, one position shift | both | 8 bars | patterns, accidentals |
| 6 | A short piece in a key of one sharp or flat, dotted rhythms, legato and staccato, dynamics | both | 8 to 16 bars | articulation |
| 7 | A first-year piece: both clefs moving, ties, a pick-up | both | 16 to 32 bars | independence |
| 8 | Two sharps or flats, syncopation, chords, a tempo change | both | a page | texture |
| 9 | A section of a real classic in its own texture | both | a section | the real thing |
| 10 | A whole piece in its full complexity | both | the whole piece | everything |

The MVP's phrases are 1 to 3, one per tug level. Changed (the architect, from a WP-11 question): steps 1 and 2 were 1 to 2 and 2 to 4 bars, but every curriculum level asks at least 4 bars of a piece (`bars.min` in `content/curriculum/levels.json`) and the tug trades two-bar turns anyway (ft_1_21.AC3), so a phrase is never shorter than 4 bars and the linter stays as it is (AX-1: more correct bars for the same reward; AX-3: no special case). Curriculum levels (`content/curriculum/levels.json`) stay what the player has met; difficulty is how hard a phrase or piece is.

## 3. The phrase plan: 3 styles × 3 levels

Nine phrases for the MVP, three per character, **public-domain tunes** or original, written as pieces (ABC plus meta with `style` and `difficulty`), generated or composed by the builder in WP-11 and WP-17, passing `piece:lint`, approved by a person in the piece preview. Range inside the student's current level; the tug splits each into two-bar turns (ft_1_21.AC3).

| Style (character) | Level 1 (difficulty 1) | Level 2 (difficulty 2) | Level 3 (difficulty 3) |
|---|---|---|---|
| Folk (the oak spirit: old songs by ear) | a runo song line, 4 bars of quarters and halves, right hand, C to F | Frère Jacques, its first half, steps and thirds | Greensleeves, its opening in E minor, 3/4, with a pick-up |
| Folk (the fisherman: hauling song) | 4 bars in 2/4, right hand, C to G, stepwise, the line's last note repeated | 4 bars, two lines answering each other, a third | 4 bars, hands taking turns (the crew in the left hand an octave lower), eighth pairs |
| Jazz (the border guard: riff, trading fours) | 4 bars, three notes, a rest on beat 1 | 4 bars, a syncopated note held across the beat (a tie inside the bar) | 4 bars with the flat third (E♭ in C), the riff and its answer |

## 4. Who is met where

| Character | Scene | When | Ties to |
|---|---|---|---|
| Puuvaim | the knoll, in the tree at its left | dusk, night | the old songs, learned by ear |
| The Prangli fisherman | the port (southern docks) | morning | hauling songs |
| The border guard | the docks | day | trading fours |
| Õpetaja | the docks (her boat), then the room | toward a deadline | the curriculum |

Presence (WP-08) decides which day each one is there; the fisherman and the border guard share the docks and are not there on the same day. A character is only met after practice (d132).

## 5. First lines, in Estonian (drafts for the maintainer to read)

Plain text level (ft_1_23's MVP), shown in capitals by the game (the rule for game text). `{…}` is filled from the measured result (AX-2.1). These are drafts; the string keys and the final wording go through `write-ui-text` in WP-09 and WP-11.

### Puuvaim, the first conversation

| Speaker | Line | Then |
|---|---|---|
| Puuvaim | Ohoo... keegi tuli mu okste alla. | |
| Puuvaim | Siin saarel pole teisi puid. Ma olen kaua üksi kuulanud, mida tuul ja tuletornirahvas mängisid. | |
| Student (choice) | Õpeta mulle üks viis! | teach (level 1 phrase) |
| Student (choice) | Mis viise sa kuulnud oled? | the music tie, then back |
| Student (choice) | Ma tulen hiljem. | leave |
| Puuvaim (after teaching) | Nüüd oskad sa minu viisi. Harjuta seda, ja kui tuul jälle vaikseks jääb, tule tagasi. | leave |
| Puuvaim (on a later visit, practised) | Mina mängin ette, sina mängid järele. No näita, mida sa oskad! | tug |
| Puuvaim (won) | Sinu read läksid kõik paika. Võta see kuldne leht, seda ei saa iga mööduja. | give the item |
| Puuvaim (lost) | {right} rida {total}-st läks paika. Harjuta veel, siis mängime uuesti. | leave |

### Kiur's heads-up and the teacher

| Speaker | Line |
|---|---|
| Kiur | Vana puu juures sahiseb keegi. Lähme vaatama? |
| Kiur | Kaugelt tuleb paat. Vist on see õpetaja. |
| Õpetaja (arriving) | Tähtajani on {days} päeva. Mängi mulle "{piece}". |
| Õpetaja (passed) | Lugu on selge. Järgmisel korral tahan kuulda {tempo} kiirusel. |
| Õpetaja (not yet) | Veel mitte. {bars} takti vajavad harjutamist. Ma tulen tagasi. |

### The other two, one greeting each

| Speaker | Line |
|---|---|
| The Prangli fisherman | Tulin Pranglilt võrke vaatama. Kui võrke veetakse, siis lauldakse: mina alustan, sina vastad! |
| The border guard | Mul on kakskümmend minutit pausi. Mängime kordamööda: neli takti mina, neli sina! |

## TODO

- TODO(architect, R3): WP-02 the maintainer reads the lines of section 5 (on the weekly list, rule 11); Puuvaim's final lines go to WP-11, the other two's to WP-17.
