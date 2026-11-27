---
title: "The circle of fifths"
---
# The circle of fifths

Index: [THEORY.md](THEORY.md). Built in [ft_1_28](../features/ft_1_28-circle-of-fifths.md); the code is `src/core/layout/circleOfFifths.ts` (the wheel), `src/core/trainer/scaleChart.ts` (a key's scale) and `src/core/editor/key.ts` (key names, the fifths count a piece keeps).

## 1. What it is

Start at C and go up a perfect fifth (seven semitones) twelve times: C, G, D, A, E, B, F#, C#, G#, D#, A#, E#, B#, and B# is C again. Laid round a clock, each step clockwise is a fifth up and each step anticlockwise a fifth down (or a fourth up). The major key of each step has one sharp more than the step before it, or one flat fewer: C has none, G one sharp, D two; F one flat, Bb two. So the circle answers "how many sharps or flats has this key, and which" at a glance, and it shows which keys are close (neighbours share six of their seven notes).

## 2. The signatures

A key signature is written in a fixed order, which is the circle itself:

- **Sharps:** F C G D A E B. G major has F#; D major F# and C#; each new key adds the next sharp, which is the seventh note (leading tone) of the new key.
- **Flats:** B E A D G C F, the sharps backwards. F major has Bb; Bb major Bb and Eb; each new key adds the next flat, which is the fourth note of the new key.

In the code a key is one number, `fifths`, from -7 (seven flats) to 7 (seven sharps), and a mode. `signatureAlter(fifths, letter)` gives the sign the signature puts on a letter.

## 3. Relative minors

Each major key shares its signature with a minor key three semitones (a minor third) lower: C major and a minor, G major and e minor, F major and d minor. On the wheel the minor is on the same step, inside. The natural minor scale uses exactly the signature's notes; the harmonic and melodic minor raise the seventh (and sixth) with accidentals in the music, not in the signature. The circle overlay plays the natural minor because it shows what the signature means (AX-3 provisional in ft_1_28).

## 4. Fifteen keys on twelve steps

There are twelve pitches but fifteen major key signatures, because three steps can be spelled two ways (enharmonic keys, the same keys on the piano):

| Step (clockwise from C) | Sharps spelling | Flats spelling |
|---|---|---|
| 5 | B major, 5 sharps | Cb major, 7 flats |
| 6 (the bottom) | F# major, 6 sharps | Gb major, 6 flats |
| 7 | C# major, 7 sharps | Db major, 5 flats |

Pianor's choices: the bottom step shows both (F#/Gb, sharps first); steps 5 and 7 show the spelling with fewer signs (B, Db) unless the piece on screen is in the other one. The minor ring at the bottom shows d# (or eb for a piece in Gb), as both names do not fit there. A step is `fifths` modulo 12.

## 5. Finding a key from a played note

The tonic of the major key on step `i` is `7 i` semitones above C, so the step of a tonic with pitch class `p` is `7 p` modulo 12 (7 x 7 = 49 = 1 in twelve). A minor tonic is 9 semitones above its relative major's tonic, so its step is `7 (p + 3)` modulo 12. `tonicStep` does this.

## 6. Letter names: B and H

In German and Estonian naming (the player's `H` setting, d087) H is our B natural and B is our B flat. So on the circle with H naming: H major (5 sharps), B major (2 flats), h minor (2 sharps), b minor (5 flats). The other letters do not change on the wheel. Estonian writes keys as "G-duur" and "e-moll": a capital for major, a small letter for minor, as the circle does in both languages. A key's whole name in Estonian with H naming uses the Estonian syllables: the letter and "is" for a sharp, "es" for a flat, with Es, As and B for E flat, A flat and B flat (Fis-duur, Es-duur, B-duur, H-duur, Ces-duur, gis-moll, as-moll); with B naming it keeps the letters (B♭-duur). English stays "F# major". Every key name writes a flat with the flat sign (♭), never a plain b (`keyName` in `src/core/editor/key.ts`).
