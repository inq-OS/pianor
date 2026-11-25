/**
 * The staff's drawing layers, bottom to top: the paper, then the highlight boxes, then the staff lines
 * (and ledger lines), the notes and the playhead. The highlight sits under the lines so they always show through it, and so
 * do the note duration helper (ft_1_11), whose band and ghost heads never cover a line or a note, and the beat lane
 * (core_13 rule 2), whose dots lie under the lines and the notes. Over the notes the lane's blink lights a note's
 * head as the wave passes it (core_13 rule 10), and the playhead is on top.
 * `StaffView` creates its graphics in this order; creation order is draw order.
 */
export const STAFF_LAYERS = ['paper', 'highlight', 'duration', 'lane', 'lines', 'notes', 'blink', 'playhead'] as const;

export type StaffLayer = (typeof STAFF_LAYERS)[number];
