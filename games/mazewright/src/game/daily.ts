import { distances, UNREACHABLE } from './grid';
import { cellIndex, MAPS, type Cell, type MapDef } from './maps';
import { ALWAYS, COLS, DAILY, ROWS, TOWERS, type TowerKind } from './rules';

/** Today's daily maze: its garden (a known one with a few more rocks), its pouch and the seed of its chance. */
export interface DailyPlan {
  map: MapDef;
  pouch: TowerKind[];
  seed: number;
}

/**
 * Makes the daily maze from a seeded random source, the same for every player on the same day: a
 * garden (not Last Cabbage, whose one cabbage would score alike), `DAILY.rocks` more rocks on free
 * lawn that leave every burrow its way and keep two tiles from the burrows and the cottage, and
 * hedge and bow with four more towers or traps, lent whether bought or not.
 */
export function dailyPlan(rand: () => number): DailyPlan {
  const pool = MAPS.filter((m) => !m.lives);
  const base = pool[Math.floor(rand() * pool.length)];
  const blocked = new Uint8Array(COLS * ROWS);
  if (base.path) blocked.fill(1);
  for (const c of [...(base.path ?? []), base.goal, ...base.gates]) blocked[cellIndex(c)] = 0;
  // Rocks, ponds, glass and sprinklers are 2, so a path garden's lawn (1) leaves them out.
  for (const c of [...base.rocks, ...(base.ponds ?? []), ...(base.glass ?? []), ...(base.sprinklers ?? [])]) blocked[cellIndex(c)] = 2;
  const near = (c: Cell) => [base.goal, ...base.gates].some(([x, y]) => Math.abs(x - c[0]) <= 2 && Math.abs(y - c[1]) <= 2);
  const rocks: Cell[] = [...base.rocks];
  // A path garden's extra rocks go on its lawn, where they only take room from the towers.
  const lawn = (i: number) => !!base.path && blocked[i] === 1 && !rocks.some((r) => cellIndex(r) === i) && !(base.banks ?? []).some((b) => cellIndex(b) === i);
  for (let tries = 0, added = 0; added < DAILY.rocks && tries < 200; tries++) {
    const c: Cell = [Math.floor(rand() * COLS), Math.floor(rand() * ROWS)];
    const i = cellIndex(c);
    if (near(c)) continue;
    if (base.path ? !lawn(i) : blocked[i] !== 0) continue;
    if (!base.path) {
      blocked[i] = 1;
      const dist = distances(blocked, cellIndex(base.goal));
      if (base.gates.some((g) => dist[cellIndex(g)] === UNREACHABLE)) {
        blocked[i] = 0;
        continue;
      }
    }
    rocks.push(c);
    added++;
  }
  const kinds = TOWERS.filter((k) => !ALWAYS.includes(k));
  const picks: TowerKind[] = [];
  while (picks.length < 4) {
    const k = kinds[Math.floor(rand() * kinds.length)];
    if (!picks.includes(k)) picks.push(k);
  }
  const pouch = [...ALWAYS, ...TOWERS.filter((k) => picks.includes(k))];
  return { map: { ...base, rocks }, pouch, seed: Math.floor(rand() * 4294967296) };
}
