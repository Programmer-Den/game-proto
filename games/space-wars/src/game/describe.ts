import type { Ability, Faction, Role, UnitId } from './factions';
import { FLAGSHIP_STEP } from './contracts';
import { RESEARCH_LEVELS, RESEARCH_MS, RESEARCH_STEP, TRACK_DEFS, type Track } from './research';
import type { DerelictKind } from './map';
import {
  CLAIM_MS, EXPANSION_GAP, REPAIR_RANGE, REPAIR_RATE, VETERAN_NAMES, VETERAN_RANKS, VETERAN_STEP, buildingStats,
  derelictText, expansionStats, flagshipStats, researchCost, unitStats, type Side,
} from './world';
import { ADMIRAL_RANKS, MAX_ADMIRAL_RANK, admiralAt, admiralOf, type AdmiralId } from './admirals';
import { t } from '../i18n';

// Every line is in the hub's language, through `t`.

/** A sentence about what an ability does, with its numbers. */
export function abilityText(a: Ability): string {
  switch (a.kind) {
    case 'cloak':
      return t('cloakText', { s: a.revealMs / 1000 });
    case 'decoy':
      return t('decoyText', { every: a.everyMs / 1000, life: a.lifeMs / 1000 });
    case 'hack':
      return t('hackText', { s: a.disableMs / 1000, n: a.takeover });
    case 'shield':
      return t('shieldText', { range: a.range, pct: Math.round(a.share * 100) });
    case 'brood':
      return t('broodText', { every: a.everyMs / 1000, cap: a.cap });
    case 'splash':
      return t('splashText', { radius: a.radius, pct: Math.round(a.share * 100) });
    case 'salvage':
      return t('salvageText', { pay: a.pay, range: a.range });
    case 'mines':
      return t('minesText', { every: a.everyMs / 1000, cap: a.cap, damage: a.damage });
  }
}

/** A weapon's damage, range and reload, for a tooltip. */
function weaponLine(w: { damage: number; range: number; cooldownMs: number }): string {
  return t('weaponLine', { damage: w.damage, range: w.range, reload: w.cooldownMs / 1000 });
}

/** The lines a unit's tooltip shows under its name: cost, speed, weapon, ability. */
export function unitLines(side: Side, type: UnitId): string[] {
  const s = unitStats(side, type);
  const def = side.def.units[type];
  const lines = [t('unitStatsLine', { cost: s.cost, hp: s.hp, speed: Math.round(s.speed) })];
  if (type === 'harvester') lines.push(t('harvesterLine', { n: Math.round(side.def.tune.carry * side.perks.carry) }));
  if (s.weapon) lines.push(weaponLine(s.weapon));
  if (def.ability) lines.push(abilityText(def.ability));
  return lines;
}

/** The lines a building's tooltip shows under its name. */
export function buildingLines(side: Side, role: Role): string[] {
  const s = buildingStats(side, role);
  const def = side.def.buildings[role];
  const lines: string[] = [];
  if (role === 'hub') lines.push(t('hubLine'));
  else lines.push(t('buildingStatsLine', { cost: s.cost, hp: s.hp, s: def.buildMs / 1000 }));
  if (role === 'depot') lines.push(t('depotLine'));
  if (role === 'barracks') lines.push(t('barracksLine'));
  if (s.weapon) lines.push(weaponLine(s.weapon));
  if (def.ability) lines.push(abilityText(def.ability));
  return lines;
}

/** The lines an expansion's tooltip shows under its name. */
export function expansionLines(side: Side): string[] {
  const s = expansionStats(side);
  return [
    t('buildingStatsLine', { cost: s.cost, hp: s.hp, s: s.buildMs / 1000 }),
    t('expansionWhere', { gap: EXPANSION_GAP }),
    t('expansionWhat'),
  ];
}

/** The lines the Fall back button's tooltip shows under its name. */
export function fallBackLines(): string[] {
  return [
    t('fallBackWhat'),
    t('fallBackRepair', { range: REPAIR_RANGE, pct: Math.round(REPAIR_RATE * 100) }),
    t('fallBackRanks', {
      ranks: VETERAN_RANKS.map((k, i) => t('rankAt', { rank: t(VETERAN_NAMES[i]), n: k })).join(', '),
      pct: Math.round(VETERAN_STEP * 100),
    }),
  ];
}

/** The lines the Rally button's tooltip shows under its name: what it does and how to take it down. */
export function rallyLines(): string[] {
  return [t('rallyWhat'), t('rallyClear')];
}

/** The lines the flagship's tooltip shows under its name: its numbers, its ability and its one-per-battle rule. */
export function flagshipLines(side: Side): string[] {
  const s = flagshipStats(side);
  const lines = [t('flagshipStatsLine', { cost: s.cost, hp: s.hp, speed: Math.round(s.speed), s: s.trainMs / 1000 })];
  if (s.weapon) lines.push(weaponLine(s.weapon));
  lines.push(abilityText(side.def.flagship.ability));
  lines.push(t('flagshipRule', { n: FLAGSHIP_STEP }));
  return lines;
}

/** The lines a derelict station's label shows: what it gives and how to claim it. */
export function derelictLines(kind: DerelictKind): string[] {
  return [derelictText(kind), t('derelictClaim', { s: CLAIM_MS / 1000 })];
}

/** The lines a research button's tooltip shows under its name. */
export function researchLines(side: Side, track: Track): string[] {
  const level = side.research.levels[track];
  if (level >= RESEARCH_LEVELS) return [t('researchMaxed', { level, max: RESEARCH_LEVELS })];
  return [
    t('researchNext', { level: level + 1, max: RESEARCH_LEVELS, cost: researchCost(side, track), s: RESEARCH_MS / 1000 }),
    t('researchStep', { pct: Math.round(RESEARCH_STEP * 100), effect: t(TRACK_DEFS[track].effect) }),
  ];
}

/** A faction's card on the picker: its buildings and ships by name, and its signature ability. */
export function factionLines(def: Faction): string[] {
  const ships = (['scout', 'gunship', 'heavy'] as const).map((type) => t(def.units[type].name)).join(', ');
  const ability = (['scout', 'gunship', 'heavy'] as const)
    .map((type) => def.units[type].ability)
    .find((a): a is Ability => !!a) ?? def.buildings.barracks.ability;
  const lines = [t('factionBarracks', { name: t(def.buildings.barracks.name) }), t('factionShips', { names: ships })];
  if (ability) lines.push(abilityText(ability));
  return lines;
}

/** An admiral's lines at a rank: its aura, its active with the cooldown, and how far its next rank is. */
export function admiralLines(id: AdmiralId, rank: number): string[] {
  const def = admiralOf(id);
  const at = admiralAt(def, rank);
  const lines = [
    t(def.auraText, { pct: Math.round(at.aura * 100) }),
    t(def.activeText, { n: at.power, s: at.cooldownMs / 1000 }),
  ];
  lines.push(rank >= MAX_ADMIRAL_RANK ? t('admiralTopRank') : t('admiralNextRank', { rank: rank + 1, xp: ADMIRAL_RANKS[rank] }));
  return lines;
}
