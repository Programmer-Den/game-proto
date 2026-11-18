/**
 * The field's extras, called from `sim.ts` once a step like `objectives.ts` (it imports `sim.ts`,
 * so don't read its values at load time): rift altars and their pacts, and volatile barrels.
 * Neither comes before a world's first minute is out, so the first minute (and the playthrough's
 * seeded draws) play as before. Randomness only through `rand`.
 */
import { t as tr } from '../i18n';
import { PLANETS } from './planets';
import { ALTAR, BARREL, isStructure, type Barrel, type GameState, type PactKind } from './state';
import { kill, knock, near, pop } from './sim';
import { rand } from './weekly';

const PACT_COLOR: Record<PactKind, string> = { blood: '#ff6b8a', greed: '#ffd36b' };
const BLAST_COLOR = '#ffa04d';

/** Whether a pact of this kind is running. */
export const pactOn = (s: GameState, kind: PactKind) => s.pact?.kind === kind;

/** Altars, the pact's clock and barrels, once a step. */
export function field(s: GameState, ms: number) {
  altars(s, ms);
  barrels(s, ms);
}

function altars(s: GameState, ms: number) {
  if (s.pact) {
    s.pact.ms -= ms;
    if (s.pact.ms <= 0) {
      s.pact = null;
      pop(s, tr('pactOver'), '#c9b2ff');
    }
  }
  // A world's pair of altars comes once, never in the arena, a rush or once the boss is up.
  if (s.time >= s.altarAt) {
    s.altarAt = Infinity;
    if (!s.arena && !s.rush && !s.bossSpawned && !s.pact) {
      const p = s.player;
      const a = rand() * Math.PI * 2;
      const cx = p.x + Math.cos(a) * ALTAR.dist;
      const cy = p.y + Math.sin(a) * ALTAR.dist;
      const ox = -Math.sin(a) * (ALTAR.gap / 2);
      const oy = Math.cos(a) * (ALTAR.gap / 2);
      s.altars = (['blood', 'greed'] as const).map((kind, i) => ({ id: s.nextId++, kind, x: cx + (i ? ox : -ox), y: cy + (i ? oy : -oy), ms: ALTAR.lifeMs }));
      pop(s, tr('altarsRise'), '#c9b2ff');
    }
  }
  if (!s.altars.length) return;
  // The boss calls the altars off, like an objective.
  if (s.bossSpawned) {
    s.altars = [];
    return;
  }
  const p = s.player;
  for (const al of s.altars) {
    al.ms -= ms;
    if (Math.hypot(al.x - p.x, al.y - p.y) < ALTAR.r + p.r) {
      s.pact = { kind: al.kind, ms: ALTAR.ms };
      s.altars = [];
      s.blasts.push({ id: s.nextId++, x: al.x, y: al.y, r: 70, ms: 600, maxMs: 600, color: PACT_COLOR[al.kind] });
      pop(s, tr(al.kind === 'blood' ? 'pactBloodPop' : 'pactGreedPop', { n: ALTAR.ms / 1000 }), PACT_COLOR[al.kind]);
      return;
    }
  }
  s.altars = s.altars.filter((al) => al.ms > 0);
}

function barrels(s: GameState, ms: number) {
  const p = s.player;
  if (!s.arena && !s.rush && s.time >= s.nextBarrel) {
    s.nextBarrel = s.time + BARREL.everyMs;
    if (s.barrels.filter((b) => b.fuseMs < 0).length < BARREL.max) {
      const a = rand() * Math.PI * 2;
      const d = BARREL.min + rand() * (BARREL.far - BARREL.min);
      s.barrels.push({ id: s.nextId++, x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d, fuseMs: -1 });
    }
  }
  if (!s.barrels.length) return;
  for (const b of s.barrels) {
    if (b.fuseMs < 0) continue;
    b.fuseMs -= ms;
    if (b.fuseMs <= 0) blow(s, b);
  }
  // Barrels blown, or left far behind, are gone.
  s.barrels = s.barrels.filter((b) => b.fuseMs !== 0 && Math.hypot(b.x - p.x, b.y - p.y) < BARREL.leash);
}

/** A hero-side hit at a point reaching `r` (a bolt, or a foe struck) lights any barrel it touches. */
export function strikeBarrels(s: GameState, x: number, y: number, r: number) {
  for (const b of s.barrels) {
    if (b.fuseMs < 0 && Math.hypot(b.x - x, b.y - y) < r + BARREL.r) b.fuseMs = BARREL.fuseMs;
  }
}

/** A barrel blows up: most of each foe's health round it, and it lights the barrels near it. */
function blow(s: GameState, b: Barrel) {
  b.fuseMs = 0;
  near(s, b.x, b.y, BARREL.blastR, (e) => {
    if (e.hp <= 0 || e.charmMs > 0 || isStructure(e.kind)) return;
    e.hp -= e.maxHp * (e.kind === 'boss' ? BARREL.boss : e.elite ? BARREL.elite : BARREL.share);
    e.flashMs = 90;
    knock(e, b.x, b.y, 220);
    if (e.hp <= 0) kill(s, e);
  });
  for (const o of s.barrels) {
    if (o.fuseMs < 0 && Math.hypot(o.x - b.x, o.y - b.y) < BARREL.blastR) o.fuseMs = BARREL.fuseMs;
  }
  s.blasts.push({ id: s.nextId++, x: b.x, y: b.y, r: BARREL.blastR, ms: 480, maxMs: 480, color: PLANETS[s.planet].id === 'ruin' ? '#d9c9a8' : BLAST_COLOR });
}
