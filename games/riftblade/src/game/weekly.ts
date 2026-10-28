/**
 * The weekly run: one run a week with a hero and two mutators picked from the week's number, seeded
 * so each world starts the same way for every attempt that week. It is fought at heat 0 and
 * without the Armoury; winning it once a week banks a bonus for the Armoury.
 */
import type { HeroId } from './heroes';
import type { TextKey } from '../i18n';

export type MutatorId = 'glass' | 'swarm' | 'haste' | 'vampire' | 'overcharged' | 'fragile';

/** Each mutator's name and text, in the order the week picks from. */
export const MUTATORS: Record<MutatorId, { name: TextKey; text: TextKey }> = {
  glass: { name: 'mut_glass', text: 'mut_glass_text' },
  swarm: { name: 'mut_swarm', text: 'mut_swarm_text' },
  haste: { name: 'mut_haste', text: 'mut_haste_text' },
  vampire: { name: 'mut_vampire', text: 'mut_vampire_text' },
  overcharged: { name: 'mut_overcharged', text: 'mut_overcharged_text' },
  fragile: { name: 'mut_fragile', text: 'mut_fragile_text' },
};
export const MUTATOR_IDS = Object.keys(MUTATORS) as MutatorId[];

/** The mutators' numbers. */
export const MUT = {
  /** Glass Cannon: damage dealt and max health. */
  glassDmg: 1.5,
  glassHp: 0.6,
  /** Swarm: spawn rate and foe health. */
  swarmSpawn: 1.4,
  swarmHp: 0.75,
  /** Haste: hero and foe speed. */
  haste: 1.25,
  /** Vampire: health per kill (regeneration is off). */
  vampire: 1,
  /** Overcharged: the signature's cooldown. */
  overcharged: 0.5,
  /** Fragile Foes: foe health and how hard they hit. */
  fragileHp: 0.5,
  fragileHurt: 2,
};

/** Credits banked for the first weekly win of a week. */
export const WEEKLY_BONUS = 100;

const WEEK_MS = 7 * 24 * 3600_000;
/** Weeks start on Monday, 00:00 UTC (1 January 2024 was a Monday). */
const EPOCH = Date.UTC(2024, 0, 1);

/** The week's number, counted from the first week of 2024. */
export const weekOf = (now: number) => Math.floor((now - EPOCH) / WEEK_MS);

/** A seed for the week's number. */
export const weekSeed = (week: number) => (Math.imul(week + 1, 2654435761) ^ 0x5f3759df) >>> 0;

/** A small seeded generator (mulberry32). */
export function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The week's hero (from those open) and two different mutators. */
export function weeklyOf(week: number, open: readonly HeroId[]): { hero: HeroId; mutators: MutatorId[] } {
  const r = seeded(weekSeed(week));
  const hero = open[Math.floor(r() * open.length)] ?? 'tr9';
  const pool = [...MUTATOR_IDS];
  const mutators = [0, 1].map(() => pool.splice(Math.floor(r() * pool.length), 1)[0]);
  return { hero, mutators };
}

const native = Math.random;

/**
 * Seeds `Math.random` for a weekly run's next stretch (a world, the maps after a boss), so it plays
 * out the same way each attempt; `unseed` puts back the generator there was before.
 */
export function reseed(seed: number) {
  Math.random = seeded(seed);
}
export function unseed() {
  Math.random = native;
}
