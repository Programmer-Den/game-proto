// New game+: the foes grow stronger (`PLUS` in `foes.ts`) and the moonstones move. Each new game+
// cycle buries every moonstone that lies somewhere (not the ones a person, an animal, the wisp or a
// boss gives) on a new spot of the same map, picked from a seeded random number generator so the
// same cycle always hides them in the same places. A moved stone glimmers in the knight's light.

import { AFTER_BOSS, BREAKABLE, CUTTABLE, LOW, SOLID, tileAt, type MapDef, type MapId, MAP_IDS } from './maps';

/** Ground a moved moonstone can be buried in. */
const GROUND = new Set(['grass', 'path', 'flowers', 'reeds', 'floor']);
/** Moved stones keep at least this many tiles from each other and from the map's ways in and out. */
const SPREAD = 5;

function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
}

/**
 * The tiles a knight with every tool can stand on: flooded from the map's exits through walkable
 * ground, things the sword cuts, rock a bellseed breaks and gaps the hookvine or the Moonlantern
 * crosses, leaving out tiles something stands on.
 */
function reachable(map: MapDef) {
  const taken = new Set<number>();
  const mark = (x: number, y: number) => taken.add(y * map.w + x);
  for (const p of map.props) for (let j = -1; j <= p.h; j++) for (let i = -1; i <= p.w; i++) mark(p.x + i, p.y + j);
  for (const o of [...map.npcs, ...map.chests, ...map.signs, ...map.posts, ...map.blocks, ...map.plates, ...map.finds]) mark(o.x, o.y);
  if (map.hourglass) mark(map.hourglass.x, map.hourglass.y);
  for (const d of map.doors) for (let j = 0; j < d.h; j++) for (let i = 0; i < d.w; i++) mark(d.x + i, d.y + j);
  const passable = (x: number, y: number) => {
    const t = tileAt(map, x, y);
    return x >= 0 && y >= 0 && x < map.w && y < map.h && (!SOLID.has(t) || CUTTABLE.has(t) || BREAKABLE.has(t) || LOW.has(t));
  };
  const seen = new Set<number>();
  const queue: [number, number][] = [];
  for (const e of map.exits) for (let j = 0; j < e.h; j++) for (let i = 0; i < e.w; i++) queue.push([e.x + i, e.y + j]);
  while (queue.length) {
    const [x, y] = queue.pop()!;
    const k = y * map.w + x;
    if (seen.has(k) || !passable(x, y)) continue;
    seen.add(k);
    queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  const out: { x: number; y: number }[] = [];
  for (const k of seen) {
    const x = k % map.w;
    const y = Math.floor(k / map.w);
    if (!taken.has(k) && GROUND.has(tileAt(map, x, y))) out.push({ x, y });
  }
  return out.sort((a, b) => a.y - b.y || a.x - b.x);
}

/** Moves a map's moonstones for new game+ cycle `cycle` (nothing on a first run). */
export function plusStones(map: MapDef, cycle: number) {
  if (cycle <= 0) return;
  const spots = reachable(map);
  const r = rng(cycle * 7919 + MAP_IDS.indexOf(map.id as MapId) * 104729 + 17);
  const kept: { x: number; y: number }[] = map.exits.map((e) => ({ x: e.x, y: e.y }));
  for (const st of map.stones) {
    if (st.x < 0 || AFTER_BOSS[st.id]) continue;
    const far = spots.filter((p) => kept.every((k) => Math.abs(k.x - p.x) + Math.abs(k.y - p.y) >= SPREAD) && !(p.x === st.x && p.y === st.y));
    const pool = far.length ? far : spots;
    if (!pool.length) continue;
    const at = pool[Math.floor(r() * pool.length)];
    st.x = at.x;
    st.y = at.y;
    st.hidden = 'buried';
    st.glimmer = true;
    kept.push(at);
  }
}
