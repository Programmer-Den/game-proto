/**
 * The fight: two sides of robots (or monsters) on the 8x8 board, run in fixed steps of `STEP_S`
 * seconds with no input but the commanders' skills. Robots walk tile by tile to the nearest enemy,
 * attack when in range, fill their charge and cast their ability when it is full. The scene plays
 * the player's fight from the events this pushes to `events`; every other fight of the round is
 * run to the end at once with `runToEnd`.
 *
 * Side 0 holds rows 4 to 7 (the bottom half on screen), side 1 rows 0 to 3.
 */
import {
  BIG_ABILITY_COST, BOARD, CLASS_STATS, COST_SCALE, FIGHT_LIMIT_S, ITEMS, MONSTERS, OVERCHARGE_MANA,
  RAT, SKILL_POWER, STAR_POWER, STAR_STAT, TRAITS, UNIT_BY_ID,
  type AbilityKind, type AugmentId, type ClassId, type MonsterId, type OriginId, type SetId, type SkillId, type Special,
  type TerrainId, type TraitId,
} from './data';
import type { TextKey } from '../i18n';

export const STEP_S = 0.05;
/** Seconds a robot takes to step to the next tile. */
const MOVE_S = 0.5;
/** Charge per attack, and per damage taken (capped per hit). */
const MANA_PER_ATTACK = 10;
const MANA_PER_DAMAGE = 0.06;
const MANA_PER_HIT_CAP = 12;
const BASE_CRIT = 0.1;
const BASE_CRIT_DMG = 1.5;
const SHIELD_S = 4;

export interface FighterSpec {
  defId?: string;
  monster?: MonsterId;
  star: number;
  items: string[];
  gilded: OriginId | null;
  col: number;
  row: number;
}

export interface SideSpec {
  fighters: FighterSpec[];
  /** Distinct robots per trait on this side's board (`countTraits`). */
  traits: Partial<Record<TraitId, number>>;
  augments: AugmentId[];
  skill: SkillId | null;
  season: SetId;
}

export type BEvent =
  | { t: 'move'; id: number; dur: number }
  | { t: 'attack'; id: number; target: number; ranged: boolean }
  | { t: 'proj'; from: number; to: number; kind: 'shot' | 'shell' | 'snipe'; dur: number; crit: boolean }
  | { t: 'dmg'; id: number; amount: number; crit: boolean; ability: boolean }
  | { t: 'heal'; id: number; amount: number }
  | { t: 'shield'; id: number; amount: number }
  | { t: 'cast'; id: number; ability: AbilityKind }
  | { t: 'death'; id: number }
  | { t: 'stun'; id: number }
  | { t: 'lightning'; from: number; to: number[] }
  | { t: 'blink'; id: number }
  | { t: 'dodge'; id: number }
  | { t: 'revive'; id: number }
  | { t: 'gold'; team: 0 | 1; id: number; amount: number }
  | { t: 'skill'; team: 0 | 1; skill: SkillId; target?: number }
  | { t: 'escape'; id: number };

export interface BUnit {
  id: number;
  team: 0 | 1;
  defId?: string;
  monster?: MonsterId;
  name: TextKey;
  star: number;
  cls: ClassId | null;
  origins: OriginId[];
  items: string[];
  col: number;
  row: number;
  /** Where a step started, and how far through it the robot is (0 to 1); `moveDur` 0 when standing. */
  fromCol: number;
  fromRow: number;
  moveT: number;
  moveDur: number;
  hp: number;
  maxHp: number;
  atk: number;
  baseAs: number;
  /** Added attack speed, as a fraction. */
  asBonus: number;
  range: number;
  armor: number;
  mana: number;
  maxMana: number;
  crit: number;
  critDmg: number;
  dodge: number;
  dmgMul: number;
  powerMul: number;
  power: number;
  ability: AbilityKind | null;
  big: boolean;
  shield: number;
  shieldUntil: number;
  stunUntil: number;
  castLock: number;
  attackTimer: number;
  target: number | null;
  alive: boolean;
  sp: Partial<Record<Special, number>>;
  /** Attack speed piled up by Overclockers and Salvagers. */
  rampAs: number;
  revived: boolean;
  regenPerS: number;
  manaRegen: number;
  manaGainMul: number;
  /** Rat gold already shaken loose. */
  goldOut: number;
  /** Damage this unit dealt to the other side and took, for the damage meter. */
  dealt: number;
  taken: number;
}

interface Projectile {
  from: number;
  to: number;
  dmg: number;
  ability: boolean;
  crit: boolean;
  at: number;
}

const traitTier = (trait: TraitId, count: number | undefined) => {
  const tiers = TRAITS[trait].tiers;
  let tier = -1;
  for (let i = 0; i < tiers.length; i++) if ((count ?? 0) >= tiers[i]) tier = i;
  return tier;
};

/** A side's bonus from `trait` (0 when it isn't active). */
export function traitValue(traits: Partial<Record<TraitId, number>>, trait: TraitId) {
  const tier = traitTier(trait, traits[trait]);
  return tier < 0 ? 0 : TRAITS[trait].values[tier];
}

const cheb = (a: { col: number; row: number }, b: { col: number; row: number }) => Math.max(Math.abs(a.col - b.col), Math.abs(a.row - b.row));
const dist2 = (a: { col: number; row: number }, b: { col: number; row: number }) => (a.col - b.col) ** 2 + (a.row - b.row) ** 2;

export class Battle {
  units: BUnit[] = [];
  events: BEvent[] = [];
  time = 0;
  winner: 0 | 1 | null = null;
  done = false;
  /** Gold each side picked up during the fight (rat hits, scanner kills). */
  gold: [number, number] = [0, 0];
  skillUsed: [boolean, boolean];
  terrain: Map<string, TerrainId>;
  private projectiles: Projectile[] = [];
  private nextId = 1;
  private occ = new Map<string, number>();
  private asBuffUntil: [number, number] = [0, 0];
  private rallyUntil: [number, number] = [0, 0];
  private leapsDone = false;
  private sides: [SideSpec, SideSpec];

  constructor(a: SideSpec, b: SideSpec, terrain: Map<string, TerrainId> = new Map()) {
    this.sides = [a, b];
    this.terrain = terrain;
    this.skillUsed = [!a.skill, !b.skill];
    for (const [team, side] of [[0, a], [1, b]] as const) {
      const enemy = team === 0 ? b : a;
      for (const f of side.fighters) this.add(this.build(f, team, side, enemy));
    }
  }

  private add(unit: BUnit) {
    this.units.push(unit);
    this.occ.set(`${unit.col},${unit.row}`, unit.id);
  }

  private build(f: FighterSpec, team: 0 | 1, side: SideSpec, enemy: SideSpec): BUnit {
    const base = {
      id: this.nextId++, team, star: f.star, items: [...f.items], col: f.col, row: f.row, fromCol: f.col, fromRow: f.row,
      moveT: 1, moveDur: 0, shield: 0, shieldUntil: 0, stunUntil: 0, castLock: 0, target: null, alive: true, sp: {},
      rampAs: 0, revived: false, regenPerS: 0, manaRegen: 0, manaGainMul: 1, goldOut: 0, dealt: 0, taken: 0, dmgMul: 1, powerMul: 1,
      attackTimer: ((this.nextId * 0.137) % 0.5),
    };
    if (f.monster) {
      const m = MONSTERS[f.monster];
      return {
        ...base, monster: f.monster, name: m.name, cls: null, origins: [], hp: m.hp, maxHp: m.hp, atk: m.atk, baseAs: m.as,
        asBonus: 0, range: m.range, armor: m.armor, mana: 0, maxMana: f.monster === 'crusher' ? 90 : 0, crit: 0, critDmg: BASE_CRIT_DMG,
        dodge: 0, power: f.monster === 'crusher' ? 260 : 0, ability: f.monster === 'crusher' ? 'slam' : null, big: true,
      };
    }
    const def = UNIT_BY_ID[f.defId!];
    const cs = CLASS_STATS[def.cls];
    const starMul = STAR_STAT ** (f.star - 1);
    const origins: OriginId[] = f.gilded ? [def.origin, f.gilded] : [def.origin];
    let hp = cs.hp * (1 + COST_SCALE.hp * (def.cost - 1)) * starMul;
    let atk = cs.atk * (1 + COST_SCALE.atk * (def.cost - 1)) * starMul;
    let armor = cs.armor;
    let as = 0;
    let mana = cs.startMana;
    let crit = BASE_CRIT;
    const sp: Partial<Record<Special, number>> = {};
    for (const itemId of f.items) {
      const item = ITEMS[itemId];
      if (!item) continue;
      hp += item.stats.hp ?? 0;
      atk += item.stats.atk ?? 0;
      armor += item.stats.armor ?? 0;
      as += item.stats.as ?? 0;
      mana += item.stats.mana ?? 0;
      crit += item.stats.crit ?? 0;
      if (item.special) sp[item.special.kind] = (sp[item.special.kind] ?? 0) + item.special.value;
    }
    const tv = (t: TraitId) => traitValue(side.traits, t);
    const has = (a: AugmentId) => side.augments.includes(a);
    if (origins.includes('heavy')) armor += tv('heavy');
    armor += tv('guardian');
    armor -= traitValue(enemy.traits, 'magnet');
    if (def.cls === 'brawler') hp += tv('brawler');
    if (def.cls === 'gunner') as += tv('gunner') / 100;
    if (def.cls === 'saboteur') crit += tv('saboteur') / 100;
    if (has('thick-hull')) hp += 150;
    if (has('rapid-fire')) as += 0.15;
    if (has('lucky-bolt')) crit += 0.1;
    if (has('hot-wiring')) mana += 25;
    if (side.season === 'neon') mana += OVERCHARGE_MANA;
    if (sp.hpPct) hp *= 1 + sp.hpPct;
    let powerMul = 1 + (sp.spellPower ?? 0) + (has('big-battery') ? 0.2 : 0);
    if (origins.includes('neon')) powerMul += tv('neon') / 100;
    const dodge = (origins.includes('drone') ? tv('drone') / 100 : 0) + (sp.dodge ?? 0);
    const unit: BUnit = {
      ...base, defId: def.id, name: def.name, cls: def.cls, origins, hp, maxHp: hp, atk, baseAs: cs.as, asBonus: as,
      range: cs.range + (sp.range ?? 0), armor: Math.max(0, armor), mana: Math.min(mana, cs.mana - 1), maxMana: cs.mana, crit,
      critDmg: BASE_CRIT_DMG + (sp.critDmg ?? 0), dodge: Math.min(dodge, 0.6), sp, dmgMul: 1 + (sp.dmgPct ?? 0),
      powerMul, power: cs.power * (1 + COST_SCALE.power * (def.cost - 1)) * STAR_POWER[f.star - 1],
      ability: cs.ability, big: def.cost >= BIG_ABILITY_COST,
      regenPerS: tv('mechanic') + (sp.regen ?? 0) * hp, manaRegen: sp.manaRegen ?? 0,
      manaGainMul: 1 - traitValue(enemy.traits, 'hacker') / 100,
    };
    if (sp.shieldStart) this.giveShield(unit, sp.shieldStart, FIGHT_LIMIT_S, false);
    // Front Plates: the side's front row is row 4 for side 0 and row 3 for side 1.
    if (has('front-plates') && f.row === (team === 0 ? 4 : 3)) this.giveShield(unit, 200, FIGHT_LIMIT_S, false);
    return unit;
  }

  get(id: number) {
    return this.units.find((u) => u.id === id);
  }

  alive(team: 0 | 1) {
    return this.units.filter((u) => u.alive && u.team === team);
  }

  /** Steps the fight on by `STEP_S`. */
  step() {
    if (this.done) return;
    const dt = STEP_S;
    this.time += dt;
    if (!this.leapsDone && this.time >= 0.25) {
      this.leapsDone = true;
      for (const u of this.units) if (u.alive && u.cls === 'saboteur') this.leapBehind(u);
    }
    for (const p of [...this.projectiles]) {
      if (p.at > this.time) continue;
      this.projectiles.splice(this.projectiles.indexOf(p), 1);
      const src = this.get(p.from)!;
      const dst = this.get(p.to);
      if (dst?.alive) this.hit(src, dst, p.dmg, p.ability, p.crit);
    }
    for (const u of this.units) if (u.alive) this.act(u, dt);
    this.checkEnd();
  }

  private act(u: BUnit, dt: number) {
    const terrain = this.terrain.get(`${u.col},${u.row}`);
    if (u.moveDur > 0) {
      u.moveT += dt / u.moveDur;
      if (u.moveT >= 1) {
        u.moveT = 1;
        u.moveDur = 0;
      }
    }
    if (u.shield > 0 && this.time >= u.shieldUntil) u.shield = 0;
    if (terrain === 'furnace') this.hurt(u, 40 * dt, null, true, false, false);
    if (!u.alive) return;
    if (terrain === 'charger') this.gainMana(u, 6 * dt, true);
    if (u.manaRegen) this.gainMana(u, u.manaRegen * dt, true);
    if (u.regenPerS && u.hp < u.maxHp) u.hp = Math.min(u.maxHp, u.hp + u.regenPerS * dt);
    if (u.monster === 'rat') return this.flee(u);
    if (this.time < u.stunUntil || u.moveDur > 0) return;
    if (u.castLock > 0) {
      u.castLock -= dt;
      return;
    }
    if (u.ability && u.maxMana > 0 && u.mana >= u.maxMana) return this.cast(u);
    const target = this.pickTarget(u);
    if (!target) return;
    if (cheb(u, target) > u.range) {
      u.attackTimer = Math.min(u.attackTimer, 0.6);
      this.stepToward(u, target, terrain === 'oil' ? MOVE_S / 0.7 : MOVE_S);
      return;
    }
    const buff = this.time < this.asBuffUntil[u.team] ? SKILL_POWER.overclock.speed : 1;
    const speed = u.baseAs * (1 + u.asBonus + u.rampAs) * buff * (terrain === 'oil' ? 0.7 : 1);
    u.attackTimer += dt * speed;
    if (u.attackTimer >= 1) {
      u.attackTimer -= 1;
      this.attack(u, target);
    }
  }

  private pickTarget(u: BUnit): BUnit | null {
    const current = u.target != null ? this.get(u.target) : null;
    if (current?.alive && cheb(u, current) <= u.range) return current;
    let best: BUnit | null = null;
    for (const e of this.units) {
      if (!e.alive || e.team === u.team) continue;
      if (!best || cheb(u, e) < cheb(u, best) || (cheb(u, e) === cheb(u, best) && dist2(u, e) < dist2(u, best))) best = e;
    }
    u.target = best?.id ?? null;
    return best;
  }

  private free(col: number, row: number) {
    return col >= 0 && row >= 0 && col < BOARD.cols && row < BOARD.rows && !this.occ.has(`${col},${row}`);
  }

  private moveTo(u: BUnit, col: number, row: number, dur: number) {
    this.occ.delete(`${u.col},${u.row}`);
    u.fromCol = u.col;
    u.fromRow = u.row;
    u.col = col;
    u.row = row;
    this.occ.set(`${col},${row}`, u.id);
    u.moveT = dur > 0 ? 0 : 1;
    u.moveDur = dur;
    if (dur > 0) this.events.push({ t: 'move', id: u.id, dur });
  }

  private stepToward(u: BUnit, target: BUnit, dur: number) {
    let best: { col: number; row: number } | null = null;
    let bestD = cheb(u, target) * 100 + dist2(u, target);
    for (let dc = -1; dc <= 1; dc++) for (let dr = -1; dr <= 1; dr++) {
      const c = u.col + dc;
      const r = u.row + dr;
      if ((dc || dr) && this.free(c, r)) {
        const d = cheb({ col: c, row: r }, target) * 100 + dist2({ col: c, row: r }, target);
        if (d < bestD) {
          bestD = d;
          best = { col: c, row: r };
        }
      }
    }
    if (best) this.moveTo(u, best.col, best.row, dur);
  }

  private flee(u: BUnit) {
    if (this.time >= RAT.escapeS) {
      u.alive = false;
      this.occ.delete(`${u.col},${u.row}`);
      this.events.push({ t: 'escape', id: u.id });
      return;
    }
    if (u.moveDur > 0 || this.time < u.stunUntil) return;
    const foes = this.units.filter((e) => e.alive && e.team !== u.team);
    const score = (c: number, r: number) => Math.min(...foes.map((e) => dist2({ col: c, row: r }, e)), 99) - Math.abs(c - 3.5) * 0.2;
    let best = { col: u.col, row: u.row };
    let bestS = score(u.col, u.row);
    for (let dc = -1; dc <= 1; dc++) for (let dr = -1; dr <= 1; dr++) {
      const c = u.col + dc;
      const r = u.row + dr;
      if ((dc || dr) && this.free(c, r) && score(c, r) > bestS) {
        bestS = score(c, r);
        best = { col: c, row: r };
      }
    }
    if (best.col !== u.col || best.row !== u.row) this.moveTo(u, best.col, best.row, 0.34);
  }

  private attack(u: BUnit, target: BUnit) {
    const ranged = u.range > 1;
    const crit = Math.random() < u.crit;
    const rally = this.time < this.rallyUntil[u.team] ? SKILL_POWER.rally.damage : 1;
    let dmg = u.atk * u.dmgMul * rally * (crit ? u.critDmg : 1);
    if (u.cls === 'sniper') dmg *= 1 + traitValue(this.sides[u.team].traits, 'sniper') / 100;
    this.events.push({ t: 'attack', id: u.id, target: target.id, ranged });
    this.gainMana(u, MANA_PER_ATTACK + (u.sp.manaOnHit ?? 0), false);
    if (u.sp.rampAS) u.rampAs = Math.min(0.5, u.rampAs + u.sp.rampAS);
    if (ranged) {
      const dur = 0.1 + cheb(u, target) * 0.08;
      this.projectiles.push({ from: u.id, to: target.id, dmg, ability: false, crit, at: this.time + dur });
      this.events.push({ t: 'proj', from: u.id, to: target.id, kind: 'shot', dur, crit });
    } else {
      this.hit(u, target, dmg, false, crit);
      if (u.sp.cleave) {
        for (const e of this.units) {
          if (e.alive && e.team !== u.team && e !== target && cheb(e, target) <= 1) this.hit(u, e, dmg * u.sp.cleave, false, false);
        }
      }
    }
  }

  /** An attack or ability landing: dodge, armour, shields, then everything that hangs on a hit. */
  private hit(src: BUnit, dst: BUnit, amount: number, ability: boolean, crit: boolean) {
    if (!dst.alive) return;
    if (!ability && Math.random() < dst.dodge) {
      this.events.push({ t: 'dodge', id: dst.id });
      return;
    }
    const terrainArmor = this.terrain.get(`${dst.col},${dst.row}`) === 'plate' ? 25 : 0;
    const dealt = ability ? amount * (1 - (dst.sp.abilityResist ?? 0)) : (amount * 100) / (100 + dst.armor + terrainArmor);
    this.hurt(dst, dealt, src, ability, crit, true);
    if (!ability && dst.sp.thorns && src.alive) this.hurt(src, dealt * dst.sp.thorns, dst, true, false, true);
    if (!ability && src.sp.lifesteal && src.alive) this.heal(src, dealt * src.sp.lifesteal);
    if (dst.monster === 'rat' && dst.alive && dst.goldOut < RAT.maxGold) {
      dst.goldOut += RAT.goldPerHit;
      this.gold[src.team] += RAT.goldPerHit;
      this.events.push({ t: 'gold', team: src.team, id: dst.id, amount: RAT.goldPerHit });
    }
    if (src.sp.execute && dst.alive && dst.hp < dst.maxHp * src.sp.execute && !dst.monster) this.hurt(dst, dst.hp + dst.shield, src, true, false, true);
  }

  private hurt(dst: BUnit, amount: number, src: BUnit | null, ability: boolean, crit: boolean, show: boolean) {
    let left = amount;
    if (dst.shield > 0) {
      const used = Math.min(dst.shield, left);
      dst.shield -= used;
      left -= used;
    }
    // Overkill doesn't count toward the damage meter.
    const real = amount - left + Math.min(left, Math.max(0, dst.hp));
    dst.hp -= left;
    dst.taken += real;
    if (src && src.team !== dst.team) src.dealt += real;
    if (show) this.events.push({ t: 'dmg', id: dst.id, amount: Math.round(amount), crit, ability });
    this.gainMana(dst, Math.min(MANA_PER_HIT_CAP, amount * MANA_PER_DAMAGE), false);
    if (dst.hp > 0) return;
    if (dst.sp.revive && !dst.revived) {
      dst.revived = true;
      dst.hp = dst.maxHp * dst.sp.revive;
      this.events.push({ t: 'revive', id: dst.id });
      return;
    }
    dst.alive = false;
    dst.hp = 0;
    this.occ.delete(`${dst.col},${dst.row}`);
    this.events.push({ t: 'death', id: dst.id });
    if (src?.sp.goldOnKill && src.team !== dst.team) {
      this.gold[src.team] += src.sp.goldOnKill;
      this.events.push({ t: 'gold', team: src.team, id: dst.id, amount: src.sp.goldOnKill });
    }
    const salvage = traitValue(this.sides[dst.team].traits, 'salvager') / 100;
    if (salvage) for (const a of this.alive(dst.team)) if (a.origins.includes('salvager')) a.rampAs += salvage;
  }

  private heal(u: BUnit, amount: number) {
    if (!u.alive || amount <= 0) return;
    const before = u.hp;
    u.hp = Math.min(u.maxHp, u.hp + amount);
    if (u.hp - before >= 1) this.events.push({ t: 'heal', id: u.id, amount: Math.round(u.hp - before) });
  }

  private giveShield(u: BUnit, amount: number, seconds: number, show = true) {
    u.shield = Math.max(u.shield, 0) + amount;
    u.shieldUntil = Math.max(u.shieldUntil, this.time + seconds);
    if (show) this.events.push({ t: 'shield', id: u.id, amount: Math.round(amount) });
  }

  private gainMana(u: BUnit, amount: number, flat: boolean) {
    if (!u.ability || u.maxMana <= 0) return;
    u.mana = Math.min(u.maxMana, u.mana + amount * (flat ? 1 : u.manaGainMul));
  }

  private stun(u: BUnit, seconds: number) {
    if (u.sp.ccImmune || !u.alive) return;
    u.stunUntil = Math.max(u.stunUntil, this.time + seconds);
    this.events.push({ t: 'stun', id: u.id });
  }

  private enemiesOf(u: BUnit) {
    return this.units.filter((e) => e.alive && e.team !== u.team);
  }

  private cast(u: BUnit) {
    u.mana -= u.maxMana;
    u.castLock = 0.45;
    const power = u.power * u.powerMul;
    const crit = !!u.sp.spellCrit && Math.random() < u.crit;
    const dmg = power * (crit ? u.critDmg : 1);
    const enemies = this.enemiesOf(u);
    this.events.push({ t: 'cast', id: u.id, ability: u.ability! });
    switch (u.ability) {
      case 'shield':
        this.giveShield(u, power, SHIELD_S);
        break;
      case 'slam': {
        const reach = u.big ? 2 : 1;
        for (const e of enemies) if (cheb(u, e) <= reach) {
          this.hit(u, e, dmg, true, crit);
          this.stun(e, 1);
        }
        break;
      }
      case 'barrage': {
        const shots = u.big ? 8 : 4;
        for (let i = 0; i < shots && enemies.length; i++) {
          const e = enemies[Math.floor(Math.random() * enemies.length)];
          const dur = 0.3 + i * 0.06;
          this.projectiles.push({ from: u.id, to: e.id, dmg, ability: true, crit, at: this.time + dur });
          this.events.push({ t: 'proj', from: u.id, to: e.id, kind: 'shell', dur, crit });
        }
        break;
      }
      case 'snipe': {
        const far = [...enemies].sort((a, b) => dist2(u, b) - dist2(u, a)).slice(0, u.big ? 2 : 1);
        for (const e of far) {
          this.projectiles.push({ from: u.id, to: e.id, dmg, ability: true, crit, at: this.time + 0.22 });
          this.events.push({ t: 'proj', from: u.id, to: e.id, kind: 'snipe', dur: 0.22, crit });
        }
        break;
      }
      case 'backstab': {
        const weak = [...enemies].sort((a, b) => a.hp - b.hp)[0];
        if (weak) {
          this.blinkNear(u, weak);
          this.hit(u, weak, dmg, true, crit);
          if (u.big) this.stun(weak, 1.2);
        }
        break;
      }
      case 'repair': {
        const hurt = this.alive(u.team).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp).slice(0, u.big ? 2 : 1);
        for (const a of hurt) {
          this.heal(a, power);
          this.giveShield(a, power * 0.3, SHIELD_S);
        }
        break;
      }
    }
    const spark = traitValue(this.sides[u.team].traits, 'sparker');
    if (spark && u.origins.includes('sparker')) {
      const hits = [...this.enemiesOf(u)].sort(() => Math.random() - 0.5).slice(0, 3);
      if (hits.length) this.events.push({ t: 'lightning', from: u.id, to: hits.map((h) => h.id) });
      for (const h of hits) this.hit(u, h, spark, true, false);
    }
    if (u.sp.healOnCast) this.heal(u, u.sp.healOnCast);
  }

  /** Puts `u` on a free tile next to `target`, the one furthest from the target's allies' side. */
  private blinkNear(u: BUnit, target: BUnit) {
    const spots: { col: number; row: number }[] = [];
    for (let dc = -1; dc <= 1; dc++) for (let dr = -1; dr <= 1; dr++) {
      if ((dc || dr) && this.free(target.col + dc, target.row + dr)) spots.push({ col: target.col + dc, row: target.row + dr });
    }
    if (!spots.length) return;
    const back = target.team === 0 ? 1 : -1;
    spots.sort((a, b) => b.row * back - a.row * back || Math.abs(a.col - u.col) - Math.abs(b.col - u.col));
    this.moveTo(u, spots[0].col, spots[0].row, 0);
    u.target = target.id;
    this.events.push({ t: 'blink', id: u.id });
  }

  /** A saboteur's opening jump to the enemy's back line. */
  private leapBehind(u: BUnit) {
    const enemies = this.enemiesOf(u);
    if (!enemies.length) return;
    const backmost = [...enemies].sort((a, b) => (u.team === 0 ? a.row - b.row : b.row - a.row) || dist2(u, a) - dist2(u, b))[0];
    this.blinkNear(u, backmost);
  }

  /** The commander's skill for `team`, once per fight. */
  useSkill(team: 0 | 1): boolean {
    const skill = this.sides[team].skill;
    if (!skill || this.skillUsed[team] || this.done) return false;
    this.skillUsed[team] = true;
    const allies = this.alive(team);
    const foes = this.alive(team === 0 ? 1 : 0);
    const src = allies[0] ?? null;
    if (skill === 'overclock') {
      this.asBuffUntil[team] = this.time + SKILL_POWER.overclock.seconds;
      this.events.push({ t: 'skill', team, skill });
    } else if (skill === 'bulwark') {
      this.events.push({ t: 'skill', team, skill });
      for (const a of allies) this.giveShield(a, SKILL_POWER.bulwark.shield, SKILL_POWER.bulwark.seconds);
    } else if (skill === 'mend') {
      this.events.push({ t: 'skill', team, skill });
      for (const a of allies) this.heal(a, SKILL_POWER.mend.heal);
    } else if (skill === 'surge') {
      this.events.push({ t: 'skill', team, skill });
      for (const a of allies) this.gainMana(a, a.maxMana, true);
    } else if (skill === 'emp') {
      this.events.push({ t: 'skill', team, skill });
      for (const f of foes) {
        f.mana = 0;
        this.stun(f, SKILL_POWER.emp.stunS);
      }
    } else if (skill === 'rally') {
      this.rallyUntil[team] = this.time + SKILL_POWER.rally.seconds;
      this.events.push({ t: 'skill', team, skill });
    } else if (skill === 'airstrike') {
      this.events.push({ t: 'skill', team, skill });
      for (const f of foes) this.hurt(f, SKILL_POWER.airstrike.damage * (1 - (f.sp.abilityResist ?? 0)), src, true, false, true);
    } else {
      const foe = [...foes].sort((a, b) => b.hp - a.hp)[0];
      this.events.push({ t: 'skill', team, skill, target: foe?.id });
      if (foe) {
        this.hurt(foe, SKILL_POWER.zap.damage * (1 - (foe.sp.abilityResist ?? 0)), src, true, false, true);
        this.stun(foe, SKILL_POWER.zap.stunS);
      }
    }
    return true;
  }

  /** The player's zap on the Scrap Rat: a little damage, and the gold a hit shakes loose. */
  zapRat(id: number): boolean {
    const rat = this.get(id);
    if (!rat?.alive || rat.monster !== 'rat') return false;
    const zapper = this.alive(0)[0];
    if (!zapper) return false;
    this.hit(zapper, rat, RAT.zapDamage, true, false);
    return true;
  }

  private checkEnd() {
    const a = this.alive(0).length;
    const b = this.alive(1).length;
    if (a && b && this.time < FIGHT_LIMIT_S) return;
    this.done = true;
    this.winner = a && !b ? 0 : b && !a ? 1 : null;
  }

  /** Runs a fight nobody watches straight to its end; AI sides use their skill early on. */
  runToEnd() {
    while (!this.done) {
      if (this.time >= 4) {
        if (!this.skillUsed[0]) this.useSkill(0);
        if (!this.skillUsed[1]) this.useSkill(1);
      }
      this.step();
      this.events.length = 0;
    }
  }
}
