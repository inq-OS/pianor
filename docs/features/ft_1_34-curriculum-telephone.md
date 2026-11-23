---
id: "ft_1_34"
title: "The telephone: the teacher's new piece calls the student to learn it"
scope: "An old wall telephone in the room rings while the teacher's curriculum holds a piece whose learning has not begun; pressed, it opens that piece in bar-by-bar learning (ft_1_32)"
effort: "simple"
status: "built: the call's rule, the builder's first picture on the room's wall with its ringing look, the press that opens the learning, with unit and end-to-end tests; open: the painter's picture in the room and a ring that is heard"
completeness: 70
depends_on: ["ft_1_32", "ft_1_26"]
---
# ft_1_34: The telephone

The teacher gives a piece on the curriculum ([ft_1_26](ft_1_26-teachers-screen.md)); the old wall telephone in the room rings, and a press on it opens the piece to be learned bar by bar ([ft_1_32](ft_1_32-learn-a-piece-bar-by-bar.md)). Decision: [d279](../decisions/game.md#d279). Index: [FEATURES.md](FEATURES.md).

AX-0: the call leads straight to reading and playing the teacher's piece. AX-2: the ring is a fact (a new piece), never praise.

## Rules

1. **The call** (`phoneCall` in `src/core/curriculum/phoneCall.ts`): the telephone rings while the curriculum holds a piece the game has, not learned and whose learning has not begun; the call is about the one due first, the higher priority on the same day. With no new piece it does not ring, and a press picks up the most urgent piece still being learned. With every curriculum piece learned it is quiet: a press makes Kiur say so.
2. **The press** opens the call's piece on the practice screen in learning (`PracticeData.learn`), as Kiur's Learn does.
3. **Where it hangs:** on the bricks of the room's right wall beside the stove's pipe (`ROOM.phone`, `roomPlan().phone`). `AX-3 provisional:` the builder's first picture (`phoneArt.ts`) laid over the painted room, its bells shaken in turn while it rings; no sound.

## Acceptance criteria

- **ft_1_34.AC1** The telephone rings while a curriculum piece's learning has not begun, and is quiet with no curriculum or once every piece in it is learned.
- **ft_1_34.AC2** The call is about the new piece due first (the higher priority on the same day); with none new, the most urgent piece being learned, without a ring; a piece the game does not have never calls.
- **ft_1_34.AC3** The telephone hangs on the room's wall in its place and shows a ringing look; a press opens the call's piece in learning.

## TODO

- TODO(painter, R2): paint the telephone into the room's picture in the house manner, its ringing look as a second look (`phoneArt.ts` is the builder's sketch).
- TODO(builder, R2): a ring that is heard, short and soft, once per visit while it rings (AX-2: stimulation may be added).
