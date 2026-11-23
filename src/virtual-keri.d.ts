/**
 * Provided by `tools/vite-keri.ts`: the painted pictures of Keri (d111), the warden's room (ft_1_18.AC3) and the map of
 * the island (ft_1_18.AC2) and the scenes (the grassy knoll, ft_1_19.AC9; the docks, ft_1_19; the crossroads; the lantern over Keri, the main menu's, ft_1_07; the southern port, ft_1_19; the terrace before the warden's house, ft_1_19; the village square, ft_1_19), each for every hour of the sky, packed (`roomPack.ts`, `mapPack.ts`, `knollPack.ts`, `docksPack.ts`, `crossroadsPack.ts`, `lanternPack.ts`, `portPack.ts`, `terracePack.ts` and `squarePack.ts` in
 * `src/game/ui/pixel/keri/` unpack them). Each picture at each hour is a loader of its own module, fetched when a scene
 * shows it (d143, ft_1_24.AC7); `src/game/ui/pixel/keri/keriPictures.ts` keeps them.
 */
declare module 'virtual:keri-pictures' {
  // An ambient module cannot `import` a relative path, so the types come in through `import()` type queries.
  type SkyPhase = import('./core/sky/skyPhase').SkyPhase;
  type Loaders<P> = Record<SkyPhase, () => Promise<{ default: P }>>;
  type PackedRoom = import('./game/ui/pixel/keri/roomPack').PackedRoom;
  type PackedMap = import('./game/ui/pixel/keri/mapPack').PackedMap;
  type PackedKnoll = import('./game/ui/pixel/keri/knollPack').PackedKnoll;
  type PackedDocks = import('./game/ui/pixel/keri/docksPack').PackedDocks;
  type PackedCrossroads = import('./game/ui/pixel/keri/crossroadsPack').PackedCrossroads;
  type PackedLantern = import('./game/ui/pixel/keri/lanternPack').PackedLantern;
  type PackedPort = import('./game/ui/pixel/keri/portPack').PackedPort;
  type PackedTerrace = import('./game/ui/pixel/keri/terracePack').PackedTerrace;
  type PackedSquare = import('./game/ui/pixel/keri/squarePack').PackedSquare;
  const pictures: { room: Loaders<PackedRoom>; map: Loaders<PackedMap>; knoll: Loaders<PackedKnoll>; docks: Loaders<PackedDocks>; crossroads: Loaders<PackedCrossroads>; lantern: Loaders<PackedLantern>; port: Loaders<PackedPort>; terrace: Loaders<PackedTerrace>; square: Loaders<PackedSquare> };
  export default pictures;
}
