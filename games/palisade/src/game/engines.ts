// Siege engines: during a break coins build one engine on top of the barricade, a ballista or a
// catapult, kept for the run. The ballista shoots a heavy bolt that flies straight on through
// every foe on its line (shields too); the catapult lobs a stone over the front ranks that crushes
// every foe where it lands. Each has two upgrades of its own and its own aim setting. Engines are
// built and upgraded only during breaks; the aim can be switched any time. While the barricade is
// down the crew cannot work the engine.

import type { TextKey } from '../i18n';

export type EngineKind = 'ballista' | 'catapult';
export type EngineUpgradeId = 'heavy' | 'winch' | 'stones' | 'pitch';
/** Who an engine shoots at: the ballista the strongest, the nearest or flyers; the catapult the back ranks or the thickest crowd. */
export type EngineAim = 'strongest' | 'nearest' | 'flyers' | 'back' | 'crowd';

export interface EngineType {
  /** Name and text, keys of `i18n/en.ts`. */
  name: TextKey;
  text: TextKey;
  cost: number;
  /** Milliseconds between two shots, before the Iron Winch. */
  ms: number;
  /** A shot's damage on wave 1 (it grows with the waves, see `engineDamage`). */
  damage: number;
  upgrades: EngineUpgradeId[];
  aims: EngineAim[];
}

export const ENGINES: Record<EngineKind, EngineType> = {
  ballista: { name: 'ballistaName', text: 'ballistaText', cost: 40, ms: 2_600, damage: 24, upgrades: ['heavy', 'winch'], aims: ['strongest', 'nearest', 'flyers'] },
  catapult: { name: 'catapultName', text: 'catapultText', cost: 50, ms: 4_000, damage: 30, upgrades: ['stones', 'pitch'], aims: ['back', 'crowd'] },
};

export const ENGINE_KINDS = Object.keys(ENGINES) as EngineKind[];

export const ENGINE_UPGRADES: Record<EngineUpgradeId, { name: TextKey; text: TextKey }> = {
  heavy: { name: 'heavyName', text: 'heavyText' },
  winch: { name: 'winchName', text: 'winchText' },
  stones: { name: 'stonesName', text: 'stonesText' },
  pitch: { name: 'pitchName', text: 'pitchText' },
};

export const ENGINE_AIMS: Record<EngineAim, TextKey> = {
  strongest: 'strongestName',
  nearest: 'nearestName',
  flyers: 'flyersName',
  back: 'backName',
  crowd: 'crowdName',
};

/** Each engine upgrade has this many ranks, at these costs. */
export const ENGINE_RANKS = 2;
export const engineUpgradeCost = (rank: number) => [35, 60][rank] ?? Infinity;

/** An engine built on the barricade: its kind, its upgrades' ranks, its aim and the time to its next shot. */
export interface Engine {
  kind: EngineKind;
  ranks: Partial<Record<EngineUpgradeId, number>>;
  aim: EngineAim;
  cd: number;
}

/** Where engines stand, on top of the barricade, and where their shots leave from. */
export const ENGINE_SPOT = { x: 176, y: 268 };
/** The catapult's stone is in the air this long, and crushes foes within this radius where it lands. */
export const STONE_FLIGHT_MS = 1_100;
export const STONE_RADIUS = 55;
/** How fast the ballista's bolt flies. */
export const LANCE_SPEED = 900;

export const engineRank = (engine: Engine, id: EngineUpgradeId) => engine.ranks[id] ?? 0;

/** What an engine does on a wave, with its upgrades: its shot's damage (the crew grows practised as the waves go on), reload, the stone's radius and burning. */
export function engineStats(engine: Engine, wave: number) {
  const type = ENGINES[engine.kind];
  const r = (id: EngineUpgradeId) => engineRank(engine, id);
  const practised = 1 + 0.15 * (wave - 1);
  return {
    damage: type.damage * practised * (1 + 0.5 * r('heavy')) * (1 + 0.4 * r('stones')),
    ms: type.ms / (1 + 0.35 * r('winch')),
    radius: STONE_RADIUS + 15 * r('stones'),
    burn: r('pitch') > 0 ? { dps: 6 * r('pitch') * practised, ms: 3_000 } : null,
  };
}

/** The aim after this one for an engine of this kind. */
export function nextEngineAim(kind: EngineKind, aim: EngineAim) {
  const aims = ENGINES[kind].aims;
  return aims[(aims.indexOf(aim) + 1) % aims.length];
}
