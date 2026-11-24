---
id: "ft_Y_06"
title: "Key-light hints"
scope: "Light the next key on the EZ-220 as a hint with a cost; an option to switch it on and to light a key after N wrong presses"
effort: "simple"
status: "rule and save fields built (settings.keyLights, save v11); settings screen and scene wiring open; real lighting needs ft_0_01"
completeness: 50
---
# ft_Y_06: Key-light hints

Release: after the MVP; real lighting needs the ft_0_01 hardware spike.

An optional "show me the next note" help that lights the next key on the EZ-220, costing reward like the other hints (ft_0_10).

- **Verified** (`docs/hardware-notes.md`): notes sent on MIDI channel 1 light the matching keys, **and the keyboard also sounds them**, so a hint would give the answer by ear (AX-0). Before building, check that a note at channel volume 0 (CC 7) or on a silent voice still lights the key. Other channels, velocity and the Light Guide button are untested.
- **Ready today:** the `KeyLightOutput` interface (ft_0_06); the real output is `nullKeyLights`, which does nothing, and the on-screen keyboard shows lit keys.
- **Rule ready:** the "light after N wrong presses" rule is pure and lives in `src/core/judge/keyLightHint.ts` (tested for ft_Y_06.AC2). The scene wiring and the settings are not done yet.

## Rules

Key lighting is an **option**, off by default, with two settings per player (settings screen, ft_0_16; saved in the profile with a tested migration):

1. **Enable** (bool): key lighting on or off.
2. **Light after N wrong presses** (integer; 0 = light the awaited key at once, 1 and up = only after that many wrong presses on the same awaited note; the counter resets when the note is played right; a new profile starts at 2, existing saves keep theirs). Needs the wrong-note events the judge already emits (ft_0_08); the rule "N wrong presses, then a hint" is pure and lives in `core/` (a small helper, unit tested), the scene only forwards it to `KeyLightOutput`.

A lit key is a hint and costs reward like the other hints (ft_0_10, core_07); a light that comes after the N-th wrong press costs **half** the cost of lighting from the start, because the student tried first; the share is adjustable in the admin settings.

## Acceptance criteria

- **ft_Y_06.AC1** With the option off no key is lit; with it on and N = 0 the awaited key is lit on the on-screen keyboard.
- **ft_Y_06.AC2** With N = 2 the awaited key is lit only after the second wrong press on that note, and the count starts again on the next note.
- **ft_Y_06.AC3** The two settings survive a reload and are separate per player.
- **ft_Y_06.AC4** The real EZ-220 lights the key. [human]

## TODO

- TODO(builder, R2): the settings rows: key lights on or off, and "light after N wrong presses" (0 to 3), on the settings screen per player. The fields are already saved (`settings.keyLights`, v11), so no save bump. Text through string keys with Estonian (`write-ui-text`). AC3.
- TODO(builder, R2): wire the practice screen to the rule above: feed the judge's wrong presses into `keyLightHint.ts` and light the awaited key through `KeyLightOutput`; the on-screen keyboard shows it, the EZ-220 output stays `nullKeyLights` until the NEEDS-HUMAN test below. Record `litKey` in the attempt's helps (core_07). AC1, AC2. With the EZ-220 attached the on-screen keyboard hides (ft_Y_12), so until then the hint shows only where the on-screen keyboard does.
- TODO(builder, R2): make the XP rule follow rule 4: a light that came after the N-th wrong press costs **half** of `litKey`'s cost (factor 1 - (1 - 0.6) / 2 = 0.8 with today's table), not 0 new XP as `applyHelpFactors` in `src/core/progression/xp.ts` does now. Test first. If the half cost needs a new help id in the saved attempt, that is a save change (`save-format-bump` skill; the maintainer merges).
- NEEDS-HUMAN: with channel 1 at volume 0, does a lit key on the EZ-220 still light, and does it stay silent? The result goes into `docs/hardware-notes.md` and shapes this feature (a lit key that also sounds gives the answer by ear, AX-0).
