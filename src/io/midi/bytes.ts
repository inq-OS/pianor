/** Raw MIDI byte values (MIDI 1.0 channel voice messages). One list for the parser and the virtual keyboard. */

/** Bit 7 set: the byte is a status byte; clear: a data byte. */
export const STATUS_BIT = 0x80;
/** Keeps the message type (high nibble) of a status byte and drops the channel. */
export const TYPE_MASK = 0xf0;
/** Keeps the 7 data bits of a data byte. */
export const DATA_MASK = 0x7f;
/** Message types, channel bits cleared. Channel 1 is `NOTE_ON | 0`. */
export const NOTE_OFF = 0x80;
export const NOTE_ON = 0x90;
/** Sent periodically by the real device; consumers ignore it. */
export const ACTIVE_SENSING = 0xfe;
/** Release velocity the virtual keyboard sends with a real note-off (the MIDI default for "unknown"). */
export const DEFAULT_RELEASE_VELOCITY = 64;
