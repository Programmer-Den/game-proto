import { DT, GRAVITY, WIND_ACC, type Terrain } from './terrain';
import { WEAPONS, type WeaponId } from './weapons';

/**
 * Everything that moves in a match, stepped at a fixed `DT`: moles, shells, flames, bees, crates,
 * balloons, bolts and the particles of every blast. It knows nothing of Phaser; the scene draws it
 * and hands it the player's walking and weapons. Sound and camera shake go out through `Hooks`.
 */

export interface Mole {
  id: number;
  team: number;
  name: string;
  x: number;
  /** Feet: the first earth pixel under the mole while it stands. */
  y: number;
  vx: number;
  vy: number;
  hp: number;
  /** Health it starts with and heals up to (more with the Quartermaster's helmets). */
  maxHp: number;
  alive: boolean;
  grounded: boolean;
  facing: 1 | -1;
  /** -1, 0 or 1 while walking under control. */
  walk: number;
  walkT: number;
  /** Seconds left of the hurt wobble. */
  hurtT: number;
  shield: boolean;
  /** An action under way that holds the mole: digging, hopping through the ground, a ground pound, dying. */
  act: null | { kind: 'dig' | 'hop' | 'pound' | 'die' | 'swipe' | 'throw' | 'recoil' | 'cheer'; t: number; dur: number; dx?: number; dy?: number; tx?: number; ty?: number; phase?: number };
  /** What it wears on its helmet: the boss's crown, or a hat (null for none). */
  hat: string | null;
  /** Hidden in the ground during a Tunnel Hop. */
  hidden: boolean;
  drowned: boolean;
  /** Fall height since leaving the ground, for fall damage. */
  fallFrom: number;
  /** Blink timer, for the idle animation. */
  blink: number;
}

export type ShotKind = WeaponId | 'bomblet' | 'mini' | 'acorn' | 'seed';

export interface Shot {
  kind: ShotKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  team: number;
  owner: Mole | null;
  state: 'fly' | 'roll' | 'drill' | 'rest';
  /** Seconds left before it goes off, or -1. */
  fuse: number;
  bounces: number;
  dir: number;
  spin: number;
  /** Mines: armed, and seconds left once tripped (-1 until then). */
  armed: boolean;
  trip: number;
  target: Mole | null;
  /** Firing point, for the long-shot trophy. */
  fromX: number;
  gone: boolean;
}

export interface Flame { x: number; y: number; vx: number; vy: number; life: number; ground: boolean; tick: number; team: number }
export interface Bee { x: number; y: number; vx: number; vy: number; life: number; tick: number; team: number; target: Mole | null; wob: number }
export interface Crate { x: number; y: number; vy: number; kind: 'weapon' | 'health'; weapon: WeaponId | null; landed: boolean; gone: boolean; sway: number }
export interface Balloon { x: number; y: number; dir: number; targetX: number; dropped: number; team: number; owner: Mole }
export interface Bolt { x: number; t: number; y: number; struck: boolean; team: number; owner: Mole }
export interface Beam { x: number; y: number; ex: number; ey: number; t: number }
/** A powder keg standing on the map: any blast in reach sets it off. */
export interface Keg { x: number; y: number; vy: number; landed: boolean; gone: boolean }
export interface Mound { x: number; y: number; team: number; name: string; drowned: boolean }

export type ParticleKind = 'dirt' | 'smoke' | 'spark' | 'fire' | 'flash' | 'ring' | 'drop' | 'heal' | 'feather' | 'swoosh' | 'star';
export interface Particle { kind: ParticleKind; x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: number; grav: number; rot: number }

export interface Pop { x: number; y: number; text: string; color: number; t: number }

export type Sfx =
  | 'launch' | 'throw' | 'boom' | 'bigBoom' | 'smallBoom' | 'bounce' | 'boing' | 'splash' | 'fuse' | 'beep' | 'buzz' | 'zap'
  | 'beam' | 'dig' | 'jump' | 'land' | 'hurt' | 'heal' | 'shield' | 'quake' | 'pop' | 'whoosh' | 'thud' | 'crack'
  | 'split' | 'sizzle' | 'thunder' | 'poof' | 'collect' | 'balloon';

export interface Hooks {
  sound(name: Sfx): void;
  shake(power: number): void;
}

/** What happened this turn, for the trophies and the AI's log. */
export interface TurnLog {
  enemiesHurt: Set<number>;
  drownedEnemies: number;
  ownLost: number;
  damage: number;
  longShot: boolean;
}

const FALL_SAFE = 360;
const MAX_PARTICLES = 900;
const WALK_SPEED = 55;
export const MAX_HP = 100;

export class World {
  moles: Mole[] = [];
  shots: Shot[] = [];
  flames: Flame[] = [];
  bees: Bee[] = [];
  crates: Crate[] = [];
  balloons: Balloon[] = [];
  bolts: Bolt[] = [];
  beams: Beam[] = [];
  mounds: Mound[] = [];
  kegs: Keg[] = [];
  /** Rain puts flames out twice as fast. */
  rain = false;
  /** The colour of a splash: water, or the lava of the ember theme. */
  splash = 0xbfe6ff;
  particles: Particle[] = [];
  pops: Pop[] = [];
  wind = 0;
  time = 0;
  quakeT = 0;
  private quakeTick = 0;
  craters = 0;
  log: TurnLog = World.freshLog();
  /** Set while a blast goes off, so mines and crates set off in it wait a step. */
  private pending: (() => void)[] = [];

  constructor(public terrain: Terrain, public water: number, private hooks: Hooks, public dirtColors: number[]) {}

  static freshLog(): TurnLog {
    return { enemiesHurt: new Set(), drownedEnemies: 0, ownLost: 0, damage: 0, longShot: false };
  }

  addMole(team: number, name: string, x: number, y: number, maxHp = MAX_HP) {
    const m: Mole = {
      id: this.moles.length, team, name, x, y, vx: 0, vy: 0, hp: maxHp, maxHp, alive: true, grounded: true, facing: team === 0 ? 1 : -1,
      walk: 0, walkT: 0, hurtT: 0, shield: false, act: null, hat: null, hidden: false, drowned: false, fallFrom: y, blink: Math.random() * 3,
    };
    this.moles.push(m);
    return m;
  }

  /** Whether anything is still moving, burning, flying or counting down. */
  busy() {
    if (this.shots.some((s) => !(s.kind === 'mine' && s.state === 'rest' && s.trip < 0))) return true;
    if (this.flames.length || this.bees.length || this.balloons.length || this.bolts.length || this.beams.length || this.quakeT > 0) return true;
    if (this.crates.some((c) => !c.landed && !c.gone) || this.kegs.some((k) => !k.landed)) return true;
    return this.moles.some((m) => m.alive && (!m.grounded || (m.act && m.act.kind !== 'cheer')));
  }

  step() {
    this.time += DT;
    const later = this.pending;
    this.pending = [];
    for (const fn of later) fn();
    for (const m of this.moles) this.stepMole(m);
    for (const s of this.shots) if (!s.gone) this.stepShot(s);
    this.shots = this.shots.filter((s) => !s.gone);
    this.stepFlames();
    this.stepBees();
    this.stepCrates();
    this.stepKegs();
    this.stepBalloons();
    this.stepBolts();
    for (const b of this.beams) b.t -= DT;
    this.beams = this.beams.filter((b) => b.t > 0);
    if (this.quakeT > 0) this.stepQuake();
    this.stepParticles();
    for (const p of this.pops) p.t += DT;
    this.pops = this.pops.filter((p) => p.t < 1.3);
  }

  // ---------------------------------------------------------------- moles

  private stepMole(m: Mole) {
    m.blink -= DT;
    if (m.blink < -0.12) m.blink = 2 + Math.random() * 3;
    if (m.hurtT > 0) m.hurtT -= DT;
    if (!m.alive) return;
    if (m.act) {
      if (this.stepAct(m)) return;
    }
    const t = this.terrain;
    if (m.grounded) {
      if (m.walk) this.walkStep(m, m.walk);
      else m.walkT = 0;
      if (!t.solid(m.x, m.y) && !t.solid(m.x, m.y + 1)) {
        m.grounded = false;
        m.vx = 0;
        m.vy = 0;
        m.fallFrom = m.y;
      } else if (!t.solid(m.x, m.y)) m.y += 1;
      // Earth heaped on top: climb out of it.
      for (let i = 0; i < 40 && t.solid(m.x, m.y - 2); i++) m.y -= 1;
    } else {
      this.airStep(m);
    }
    if (m.y > this.water + 4 || m.x < -40 || m.x > t.w + 40) this.drown(m);
  }

  private walkStep(m: Mole, dir: number) {
    const t = this.terrain;
    m.facing = dir > 0 ? 1 : -1;
    m.walkT += DT;
    const nx = m.x + dir * WALK_SPEED * DT;
    let ny = m.y;
    if (t.solid(nx, ny - 1)) {
      let up = 1;
      while (up <= 5 && t.solid(nx, ny - 1 - up)) up++;
      if (up > 5) return;
      ny -= up;
    }
    if (t.solid(nx, ny - 12) || t.solid(nx, ny - 18)) return;
    if (!t.solid(nx, ny)) {
      let down = 1;
      while (down <= 5 && !t.solid(nx, ny + down)) down++;
      if (down > 5) {
        m.x = nx;
        m.grounded = false;
        m.vx = dir * 40;
        m.vy = 0;
        m.fallFrom = m.y;
        return;
      }
      ny += down;
    }
    m.x = nx;
    m.y = ny;
  }

  private airStep(m: Mole) {
    const t = this.terrain;
    m.vy = Math.min(m.vy + GRAVITY * DT, 900);
    const n = Math.max(1, Math.ceil((Math.max(Math.abs(m.vx), Math.abs(m.vy)) * DT) / 2));
    for (let k = 0; k < n; k++) {
      const nx = m.x + (m.vx * DT) / n;
      if (t.solid(nx, m.y - 9) || t.solid(nx, m.y - 17)) m.vx *= -0.3;
      else m.x = nx;
      const ny = m.y + (m.vy * DT) / n;
      if (m.vy > 0 && t.solid(m.x, ny)) {
        this.land(m, Math.floor(ny));
        return;
      }
      if (m.vy < 0 && t.solid(m.x, ny - 19)) m.vy = 0;
      else m.y = ny;
    }
  }

  private land(m: Mole, y: number) {
    const t = this.terrain;
    m.y = y;
    for (let i = 0; i < 10 && t.solid(m.x, m.y - 1); i++) m.y -= 1;
    const speed = m.vy;
    if (speed > 220 && Math.abs(m.vx) > 120) {
      // Knocked hard: a bounce and a skid.
      m.vy = -speed * 0.25;
      m.vx *= 0.45;
      m.y -= 1;
      this.hooks.sound('land');
      this.dust(m.x, m.y, 4);
      return;
    }
    if (speed > FALL_SAFE) {
      const dmg = Math.round((speed - FALL_SAFE) / 9);
      if (dmg > 0) this.hurt(m, dmg, -1);
    }
    if (speed > 120) {
      this.hooks.sound('land');
      this.dust(m.x, m.y, 5);
    }
    m.grounded = true;
    m.vx = 0;
    m.vy = 0;
    if (m.act?.kind === 'pound') this.poundLand(m);
  }

  jump(m: Mole, back = false) {
    if (!m.grounded || m.act) return;
    m.grounded = false;
    m.fallFrom = m.y;
    m.vy = back ? -330 : -230;
    m.vx = back ? -m.facing * 50 : m.facing * 115;
    m.y -= 2;
    this.hooks.sound('jump');
  }

  hurt(m: Mole, dmg: number, team: number, ownerX?: number, kind?: ShotKind) {
    if (!m.alive || dmg <= 0) return;
    if (m.shield) {
      m.shield = false;
      this.pops.push({ x: m.x, y: m.y - 30, text: '🛡', color: 0x8fd3ff, t: 0 });
      this.hooks.sound('shield');
      for (let i = 0; i < 14; i++) this.particle('spark', m.x, m.y - 10, rnd(-120, 120), rnd(-120, 60), 0.5, 3, 0x8fd3ff, 0);
      return;
    }
    m.hp = Math.max(0, m.hp - dmg);
    m.hurtT = 0.7;
    this.pops.push({ x: m.x, y: m.y - 32, text: `-${dmg}`, color: m.team === 0 ? 0x3d8be0 : 0xe8a33d, t: 0 });
    this.hooks.sound('hurt');
    if (team >= 0 && team !== m.team) {
      this.log.enemiesHurt.add(m.id);
      this.log.damage += dmg;
      if (ownerX !== undefined && Math.abs(ownerX - m.x) > 500 && (kind === 'rocket' || kind === 'heavy')) this.log.longShot = true;
    }
  }

  knock(m: Mole, vx: number, vy: number) {
    if (!m.alive || m.hidden) return;
    if (m.act && m.act.kind !== 'die') m.act = null;
    m.grounded = false;
    m.fallFrom = m.y;
    m.vx = vx;
    m.vy = vy;
    m.y -= 2;
  }

  private drown(m: Mole) {
    if (!m.alive) return;
    m.alive = false;
    m.drowned = true;
    m.hp = 0;
    m.act = null;
    this.hooks.sound('splash');
    const x = Math.max(4, Math.min(this.terrain.w - 4, m.x));
    for (let i = 0; i < 18; i++) this.particle('drop', x, this.water, rnd(-90, 90), rnd(-260, -80), 0.9, rnd(2, 4), this.splash, 1);
    this.mounds.push({ x, y: this.water, team: m.team, name: m.name, drowned: true });
    if (this.turnTeam >= 0) {
      if (m.team !== this.turnTeam) this.log.drownedEnemies++;
      else this.log.ownLost++;
    }
  }

  /** The team whose turn it is, for the turn log; -1 between turns. */
  turnTeam = -1;

  /** Moles at 0 health start their last animation; returns whether any did. */
  startDeaths() {
    let any = false;
    for (const m of this.moles)
      if (m.alive && m.hp <= 0 && !m.act) {
        m.act = { kind: 'die', t: 0, dur: 1.1 };
        any = true;
      }
    return any;
  }

  private stepAct(m: Mole): boolean {
    const a = m.act!;
    a.t += DT;
    const t = this.terrain;
    switch (a.kind) {
      case 'die':
        if (a.t >= a.dur) {
          m.act = null;
          m.alive = false;
          this.hooks.sound('poof');
          this.dust(m.x, m.y, 14);
          for (let i = 0; i < 8; i++) this.particle('smoke', m.x + rnd(-8, 8), m.y - 10, rnd(-20, 20), rnd(-40, -10), 1, rnd(5, 9), 0xd8d0c4, -10);
          this.mounds.push({ x: m.x, y: m.y, team: m.team, name: m.name, drowned: false });
          if (this.turnTeam >= 0 && m.team === this.turnTeam) this.log.ownLost++;
        }
        return true;
      case 'dig': {
        const sp = 58;
        m.x += a.dx! * sp * DT;
        m.y += a.dy! * sp * DT;
        if (Math.floor(a.t * 60) % 3 === 0) t.carve(m.x + a.dx! * 6, m.y - 9 + a.dy! * 6, 12);
        if (Math.floor(a.t * 60) % 4 === 0) {
          this.particle('dirt', m.x + a.dx! * 10, m.y - 9, -a.dx! * rnd(30, 90), rnd(-120, -40), 0.6, rnd(2, 4), this.dirt(), 1);
          this.hooks.sound('dig');
        }
        if (a.t >= a.dur || m.y > this.water) {
          m.act = null;
          m.grounded = false;
          m.vx = 0;
          m.vy = 0;
        }
        return true;
      }
      case 'hop':
        if (a.phase === 0 && a.t >= 0.5) {
          a.phase = 1;
          m.hidden = true;
          this.dust(m.x, m.y, 10);
          this.hooks.sound('poof');
        } else if (a.phase === 1 && a.t >= 0.9) {
          a.phase = 2;
          m.hidden = false;
          m.x = a.tx!;
          m.y = a.ty!;
          for (let i = 0; i < 30 && t.solid(m.x, m.y - 2); i++) m.y -= 2;
          this.dust(m.x, m.y, 10);
          for (let i = 0; i < 10; i++) this.particle('star', m.x, m.y - 10, rnd(-80, 80), rnd(-100, 20), 0.6, 3, 0xfff1a8, 0);
          this.hooks.sound('pop');
        } else if (a.phase === 2 && a.t >= 1.25) {
          m.act = null;
          m.grounded = false;
          m.vx = 0;
          m.vy = 0;
          m.fallFrom = m.y;
        }
        return true;
      case 'pound':
        // The jump up is ordinary flight; the slam comes on landing (see `land`).
        return false;
      case 'swipe':
      case 'throw':
      case 'recoil':
      case 'cheer':
        if (a.t >= a.dur) m.act = null;
        return false;
    }
  }

  // ---------------------------------------------------------------- weapons

  private shot(kind: ShotKind, x: number, y: number, vx: number, vy: number, team: number, owner: Mole | null): Shot {
    const s: Shot = {
      kind, x, y, vx, vy, age: 0, team, owner, state: 'fly', fuse: -1, bounces: 0, dir: Math.sign(vx) || 1, spin: 0,
      armed: false, trip: -1, target: null, fromX: owner?.x ?? x, gone: false,
    };
    this.shots.push(s);
    return s;
  }

  /** Where an aimed shell leaves a mole aiming at `angle` (radians, 0 right, negative up). */
  static muzzle(m: Mole, angle: number) {
    return { x: m.x + Math.cos(angle) * 16, y: m.y - 12 + Math.sin(angle) * 16 };
  }

  /** Fires an aimed or thrown weapon. */
  fire(m: Mole, id: WeaponId, angle: number, power: number) {
    const w = WEAPONS[id];
    const p = World.muzzle(m, angle);
    const speed = w.speed * Math.max(0.05, power);
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;
    m.facing = Math.cos(angle) >= 0 ? 1 : -1;
    if (w.group === 'throw') {
      m.act = { kind: 'throw', t: 0, dur: 0.35 };
      this.hooks.sound('throw');
    } else {
      m.act = { kind: 'recoil', t: 0, dur: 0.3 };
      this.hooks.sound('launch');
      for (let i = 0; i < 6; i++) this.particle('smoke', p.x, p.y, -vx * 0.05 + rnd(-20, 20), -vy * 0.05 + rnd(-20, 20), 0.6, rnd(3, 6), 0xeeeeee, -20);
    }
    if (id === 'firecracker') {
      for (let i = 0; i < 5; i++) {
        const spread = (i - 2) * 0.035;
        const a = angle + spread;
        const s = this.shot('mini', p.x, p.y, Math.cos(a) * speed, Math.sin(a) * speed, m.team, m);
        s.age = -i * 0.12;
      }
      return;
    }
    const s = this.shot(id, p.x, p.y, vx, vy, m.team, m);
    if (id === 'grenade' || id === 'cluster') s.fuse = 3;
    if (id === 'bouncer') s.fuse = 6;
    if (id === 'roller') s.fuse = 7;
    if (id === 'seeker') s.target = this.nearestEnemy(m.team, m.x, m.y);
  }

  /** The Fire button for `use` weapons, and a tapped spot for `target` ones. */
  use(m: Mole, id: WeaponId, angle: number, tx = 0, ty = 0) {
    const t = this.terrain;
    switch (id) {
      case 'mine': {
        const s = this.shot('mine', m.x + m.facing * 10, m.y - 8, m.facing * 40, -60, m.team, m);
        s.fuse = -1;
        this.hooks.sound('throw');
        m.act = { kind: 'throw', t: 0, dur: 0.35 };
        break;
      }
      case 'dynamite': {
        const s = this.shot('dynamite', m.x + m.facing * 8, m.y - 8, m.facing * 30, -50, m.team, m);
        s.fuse = 4.5;
        this.hooks.sound('fuse');
        m.act = { kind: 'throw', t: 0, dur: 0.35 };
        break;
      }
      case 'skyrain': {
        const dir = tx < t.w / 2 ? 1 : -1;
        this.balloons.push({ x: dir > 0 ? -60 : t.w + 60, y: 46, dir, targetX: tx, dropped: 0, team: m.team, owner: m });
        this.hooks.sound('balloon');
        m.act = { kind: 'cheer', t: 0, dur: 0.8 };
        break;
      }
      case 'bolt':
        this.bolts.push({ x: tx, t: 0, y: 0, struck: false, team: m.team, owner: m });
        this.hooks.sound('thunder');
        m.act = { kind: 'cheer', t: 0, dur: 0.8 };
        break;
      case 'quake':
        this.quakeT = 1.8;
        this.quakeTick = 0;
        this.hooks.sound('quake');
        for (const o of this.moles) if (o.alive && o !== m) this.hurt(o, 10, m.team);
        break;
      case 'swipe': {
        m.act = { kind: 'swipe', t: 0, dur: 0.4 };
        this.hooks.sound('whoosh');
        this.particle('swoosh', m.x + m.facing * 12, m.y - 12, 0, 0, 0.3, 16, 0xffffff, 0, m.facing);
        for (const o of this.moles) {
          if (!o.alive || o === m || o.hidden) continue;
          const dx = (o.x - m.x) * m.facing;
          if (dx >= -2 && dx < 28 && Math.abs(o.y - m.y) < 20) {
            this.hurt(o, 20, m.team);
            this.knock(o, m.facing * 270, -240);
            this.hooks.sound('thud');
            for (let i = 0; i < 6; i++) this.particle('star', o.x, o.y - 14, rnd(-80, 80), rnd(-120, -20), 0.6, 3, 0xffe066, 0);
          }
        }
        break;
      }
      case 'pound':
        m.act = { kind: 'pound', t: 0, dur: 9 };
        m.grounded = false;
        m.fallFrom = m.y + 1000;
        m.vy = -300;
        m.vx = 0;
        m.y -= 2;
        this.hooks.sound('jump');
        break;
      case 'gust': {
        // A blast of air the way you point: moles, kegs and loose bombs in front fly off.
        m.act = { kind: 'swipe', t: 0, dur: 0.4 };
        m.facing = Math.cos(angle) >= 0 ? 1 : -1;
        this.hooks.sound('whoosh');
        const cx = m.x;
        const cy = m.y - 12;
        const inCone = (x: number, y: number, reach: number) => {
          const d = Math.hypot(x - cx, y - cy);
          if (d > reach || d < 1) return 0;
          let diff = Math.atan2(y - cy, x - cx) - angle;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          return Math.abs(diff) < 0.6 ? 1 - d / (reach * 1.25) : 0;
        };
        for (const o of this.moles) {
          if (o === m || !o.alive || o.hidden) continue;
          const f = inCone(o.x, o.y - 10, 170);
          if (f > 0) this.knock(o, Math.cos(angle) * 480 * f, Math.sin(angle) * 480 * f - 160);
        }
        for (const s of this.shots) {
          const f = inCone(s.x, s.y, 170);
          if (f > 0 && s.target === null) {
            s.state = 'fly';
            s.vx += Math.cos(angle) * 380 * f;
            s.vy += Math.sin(angle) * 380 * f - 120;
          }
        }
        for (const k of this.kegs) {
          const f = inCone(k.x, k.y - 9, 150);
          if (f > 0) {
            k.landed = false;
            // Slid along a pixel at a time, stopping at a bank of earth rather than going into it.
            const dx = Math.cos(angle) * 40 * f;
            for (let i = 0; i < Math.abs(dx) && !t.solid(k.x + Math.sign(dx), k.y - 6); i++) k.x += Math.sign(dx);
            k.vy = -140 * f;
          }
        }
        for (let i = 0; i < 5; i++)
          this.particle('swoosh', cx + Math.cos(angle) * (20 + i * 22), cy + Math.sin(angle) * (20 + i * 22), Math.cos(angle) * 120, Math.sin(angle) * 120, 0.45, 10 + i * 3, 0xe8f6ff, 0, m.facing);
        break;
      }
      case 'burrow': {
        let dx = Math.cos(angle);
        let dy = Math.sin(angle);
        // Dig no steeper than 60° up or down.
        if (Math.abs(dy) > 0.87) {
          dy = Math.sign(dy) * 0.87;
          dx = Math.sign(dx || m.facing) * 0.5;
        }
        m.facing = dx >= 0 ? 1 : -1;
        m.act = { kind: 'dig', t: 0, dur: 1.7, dx, dy };
        this.hooks.sound('dig');
        break;
      }
      case 'beam':
        this.sunbeam(m, angle);
        break;
      case 'hop': {
        let y = ty;
        for (let i = 0; i < 80 && t.solid(tx, y - 4); i++) y -= 2;
        m.act = { kind: 'hop', t: 0, dur: 2, tx, ty: y, phase: 0 };
        this.hooks.sound('dig');
        break;
      }
      case 'shield':
        m.shield = true;
        this.hooks.sound('shield');
        for (let i = 0; i < 16; i++) this.particle('spark', m.x + rnd(-14, 14), m.y - 10 + rnd(-14, 14), 0, rnd(-30, -10), 0.7, 2, 0x8fd3ff, 0);
        break;
      case 'repair':
        m.hp = Math.min(m.maxHp, m.hp + 30);
        this.pops.push({ x: m.x, y: m.y - 32, text: '+30', color: 0x3fae4a, t: 0 });
        this.hooks.sound('heal');
        for (let i = 0; i < 12; i++) this.particle('heal', m.x + rnd(-12, 12), m.y - rnd(0, 20), rnd(-10, 10), rnd(-60, -30), 1, 4, 0x4cc65a, 0);
        m.act = { kind: 'cheer', t: 0, dur: 0.8 };
        break;
      case 'skip':
        break;
      default:
        break;
    }
  }

  private sunbeam(m: Mole, angle: number) {
    const t = this.terrain;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    let x = m.x + dx * 12;
    let y = m.y - 12 + dy * 12;
    const hit = new Set<Mole>();
    let earth = 0;
    let len = 0;
    for (; len < 1400 && earth < 300; len += 2) {
      x += dx * 2;
      y += dy * 2;
      if (x < -20 || x > t.w + 20 || y < -20 || y > this.water) break;
      if (t.solid(x, y)) {
        earth += 2;
        if (len % 6 === 0) t.carve(x, y, 7);
      }
      for (const o of this.moles)
        if (o.alive && o !== m && !o.hidden && !hit.has(o) && (o.x - x) ** 2 + (o.y - 10 - y) ** 2 < 144) {
          hit.add(o);
          this.hurt(o, 30, m.team);
          this.knock(o, dx * 160, dy * 160 - 120);
        }
    }
    this.beams.push({ x: m.x + dx * 12, y: m.y - 12 + dy * 12, ex: x, ey: y, t: 0.9 });
    this.hooks.sound('beam');
    if (earth) this.craters++;
    m.act = { kind: 'recoil', t: 0, dur: 0.5 };
  }

  private poundLand(m: Mole) {
    m.act = null;
    this.hooks.sound('thud');
    this.hooks.shake(6);
    this.terrain.carve(m.x, m.y + 6, 26);
    this.craters++;
    this.ring(m.x, m.y, 50, 0xfff1c8);
    this.dust(m.x, m.y, 18);
    for (const o of this.moles) {
      if (!o.alive || o === m || o.hidden) continue;
      const d = Math.hypot(o.x - m.x, o.y - m.y);
      if (d < 50) {
        this.hurt(o, 25, m.team);
        this.knock(o, Math.sign(o.x - m.x || 1) * 200, -300);
      }
    }
    m.grounded = false;
  }

  nearestEnemy(team: number, x: number, y: number) {
    let best: Mole | null = null;
    let bd = Infinity;
    for (const m of this.moles) {
      if (!m.alive || m.team === team || m.hidden) continue;
      const d = Math.hypot(m.x - x, m.y - y);
      if (d < bd) {
        bd = d;
        best = m;
      }
    }
    return best;
  }

  private stepShot(s: Shot) {
    s.age += DT;
    if (s.age < 0) return;
    const t = this.terrain;
    if (s.fuse > 0) {
      s.fuse -= DT;
      if (s.fuse <= 0) {
        this.goOff(s);
        return;
      }
    }
    const windAx = this.wind * WIND_ACC * windFactor(s.kind);
    switch (s.state) {
      case 'fly': {
        if (s.kind === 'seeker' && s.age > 0.45 && s.age < 3.5 && s.target?.alive) {
          const want = Math.atan2(s.target.y - 10 - s.y, s.target.x - s.x);
          const have = Math.atan2(s.vy, s.vx);
          let d = want - have;
          while (d > Math.PI) d -= Math.PI * 2;
          while (d < -Math.PI) d += Math.PI * 2;
          const turn = Math.max(-3.2 * DT, Math.min(3.2 * DT, d));
          const sp = Math.max(260, Math.hypot(s.vx, s.vy));
          s.vx = Math.cos(have + turn) * sp;
          s.vy = Math.sin(have + turn) * sp - GRAVITY * DT;
          if (Math.floor(s.age * 60) % 6 === 0) this.particle('spark', s.x, s.y, rnd(-20, 20), rnd(-20, 20), 0.3, 2, 0xffe066, 0);
        }
        const prevVy = s.vy;
        const res = this.move(s, windAx);
        if (s.kind === 'splitter' && prevVy < 0 && s.vy >= 0) {
          this.split(s);
          return;
        }
        // Smoke trails behind rockets.
        if (isRocket(s.kind) && Math.floor(s.age * 60) % 2 === 0)
          this.particle('smoke', s.x - s.vx * 0.012, s.y - s.vy * 0.012, rnd(-8, 8), rnd(-14, 0), 0.55, s.kind === 'heavy' ? 5 : 3.2, 0xf4f1ea, -16);
        if (s.kind === 'ember' && Math.floor(s.age * 60) % 3 === 0) this.particle('fire', s.x, s.y - 4, rnd(-10, 10), rnd(-40, -10), 0.3, 3, 0xffa13d, -30);
        if (s.kind === 'dynamite' || s.kind === 'grenade' || s.kind === 'cluster') this.fuseSpark(s);
        s.spin += s.vx * DT * 0.08;
        if (!res) {
          if (s.y > this.water) this.sink(s);
          else if (s.x < -80 || s.x > t.w + 80) s.gone = true;
          return;
        }
        this.contact(s, res);
        return;
      }
      case 'drill': {
        s.x += s.vx * DT;
        s.y += s.vy * DT;
        if (Math.floor(s.age * 60) % 2 === 0) t.carve(s.x, s.y, 10);
        if (Math.floor(s.age * 60) % 5 === 0) {
          this.particle('dirt', s.x, s.y, rnd(-60, 60), rnd(-140, -50), 0.6, rnd(2, 4), this.dirt(), 1);
          this.hooks.sound('dig');
        }
        s.spin += DT * 30;
        const hitMole = this.moleAt(s.x, s.y, 11, null);
        // A boring drill counts its time down in `dir`.
        s.dir -= DT;
        if (hitMole || s.dir <= 0 || s.y > this.water) this.goOff(s);
        return;
      }
      case 'roll': {
        s.spin += s.dir * DT * 9;
        const nx = s.x + s.dir * 95 * DT;
        let ny = s.y;
        if (t.solid(nx, ny - 1)) {
          let up = 1;
          while (up <= 3 && t.solid(nx, ny - 1 - up)) up++;
          if (up > 3) {
            s.dir = -s.dir;
            s.bounces++;
            this.hooks.sound('bounce');
            if (s.bounces >= 3) this.goOff(s);
            return;
          }
          ny -= up;
        }
        if (!t.solid(nx, ny)) {
          let down = 1;
          while (down <= 6 && !t.solid(nx, ny + down)) down++;
          if (down > 6) {
            s.state = 'fly';
            s.vx = s.dir * 95;
            s.vy = 0;
            s.x = nx;
            return;
          }
          ny += down;
        }
        s.x = nx;
        s.y = ny;
        if (this.moleAt(s.x, s.y - 6, 13, null) || s.y > this.water) this.goOff(s);
        return;
      }
      case 'rest': {
        if (s.kind === 'sap') {
          // Stuck fast: it rides on the mole it hit, or stays where it struck the earth.
          if (s.target?.alive && !s.target.hidden) {
            s.x = s.target.x;
            s.y = s.target.y - 12;
          }
          this.fuseSpark(s);
          return;
        }
        if (s.kind === 'mine') this.stepMine(s);
        else if (s.kind === 'dynamite' || s.kind === 'grenade' || s.kind === 'cluster') this.fuseSpark(s);
        // Ground gone: fall again.
        if (!t.solid(s.x, s.y + 4) && !t.solid(s.x, s.y + 5)) {
          s.state = 'fly';
          s.vx = 0;
          s.vy = 0;
        }
        return;
      }
    }
  }

  private fuseSpark(s: Shot) {
    if (Math.floor(s.age * 60) % 3 === 0) this.particle('spark', s.x, s.y - 7, rnd(-30, 30), rnd(-60, -20), 0.25, 1.6, 0xffd34d, 60);
  }

  private stepMine(s: Shot) {
    if (!s.armed) {
      if (s.age > 1.2) s.armed = true;
      return;
    }
    if (s.trip < 0) {
      if (this.moles.some((m) => m.alive && !m.hidden && Math.hypot(m.x - s.x, m.y - 6 - s.y) < 22)) {
        s.trip = 0.8;
        this.hooks.sound('beep');
      }
      return;
    }
    s.trip -= DT;
    if (Math.floor(s.trip * 10) !== Math.floor((s.trip + DT) * 10) && Math.floor(s.trip * 10) % 3 === 0) this.hooks.sound('beep');
    if (s.trip <= 0) this.goOff(s);
  }

  /** Moves a flying shot one step; returns what it touched. */
  private move(s: Shot, ax: number): null | { earth: boolean; mole: Mole | null } {
    const t = this.terrain;
    s.vx += ax * DT;
    s.vy += GRAVITY * DT;
    const n = Math.max(1, Math.ceil((Math.max(Math.abs(s.vx), Math.abs(s.vy)) * DT) / 2.5));
    for (let k = 0; k < n; k++) {
      const nx = s.x + (s.vx * DT) / n;
      const ny = s.y + (s.vy * DT) / n;
      if (t.solid(nx, ny)) return { earth: true, mole: null };
      s.x = nx;
      s.y = ny;
      if (hitsMoles(s.kind)) {
        const m = this.moleAt(s.x, s.y, 11, s.age < 0.12 ? s.owner : null);
        if (m) return { earth: false, mole: m };
      }
      if (s.y > this.water + 2) return null;
    }
    return null;
  }

  private moleAt(x: number, y: number, r: number, skip: Mole | null) {
    for (const m of this.moles) {
      if (!m.alive || m.hidden || m === skip) continue;
      if ((m.x - x) ** 2 + (m.y - 10 - y) ** 2 < r * r) return m;
    }
    return null;
  }

  private contact(s: Shot, res: { earth: boolean; mole: Mole | null }) {
    const t = this.terrain;
    switch (s.kind) {
      case 'grenade':
      case 'cluster':
      case 'bouncer':
      case 'mine':
      case 'dynamite': {
        if (res.mole) {
          if (s.kind === 'bouncer') return this.goOff(s);
          s.vx *= -0.3;
          s.vy *= -0.3;
          return;
        }
        const n = t.normal(s.x, s.y);
        const dot = s.vx * n.x + s.vy * n.y;
        const rest = s.kind === 'bouncer' ? 0.82 : s.kind === 'grenade' || s.kind === 'cluster' ? 0.45 : 0.2;
        s.vx = (s.vx - 2 * dot * n.x) * rest;
        s.vy = (s.vy - 2 * dot * n.y) * rest;
        const speed = Math.hypot(s.vx, s.vy);
        if (speed > 60) {
          s.bounces++;
          this.hooks.sound(s.kind === 'bouncer' ? 'boing' : 'bounce');
          if (s.kind === 'bouncer') {
            this.particle('ring', s.x, s.y, 0, 0, 0.25, 10, 0xff9ad5, 0);
            if (s.bounces >= 5) return this.goOff(s);
          }
        }
        // Nudge out of the earth.
        for (let i = 0; i < 6 && t.solid(s.x, s.y); i++) {
          s.x += n.x;
          s.y += n.y;
        }
        if (speed < 40 && n.y < -0.5) {
          s.state = 'rest';
          s.vx = 0;
          s.vy = 0;
          for (let i = 0; i < 8 && !t.solid(s.x, s.y + 4); i++) s.y += 1;
        }
        return;
      }
      case 'roller':
        if (res.mole) return this.goOff(s);
        if (s.vy > 0) {
          s.state = 'roll';
          s.dir = Math.sign(s.vx) || s.dir;
          this.hooks.sound('thud');
        } else {
          s.vy = 0;
          s.vx *= -0.5;
        }
        return;
      case 'drill':
        if (res.mole) return this.goOff(s);
        s.state = 'drill';
        {
          const sp = Math.hypot(s.vx, s.vy) || 1;
          s.vx = (s.vx / sp) * 125;
          s.vy = (s.vy / sp) * 125;
        }
        s.dir = 1.3;
        this.hooks.sound('crack');
        return;
      case 'sap':
        // Sticks to whatever it touches, a mole too, and goes off two seconds later.
        s.state = 'rest';
        s.vx = 0;
        s.vy = 0;
        s.fuse = 2;
        s.target = res.mole;
        this.hooks.sound('thud');
        for (let i = 0; i < 6; i++) this.particle('drop', s.x, s.y, rnd(-50, 50), rnd(-90, -20), 0.5, 2, 0xd9a43a, 1);
        return;
      case 'ember':
        return this.goOff(s);
      case 'beehive':
        return this.goOff(s);
      case 'clod':
        this.terrain.add(s.x, s.y, 34);
        this.hooks.sound('thud');
        this.dust(s.x, s.y, 12);
        s.gone = true;
        return;
      default:
        this.goOff(s);
    }
  }

  private split(s: Shot) {
    s.gone = true;
    this.hooks.sound('split');
    for (let i = -1; i <= 1; i++) {
      const c = this.shot('seed', s.x, s.y, s.vx + i * 90, s.vy - 20, s.team, s.owner);
      c.age = 0.2;
      c.fromX = s.fromX;
    }
    for (let i = 0; i < 10; i++) this.particle('feather', s.x, s.y, rnd(-60, 60), rnd(-60, 20), 1.2, 3, 0xffffff, 20);
  }

  private sink(s: Shot) {
    s.gone = true;
    this.hooks.sound('splash');
    for (let i = 0; i < 8; i++) this.particle('drop', s.x, this.water, rnd(-50, 50), rnd(-180, -60), 0.7, 2.5, this.splash, 1);
  }

  /** A shot's end: the blast, or what else it turns into. */
  private goOff(s: Shot) {
    if (s.gone) return;
    s.gone = true;
    const owner = s.owner;
    const at = (r: number, d: number) => this.explode(s.x, s.y, r, d, s.team, s.fromX, s.kind);
    switch (s.kind) {
      case 'rocket': return at(36, 45);
      case 'heavy': return at(62, 60);
      case 'seeker': return at(34, 40);
      case 'mini': return at(18, 15);
      case 'seed': return at(26, 25);
      case 'acorn': return at(26, 25);
      case 'drill': return at(30, 40);
      case 'sap': return at(38, 42);
      case 'grenade': return at(40, 45);
      case 'bomblet': return at(22, 20);
      case 'bouncer': return at(34, 35);
      case 'roller': return at(44, 50);
      case 'mine': return at(40, 45);
      case 'dynamite': return at(70, 70);
      case 'cluster':
        at(26, 25);
        for (let i = 0; i < 5; i++) {
          const b = this.shot('bomblet', s.x, s.y - 4, rnd(-160, 160), rnd(-300, -140), s.team, owner);
          b.age = 0.05;
          b.fromX = s.fromX;
        }
        return;
      case 'ember':
        this.hooks.sound('crack');
        this.hooks.sound('sizzle');
        for (let i = 0; i < 14; i++)
          this.flames.push({ x: s.x, y: s.y - 3, vx: rnd(-110, 110) + s.vx * 0.15, vy: rnd(-200, -40), life: rnd(3.5, 5), ground: false, tick: Math.random() * 0.3, team: s.team });
        for (let i = 0; i < 8; i++) this.particle('dirt', s.x, s.y, rnd(-80, 80), rnd(-140, -40), 0.6, 2.5, 0xc0703a, 1);
        return;
      case 'beehive': {
        this.hooks.sound('crack');
        this.hooks.sound('buzz');
        for (let i = 0; i < 8; i++)
          this.bees.push({ x: s.x, y: s.y - 4, vx: rnd(-120, 120), vy: rnd(-160, -40), life: rnd(5.5, 6.5), tick: Math.random() * 0.4, team: s.team, target: null, wob: Math.random() * 6 });
        for (let i = 0; i < 8; i++) this.particle('dirt', s.x, s.y, rnd(-80, 80), rnd(-140, -40), 0.6, 2.5, 0xf2c14e, 1);
        return;
      }
      default:
        at(20, 15);
    }
  }

  /** A blast: cuts a crater, hurts and throws the moles in reach, and sets off mines and crates. */
  explode(x: number, y: number, r: number, dmg: number, team: number, fromX?: number, kind?: ShotKind) {
    this.terrain.carve(x, y, r);
    this.craters++;
    const reach = r + 12;
    for (const m of this.moles) {
      if (!m.alive || m.hidden) continue;
      const dx = m.x - x;
      const dy = m.y - 10 - y;
      const d = Math.hypot(dx, dy);
      if (d >= reach) continue;
      const f = d < 10 ? 1 : 1 - d / reach;
      const hit = Math.max(1, Math.round(dmg * Math.max(0.3, f)));
      this.hurt(m, hit, team, fromX, kind);
      const push = (130 + dmg * 3.4) * Math.max(0.35, f);
      const len = d || 1;
      this.knock(m, (dx / len) * push, (dy / len) * push - 160 * Math.max(0.4, f));
    }
    for (const s of this.shots) {
      if (s.gone || Math.hypot(s.x - x, s.y - y) > r + 6) continue;
      if (s.kind === 'mine' && s.trip < 0) s.trip = 0.12;
      else if (s.kind === 'mine' || s.kind === 'dynamite' || s.kind === 'grenade') {
        // Thrown about by the blast.
        s.state = 'fly';
        s.vx += Math.sign(s.x - x || 1) * 140;
        s.vy -= 180;
      }
    }
    for (const c of this.crates) {
      if (c.gone || Math.hypot(c.x - x, c.y - 8 - y) > r + 8) continue;
      c.gone = true;
      if (c.kind === 'weapon') this.pending.push(() => this.explode(c.x, c.y - 8, 24, 18, -1));
      else this.dust(c.x, c.y, 8);
    }
    for (const k of this.kegs) {
      if (k.gone || Math.hypot(k.x - x, k.y - 9 - y) > r + 10) continue;
      k.gone = true;
      this.pending.push(() => this.kegBlast(k, team));
    }
    // Fire on the ground near the blast goes out.
    this.flames = this.flames.filter((f) => Math.hypot(f.x - x, f.y - y) > r * 0.7);
    this.hooks.sound(r >= 60 ? 'bigBoom' : r >= 30 ? 'boom' : 'smallBoom');
    this.hooks.shake(Math.min(14, r / 5));
    this.burst(x, y, r);
  }

  /** The look of a blast: a flash, a fireball, a shock ring, smoke, sparks and flying earth. */
  private burst(x: number, y: number, r: number) {
    this.particle('flash', x, y, 0, 0, 0.14, r * 1.1, 0xfff8d8, 0);
    this.particle('ring', x, y, 0, 0, 0.35, r * 1.4, 0xffffff, 0);
    const n = Math.round(r / 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = rnd(20, 70) * (r / 36);
      this.particle('fire', x + Math.cos(a) * r * 0.3, y + Math.sin(a) * r * 0.3, Math.cos(a) * sp, Math.sin(a) * sp - 30, rnd(0.25, 0.5), rnd(0.35, 0.6) * r, i % 3 ? 0xff9a3c : 0xffd04d, -60);
    }
    for (let i = 0; i < n; i++)
      this.particle('smoke', x + rnd(-r, r) * 0.5, y + rnd(-r, r) * 0.4, rnd(-30, 30), rnd(-60, -15), rnd(0.9, 1.6), rnd(0.25, 0.45) * r, 0x8c8478, -12);
    for (let i = 0; i < n + 4; i++) {
      const a = -Math.PI / 2 + rnd(-1.3, 1.3);
      const sp = rnd(120, 320);
      this.particle('dirt', x, y, Math.cos(a) * sp, Math.sin(a) * sp, rnd(0.8, 1.4), rnd(2, 4.5), this.dirt(), 1);
    }
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2;
      this.particle('spark', x, y, Math.cos(a) * rnd(100, 260), Math.sin(a) * rnd(100, 260), rnd(0.3, 0.6), 1.8, 0xffe9a0, 300);
    }
  }

  private stepFlames() {
    const t = this.terrain;
    for (const f of this.flames) {
      f.life -= this.rain ? DT * 2 : DT;
      f.tick -= DT;
      if (!f.ground) {
        f.vx += this.wind * WIND_ACC * 0.4 * DT;
        f.vy += GRAVITY * 0.7 * DT;
        const nx = f.x + f.vx * DT;
        const ny = f.y + f.vy * DT;
        if (t.solid(nx, ny)) {
          f.ground = true;
          f.vx = 0;
          f.vy = 0;
        } else {
          f.x = nx;
          f.y = ny;
        }
      } else if (!t.solid(f.x, f.y + 1)) {
        f.ground = false;
      } else if (Math.random() < 0.3) {
        // Flow downhill.
        const dir = !t.solid(f.x - 1, f.y + 1) ? -1 : !t.solid(f.x + 1, f.y + 1) ? 1 : 0;
        if (dir && !t.solid(f.x + dir, f.y)) f.x += dir;
      }
      if (f.y > this.water) f.life = 0;
      if (f.tick <= 0) {
        f.tick = 0.3;
        for (const m of this.moles)
          if (m.alive && !m.hidden && Math.abs(m.x - f.x) < 9 && f.y - m.y < 22 && f.y - m.y > -6) this.hurt(m, 2, f.team);
        if (f.ground && Math.random() < 0.3) t.carve(f.x, f.y, 3);
        // Fire licking at a keg sets it off.
        for (const k of this.kegs)
          if (!k.gone && Math.abs(k.x - f.x) < 10 && Math.abs(k.y - 6 - f.y) < 12) {
            k.gone = true;
            this.pending.push(() => this.kegBlast(k, f.team));
          }
      }
      if (Math.random() < 0.25) this.particle('smoke', f.x, f.y - 6, rnd(-6, 6), rnd(-40, -20), 0.6, 3, 0x6a625a, -10);
    }
    const before = this.flames.length;
    this.flames = this.flames.filter((f) => f.life > 0);
    if (before && !this.flames.length) this.hooks.sound('sizzle');
  }

  private stepBees() {
    for (const b of this.bees) {
      b.life -= DT;
      b.tick -= DT;
      b.wob += DT * 9;
      if (!b.target?.alive) b.target = this.nearestEnemy(b.team, b.x, b.y);
      const tx = b.target ? b.target.x + Math.sin(b.wob) * 12 : b.x + Math.sin(b.wob) * 30;
      const ty = b.target ? b.target.y - 14 + Math.cos(b.wob * 1.3) * 8 : b.y;
      const dx = tx - b.x;
      const dy = ty - b.y;
      const d = Math.hypot(dx, dy) || 1;
      b.vx += (dx / d) * 520 * DT + this.wind * 4 * DT;
      b.vy += (dy / d) * 520 * DT;
      const sp = Math.hypot(b.vx, b.vy);
      if (sp > 150) {
        b.vx *= 150 / sp;
        b.vy *= 150 / sp;
      }
      b.x += b.vx * DT;
      b.y += b.vy * DT;
      if (b.target && b.tick <= 0 && Math.hypot(b.target.x - b.x, b.target.y - 12 - b.y) < 14) {
        b.tick = 0.55;
        this.hurt(b.target, 2, b.team);
      }
    }
    this.bees = this.bees.filter((b) => b.life > 0);
    if (this.bees.length && Math.floor(this.time * 2) !== Math.floor((this.time - DT) * 2)) this.hooks.sound('buzz');
  }

  /** Stands a powder keg on the ground below (x, y). */
  addKeg(x: number, y: number) {
    this.kegs.push({ x, y, vy: 0, landed: false, gone: false });
  }

  /** A keg going off: a big blast that counts for whoever set it off, and burning powder. */
  private kegBlast(k: Keg, team: number) {
    this.explode(k.x, k.y - 9, 42, 38, team);
    for (let i = 0; i < 6; i++)
      this.flames.push({ x: k.x + rnd(-6, 6), y: k.y - 14, vx: rnd(-160, 160), vy: rnd(-260, -120), life: rnd(2.5, 4), ground: false, tick: 0.3, team });
    this.hooks.sound('bigBoom');
  }

  private stepKegs() {
    const t = this.terrain;
    for (const k of this.kegs) {
      if (k.gone) continue;
      if (!k.landed) {
        k.vy = Math.min(k.vy + GRAVITY * DT, 600);
        k.y += k.vy * DT;
        if (t.solid(k.x, k.y)) {
          k.landed = true;
          for (let i = 0; i < 20 && t.solid(k.x, k.y - 1); i++) k.y -= 1;
          if (k.vy > 200) this.hooks.sound('thud');
          k.vy = 0;
        }
      } else if (!t.solid(k.x, k.y) && !t.solid(k.x, k.y + 1)) k.landed = false;
      if (k.y > this.water) {
        k.gone = true;
        this.sink({ x: k.x } as Shot);
      }
    }
    this.kegs = this.kegs.filter((k) => !k.gone);
  }

  /** Drops a crate from the sky at `x`. */
  dropCrate(x: number, kind: 'weapon' | 'health', weapon: WeaponId | null) {
    this.crates.push({ x, y: -20, vy: 0, kind, weapon, landed: false, gone: false, sway: Math.random() * 6 });
  }

  /** Called when a mole picks up a crate. */
  onCollect: (m: Mole, c: Crate) => void = () => undefined;

  private stepCrates() {
    const t = this.terrain;
    for (const c of this.crates) {
      if (c.gone) continue;
      c.sway += DT * 2;
      if (!c.landed) {
        c.vy = Math.min(c.vy + GRAVITY * DT, 70);
        c.x += this.wind * 2.2 * DT;
        c.y += c.vy * DT;
        if (t.solid(c.x, c.y)) {
          c.landed = true;
          for (let i = 0; i < 10 && t.solid(c.x, c.y - 1); i++) c.y -= 1;
          this.hooks.sound('thud');
          this.dust(c.x, c.y, 5);
        }
      } else if (!t.solid(c.x, c.y) && !t.solid(c.x, c.y + 1)) c.landed = false;
      if (c.y > this.water) {
        c.gone = true;
        this.sink({ x: c.x } as Shot);
        continue;
      }
      for (const m of this.moles)
        if (m.alive && !m.hidden && Math.abs(m.x - c.x) < 14 && Math.abs(m.y - c.y) < 18) {
          c.gone = true;
          if (c.kind === 'health') {
            m.hp = Math.min(m.maxHp, m.hp + 25);
            this.pops.push({ x: m.x, y: m.y - 32, text: '+25', color: 0x3fae4a, t: 0 });
            for (let i = 0; i < 10; i++) this.particle('heal', m.x + rnd(-12, 12), m.y - rnd(0, 20), 0, rnd(-60, -30), 1, 4, 0x4cc65a, 0);
            this.hooks.sound('heal');
          } else this.hooks.sound('collect');
          this.onCollect(m, c);
          break;
        }
    }
    this.crates = this.crates.filter((c) => !c.gone);
  }

  private stepBalloons() {
    for (const b of this.balloons) {
      b.x += b.dir * 210 * DT;
      const first = b.targetX - b.dir * 28;
      while (b.dropped < 5 && (b.x - first) * b.dir >= b.dropped * 14) {
        const s = this.shot('acorn', b.x, b.y + 16, b.dir * 50, 30, b.team, b.owner);
        s.fromX = b.owner.x;
        b.dropped++;
        this.hooks.sound('throw');
      }
    }
    this.balloons = this.balloons.filter((b) => b.dropped < 5 || (b.x > -80 && b.x < this.terrain.w + 80));
  }

  private stepBolts() {
    const t = this.terrain;
    for (const b of this.bolts) {
      b.t += DT;
      if (!b.struck && b.t >= 0.75) {
        b.struck = true;
        let y = 100;
        let mole: Mole | null = null;
        for (; y < this.water; y += 2) {
          if (t.solid(b.x, y)) break;
          mole = this.moleAt(b.x, y, 9, null);
          if (mole) break;
        }
        b.y = y;
        this.hooks.sound('zap');
        this.hooks.shake(8);
        if (mole) {
          this.hurt(mole, 20, b.team);
          for (let i = 0; i < 12; i++) this.particle('spark', mole.x, mole.y - 12, rnd(-150, 150), rnd(-150, 50), 0.5, 2, 0xbfe0ff, 100);
        }
        this.explode(b.x, y, 24, mole ? 25 : 45, b.team);
      }
    }
    this.bolts = this.bolts.filter((b) => b.t < 1.15);
  }

  private stepQuake() {
    this.quakeT -= DT;
    this.quakeTick -= DT;
    this.hooks.shake(5);
    if (this.quakeTick <= 0) {
      this.quakeTick = 0.3;
      for (const m of this.moles)
        if (m.alive && m.grounded && !m.act) this.knock(m, rnd(-90, 90), rnd(-150, -70));
      for (let i = 0; i < 6; i++) this.particle('dirt', rnd(0, this.terrain.w), rnd(100, this.water), 0, rnd(-60, 0), 0.8, 2.5, this.dirt(), 1);
    }
  }

  // ---------------------------------------------------------------- particles

  particle(kind: ParticleKind, x: number, y: number, vx: number, vy: number, life: number, size: number, color: number, grav: number, rot = 0) {
    if (this.particles.length >= MAX_PARTICLES) this.particles.shift();
    this.particles.push({ kind, x, y, vx, vy, life, max: life, size, color, grav, rot });
  }

  private ring(x: number, y: number, r: number, color: number) {
    this.particle('ring', x, y, 0, 0, 0.35, r, color, 0);
  }

  private dust(x: number, y: number, n: number) {
    for (let i = 0; i < n; i++) this.particle('dirt', x + rnd(-6, 6), y - 2, rnd(-90, 90), rnd(-150, -40), rnd(0.5, 0.9), rnd(1.5, 3.5), this.dirt(), 1);
    for (let i = 0; i < n / 2; i++) this.particle('smoke', x + rnd(-8, 8), y - 4, rnd(-30, 30), rnd(-30, -5), 0.7, rnd(3, 6), 0xd8cbb8, -10);
  }

  private dirt() {
    return this.dirtColors[Math.floor(Math.random() * this.dirtColors.length)];
  }

  private stepParticles() {
    const t = this.terrain;
    for (const p of this.particles) {
      p.life -= DT;
      if (p.kind === 'dirt' || p.kind === 'drop') {
        p.vy += GRAVITY * p.grav * DT;
        const nx = p.x + p.vx * DT;
        const ny = p.y + p.vy * DT;
        if (p.kind === 'dirt' && t.solid(nx, ny) && p.vy > 0) {
          p.vx *= 0.3;
          p.vy *= -0.2;
        } else {
          p.x = nx;
          p.y = ny;
        }
        p.rot += p.vx * DT * 0.1;
      } else {
        p.vy += p.grav * DT;
        p.x += p.vx * DT;
        p.y += p.vy * DT;
        if (p.kind === 'feather') {
          p.vx *= 0.97;
          p.vy = Math.min(p.vy, 30);
          p.x += this.wind * 3 * DT;
        }
        if (p.kind === 'smoke') p.x += this.wind * 2.5 * DT;
      }
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }
}

export function rnd(a: number, b: number) {
  return a + Math.random() * (b - a);
}

/** How much the wind pushes each kind of shot. */
export function windFactor(kind: ShotKind) {
  if (kind === 'mini' || kind === 'seed') return 1;
  if (kind === 'acorn') return 1.2;
  if (kind === 'bomblet') return 0;
  return WEAPONS[kind as WeaponId]?.wind ?? 0;
}

function isRocket(kind: ShotKind) {
  return kind === 'rocket' || kind === 'heavy' || kind === 'seeker' || kind === 'mini' || kind === 'drill';
}

/** Whether a flying shot stops on a mole it touches (thrown things fly past them). */
function hitsMoles(kind: ShotKind) {
  return !(kind === 'grenade' || kind === 'cluster' || kind === 'mine' || kind === 'dynamite' || kind === 'clod');
}
