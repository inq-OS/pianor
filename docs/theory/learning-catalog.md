---
title: "Everything there is to learn"
---
# Everything there is to learn

The full list of what a piano student can learn, whether Pianor teaches it yet or not ([d303](../decisions/game.md#d303)). The lesson book of [ft_1_39](../features/ft_1_39-theory-lessons.md) shows every row: a written lesson as a lesson, the rest as a ghosted placeholder with its name only, so the student and the maintainer see what is covered and no topic is forgotten. A new topic is added here as a row; a topic is never deleted because it is not built yet.

**Status** (what the game can do for the topic today):

| Status | Meaning |
|---|---|
| trained | a screen of the game already trains it (the column Where names it) |
| drawn | the staff and the game support it, so a lesson can be written now |
| needs drawing | the staff cannot draw it yet; its lesson waits on [core_09](../features/core_09-notation-growth.md) |
| needs a feature | needs more than notation (listening tasks, measuring touch, a new screen) |
| idea | wanted, nothing planned yet |

Ids are `<area letter><number>` and stay fixed once given; a lesson in the content names the id it teaches.

## A. The keyboard

| Id | Topic | Status | Where |
|---|---|---|---|
| A1 | Black keys in groups of two and three | drawn | |
| A2 | White key names (with H, by the B or H setting) | trained | note-name trainer (ft_0_17) |
| A3 | Octaves and registers, high and low | drawn | |
| A4 | Middle C and the keyboard's range | drawn | |
| A5 | Finger numbers 1 to 5 | drawn | finger numbers on the staff |
| A6 | Hand positions (C, G, middle C position) | drawn | |

## B. Reading the staff

| Id | Topic | Status | Where |
|---|---|---|---|
| B1 | Lines and spaces | trained | note-name trainer |
| B2 | Treble clef | trained | note-name trainer |
| B3 | Bass clef | trained | note-name trainer |
| B4 | The grand staff | drawn | practice (ft_0_15) |
| B5 | Ledger lines | trained | note-name trainer |
| B6 | Landmark notes | drawn | |
| B7 | Reading by steps and skips | drawn | |
| B8 | Reading chords on the staff | drawn | |
| B9 | Two voices in one hand | drawn | |
| B10 | Clef changes inside a piece | needs drawing | |
| B11 | Octave signs 8va, 8vb, 15ma | needs drawing | |
| B12 | Alto and tenor clefs | idea | |

## C. Rhythm and meter

| Id | Topic | Status | Where |
|---|---|---|---|
| C1 | Pulse and beat | trained | metronome, Tempo mode (core_01, core_02) |
| C2 | Whole, half, quarter, eighth, sixteenth notes | drawn | |
| C3 | Rests | drawn | |
| C4 | Dotted notes | drawn | dotted half, quarter and eighth |
| C5 | Double-dotted notes | needs drawing | |
| C6 | Ties | drawn | |
| C7 | Thirty-second notes | needs drawing | |
| C8 | Time signatures 2/4, 3/4, 4/4 | drawn | |
| C9 | Cut time 2/2 | needs drawing | |
| C10 | Compound meter 6/8, 9/8, 12/8 | needs drawing | |
| C11 | Counting aloud | needs a feature | |
| C12 | Pick-up bars | drawn | |
| C13 | Syncopation | drawn | |
| C14 | Triplets | drawn | |
| C15 | Other tuplets (duplets, quintuplets) | needs drawing | |
| C16 | Swing feel | needs a feature | |
| C17 | Two against three | drawn | |
| C18 | Odd meters (5/4, 7/8) | needs drawing | |
| C19 | Meter changes inside a piece | needs drawing | |
| C20 | Beaming | drawn | |

## D. Pitch and accidentals

| Id | Topic | Status | Where |
|---|---|---|---|
| D1 | Half steps | drawn | |
| D2 | Whole steps | drawn | |
| D3 | Sharps, flats and naturals | drawn | |
| D4 | An accidental lasts to the bar line | drawn | |
| D5 | Enharmonic names | drawn | |
| D6 | Double sharps and double flats | drawn | |
| D7 | Courtesy accidentals | needs drawing | |
| D8 | The chromatic scale | drawn | |

## E. Scales and keys

| Id | Topic | Status | Where |
|---|---|---|---|
| E1 | The major scale pattern | trained | scales and chords trainer (ft_1_29) |
| E2 | All twelve major scales | trained | scales and chords trainer, scale switcher |
| E3 | Key signatures with sharps | trained | circle of fifths (ft_1_28) |
| E4 | Key signatures with flats | trained | circle of fifths |
| E5 | The circle of fifths | trained | circle of fifths |
| E6 | Scale degree names (tonic, dominant and the rest) | drawn | |
| E7 | Relative minor | trained | circle of fifths |
| E8 | Parallel minor | drawn | |
| E9 | Natural minor | trained | scales and chords trainer |
| E10 | Harmonic minor | drawn | |
| E11 | Melodic minor | drawn | |
| E12 | Major and minor pentatonic | drawn | |
| E13 | The blues scale | drawn | |
| E14 | The modes (Dorian to Locrian) | drawn | |
| E15 | Whole-tone scale | drawn | |
| E16 | Key changes inside a piece | needs drawing | |
| E17 | Transposing | drawn | |

## F. Intervals

| Id | Topic | Status | Where |
|---|---|---|---|
| F1 | Interval numbers (second to octave) | drawn | |
| F2 | Major and minor intervals | drawn | |
| F3 | Perfect intervals | drawn | |
| F4 | Augmented and diminished intervals, the tritone | drawn | |
| F5 | Compound intervals | drawn | |
| F6 | Inverting an interval | drawn | |
| F7 | Consonance and dissonance | drawn | |
| F8 | Intervals by ear | trained | ear trainer (ft_1_10), two notes |

## G. Chords

| Id | Topic | Status | Where |
|---|---|---|---|
| G1 | Major and minor triads | trained | scales and chords trainer |
| G2 | Diminished and augmented triads | trained | chord namer |
| G3 | Inversions | trained | chord trainer (any inversion) |
| G4 | Chord symbols | trained | chord from its name |
| G5 | Dominant seventh | trained | chord trainer |
| G6 | Major seventh | trained | chord trainer |
| G7 | Minor seventh | drawn | |
| G8 | Half-diminished seventh (m7b5) | trained | chord namer |
| G9 | Diminished seventh | trained | chord namer |
| G10 | Suspended chords (sus2, sus4) | drawn | |
| G11 | Sixth and add9 chords | drawn | |
| G12 | Ninth, eleventh and thirteenth chords | drawn | |
| G13 | Slash chords | drawn | |
| G14 | Broken chords and arpeggios | drawn | |
| G15 | Voicing a chord | drawn | |
| G16 | Arpeggiated chord sign | needs drawing | |

## H. Harmony

| Id | Topic | Status | Where |
|---|---|---|---|
| H1 | Chords of a key and Roman numerals | drawn | |
| H2 | The primary chords I, IV, V | drawn | |
| H3 | Cadences (perfect, plagal, imperfect, interrupted) | drawn | |
| H4 | The dominant seventh and where it goes | drawn | |
| H5 | Common progressions (I V vi IV, ii V I) | drawn | |
| H6 | The twelve-bar blues | drawn | |
| H7 | Non-chord tones (passing, neighbour, suspension) | drawn | |
| H8 | Secondary dominants | drawn | |
| H9 | Borrowed chords | drawn | |
| H10 | Neapolitan and augmented sixth chords | drawn | |
| H11 | Voice leading | drawn | |
| H12 | Harmonising a melody | drawn | piece maker (ft_1_02) |
| H13 | Accompaniment patterns (Alberti bass, waltz, stride) | drawn | |
| H14 | Playing from a lead sheet | needs drawing | |
| H15 | Figured bass | idea | |

## I. Articulation and touch

| Id | Topic | Status | Where |
|---|---|---|---|
| I1 | Legato and the slur | drawn | legato judged in Tempo mode (core_09) |
| I2 | Slur and tie told apart | drawn | |
| I3 | Staccato | needs drawing | |
| I4 | Accent | needs drawing | |
| I5 | Tenuto | needs drawing | |
| I6 | Marcato, staccatissimo, portato | needs drawing | |
| I7 | Phrase marks | drawn | |

## J. Ornaments

| Id | Topic | Status | Where |
|---|---|---|---|
| J1 | Grace notes | drawn | |
| J2 | Appoggiatura | needs drawing | |
| J3 | Mordent, upper and lower | needs drawing | |
| J4 | Trill | needs drawing | |
| J5 | Turn | needs drawing | |
| J6 | Glissando | needs drawing | |

## K. Dynamics, tempo and expression

| Id | Topic | Status | Where |
|---|---|---|---|
| K1 | Dynamics pp to ff | drawn | shown, not judged (d101) |
| K2 | Crescendo and diminuendo | needs drawing | |
| K3 | Sudden accents (sf, sfz, fp) | needs drawing | |
| K4 | Tempo words (Largo to Presto) | needs drawing | |
| K5 | The metronome mark | drawn | tempo of every piece |
| K6 | Ritardando, accelerando, a tempo | needs drawing | |
| K7 | Fermata | needs drawing | |
| K8 | Rubato | idea | |
| K9 | Character words (dolce, cantabile, maestoso) | needs drawing | |
| K10 | Playing loud and soft on purpose | needs a feature | key velocity, after the hardware spike |

## L. Pedals and keyboard signs

| Id | Topic | Status | Where |
|---|---|---|---|
| L1 | The sustain pedal and its marks | needs drawing | |
| L2 | Una corda | needs drawing | |
| L3 | Hand signs (m.d., m.s.) and crossing hands | needs drawing | |

## M. The road map of a score

| Id | Topic | Status | Where |
|---|---|---|---|
| M1 | Repeat signs | drawn | |
| M2 | First and second endings | drawn | |
| M3 | D.C. al Fine | needs drawing | |
| M4 | D.S. al Coda and the coda | needs drawing | |
| M5 | Bar repeat and multi-bar rests | needs drawing | |
| M6 | Simile | needs drawing | |

## N. Melody and form

| Id | Topic | Status | Where |
|---|---|---|---|
| N1 | Motif and phrase | drawn | |
| N2 | Question and answer | drawn | phrases traded with characters (ft_1_21) |
| N3 | Sequences | drawn | |
| N4 | Binary form AB | drawn | song pages (ft_1_36) |
| N5 | Ternary form ABA | drawn | song pages |
| N6 | Rondo | drawn | |
| N7 | Theme and variations | drawn | |
| N8 | Verse and chorus | drawn | |
| N9 | Sonata form | idea | |

## O. Ear

| Id | Topic | Status | Where |
|---|---|---|---|
| O1 | Finding a heard note | trained | ear trainer |
| O2 | Two heard notes | trained | ear trainer |
| O3 | Major or minor by ear | needs a feature | |
| O4 | Chord qualities by ear | needs a feature | |
| O5 | Cadences by ear | needs a feature | |
| O6 | Playing back a heard rhythm | needs a feature | |
| O7 | Playing back a heard melody | needs a feature | |
| O8 | Meter by ear | needs a feature | |
| O9 | Playing a tune by ear | idea | |

## P. Technique

| Id | Topic | Status | Where |
|---|---|---|---|
| P1 | Sitting, hand shape and relaxed arms | idea | |
| P2 | Five-finger patterns | drawn | |
| P3 | Thumb under and finger crossing | drawn | hand-shift arrows (ft_1_30) |
| P4 | Scale fingerings | drawn | automatic fingering (ft_1_30) |
| P5 | Arpeggio fingerings | drawn | |
| P6 | Hands together | trained | practice, grand staff (ft_0_15) |
| P7 | Playing in time with a click | trained | metronome, Tempo mode |
| P8 | Even touch and evenness | needs a feature | |
| P9 | Pedalling legato | needs a feature | |

## Q. Practising and musicianship

| Id | Topic | Status | Where |
|---|---|---|---|
| Q1 | Learning a piece bar by bar | trained | learn bar by bar (ft_1_32) |
| Q2 | Practising a hard spot slowly | trained | section repeat and tempo (core_03), practice analysis (core_10) |
| Q3 | Sight-reading | drawn | |
| Q4 | Playing from memory | trained | recall check (ft_1_32) |
| Q5 | Writing music | trained | piece maker (ft_1_02) |
| Q6 | Improvising over chords | needs a feature | |
| Q7 | Playing with another player | trained | tug with characters (ft_1_21) |

## R. Styles and history

| Id | Topic | Status | Where |
|---|---|---|---|
| R1 | The periods (Baroque, Classical, Romantic, modern) | idea | |
| R2 | Composers of the pieces in the game | idea | |
| R3 | Estonian folk music and regilaul | idea | |
| R4 | Dances (minuet, waltz, march) | idea | |
| R5 | Jazz and blues | idea | |
