---
title: "Decisions: Art"
---
# Decisions: Art

Pixel art, palette, sprites, painted pictures, canvas and the art rules. One entry per decision, oldest first. Index: [DECISIONS.md](DECISIONS.md).

## d028

**The pixel kit is a 21-colour palette, a pixel font and pictures as rows of letters, drawn at a whole-number zoom.** Features: ft_0_13.

The kit in `src/game/ui/pixel/` holds the palette, a pixel font (capitals 7 px, lowercase 5 px with real ascenders), Kiur, icons and frames; text is a `PixelText` image keeping its string in `text`; textures are made from raw RGBA data (canvas readback was 3 times slower). `pixelView` (pure, `core/layout`) picks the largest whole zoom, and the staff stays vector at full resolution. Eighth notes are drawn: pairs beamed, lone eighths flagged. Free assets are welcome (d084); painted backgrounds have their own palette (d111); canvas sizes are set by d105 and d110.

Check: `src/game/ui/pixel/font.test.ts` "cover every letter, digit and mark the game writes"; `src/core/layout/pixelView.test.ts` "picks the whole-number zoom"; `src/game/ui/pixel/art.test.ts` "has a colour for every index"

## d084

**Free third-party assets are welcome and preferred over redrawing standard symbols.** Features: ft_0_13. Supersedes the "all art is original" part of d028.

Look in free packs first (Kenney CC0, OpenGameArt per-file licence, game-icons.net CC BY 3.0, free pixel fonts); CC0 preferred, CC BY/BY-SA with credit on `CreditsScene` via a string key, SIL OFL for fonts; never NC, ND, "personal use only" or an unstated licence. Every asset gets a row in `docs/assets.md` before use; take only the files used and keep the pack's licence beside them (`public/assets/<pack>/LICENSE`). Pixel art is imported to text rows, mapped to the palette and black outline (style A), at 1x, never fractionally scaled; mixed styles on one screen are a defect (painted pictures follow d111). Never franchise or copyrighted art, never AI-generated images, nothing that shows what to play without reading.

Check: untestable: licence and taste of third-party assets, judged by the maintainer and by the use-free-art-packs skill

## d086

**Estonian text is drawn in small capitals, with Õ Ä Ö Ü Š Ž inside the capital height.** Features: ft_0_18. Supersedes d081 Decision 4.

Estonian keeps sentence case (`LetterCase` `smallCaps`, the Estonian default): a capital in the text is the full seven-row capital, every other letter a five-row small capital on the baseline. Õ Ä Ö Ü Š Ž are always the small capital with the mark in the two rows above it, within the seven-row height, so no text reserves extra rows and every label has one height (`ACCENT_ROWS` gone); the tilde of Õ is a plain line. The font maps small capitals to Private Use Area characters (`drawnText` in `src/game/ui/pixel/font.ts`); `displayText` leaves the text as written. A word-initial full capital with a mark is not drawn ("Üks" starts with a small Ü); lowercase Estonian letters are not drawn.

Check: `src/game/ui/pixel/estonianFont.test.ts` "an uppercase letter is a full capital"; `src/game/ui/pixel/estonianFont.test.ts` "each have a glyph with the mark inside the seven-row capital height"; `src/game/ui/pixel/estonianFont.test.ts` "is as tall as one without"

## d097

**The sky follows the sun over Keri, computed offline; looks are layers.** Features: ft_1_14, ft_Y_14, ft_1_06.

The core computes sun elevation from the UTC instant and Keri's lighthouse (59.698722 N, 25.0227421 E, `KERI` in `src/core/sky/skyPhase.ts`) with the NOAA low-precision formulas in `src/core/sky/`, no dependency and no network. Phases: night below -6 degrees, dawn or dusk -6 to +3, day above +3 (options with these defaults). A phase swaps the sky, cloud, moon and halo palette slots (phase colours in `skyLooks.ts`, `toRgba` takes a palette), decided when the picture opens and never swapped while viewed; the room's window follows the same phase. `sceneLook(instant, options)` returns `{ phase, season, weather, holidays }` in layers (base, phase, season, weather, holiday props at named anchors; season and weather null and holidays empty in ft_1_14, data added by ft_Y_14). Nothing is saved.

Check: `src/core/sky/skyPhase.test.ts` "is night, dawn, day, dusk, night through 1998-11-01 on Keri"; `src/core/sky/skyPhase.test.ts` "returns the phase and no season, weather or holidays yet"

## d107

**Private room art reaches the game only at build time; the repository ships only its own drawn picture.** Features: ft_1_08.

A private portrait (art of unknown licence the project does not ship) lives only in `private/room/portrait.json` (gitignored, d026; rows of letters plus a legend of palette colour names). The plugin that paints the room at build time (`tools/vite-keri.ts`, since d111) lays it into the painting when the file exists and is sound (size within the wall's limit, known colours); otherwise the repository's own drawn portrait shows. Nothing imports `private/`; a build elsewhere (CI, a clone) has no private picture, and if a build is ever given to others (against d068) `private/room/` must be empty first. Why: a picture traced from a photograph has an unknown licence.

Check: `src/game/room/privatePortrait.test.ts` "no file, or a file that is not a sound picture, gives no portrait"; `src/game/ui/pixel/keri/roomPicture.test.ts` "the portrait is painted into the picture where the plan hangs it"

## d110

**The art canvas is a 640x360 fine grid under layout cells of 2 x 2 fine pixels.** Features: ft_0_13, ft_1_08.

`ART_CANVAS` (`src/core/layout/frame.ts`) is 640 x 360 fine pixels, 3x on the target screen (zoom is the largest whole number that keeps the canvas, at most 4; a page up to 4 fine pixels short of a zoom keeps it, the canvas centred and its edges trimmed, `TRIM_FINE` in `src/core/layout/canvasSize.ts`: an F11 full screen at 1920x1080 gives the page only 1910 x 1070). Layouts, hit areas, toolbar and font count in layout cells of 2 x 2 fine pixels (`ART_DETAIL`), so old layouts and art carry over at exactly twice size; `px.scale` is screen pixels per cell (6), `px.fine` per fine pixel (3). New art is drawn on the fine grid with `PixelScene.fineImage` (`fineToCells` gives the cells); the tested layout area is 320 x 180 cells (main area 320 x 157 under the toolbar and vine) and `frameFits` needs the canvas at 1x (640 x 360 physical). The private portrait is up to 66 x 80 fine pixels (d111). Replaces the sizes of d105.

Check: `src/core/layout/frame.test.ts` "draws the art canvas of 640 x 360 fine pixels at 3x on the target screen"; `src/core/layout/frame.test.ts` "counts a picture drawn on the fine grid in cells, rounded up"

## d111

**The room and the map of Keri are painted pictures made at build time; outdoor scenes are pixel art in shared flat-tone runs.** Features: ft_1_18, ft_1_19, ft_1_08, ft_1_09, ft_1_14.

The manner is Monkey Island 2 as first released in 1991, never the 2010 remake (The Curse of Monkey Island lends single ideas, the clouds most); the approach is taken, never the art. Pictures are painted in Node by `tools/vite-keri.ts` (module `virtual:keri-pictures`, cached in `node_modules/.cache/pianor-keri`, packed by `pixel/pack.ts`), brought down to their own palette of up to 256 colours, and the game only unpacks them; moving things are small frames over the picture. The picture is 640 x 248 fine pixels (320 x 124 cells) with `STRIP_ROWS` = 33 cell rows free below it; the room (`roomSet.ts`, `roomCamera` in `src/core/layout/room.ts`) is a ray-cast lit set (game palette plus 61 `SHADES`, 4 x 4 ordered dither, short runs and strong dither so the light stays banded; foreground props close the corners), the map (`keri/mapPicture.ts`, 800 x 404, `MAP_TILT`) is full colour from the world model with houses and island drawn larger than scale, the island name "Keri" is painted lettering (the one text exempt from string keys), and each scene has a painted place on the map with a button rectangle and level (d113). No picture lays a shadow or vignette over its corners; corners may stay open (art-direction rule 10). An outdoor scene (the knoll) is flat tones in runs, painted back to front, with the hour changing only the palette; all outdoor scenes share `keri/keriPalette.ts` (named material runs, `scenePalette()`, up to 256 colours; `fine` fills each run so no step exceeds `MAX_STEP` = 8 L*, the hue turning 3 to 6 degrees per 10 L*), and clouds are one-stroke curl clouds from specs (`keri/curlCloud.ts`; headed clouds 1.8 to 5.5 times as long as high). Every picture is listed in `tools/art/pictures.ts` and held to the measured rules by `tools/art/pictureRules.test.ts`, and `npm run art:check` measures runs, clouds and stage-set guides (`paint-a-scene` skill); ground is alive (blades, swells, no ball-shaped hill) and a thing in a picture is found or worn, never factory-made. The private portrait (d107) is laid in by the room plugin, up to 66 x 80 fine pixels. Changed by d123 (hours), d124 (kit), d128 (room).

Check: `tools/art/pictureRules.test.ts` "every picture the build paints is held to the rules, and no other"; `tools/art/pictureRules.test.ts` "no step of lightness over its rule"; `src/game/ui/pixel/keri/keriPalette.test.ts` "no step of lightness is over MAX_STEP at any hour"

## d114

**Kiur is a tree pipit drawn from one small model on the fine grid.** Features: ft_0_13, ft_1_15, ft_1_08, ft_1_18.

Kiur (Anthus trivialis) is brown and streaked above, with a pale eyebrow, a buff breast with dark drops, white below, a fine bill and pink legs, round and facing the player. He is one model of rounded parts (body, head, tail, folded wings, bill) seen from any side (`src/game/ui/pixel/kiur/kiurModel.ts`, poses in `kiurFrames.ts`), drawn on the fine grid at 48 x 40 fine pixels, each material three flat tones in bands (not a lit render), with marks placed by hand. He has an outline in the interface (darker on the shade side) and none inside a painted picture; his 16 colours (four ramps: umber, buff, down, leg) plus outline and streak colours are in the palette (69 colours then). He never frowns (the cap's edge falls away toward the back of the head, tested); the cheer is singing with the bill open and two gold notes. Changed by d118 (the palette has 79 colours).

Check: `src/game/ui/pixel/kiur/kiurModel.test.ts` "never frowns"; `src/game/ui/pixel/kiur/kiurModel.test.ts` "is brown and streaked above"; `src/game/ui/pixel/kiur/kiurModel.test.ts` "paints the same pose to the same pixels every time"

## d118

**The band and every screen are warm wood; the cold tones stay in the palette as paints.** Features: ft_1_20.

The palette names `night`, `panel`, `panelLight`, `panelDark`, `dim` and `lock` become warm browns (new names `groove`, `panelLit`, `honey`, `honeyDark`), so every screen turns warm in one place; the cold tones stay as `dusk` (four shades: room portrait, room palette) and `silver` (two shades). The band is one board with plates and slots cut into it (`trayBitmap` in `src/game/ui/pixel/frames.ts`): a dark line all round and a lighter line inside the top-left of a plate or the bottom-right of a slot or pressed plate; hover and held items a tone lighter, a switched-on slot has gold corner marks; a cell shows its picture tinted (`tinted`: pale honey, cream on hover, gold when on), or its word if it has no picture. The palette has 79 colours; no sprite or painted picture changes, and the staff keeps its paper, ink and blue pointer (AX-0).

Check: `src/game/ui/pixel/frames.test.ts` "cuts a plate into the board"; `src/game/ui/pixel/frames.test.ts` "marks a switched-on slot with gold in its four corners"; `src/game/ui/pixel/art.test.ts` "has 79 colours"

## d122

**Painted pictures get an advisory art review by a fresh reviewer against the MI2 atlas; only the copy guard blocks.** Features: none.

The `art-reviewer` agent (`.claude/agents/art-reviewer.md`, started by the `art-review` skill in `.claude/skills/art-review/` before a pass is shown, on a painter pull request, or on request) scores the atlas gauge per picture and hour, writes a critique under five headings (MI2 manner; quirk, not realism; Keri kept; a young student can read it; the four hours) and gives one verdict: `ready to show`, `needs a pass` or `off direction`. It is advisory, never blocking a merge, except the copy guard: a picture within dHash 10 of an MI2 picture waits for a repaint. The review is one comment-type PR comment; side-by-side sheets stay local (d223), never on GitHub or in git; not run in CI.

Check: untestable: review process for agents, advisory and judged by a fresh reviewer

## d123

**Hours move a material's lightness along a curve and tint it instead of multiplying, so the night keeps MI2's light range.** Features: ft_1_19.

In `lit()` (`src/game/ui/pixel/keri/keriPalette.ts`) an hour has `value` (`floor`, `top`, `curve`: lightness L shows as `floor + (top - floor) * (L/100) ** curve`), `keep` (share of the material's own colour) and `shade`/`sun` Lab shifts mixed by lightness. Day is unchanged; dawn is 3, 94, 1.08 keeping 82 %; dusk 2, 90, 1.15 keeping 85 %; night 2, 86, 1.8 keeping 60 % with ultramarine shade and pale cyan moonlight (AX-3 provisional). `scenePalette(own, use)` takes the materials a scene paints with so a night with more in-between colours stays within 256; a palette over 256 must name `use`. `keriPalette.test.ts` holds a run's night spread above 65 % of its day spread. Changes d111 point 16.

Check: `src/game/ui/pixel/keri/keriPalette.test.ts` "the night keeps a run long, as the 1991 nights reach from near black to a moonlit plane"; `src/game/ui/pixel/keri/keriPalette.test.ts` "a scene that names the materials it paints with gets only those"

## d124

**Recurring things in Keri's pictures are painted by one shared kit of families, types and variants.** Features: ft_1_19.

The kit is `src/game/ui/pixel/keri/kit/`: a family (stones, grass, bushes, trees, paths, lights, water, wood) has types (`stones/boulder`), each a `KitItem` that paints at a place from the scene's shared palette by a seed (same seed, same thing), with options and named variants (`small`, `in-water`, `foreground`). A scene places kit types and never paints its own stone, tuft or bush: it hands each item a `KitBrush` (pixels, palette runs at the hour, light side, loop, wind); a region-covering fill asks the scene about its ground per pixel; a type names its runs (`uses`) and has no colour of its own. `npm run art:render -- kit [family] [hour]` is the sheet the maintainer picks from; a type is `picked` (its rule in its `model`) or `candidate`, becoming picked only on the maintainer's word, and refining a picked type changes every scene using it. A thing only one scene has stays custom in that scene and is lifted into the kit when a second wants it; `kit/kit.test.ts` holds every type to its box, its runs, determinism by seed and every hour; recipes stay in `projects/painter/artists-notes/`.

Check: `src/game/ui/pixel/keri/kit/kit.test.ts` "paints only from the runs it names, the foam and the ink: no private colour"; `src/game/ui/pixel/keri/kit/kit.test.ts` "is the same for the same seed and another thing for another: no two alike"; `src/game/ui/pixel/keri/kit/kit.test.ts` "paints something, inside the box it names, at every hour"

## d128

**The room stays a lit set but is drawn as the 1991 rooms are: a bent view, leaning things, light in pools, flat island in the windows.** Features: ft_1_18, ft_1_20, ft_1_08.

The ray caster stays (d111 point 1) but its result is painted over harder: light in flat pools with ragged borders (`POOL` in `roomPicture.ts`), lines in the thing's own darkened violet colour, a pale stroke on edges facing the light, no grain, and colour held calm (`GRADE.knee`, `HOT`, `calm`) so only what burns is strong. The view is bent (`BEND` in `src/core/layout/room.ts`; `projectPoint` and `lookThrough` stay inverses so buttons, sprites and hung pictures land where painted; B of A/B/C was chosen, C is about 1.8 times `BEND` and the leans); nothing stands plumb (`Lean`, `Leant` shape, `ROOM.leans`, button boxes follow). The windows show the island as flat pixel art from the shared palette (`keri/roomView.ts`: navy night with stars and moon, a fat lit lighthouse in the left window, level horizon); furniture follows the 1991 manner (pot-bellied stove, thick-topped piano with two candles, spindle chair, ball-topped bedposts), the foreground firewood is replaced by stacks of the warden's music (`keri/roomPapers.ts`: thin bent sheets, hand-written, a bar struck out in red), windows and door have fat dark frames, a thing that never moves (the mug) is painted into the set, and the gramophone is gone: `ROOM_OBJECTS` is the piano, the door and the easel (the stand opens the other trainers, ft_1_08.AC11); the chest stays as no button. The stove's glass door is swapped for a barred one (`docs/keri.md` section 9). Art-direction rules 3, 11 and 26 apply.

Check: `src/core/layout/room.test.ts` "the view is bent as a hand draws a room"; `src/core/layout/room.test.ts` "a button lies round its thing as the thing leans"; `src/game/ui/pixel/keri/roomView.test.ts` "the sea windows show sky over a level horizon and sea under it, at every hour"; `src/game/ui/pixel/keri/roomPapers.test.ts` "every page carries a bar that was struck out and written again in red ink"

## d130

**Screens that are not painted places lie on the warden's walnut desk, with parchment card, open book, card catalogue, scroll and door in place of the felt and vine.** Features: ft_1_08, ft_1_02c, ft_1_07, ft_1_15, ft_1_10, core_06.

`PixelScene.sky()` paints the desk (`paint/desk.ts`) and the toolbar sits on a rafter (`paintBeam`); a painted place paints over it. A scene that writes on paper sets `inkWriting` (labels through `inkOf`, buttons in the `ink` look); results, ear trainer and credits are on a parchment card (`paint/card.ts`), the song list, a piece's parts and settings in an open book (`paint/book.ts`, shows only pieces that are on). Turning pieces on and off is a card catalogue of drawers by first letter (`paint/cabinet.ts`, `core/layout/libraryDrawers.ts`, ft_1_02c.AC7; empty drawer: blank front, no tap), the name is typed on the menu scroll with the computer's keys too, Kiur's door is a painted door ajar (`paint/door.ts`), and the corner vine is gone from screens (art stays in `vineArt.ts`). Changes the ground of d088.

Check: `src/core/layout/libraryDrawers.test.ts` "puts every piece in exactly one drawer of at most five, the drawers in order"; `src/core/layout/libraryDrawers.test.ts` "puts every drawer front inside the cabinet without two touching"

## d142

**Figures are built on one template character, a layered body with states, assembled per character or generated from a feature set.** Features: ft_1_24, ft_1_22.

The painter makes one template character with states idle, talk, play, listen, walk in swappable layers (head and face, hair, clothes, held thing, palette ramps for skin, hair and clothes). A named character is the template with its own layers and new layers only where needed; a non-figure (the bonfire's voice) is off the template; walkers and passing visitors are generated from the feature set with the seeded daily random, and the map uses a small version. `ActorDef` takes either a `sheet` or a `template` with chosen features.

Check: `src/core/scene/actorRuntime.test.ts` "takes exactly one of a sheet and a template"; `src/game/ui/pixel/actors/figure.test.ts` "generates islanders from the feature set, never a ghost, a held thing or a pocket"

## d144

**The template character is cast on MI2's grid: 2 x 2 fine-pixel blocks, no outline, five-tone ramps, lit by the scene's hour.** Features: ft_1_24, ft_1_21.

A figure is a puppet of few shapes per layer posed by two-bone limbs and cast on blocks of 2 x 2 fine pixels (`FIGURE_GRID`, MI2's 320-wide grid), face by hand (one pixel per eye and mouth). No line round the figure: each material is a five-tone ramp (deep, dark, mid, light, high) lit from the upper front, shaded edge in deep, with contact shadows (replaces sprites.md's outline for figures only). Body shape A (head 18, leg 36 fine pixels at size 1) drawn at a standing place's size, never bitmap-scaled; figures take the hour light through `lit` (keriPalette.ts); code in `src/game/ui/pixel/actors/`, `npm run art:render -- figures [hour]`. Builds on d142.

Check: `src/game/ui/pixel/actors/figure.test.ts` "makes five tones round the mid, from deep to high"; `src/game/ui/pixel/actors/figure.test.ts` "takes the scene"; `src/game/ui/pixel/actors/figure.test.ts` "is drawn at a standing place"

## d145

**The teacher's screens are written in a green school register, and the academic hat is a painted mortarboard on the menu's scroll.** Features: ft_1_26, ft_1_07.

The four teacher screens are the song book's open book (d130) bound in bottle-green cloth (`REGISTER_PALETTE`), laid over the main area (`PixelScene.register`, `core/layout/register.ts`, `paint/register.ts`), ruled like a class register and written in ink; names and dates on the left page, marks on the right; they keep the toolbar and have no band. The hat is a painted mortarboard (dark board, gold tassel, `hatPicture`) at `mainMenuLayout().hat` between keyboard and gear, the keyboard shrinking to five keys. Paper and cloth use flat tones with lone specks, not an ordered dither. ft_1_26.AC7 names the register.

Check: `src/game/ui/pixel/paint/register.test.ts` "is the song book bound in green: the same places, another cover"; `src/game/ui/pixel/paint/register.test.ts` "is a dark mortarboard with a gold tassel"; `src/core/layout/mainMenu.test.ts` "ft_1_26.AC1 the academic hat lies between the piano and the gear"

## d154

**The student is drawn as a child of about three heads on the template: pick A.** Features: ft_1_24, ft_1_22.

The feature `age: child` gives the player's body `BODY_CHILD` (head 18 like a grown-up's but rounder, torso 16, leg 20 fine pixels at size 1: about three heads and two thirds of body A's height, as a young student beside a grown-up) and a child's face: a snub nose whatever `nose` says, eye, nose and mouth set 0.2 head radii lower under a big skull, one rosy cheek pixel, never a beard or a stoop; the shaded hair is one deep tone of its own colour and the skin never takes its deepest tone (art review 1: near-black slabs on a small round head). Same grid, ramps, states and hour light as d144. The student's actor is `content/actors/student.json`, in a sailor's striped shirt and a red hat: a navy-on-off-white striped sailor shirt (`top: striped`, every other grid row of the top and sleeves in the trim) and a red knitted stocking cap whose tip flops back behind the head (`headwear: stocking`, our own shape: no brim, no bobble); proportions B (about 2.5 heads) and C (about 3.8) were shown and not chosen. Builds on d144.

Check: `src/game/ui/pixel/actors/figure.test.ts` "draws a child about two thirds of a grown-up"; `src/game/ui/pixel/actors/figure.test.ts` "gives a child a child"; `src/game/ui/pixel/actors/figure.test.ts` "draws a striped top in rows of its trim, sleeves too, and a stocking cap past the back of the head"

## d156

**What is organic in a painted place moves live, seeded by the day, on one wind: water, fire, beam, fish, gulls, sparks, fireflies and spray.** Features: ft_1_19, ft_1_18, ft_1_07.

The painter records where water may shimmer and the game lights it (`paint/live.ts`, `liveWater.ts`); swimmers, flames, the beam, flocks (`flock.ts`, boids) and glowing motes (`motes.ts`) are worked out from the time and the day's seed, never from dice at run time, and all read one wind whose gusts cross the picture (`windField.ts`). Motes may glow softly over the pixel art (soft modern sparks and fireflies over 1990s pixel art suit the look), except a fire's sparks, which are sharp dots; shaders stay out until a modest laptop needs them. Why: painted loops visibly step and repeat, so motion follows natural laws with organic randomness. Every scene considers these details: painted things the wind or water moves are painted once and bent by the game (`sway.ts`), steam and a sleeper's letters are drawn live (`wisps.ts`), and every scene must say what lives in it, kind by kind (`sceneLiving.ts`, checked by a test). Rules in `docs/art-direction.md` rule 17.

Check: `src/game/adventure/sceneLiving.test.ts` "each list answers every kind: what moves there, or none and why"; `src/game/ui/pixel/windField.test.ts` "another day has its own gusts"; `src/game/ui/pixel/sway.test.ts` "every pixel of the thing is drawn at every moment, inside its box: it bends, it never tears or loses a part"; `src/game/ui/pixel/motes.test.ts` "sparks are sharp dots that rise nearly straight"

## d171

**Painted places aim at about 70% of the 1991 Monkey Island 2 manner, never realistic; figures go as close to MI2's people as can be without copying.** Features: ft_1_18, ft_1_19, ft_1_24.

The quirk dial is set at about 70 of 100 (the pictures then stood at about 10 to 15): never realistic, quirky is good. So every scene and repaint keeps Keri's real layout (d108) but is pushed hard toward wonky, leaning, chunky shapes in flat bands, contours and slightly oversized things ([art-direction.md](../art-direction.md) section 1). Characters follow MI2's manner as closely as possible, past the scenes' dial (d144). The approach only, never MI2's art (d084, d111).

Check: untestable: taste (the quirk dial), judged by the maintainer and the art review

## d172

**Every picture that shows the lighthouse draws it big and grand.** Features: ft_1_18, ft_1_19, ft_1_07.

The lighthouse is fatter and indomitable, and painted grand in every scene: a fat pale limestone drum, a rust-red iron column, a railed gallery and the lantern, larger than to scale wherever it is in view (the map draws it 3.3 times, d125). It is a departure listed in `docs/keri.md` section 9; a scene that does not face it need not show it.

Check: `src/game/ui/pixel/keri/mapPicture.test.ts` "the lighthouse stands up from its place, red iron over a pale stone foot, taller than any house"; `src/game/ui/pixel/keri/roomView.test.ts` "the lighthouse stands big in the left wall"

## d173

**Each material has one model scene or MI2 picture that every scene follows, checked against the atlas from time to time.** Features: ft_1_19.

Provisional picks: stones follow the docks; grass, bushes and foliage the knoll; light and heat the docks' lantern, checked against the atlas (Woodtick); slab paths the Phatt cottage's cobbles and footpaths the Booty hut's sandy path, Keri keeping its concrete painted worn; the sea and jetty wood the Phatt dock. The picks are checked against the atlas from time to time (each art review, d122, lists them); the room is judged for overall style only. Recipes in `projects/painter/artists-notes/`, kit types in d124; sky, ink line and buildings are not picked.

Check: untestable: the picks are checked against the atlas by art review, a matter of taste

## d174

**Sky and background are butter smooth; grain and pixel-art crispness lie only on things.** Features: ft_1_19.

A grainy sky looks sore: the sky and background are smooth as in MI2, the details and buildings pixel art. An outdoor sky is a long run of small steps (`scenePalette(own, use, { sky: 3 })`), one tone to a row, with no dither and no grain, and the open water takes no grain; stone, wood and plants keep it (art-direction rule 12). The north docks' grained sky and the other scenes are still to follow (`TODO(painter, R2)` in `docs/keri/scene-port.md`).

Check: `src/game/ui/pixel/keri/keriPalette.test.ts` "a scene may ask for a smoother sky: its run has no step of lightness over what was asked"; `src/game/ui/pixel/keri/terracePicture.test.ts` "what lies behind is smooth"

## d175

**The southern harbour is a big heavy stone quay seen from west to east, with only the pier, water and visitors' boats, and a world under the water.** Features: ft_1_19.

No coast is visible; the pier is much larger and heavier, boats land on its far side, and the view holds only the pier, the water and the visitors' boats. The view is two stages, the pier, and below it, opened by pressing the water, a rich underwater world in MI2's most quirky and inventive manner (invented corals, round arches crossing the waterline, a locked treasure chest). The boats are our own in MI2's manner, never copies; for now the galley is the teacher's boat; a small lower landing reaches the waterline for smaller boats. Notes in `docs/keri/scene-port.md`.

Check: `src/game/ui/pixel/keri/portPicture.test.ts` "the two views meet: above the water the view under it is the view on top as it stands"; `src/game/ui/pixel/keri/portPicture.test.ts` "the quay stands on arches whose tops show above the water"

## d176

**The terrace is the village plaza: a deck on piles over the beach with wooden rails and a small watchtower, no boat, and torches lit at night.** Features: ft_1_19.

The terrace has more features than the real one and reaches further out over the beach; it is a deck with character, no boat, thick wooden handrails, a roofed section that may be a small watchtower to about the second floor with a fixed telescope, and torches at night, because it is the village plaza. So it is furnished as the island's gathering place, with no set piece the maintainer did not ask for, and no path or stair from the terrace down to the waterfront (the map); later scenes of the house (the right wing toward the lighthouse, then the facade) keep it the plaza. Notes in `docs/keri/scene-terrace.md`.

Check: `src/game/ui/pixel/keri/terracePicture.test.ts` "a watchtower stands on the head"; `src/game/ui/pixel/keri/mapPicture.test.ts` "nothing leads from the terrace to the water: no planks on the sea before it"

## d177

**Meeting a character: the line floats over the speaker's head in their own colour, the tug is a rope board in the band, and Puuvaim is a burl face only there when available.** Features: ft_1_21, ft_1_22.

Picks from sketches: the conversation take A2 (MI2's manner in the band's warm colours, outlined lines in each speaker's colour with no box, the student's choices listed in the band); the tug board take B (a dark board with a hemp rope between the student's token and the character's face, a red rag pulled toward who won the exchange); Puuvaim take B (an old burl with a lichen beard on the knoll's tree), who shows only when he is available and otherwise the tree is just a tree. The rules in ft_1_22 (Look) and ft_1_21 (In the scene).

Check: `src/game/ui/pixel/talkArt.test.ts` "a spoken line is its colour inside a one-pixel ink outline, and nothing else (no box)"; `src/game/ui/pixel/tugArt.test.ts` "the board fills the band and carries the rope from token to token"

## d178

**The circle of fifths is a ship's helm whose rim is the ring of counts.** Features: ft_1_28.

The ship's helm was picked of three sketches; its rim is too thick to hold every element, so the counts stand on brass plates in the rim itself and add no girth; the piece's key has a shape as well as a colour (a red bow). The look in ft_1_28.

Check: `src/game/ui/pixel/circleArt.test.ts` "ties a red rag on the rim at the piece"; `src/game/ui/pixel/circleArt.test.ts` "gilds the chosen cell, and only it"

## d223

**Reference pictures (photographs of Keri, screenshots of other games, review and comparison sheets) never go into git, a pull request or an issue; git keeps only words about them.** Features: none.

They stay in the gitignored `private/painter/` folder on the machine that studies them, each batch with a note of where it came from; a game's picture is studied for its approach and never copied, traced or named in the game (`docs/architect/painter-project.md` rule 6, `study-a-picture`, `art-review` and `paint-a-scene` skills, d122, d181).

Check: `tools/docs/privacy.test.ts` "fails a binary file outside the allowed kinds, and leaves allowed ones alone"

## d224

**Painting code imports neither Phaser nor the DOM, and unit tests call the painters directly and never load `virtual:keri-pictures`.** Features: none.

This holds for `src/game/ui/pixel/paint/`, `src/game/ui/pixel/keri/` and the plans in `src/core/layout/`, because the build paints in Node (`tools/vite-keri.ts`, d111); it is a convention until the lint rule planned in `docs/architect/painter-project.md` section 7 exists.

Check: untestable: a convention with no lint rule yet; a slip shows only as a failed build

## d225

**Every reference picture is studied beyond what was asked, and what it teaches is written in words in the scene's file under `docs/keri/` or the painter's vocabulary.** Features: none.

First check whether it was seen before; describe only what painting needs, with no faces, names, house numbers, number plates or anyone's home (`docs/art-direction.md` rule 15, `study-a-picture` skill, d181).

Check: untestable: a study habit of the painter

## d226

**A painted place is composed as a stage set, with no golden ratio and no rule of thirds, after studying ten or more real examples of what it shows.** Features: none.

The main thing near the middle (0.4 to 0.6 of the width), a smaller second thing to one side, dark wings on at most two edges and optional, the horizon at the viewer's eye height between about 0.35 and 0.65 and never on the middle row; `npm run art:check` draws the guides (`docs/art-direction.md` rules 21 and 22, `paint-a-scene` skill).

Check: untestable: composition guidance checked by eye on the art:check guides, not a failing test

## d227

**What `docs/art-direction.md` section 8 lists as tried and turned down is not tried again unless the maintainer asks.** Features: none.

A turned-down idea that comes back in a picture is a finding for the art reviewer (`.claude/agents/art-reviewer.md`).

Check: untestable: taste, judged by the art review and the maintainer

## d228

**A picture counts as done only after the maintainer has seen it at the laptop's screen size, at every hour it has, beside the picture it replaces, with the art review and the beside-MI2 sheet next to it.** Features: none.

Before showing, the painter paints it with `npm run art:render`, measures it with `npm run art:check`, takes the in-game screenshot, sends a few seconds of it moving, and runs the checks of `docs/art-direction.md` section 5; the verdict is written as a plain rule in the scene's file under `docs/keri/` and, when it changes a rule, in `docs/art-direction.md` (`docs/architect/painter-project.md` rule 2, `paint-a-scene` skill section 4, d122, d183).

Check: untestable: the maintainer's look is a human step

## d229

**No label reaches past its button's frame and no pixel-font text runs off the screen, in either language.** Features: none.

`PixelButton.labelFit` says how far the letters reach past the two-pixel frame, and the end-to-end check walks every screen (`docs/sprites.md` section 1).

Check: `tests/e2e/button-fit.spec.ts` "every label fits inside its button on the menu, settings, pieces, credits, main menu, room, and editor screens"; `src/game/ui/pixel/art.test.ts` "puts a label past the frame by how far its letters reach over the two-pixel border"

## d230

**Every colour ramp of the game palette lightens in order, and its mid shade stands out from the ink outline, the backdrop and the wood of the screens.** Features: none.

The test asks for a contrast of at least 3 against `ink` and an RGB distance of at least 60 from the backdrop, ground and screen wood; a new colour is original and gets a row in `docs/assets.md` (`docs/sprites.md` section 3.1).

Check: `src/game/ui/pixel/art.test.ts` "lightens every ramp in order, dark to light"; `src/game/ui/pixel/art.test.ts` "sets every mid shade off from the ink outline, the stage backdrop and the ground, and from the wood of the screens"

## d231

**Where a piece is read and played, no picture makes the notes harder to read: a frame may be painted round the staff, nothing over the notes, and the parchment under them stays pale and quiet.** Features: ft_0_05.

From AX-0 and `docs/art-direction.md` rule 18 and section 10: no mark, fold or stain that could read as a staff line, the dark rim and foxing at the edge only (d119).

Check: `src/game/ui/pixel/paint/parchment.test.ts` "keeps the skin pale where notes are written"; `src/core/layout/sheet.test.ts` "narrows a strip so the torn edge stays clear of the ink"

## d245

**When grain is asked for, the painter first asks which is meant before changing a picture.** Features: none.

Grain has more than one meaning here: the scanned-paint grain on things (`docs/art-direction.md` rule 12, `paint/grain.ts`) and the smooth sky and background that carry none (d174).

Check: untestable: a question the painter asks, not a property of a picture

## d246

**The house on Keri is painted as several scenes, in order: first the right wing looking east toward the lighthouse, then the facade.** Features: ft_1_19.

Each is its own scene and pull request (`docs/keri/scene-terrace.md`, d183).

Check: untestable: an order of painting work

## d251

**Scenery motion is smooth, never stepped: sky and sea move without extra painted frames, the ground stays still and plants sway only a little.** Features: ft_1_19.

Stepped scenery at a few frames a second is not used; the game moves sky and sea from one picture, so memory does not grow with each scene. A lamp's or oven's flicker changes smoothly, without jumps. Works with d156 and d174.

Check: `src/game/ui/pixel/windMotion.test.ts` "looks that dissolve into each other (the stepped scenery was choppy)"

## d252

**The garden scene is paused; its next round is a full rework that starts by asking the maintainer what to change.** Features: ft_1_19.

No passes or pushes on the garden until the maintainer reopens it. The closed garden branch is material to reuse, not a draft to refine.

Check: untestable: a pause on painting work

## d253

**The north docks' lookout has no legs and sits directly on the rock; its floor is meant to become a later scene of its own.** Features: ft_1_19.

The hut is a lookout, not a dwelling, and its floor is the stone it stands on; a later scene inside it keeps that floor (`docs/keri/scene-docks.md`).

Check: untestable: a shape in a painted picture, judged by the art review

## d254

**No scene paints a woodpile, and the knoll has no ledge face.** Features: ft_1_19.

Both were taken out of the knoll and stay out of every picture; the knoll rises gently as a plateau (`docs/keri/scene-knoll.md`).

Check: untestable: things absent from a painted picture, judged by the art review

## d255

**Kiur gets an outline only in the interface, never inside a painted picture.** Features: ft_0_13, ft_1_15, ft_1_08, ft_1_18.

Inside a painted place Kiur is painted like everything else in it (d111); the contour belongs to the interface's sprites (d114).

Check: untestable: how a sprite is drawn in a picture, judged by the art review

## d256

**New live-motion candidates are kept only after the maintainer has looked at them on the machine the game is played on.** Features: ft_1_19.

What moves in a scene (d156) is judged on the machine the game is played on (CLAUDE.md, Stack), not only in cloud recordings; until then a candidate stays a tag in `projects/painter/artists-notes/living-things.md`.

Check: untestable: a look on the real machine

## d266

**A gauge score is never a reason to add something the eye did not ask for.** Features: none.

The atlas gauge (`refcat.py gauge`) and `art:check` measure; what goes into a picture is decided by looking (art direction section 5) and by the scene's rules, not by raising a number.

Check: untestable: a painting judgement, held by the art review

## d285

**Every choice the player picks from shows a picture, never a word; its words are in the tooltip.** Features: ft_1_32, ft_0_16.

A choice is a button among others that sets or picks something (a setting, a question with answers). Its picture shows the choice the way the student meets it in play, as the settings pictures do (`src/game/ui/pixel/settingArt.ts`); its name stays the button's tooltip and what tests read. Choices still drawn as words are changed when their screen is next worked on.

Check: `src/game/ui/pixel/settingArt.test.ts` "every choice of %s has a picture of the same size, and no two choices look alike"
