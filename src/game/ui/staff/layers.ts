/**
 * The staff's drawing layers, bottom to top: the paper, then the highlight boxes, then the staff lines
 * (and ledger lines), the notes and the playhead. The highlight sits under the lines so they always show through it, and so
 * do the note duration helper (ft_1_11), whose band and ghost heads never cover a line or a note, and the beat lane
 * (core_13 rule 2), whose dots never cover a note between the staves.
 * `StaffView` creates its graphics in this order; creation order is draw order.
 */
export const STAFF_LAYERS = ['paper', 'highlight', 'duration', 'lane', 'lines', 'notes', 'playhead'] as const;

export type StaffLayer = (typeof STAFF_LAYERS)[number];
