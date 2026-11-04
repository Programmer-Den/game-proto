/** The whole battlefield, in world pixels. The camera shows a window of it and scrolls. A skirmish's map size changes it (`setArena`). */
export const ARENA = { x: 0, y: 0, w: 1600, h: 1000 };

/** A skirmish's map sizes, in world pixels; every other battle is `standard`. */
export type MapSize = 'small' | 'standard' | 'large';
export const MAP_SIZES: readonly MapSize[] = ['small', 'standard', 'large'];
export const ARENA_SIZES: Record<MapSize, { w: number; h: number }> = {
  small: { w: 1360, h: 850 },
  standard: { w: 1600, h: 1000 },
  large: { w: 1920, h: 1200 },
};
/** The biggest battlefield, which the fog's grid is laid out for. */
export const MAX_ARENA = ARENA_SIZES.large;

/** Sets the battlefield's size for the next map (and the battle on it). */
export function setArena(size: MapSize) {
  Object.assign(ARENA, ARENA_SIZES[size]);
}

/** Crystal a node holds when the map is made. */
export const NODE_AMOUNT = 1500;
/** How close a building can be to a crystal node. */
export const NODE_CLEARANCE = 26;
/** How far from its hub a player can place a building. */
export const BUILD_RANGE = 240;
/**
 * Where each faction's hub starts, in world pixels: the player's is first. The points are fixed
 * so every game starts from the same spots, spread across the battlefield; the map jitters each one
 * a little.
 */
export const START_POINTS = [
  { x: 260, y: 780 },
  { x: 1340, y: 220 },
  { x: 1340, y: 780 },
  { x: 260, y: 220 },
  { x: 800, y: 500 },
] as const;

/** The start points on the battlefield as it is now: the fixed spots, scaled with a skirmish's map size. */
export function startPoints() {
  const kx = ARENA.w / ARENA_SIZES.standard.w;
  const ky = ARENA.h / ARENA_SIZES.standard.h;
  return START_POINTS.map((p) => ({ x: p.x * kx, y: p.y * ky }));
}
