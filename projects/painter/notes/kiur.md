# Kiur as a metskiur: the study and the sketches

Kiur, the mascot of Pianor, is drawn after the real bird (metskiur, the tree pipit, Anthus trivialis). The first Kiur was a round teal bird with a gold crest (d036) with nothing of a metskiur in him; the new look is d114.

Reference pictures are studied locally and never committed (d223): reference photographs of the bird (six views) and screenshots of the 1991 game.

## What the photographs show (six views: side, front twice, from behind twice, in the hand with the wing open)

| Part | What is there |
|---|---|
| Shape | slim and upright on a perch; from the front on the ground a full egg. Small round head, no neck. The tail is about two fifths of the body, notched at its tip |
| Crown and back | olive-brown to warm buff with dark streaks: fine on the crown, broad and soft on the back |
| Face | a pale buff eyebrow, strongest over and behind the eye; a thin dark line behind the eye; a pale broken ring round a black eye; a brown cheek; a pale throat between two dark moustache lines, the outer one ending in a dark patch at the side of the neck that runs into the breast streaks |
| Bill | fine and pointed, half the head long; dark along the top and at the tip, pink below and at the base |
| Breast | warm buff with bold black drops in lines that fan out from the throat |
| Flanks and belly | the drops thin to hair lines along the flank; the belly is white and plain |
| Wing | two bars: a row of black-centred feathers with white tips like scales, and a second, longer row; then long dark feathers with fine pale edges |
| Tail | dark, the outer feathers white |
| Legs | pink, long toes, a short curved hind claw |

Not yet seen: a bird singing with its bill open, and the song flight (it climbs from a tree top and parachutes down singing).

One view straight from behind is paler and sandier than the others and may be another pipit; it is used for the layout of the back only.

## What the 1991 game shows about small characters

- No dark line round a character. A material is three or four flat tones of one hue in clusters, with no dither. A face is a few pixels.
- A character stands out by strong local colour against a dithered, painted ground.
- Inventory icons are the opposite: larger, richer, each with a dark line round it.

So: Kiur has a dark line where he is part of the interface (the practice bar, settings, credits) and none where he sits in a painted picture (asleep on the bed in the room).

## The look: the round friend

Kiur is the round friend: from the front, both eyes, in 48 x 40 fine pixels, the footprint of 24 x 20 cells (d110), with profiles (front, back, sides, angles, sleeping) so that an interactive Kiur is possible (flies from branch to branch, sits on a shoulder, and so on). A brown bird on cream paper is quieter than a teal one, so he has strong darks and big gestures, with the red mouth, pink legs and gold notes as accents.

He is built as **one small model** so that every view is the same bird: a few rounded parts (body, head, tail, folded wings, bill), each material in three flat tones in bands (no smooth light: a look too 3D for scenes was turned down), and every stripe, breast drop, wing bar and crown streak a mark placed on the bird, shown where its surface faces the viewer. A pose is a handful of numbers (which way he faces, the head's turn and lift, legs standing, sitting or tucked, the bill, the eyes, the wings).

The model sheet holds the turnaround (front, three quarters, side, three quarters from behind, back; the other three mirrored), idle, sings, thinks, sits, sleeps (head turned back, bill tucked in), three wing frames, all at about real size on paper and on a panel.

Rules learnt while making it:
- **The brow decides the mood.** A pale eyebrow whose edge rises toward the back of the head reads as a frown in a three-quarter view. The cap's edge must fall away toward the back (a kind brow). Never a frown (the rule for Kiur's moods).
- The eyebrow needs a face darker than itself, or it is not there: the face is mid buff, the brow cream.
- The eyes sit about 44 degrees off the bill's line: far enough to the side for a bird, near enough that both look at the student from the front.
- From the front the bill is a small diamond stamped by hand; the modelled cone only works from the side.
- A streak drawn with a bend (a third pixel stepped sideways) turns a row of drops into a tangle. Straight drops, two or three pixels.

What is still weak is tagged under [TODO](#todo) below (d116).

## In the game (d114)

The model is `src/game/ui/pixel/kiur/kiurModel.ts` (the painter) and `kiurFrames.ts` (the named poses). How it is drawn:

- His colours are sixteen entries of the game palette (umber, buff, down and leg ramps, his outline and his streaks). The bill shares the legs' pink and the back's dark brown: three colours fewer and no visible difference.
- Which pixels get no line round them (the thin legs) is remembered while painting, not told from the colour, so the bill keeps its line.
- Kiur at the door is a new pose: square to the student, head turned to the door, one wing held out flat with its feathers hanging down (`wings: 'point'`). A flying wing seen from the front is only a thin line, so pointing needed its own way to hold the wing.
- In the room he sits on the bed with no line round him and the room's light on him. At dusk and at night he nearly melts into the bed, as the real bird would; by day he reads well.
- Seen on the screens: at the laptop's size he is about 85 by 115 screen pixels beside the staff, finer and smaller than the teal bird in the same room. His size is tagged below.
- On the settings screen his feet touch the end of the label "Space between staves". The place is the screen's, not the picture's (tagged below).

## TODO

The later refinements of Kiur as work tags (d116, `docs/automation/todo-tags.md`). No release is named: `Later` until the architect says otherwise. The pull request that does a line deletes it.

- TODO(painter, Later): flight wings that bend and overlap like feathers instead of three stiff striped boards (`openWing` in `kiurModel.ts`, frames `KIUR_FLIGHT`). Waits on the photographs below.
- TODO(painter, Later): a "thinks" pose that reads at a glance (a tilted head, a foot at the bill), not only a look aside (`KIUR_MOODS.hmm`).
- TODO(painter, Later): break up the back's streaks; they stand in rows too regular for feathers (`bodyMarks`, `wingMarks`).
- TODO(painter, Later): Kiur's size on the screens. He fills less of his 48 x 40 box than the teal bird did (about 85 by 115 screen pixels beside the staff) Decide with the interface band (ft_1_20), which may change his box.
- TODO(painter, Later): Kiur asleep on the bed at dusk and at night nearly melts into the blanket. A lighter rim or a paler blanket under him, with no line round him (inside a painted picture).
- TODO(painter, Later): on the settings screen his feet touch the end of the label "Space between staves". The place is the screen's: move him with the settings screen's repaint.
- NEEDS-HUMAN: photographs of a metskiur singing (bill open, on a branch top) and flying (wings open from the side and from below), studied locally, never committed (d223).

## Fetching references

- Wikimedia (Commons, Wikipedia, their image host) refuses automated readers under its robot policy, whatever the reader calls itself; a person downloads the photographs.
