/**
 * Hero mastery: every finished run (not a boss rush) gives its hero mastery XP, kept in the save
 * (`progress.mastery`). Levels open, in turn, the hero's mastery colours, a second starting weapon
 * (tier 1 of one pool skill at the start of a run) and two small lasting perks (more health, then
 * more damage). Imports nothing from the game but types.
 */
import type { HeroId, HeroScheme } from './heroes';

/**
 * The XP each level starts at (level 1 at 0, up to `MAX_MASTERY`), what each level opens, the
 * perks' sizes and the XP a run gives: per boss beaten, per `perKills` kills and for a win.
 */
export const MASTERY = {
  levels: [0, 250, 700, 1400, 2400],
  colourAt: 2,
  weaponAt: 3,
  healthAt: 4,
  damageAt: 5,
  health: 0.08,
  damage: 0.08,
  perBoss: 40,
  perKills: 25,
  win: 100,
};
export const MAX_MASTERY = MASTERY.levels.length;

/** The mastery level (1 to `MAX_MASTERY`) an amount of XP reaches. */
export const masteryLevel = (xp = 0) => MASTERY.levels.filter((n) => xp >= n).length;

/** The XP the next level starts at, or null at the top. */
export const masteryNext = (xp = 0) => MASTERY.levels.find((n) => xp < n) ?? null;

/** The XP a finished run gives: per boss beaten, per so many kills and for a won crusade. */
export const masteryXp = (bosses: number, kills: number, won: boolean) =>
  MASTERY.perBoss * Math.max(0, bosses) + Math.floor(Math.max(0, kills) / MASTERY.perKills) + (won ? MASTERY.win : 0);

/** The pool skill each hero starts with from `MASTERY.weaponAt` on (one its pools can draw). */
export const MASTERY_WEAPON: Record<HeroId, string> = {
  rook: 'drone', tr9: 'thermal', bram: 'scatter', kael: 'blade-throw', vharn: 'lightning-arc', oom: 'push-wave',
  corvin: 'crescent', veyl: 'dark-nova', kresh: 'spinning-guard', joren: 'lightning-arc', elara: 'callin', triad: 'drone',
  dax: 'ricochet', grunda: 'stun', kettle: 'drone', cassia: 'executioner',
};

/** The text key of what each level opens (level 1 opens nothing). */
export const MASTERY_REWARDS: Record<number, 'masteryColour' | 'masteryWeapon' | 'masteryHealth' | 'masteryDamage'> = {
  2: 'masteryColour', 3: 'masteryWeapon', 4: 'masteryHealth', 5: 'masteryDamage',
};

/** Each hero's mastery colours (its bolts keep their colour). */
export const MASTERY_COLOURS: Record<HeroId, Omit<HeroScheme, 'name' | 'bolt'>> = {
  rook: { body: '#3d4a33', accent: '#f0d27a', mark: '#7a6230' },
  tr9: { body: '#d9d6cc', accent: '#ff5f2e', mark: '#7a2c12' },
  bram: { body: '#4a3b5c', accent: '#ffc2ea', mark: '#2a1f36' },
  kael: { body: '#f0eee8', accent: '#ff4fd8', mark: '#7a6a58' },
  vharn: { body: '#5a1018', accent: '#ff9a3c', mark: '#2a0a0c' },
  oom: { body: '#2e5a3a', accent: '#ffe27a', mark: '#c9b48a' },
  corvin: { body: '#1f2e5a', accent: '#9ff0ff', mark: '#0f1630' },
  veyl: { body: '#101418', accent: '#ff3cc8', mark: '#6b6470' },
  kresh: { body: '#5a5048', accent: '#c8ff3c', mark: '#2a2420' },
  joren: { body: '#2b2f3a', accent: '#ffd23f', mark: '#8a5a30' },
  elara: { body: '#2f4a5c', accent: '#ffb347', mark: '#e6dac2' },
  triad: { body: '#2a2d36', accent: '#7df9ff', mark: '#4a5266' },
  dax: { body: '#1e2a3a', accent: '#ffd23f', mark: '#c8b89a' },
  grunda: { body: '#4a3a2e', accent: '#ff9a76', mark: '#2e2420' },
  kettle: { body: '#f0e6d0', accent: '#ff8a3c', mark: '#5a4630' },
  cassia: { body: '#f2f0f4', accent: '#7a5cff', mark: '#9aa0b0' },
};
