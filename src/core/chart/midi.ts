/** MIDI value limits. A note number and a velocity are 7-bit data bytes. Pure: no DOM, no engine. */

/** The highest MIDI data value: the top note number (G9) and the loudest velocity. */
export const MIDI_MAX = 127;
/** The softest real key press. Velocity 0 is a note-off, whatever the status byte says. */
export const MIDI_VELOCITY_MIN = 1;
