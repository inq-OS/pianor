# Roads and paths

**Model:** two looks from the 1991 game, picked from a sheet of MI2's paths over our crossroads. The pick is cobbled slabs plus earth trails: **slab paths follow the cobbled path at the Phatt cottage (mi2-bg-2-038), footpaths follow the sandy path at the Booty hut (mi2-bg-1-051); Keri keeps its concrete, painted worn.** Not taken: all earth and sand as in MI2 (that would have replaced Keri's concrete), nor our crossroads path as the model. No scene of ours is the model yet: the crossroads paints both kinds and was the first brought to these two looks; it becomes the model when the maintainer says so. Code: the kit, `src/game/ui/pixel/keri/kit/paths.ts` (`paths/slabs`, `paths/trail`), in the kit since the crossroads ([kit.md](kit.md)); the lanes' course stays the scene's, in `crossroadsPicture.ts`.

## Types

Both are fills ([kit.md](kit.md) section 2): a path lies on the scene's ground and clips its grass. They are `candidate`; they are `picked` when the maintainer has seen them on the sheet beside the two MI2 rooms. Each asks a ground of its own, not the grass's slope: `SlabGround` (the path in sections far to near: left and right on the picture, how far along, how wide, slabs per metre) and `TrailGround` (at a pixel: how far off the middle, which side, how far to the end), both a `PathGround` (what is laid, and how to lay). Variants so far: `slabs` `worn`, `trail` `footpath`.

| Type | What it is for | The look | State |
|---|---|---|---|
| `paths/slabs` | Keri's concrete slab paths between the houses, the Y fork at the crossroads | the Phatt cottage's cobbles: pale grey-blue blotchy stones with dark gaps, cut into lit grass | look picked; in the kit, `candidate` |
| `paths/trail` | earth footpaths: round the island, through the rose thicket, off a slab path | the Booty hut's sandy path: warm blotches of sand and earth, pebbles along an edge, widening toward the viewer | look picked; in the kit, `candidate`. Its pale sand is cream from the smoke's and the shingle's pale tones (the crossroads' own lime before), nearer the hut's sand |

Custom: the course of the crossroads' lanes (where the fork lies and how it bends) is the scene's; the kit paints what lies on it.

## Recipe

For both:

1. **A path is a lit plane.** In MI2's day pictures the path is lighter than the grass round it and leads the eye to the main thing; at night it is the pale band that the moon catches.
2. **It winds and widens.** Never a straight strip of even width: a few pixels wide far off and a broad apron at the viewer's feet, its two edges not parallel.
3. **Its edges are eaten by the grass.** Blades and clumps lean in over both edges (the grass recipe's rule 8), the near edge more ragged than the far one; where a path meets a wall or a stone, shade lies in the corner.
4. **A path nobody decided is not painted.** Keri's paths come from the world model (`content/world/keri.json`) and the reference photographs of Keri; an invented path is art-direction rule 14's fault (the knoll's first path was taken out for it).

Slabs (after mi2-bg-2-038):

5. **Stones, not a band.** Each slab is its own blotch: unlike in length and width, corners rounded, a few tilted or sunk. No two alike, and no row of equal rectangles.
6. **Blotchy within one cool pale run:** four or five near tones of grey-blue stone, a slab lighter in its middle and toward its far edge, darker along its near edge; neighbours differ by a tone, so the path is mottled and never one even colour. The smooth even band is the fault to avoid (consistency review 1, finding 4).
7. **Dark gaps between the slabs,** one or two pixels, in the darkest tone of the run or of the earth, not ink; a grass tuft or a moss pixel grows in some.
8. **Cracks** as dark lines one pixel wide across a few slabs; the stone recipe's grain over all of it.

Trails (after mi2-bg-1-051):

9. **Warm blotches, not stripes:** four to six near tones of sand and earth in patches a few pixels across, lighter in the middle where feet go, darker and redder at the edges. No level lines along it.
10. **Crumbs:** single darker pebbles and lighter grains here and there, and a loose line of small stones along one edge where the ground falls away.
11. **It fades into the grass at its far end** in broken patches; it does not stop at a line.

## Atlas

- `find --tags dinky,path` (mi2-bg-4-096 to 4-098): earth paths through the jungle in pink-brown and ochre blotches, leaves hanging over both edges, each path widening toward the viewer.
- `find --tags cottage` (mi2-bg-2-038): a cobbled path as pale grey-blue blotches with darker gaps, cut into lit grass.
- `find --tags mansion,outdoor` (mi2-bg-1-053, mi2-bg-1-054): a broad sandy drive, the lightest plane of the picture, mottled, its edge against the grass soft and wandering.
- `find --tags booty,hut` (mi2-bg-1-051): a sandy path along a shore, pebbles lining its water side.
- `find --tags bonfire`: trodden ground with a ragged grass edge.
- `find --tags town,day`: streets as flat lit planes with cast shade lying across them.

## Keri

- Cracked concrete slab paths run between the houses and fork by the sauna toward the lighthouse (the crossroads); a dotted footpath runs round the island; the ground between the crossroads and the lighthouse is rose thicket with a few paths through and branches arching over. `find --tags path,keri` lists the photographs.

## Where each picture stands

| Picture | Paths |
|---|---|
| Crossroads | brought to the two picked looks: the slabs are blotchy in a cool pale run from the stone's greys up to the smoke's pale, with dark seams and grass leaning in over both edges (rules 5 to 8); the trail is sand and earth with rust and ochre patches (rules 9 to 11). Sheet beside the two rooms: `paths-beside-mi2.png`. Seen beside the cottage: our slabs are greyer and carry none of its blue and green flecks, and the trail is narrower and browner than the hut's sand; whether to go further is the maintainer's word on that sheet. Since the lift the scene paints both through the kit and the trail's sand is cream; the crossroads' kit sheets (on the kit's sheet the trail lies wide on a flat field and reads paler and more ragged than the short branch in the scene) |
| Knoll | no path (none is known); trodden earth round the fire with dry blades leaning in |
| Docks | the plank walk is wood, not a path: see [not-picked-yet.md](not-picked-yet.md) |

## Open

- NEEDS-HUMAN: `paths/slabs` and `paths/trail` are `candidate`: the maintainer's word on the sheet beside mi2-bg-2-038 and mi2-bg-1-051 makes them `picked` or says what to change.
