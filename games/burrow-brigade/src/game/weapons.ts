/**
 * Burrow Brigade's arsenal: what each weapon is and how it is used. What it does once used lives in
 * `scenes/world.ts`, keyed by the same id; its name and description are in `i18n/` as
 * `w_<id>` and `d_<id>`.
 */

/**
 * How a weapon is used:
 * - `aim`: drag back from the mole (or the arrow keys and Space) to set angle and power, release to fire.
 * - `angle`: like `aim`, but only the direction counts.
 * - `target`: tap a spot on the map.
 * - `use`: the Fire button (or Space) uses it at once.
 */
export type Mode = 'aim' | 'angle' | 'target' | 'use';

/** The arsenal's tabs, in order. */
export type Group = 'rocket' | 'throw' | 'strike' | 'close' | 'tool';

export const WEAPON_IDS = [
  'rocket', 'heavy', 'splitter', 'seeker', 'firecracker', 'drill',
  'grenade', 'cluster', 'bouncer', 'roller', 'ember', 'beehive', 'sap', 'clod',
  'mine', 'dynamite', 'skyrain', 'bolt', 'quake',
  'swipe', 'pound', 'gust', 'burrow', 'beam',
  'hop', 'shield', 'repair', 'skip',
] as const;
export type WeaponId = (typeof WEAPON_IDS)[number];

export interface Weapon {
  id: WeaponId;
  mode: Mode;
  group: Group;
  /** Uses at the start of a match; -1 for unlimited. */
  ammo: number;
  /** Launch speed at full power, in px/s (aimed weapons). */
  speed: number;
  /** How much the wind pushes it, 0 to 1. */
  wind: number;
  /** Blast radius and damage at the centre, for the AI and the arsenal's text. */
  radius: number;
  damage: number;
  /** Whether a crate may hold it. */
  crate: boolean;
  /** Whether the Burrow AI knows how to use it. */
  ai: boolean;
}

const w = (id: WeaponId, mode: Mode, group: Group, ammo: number, speed: number, wind: number, radius: number, damage: number, ai = true, crate = ammo >= 0): Weapon => ({
  id, mode, group, ammo, speed, wind, radius, damage, crate, ai,
});

export const WEAPONS: Record<WeaponId, Weapon> = {
  rocket: w('rocket', 'aim', 'rocket', -1, 820, 1, 36, 45),
  heavy: w('heavy', 'aim', 'rocket', 1, 720, 0.35, 62, 60),
  splitter: w('splitter', 'aim', 'rocket', 2, 820, 1, 26, 25),
  seeker: w('seeker', 'aim', 'rocket', 1, 760, 1, 34, 40),
  firecracker: w('firecracker', 'aim', 'rocket', 1, 820, 1, 18, 15),
  drill: w('drill', 'aim', 'rocket', 2, 820, 1, 30, 40),
  grenade: w('grenade', 'aim', 'throw', -1, 600, 0, 40, 45),
  cluster: w('cluster', 'aim', 'throw', 2, 600, 0, 22, 20),
  bouncer: w('bouncer', 'aim', 'throw', 2, 600, 0, 34, 35),
  roller: w('roller', 'aim', 'throw', 1, 560, 0, 44, 50),
  ember: w('ember', 'aim', 'throw', 1, 600, 0, 8, 6),
  beehive: w('beehive', 'aim', 'throw', 1, 600, 0, 10, 4),
  sap: w('sap', 'aim', 'throw', 1, 600, 0, 38, 42),
  clod: w('clod', 'aim', 'throw', 2, 600, 0, 34, 0, false),
  mine: w('mine', 'use', 'strike', 2, 0, 0, 40, 45, false),
  dynamite: w('dynamite', 'use', 'strike', 1, 0, 0, 70, 70, false),
  skyrain: w('skyrain', 'target', 'strike', 1, 0, 1, 26, 25),
  bolt: w('bolt', 'target', 'strike', 1, 0, 0, 24, 45),
  quake: w('quake', 'use', 'strike', 1, 0, 0, 0, 10, false),
  swipe: w('swipe', 'use', 'close', -1, 0, 0, 24, 20),
  pound: w('pound', 'use', 'close', 1, 0, 0, 46, 25),
  gust: w('gust', 'angle', 'close', 1, 0, 0, 0, 0, false),
  burrow: w('burrow', 'angle', 'close', -1, 0, 0, 12, 0, false, false),
  beam: w('beam', 'angle', 'close', 1, 0, 0, 7, 30, false),
  hop: w('hop', 'target', 'tool', 1, 0, 0, 0, 0, false),
  shield: w('shield', 'use', 'tool', 1, 0, 0, 0, 0, false),
  repair: w('repair', 'use', 'tool', 1, 0, 0, 0, 0),
  skip: w('skip', 'use', 'tool', -1, 0, 0, 0, 0, false, false),
};

export const GROUPS: Group[] = ['rocket', 'throw', 'strike', 'close', 'tool'];

/** A team's starting stock. */
export function startingAmmo(): Record<WeaponId, number> {
  const out = {} as Record<WeaponId, number>;
  for (const id of WEAPON_IDS) out[id] = WEAPONS[id].ammo;
  return out;
}

/** The weapons a crate can hold. */
export const CRATE_WEAPONS = WEAPON_IDS.filter((id) => WEAPONS[id].crate);
