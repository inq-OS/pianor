import pictures from 'virtual:keri-pictures';
import { loadedOnce } from '../pack';
import { unpackCrossroads } from './crossroadsPack';
import { unpackDocks } from './docksPack';
import { unpackKnoll } from './knollPack';
import { unpackLantern } from './lanternPack';
import { unpackMap } from './mapPack';
import { unpackPort } from './portPack';
import { unpackRoom } from './roomPack';
import { unpackTerrace } from './terracePack';

/**
 * The painted pictures of Keri as the game keeps them (d143, ft_1_24.AC7): each picture at each hour is loaded when a
 * scene first shows it, unpacked once and kept; the game's own file carries none of them. A scene asks with
 * `PixelScene.loaded`, which shows a short loading view until the picture is there.
 */
export const PAINTED = {
  room: loadedOnce(pictures.room, unpackRoom),
  map: loadedOnce(pictures.map, unpackMap),
  knoll: loadedOnce(pictures.knoll, unpackKnoll),
  docks: loadedOnce(pictures.docks, unpackDocks),
  crossroads: loadedOnce(pictures.crossroads, unpackCrossroads),
  lantern: loadedOnce(pictures.lantern, unpackLantern),
  port: loadedOnce(pictures.port, unpackPort),
  terrace: loadedOnce(pictures.terrace, unpackTerrace),
};
