// A greedy bot that plays every garden on Normal, to check the balance after a change. It is not a
// test: build and run it with
//   npx rolldown games/mazewright/e2e/bot.ts -p node -f esm -o /tmp/mazewright-bot.mjs
//   node /tmp/mazewright-bot.mjs
// Each hedge goes where it lengthens the routes from the burrows most, each tower where it covers
// most of the routes (on a path garden, the lawn beside the most path), and an upgrade wins over a
// new tower when it adds more per gold. It plays Classic, Calm, with no master levels, and prints
// each garden's result: W and the cabbages kept, or L and the wave lost on.
// Environment: POUCH (default hedge,bow,frost,cannon), DURING=0 to build only between waves,
// SEEDS (runs per garden, default 1; only winter frost draws random numbers), ONLY=<garden>.

import { distances, route } from '../src/game/grid';
import { cellOf, MAPS } from '../src/game/maps';
import { attacks, COLS, ROWS, startLives, TOWER, type TowerKind } from '../src/game/rules';
import { build, cabbagesLeft, canBuild, goldAt, newGame, nextUpgrade, reachOf, startWave, step, towerAt, upgrade, type Game } from '../src/game/sim';

const POUCH = (process.env.POUCH ?? 'hedge,bow,frost,cannon').split(',') as TowerKind[];
const DURING = process.env.DURING !== '0';
const SEEDS = Number(process.env.SEEDS ?? 1);

/** The steps from every burrow to the cottage with `blocked`, or -1 when one is walled in. */
function routeSum(g: Game, blocked: Uint8Array) {
  const dist = distances(blocked, g.goal);
  let sum = 0;
  for (const gate of g.gates) {
    if (dist[gate] < 0) return -1;
    sum += dist[gate];
  }
  return sum;
}

/** The route cells, weighted: the first burrow's count most, as it is open longest. */
function routeCells(g: Game) {
  const cells = new Map<number, number>();
  g.gates.forEach((gate, i) => {
    for (const c of route(g.dist, gate)) cells.set(c, (cells.get(c) ?? 0) + 1 / (1 + i * 0.3));
  });
  return cells;
}

function coverage(g: Game, cell: number, kind: TowerKind, cells: Map<number, number>) {
  const reach = reachOf(g, cell, kind);
  const [x, y] = cellOf(cell);
  let n = 0;
  for (const [c, w] of cells) {
    const [cx, cy] = cellOf(c);
    if (Math.hypot(cx - x, cy - y) <= reach) n += w;
  }
  return n;
}

/** Bows mostly (or the pouch's first attacker), a frost tower in five and a cannon in eight from wave 3, and the other attackers in turn. */
function nextKind(g: Game, built: number): TowerKind {
  const count = (k: TowerKind) => g.towers.filter((t) => t.kind === k).length;
  const attackers = POUCH.filter((k) => attacks(k));
  const main = attackers.includes('bow') ? 'bow' : attackers[0];
  if (attackers.includes('frost') && main !== 'frost' && count('frost') < Math.floor(built / 5) + (g.wave >= 3 ? 1 : 0)) return 'frost';
  if (attackers.includes('cannon') && main !== 'cannon' && g.wave >= 3 && count('cannon') < Math.floor(built / 8)) return 'cannon';
  for (const k of attackers.filter((k) => k !== main && k !== 'frost' && k !== 'cannon')) if (g.wave >= 2 && count(k) < Math.floor(built / 4) + 1) return k;
  return main;
}

interface Spend {
  hedges: number;
  towers: number;
  built: number;
}

function act(g: Game, spend: Spend) {
  for (let guard = 0; guard < 40; guard++) {
    // A hedge where it lengthens the routes, while hedges have had less than 60% of the towers' gold.
    if (!g.map.path && POUCH.includes('hedge') && spend.hedges < (spend.towers + 30) * 0.6 && g.gold >= TOWER.hedge.cost) {
      const base = routeSum(g, g.blocked);
      let best = -1;
      let gain = 1;
      for (let c = 0; c < COLS * ROWS; c++) {
        if (g.blocked[c] || canBuild(g, c, 'hedge')) continue;
        const blocked = g.blocked.slice();
        blocked[c] = 2;
        const sum = routeSum(g, blocked);
        if (sum - base > gain) (gain = sum - base), (best = c);
      }
      if (best >= 0) {
        build(g, best, 'hedge');
        spend.hedges += TOWER.hedge.cost;
        continue;
      }
    }
    const kind = nextKind(g, spend.built);
    const cells = routeCells(g);
    let spot = -1;
    let spotValue = 0;
    for (let c = 0; c < COLS * ROWS; c++) {
      const refusal = canBuild(g, c, kind);
      if (refusal && refusal !== 'gold') continue;
      // A tower on open lawn must not shorten the maze.
      if (!towerAt(g, c) && g.blocked[c] === 0 && !g.map.path) {
        const blocked = g.blocked.slice();
        blocked[c] = 2;
        if (routeSum(g, blocked) < routeSum(g, g.blocked)) continue;
      }
      const value = coverage(g, c, kind, cells) + (towerAt(g, c) ? 0.5 : 0);
      if (value > spotValue) (spotValue = value), (spot = c);
    }
    let up = -1;
    let upValue = 0;
    for (const t of g.towers) {
      const cost = nextUpgrade(t, g);
      if (cost === null || t.grow > 0) continue;
      const value = (coverage(g, t.cell, t.kind, cells) * 0.6 * TOWER[t.kind].cost) / cost;
      if (value > upValue) (upValue = value), (up = t.cell);
    }
    if (up >= 0 && upValue > spotValue * 0.8) {
      if (upgrade(g, up)) {
        spend.towers += 1;
        continue;
      }
      if (goldAt(g, up) < (nextUpgrade(towerAt(g, up)!, g) ?? 0)) break;
    }
    if (spot >= 0 && canBuild(g, spot, kind) === null) {
      build(g, spot, kind);
      spend.towers += TOWER[kind].cost;
      spend.built++;
      continue;
    }
    break;
  }
}

function play(mapId: string, seed: number) {
  const map = MAPS.find((m) => m.id === mapId)!;
  const g = newGame(mapId, true, 'classic', [], { seed, toughness: 1, lives: map.lives ?? startLives() });
  const spend: Spend = { hedges: 0, towers: 0, built: 0 };
  while (g.phase !== 'won' && g.phase !== 'lost' && g.clock < 3000) {
    if (g.phase === 'build') {
      act(g, spend);
      startWave(g);
    } else if (DURING && g.steps % 60 === 0) act(g, spend);
    step(g, 1 / 60);
    g.events.length = 0;
  }
  return g.phase === 'won' ? `W${cabbagesLeft(g)}/${g.maxLives}` : `L@${g.wave}`;
}

let wins = 0;
let games = 0;
for (const m of MAPS.filter((m) => !process.env.ONLY || m.id === process.env.ONLY)) {
  const results: string[] = [];
  for (let s = 1; s <= SEEDS; s++) {
    const result = play(m.id, s * 7919);
    games++;
    if (result.startsWith('W')) wins++;
    results.push(result);
  }
  console.log(m.id.padEnd(12), results.join(' '));
}
console.log(`won ${wins} of ${games}`);
