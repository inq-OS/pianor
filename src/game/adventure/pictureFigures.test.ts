// Covers ft_1_27.AC2: the teacher's galleon is the harbour picture's own boat, and its actor file stands it as the picture moors it.
import { describe, expect, it } from 'vitest';
import galleon from '../../../content/actors/galleon.json';
import { actorDefSchema } from '../../core/scene/actor';
import { placeActor } from '../../core/scene/actorRuntime';
import { PORT_BERTHS, portPlan } from '../../core/layout/port';
import { portBoats } from '../ui/pixel/keri/portPicture';

describe('figures a picture paints for a script (ft_1_24.AC6)', () => {
  it('ft_1_27.AC2 the galleon actor is the size of the painted galleon and stands by its middle at the water, so a moored stern lands on the berth', () => {
    const def = actorDefSchema.parse(galleon);
    // the boat alone, as the port paints it: painting the whole port for it ran past 30 seconds on a CI runner
    const boat = portBoats(portPlan(), 'day').galleon;
    const look = boat.frames[0]!;
    expect(def.size).toEqual({ w: look.width, h: look.height });
    expect(def.anchor).toEqual({ x: look.width / 2, y: -boat.y });
    // standing where the berth lays the painted boat, facing either way, its frame covers the same pixels
    const berth = PORT_BERTHS[1]!;
    for (const facing of ['left', 'right'] as const) {
      const at = placeActor(def, { id: 'berth', x: berth.x + boat.x + look.width / 2, y: berth.water, facing });
      expect({ x: at.x, y: at.y }).toEqual({ x: berth.x + boat.x, y: berth.water + boat.y });
    }
  });
});
