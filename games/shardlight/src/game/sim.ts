import { FIELD_W, type PaneKind, type PaneSpec, type WindowSpec } from './levels';

/**
 * One window in play: the orbs, the bar, the panes and the falling beads, moved in small fixed
 * steps so a slow frame plays out the same as many fast ones. Free of Phaser and of sound: the
 * scene sets the bar's place, calls `step`, draws what is here and plays the `events`.
 */

export type BeadKind = 'wide' | 'multi' | 'sticky' | 'fire' | 'slow' | 'life' | 'short' | 'fast';
export const BEAD_KINDS: readonly BeadKind[] = ['wide', 'multi', 'sticky', 'fire', 'slow', 'life', 'short', 'fast'];
/** How often each kind falls, out of the sum. */
const BEAD_WEIGHTS: Record<BeadKind, number> = { wide: 5, multi: 4, sticky: 3, fire: 2, slow: 3, life: 1, short: 2, fast: 2 };
/** The kinds that make the window harder. */
export const BAD_BEADS = new Set<BeadKind>(['short', 'fast']);
/** Seconds a timed bead lasts, before the Longer charms upgrade. */
const BEAD_SECONDS: Partial<Record<BeadKind, number>> = { wide: 15, fire: 7, slow: 12, short: 12, fast: 10 };
/** Catches a sticky bar holds the orb for. */
const STICKY_CATCHES = 5;

export const ORB_R = 7;
export const BAR_H = 14;
/** The steepest an orb leaves the bar, from straight up. */
export const MAX_BOUNCE = (60 * Math.PI) / 180;
const STEP_MS = 4;
const BEAD_FALL = 150;
const BEAD_R = 11;
/** A pane breaks after this many hits. */
const HITS: Record<PaneKind, number> = { glass: 1, thick: 2, lead: Infinity, bead: 1, heart: 3 };

export interface Pane extends PaneSpec {
  id: number;
  hp: number;
  alive: boolean;
}
export interface Orb {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Held on the bar at this offset from its middle, until launched. */
  held: number | null;
}
export interface Bead {
  x: number;
  y: number;
  kind: BeadKind;
}

export type SimEvent =
  | { type: 'bar'; x: number; y: number }
  | { type: 'wall'; x: number; y: number }
  | { type: 'crack'; pane: Pane }
  | { type: 'break'; pane: Pane; combo: number }
  | { type: 'clang'; pane: Pane }
  | { type: 'bead'; bead: Bead }
  | { type: 'catch'; kind: BeadKind }
  | { type: 'lost' }
  | { type: 'launch' }
  | { type: 'won' }
  | { type: 'over' };

export interface SimOptions {
  /** Orb speed in field pixels a second, before the window's own speed. */
  speed: number;
  barW: number;
  lives: number;
  /** Bead magnet upgrade level: falling beads drift towards the bar. */
  magnet: number;
  /** Times every timed bead's length (Longer charms). */
  charmTime: number;
  /** The chance that a plain pane drops a bead. */
  dropChance: number;
  /** 0 to 1; Math.random by default. */
  random?: () => number;
}

export class Sim {
  readonly w = FIELD_W;
  /** The field's height, the bar near its bottom. */
  readonly h: number;
  readonly barY: number;
  panes: Pane[];
  orbs: Orb[] = [];
  beads: Bead[] = [];
  barX = FIELD_W / 2;
  lives: number;
  score = 0;
  /** Panes broken since the orb last touched the bar. */
  combo = 0;
  bestCombo = 0;
  orbsLost = 0;
  beadsCaught = 0;
  mostOrbs = 1;
  /** Bar hits this life; the orb speeds up a little with each. */
  barHits = 0;
  /** Seconds left on each timed bead. */
  timers: Partial<Record<BeadKind, number>> = {};
  sticky = 0;
  result: 'won' | 'over' | null = null;
  /** Milliseconds played. */
  time = 0;
  events: SimEvent[] = [];
  private carry = 0;
  private readonly random: () => number;

  constructor(
    readonly spec: WindowSpec,
    height: number,
    readonly options: SimOptions,
  ) {
    this.h = height;
    this.barY = height - 36;
    this.lives = options.lives;
    this.random = options.random ?? Math.random;
    this.panes = spec.panes.map((p, id) => ({ ...p, id, hp: HITS[p.kind], alive: true }));
    this.placePanes();
    this.newOrb();
  }

  get barW() {
    const k = (this.timers.wide ? 1.4 : 1) * (this.timers.short ? 0.65 : 1);
    return this.options.barW * k;
  }
  /** The panes still to break: every pane but lead ones. */
  get left() {
    return this.panes.filter((p) => p.alive && p.kind !== 'lead').length;
  }
  get speed() {
    const k = (this.timers.slow ? 0.72 : 1) * (this.timers.fast ? 1.3 : 1) * (1 + Math.min(0.2, this.barHits * 0.008));
    return this.options.speed * this.spec.speed * k;
  }
  /** The stars this window earns, once won: 3 with no orb lost, 2 with one, else 1. */
  get stars() {
    return this.orbsLost === 0 ? 3 : this.orbsLost === 1 ? 2 : 1;
  }

  /** Moves the bar's middle to `x`, held inside the walls. */
  moveBar(x: number) {
    const half = this.barW / 2;
    this.barX = Math.max(half, Math.min(this.w - half, x));
  }

  /** Lets every orb held on the bar go. */
  launch() {
    if (this.result) return false;
    let any = false;
    for (const orb of this.orbs) {
      if (orb.held === null) continue;
      // A new orb on the middle of the bar leaves towards the field's middle; a caught one by where it sits.
      const off = orb.held === 0 ? (this.barX < this.w / 2 ? 0.35 : -0.35) * (this.barW / 2) : orb.held;
      this.bounceOff(orb, off);
      orb.held = null;
      any = true;
    }
    if (any) this.events.push({ type: 'launch' });
    return any;
  }

  step(ms: number) {
    if (this.result) return;
    this.carry += Math.min(ms, 250);
    while (this.carry >= STEP_MS && !this.result) {
      this.carry -= STEP_MS;
      this.tick(STEP_MS / 1000);
    }
  }

  private newOrb() {
    this.orbs = [{ x: this.barX, y: this.barY - ORB_R, vx: 0, vy: 0, held: 0 }];
  }

  private placePanes() {
    const t = this.time / 1000;
    for (const p of this.panes) {
      const spec = this.spec.panes[p.id];
      if (p.slide) p.x = spec.x + Math.sin(t * p.slide.speed) * p.slide.reach;
      if (p.orbit) {
        const a = p.orbit.angle + t * p.orbit.speed;
        p.x = p.orbit.cx + Math.cos(a) * p.orbit.radius - p.w / 2;
        p.y = p.orbit.cy + Math.sin(a) * p.orbit.radius - p.h / 2;
      }
    }
  }

  /** Sends an orb up off the bar, steeper the nearer the middle it hit. */
  private bounceOff(orb: Orb, offset: number) {
    const k = Math.max(-1, Math.min(1, offset / (this.barW / 2)));
    const a = k * MAX_BOUNCE;
    orb.vx = Math.sin(a) * this.speed;
    orb.vy = -Math.cos(a) * this.speed;
  }

  private tick(dt: number) {
    this.time += dt * 1000;
    this.placePanes();
    for (const kind of Object.keys(this.timers) as BeadKind[]) {
      this.timers[kind]! -= dt;
      if (this.timers[kind]! <= 0) delete this.timers[kind];
    }
    this.moveBar(this.barX);
    const speed = this.speed;
    for (const orb of this.orbs) {
      if (orb.held !== null) {
        orb.x = this.barX + orb.held;
        orb.y = this.barY - ORB_R;
        continue;
      }
      // Keep the speed in step with slow and fast beads.
      const v = Math.hypot(orb.vx, orb.vy) || 1;
      orb.vx *= speed / v;
      orb.vy *= speed / v;
      orb.x += orb.vx * dt;
      orb.y += orb.vy * dt;
      this.walls(orb);
      this.bar(orb);
      this.hitPanes(orb);
    }
    const before = this.orbs.length;
    this.orbs = this.orbs.filter((o) => o.y < this.h + ORB_R * 2);
    if (before && !this.orbs.length) this.loseOrb();
    this.fall(dt);
    if (!this.result && this.left === 0) {
      this.result = 'won';
      this.events.push({ type: 'won' });
    }
  }

  private walls(orb: Orb) {
    if (orb.x < ORB_R) {
      orb.x = ORB_R;
      orb.vx = Math.abs(orb.vx);
      this.events.push({ type: 'wall', x: orb.x, y: orb.y });
    } else if (orb.x > this.w - ORB_R) {
      orb.x = this.w - ORB_R;
      orb.vx = -Math.abs(orb.vx);
      this.events.push({ type: 'wall', x: orb.x, y: orb.y });
    }
    if (orb.y < ORB_R) {
      orb.y = ORB_R;
      orb.vy = Math.abs(orb.vy);
      this.events.push({ type: 'wall', x: orb.x, y: orb.y });
    }
  }

  private bar(orb: Orb) {
    if (orb.vy <= 0) return;
    const half = this.barW / 2;
    const top = this.barY;
    if (orb.y + ORB_R < top || orb.y - ORB_R > top + BAR_H) return;
    if (orb.x < this.barX - half - ORB_R || orb.x > this.barX + half + ORB_R) return;
    // Only an orb coming down onto the top of the bar bounces; one that slipped past the side falls.
    if (orb.y > top + BAR_H / 2) return;
    orb.y = top - ORB_R;
    const offset = orb.x - this.barX;
    this.combo = 0;
    this.barHits++;
    this.events.push({ type: 'bar', x: orb.x, y: orb.y });
    if (this.sticky > 0) {
      this.sticky--;
      orb.held = Math.max(-half + ORB_R, Math.min(half - ORB_R, offset));
      orb.vx = orb.vy = 0;
      return;
    }
    this.bounceOff(orb, offset);
  }

  private hitPanes(orb: Orb) {
    const fire = !!this.timers.fire;
    for (const p of this.panes) {
      if (!p.alive) continue;
      const nx = Math.max(p.x, Math.min(orb.x, p.x + p.w));
      const ny = Math.max(p.y, Math.min(orb.y, p.y + p.h));
      if ((orb.x - nx) ** 2 + (orb.y - ny) ** 2 > ORB_R * ORB_R) continue;
      // A fire orb burns through every pane but the heart, without bouncing.
      if (fire && p.kind !== 'heart') {
        this.breakPane(p);
        continue;
      }
      this.bounceFrom(orb, p);
      if (p.kind === 'lead') this.events.push({ type: 'clang', pane: p });
      else if (--p.hp <= 0) this.breakPane(p);
      else this.events.push({ type: 'crack', pane: p });
      // One bounce a step, so an orb in a corner between two panes never turns twice.
      return;
    }
  }

  private bounceFrom(orb: Orb, p: Pane) {
    const overlapX = Math.min(orb.x + ORB_R - p.x, p.x + p.w - (orb.x - ORB_R));
    const overlapY = Math.min(orb.y + ORB_R - p.y, p.y + p.h - (orb.y - ORB_R));
    const cx = p.x + p.w / 2;
    const cy = p.y + p.h / 2;
    if (overlapX < overlapY) {
      const side = orb.x < cx ? -1 : 1;
      orb.vx = side * Math.abs(orb.vx);
      orb.x += side * overlapX;
    } else {
      const side = orb.y < cy ? -1 : 1;
      orb.vy = side * Math.abs(orb.vy);
      orb.y += side * overlapY;
    }
  }

  private breakPane(p: Pane) {
    p.alive = false;
    this.combo++;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.score += (p.kind === 'heart' ? 100 : p.kind === 'lead' ? 30 : 10) * Math.min(this.combo, 10);
    this.events.push({ type: 'break', pane: p, combo: this.combo });
    if (p.kind === 'bead' || (p.kind !== 'lead' && this.random() < this.options.dropChance)) {
      const bead: Bead = { x: p.x + p.w / 2, y: p.y + p.h / 2, kind: this.pickBead() };
      this.beads.push(bead);
      this.events.push({ type: 'bead', bead });
    }
  }

  private pickBead(): BeadKind {
    const total = BEAD_KINDS.reduce((sum, k) => sum + BEAD_WEIGHTS[k], 0);
    let roll = this.random() * total;
    for (const kind of BEAD_KINDS) {
      roll -= BEAD_WEIGHTS[kind];
      if (roll < 0) return kind;
    }
    return 'wide';
  }

  private fall(dt: number) {
    const half = this.barW / 2;
    for (const bead of this.beads) {
      bead.y += BEAD_FALL * dt;
      if (this.options.magnet && bead.y > this.h / 2) {
        const pull = 70 * this.options.magnet * dt;
        bead.x += Math.max(-pull, Math.min(pull, this.barX - bead.x));
      }
    }
    this.beads = this.beads.filter((bead) => {
      const caught =
        bead.y + BEAD_R >= this.barY && bead.y - BEAD_R <= this.barY + BAR_H && Math.abs(bead.x - this.barX) <= half + BEAD_R;
      if (caught) this.catchBead(bead.kind);
      return !caught && bead.y < this.h + BEAD_R;
    });
  }

  private catchBead(kind: BeadKind) {
    this.beadsCaught++;
    this.events.push({ type: 'catch', kind });
    const seconds = BEAD_SECONDS[kind];
    if (seconds) {
      this.timers[kind] = seconds * (BAD_BEADS.has(kind) ? 1 : this.options.charmTime);
      // A bead undoes its opposite.
      if (kind === 'wide') delete this.timers.short;
      if (kind === 'short') delete this.timers.wide;
      if (kind === 'slow') delete this.timers.fast;
      if (kind === 'fast') delete this.timers.slow;
      this.moveBar(this.barX);
    } else if (kind === 'sticky') this.sticky = STICKY_CATCHES;
    else if (kind === 'life') this.lives++;
    else if (kind === 'multi') this.split();
  }

  /** Every moving orb becomes three, fanned out. */
  private split() {
    const extra: Orb[] = [];
    for (const orb of this.orbs) {
      if (orb.held !== null) continue;
      for (const turn of [-0.45, 0.45]) {
        const c = Math.cos(turn);
        const s = Math.sin(turn);
        let vx = orb.vx * c - orb.vy * s;
        let vy = orb.vx * s + orb.vy * c;
        // Never flat: keep a fair share of the speed up or down.
        if (Math.abs(vy) < this.speed * 0.4) vy = Math.sign(vy || -1) * this.speed * 0.4;
        vx = Math.sign(vx) * Math.sqrt(Math.max(0, this.speed ** 2 - vy * vy));
        extra.push({ x: orb.x, y: orb.y, vx, vy, held: null });
      }
    }
    this.orbs.push(...extra.slice(0, Math.max(0, 9 - this.orbs.length)));
    this.mostOrbs = Math.max(this.mostOrbs, this.orbs.length);
  }

  private loseOrb() {
    this.orbsLost++;
    this.lives--;
    this.events.push({ type: 'lost' });
    this.timers = {};
    this.sticky = 0;
    this.beads = [];
    this.barHits = 0;
    this.combo = 0;
    if (this.lives <= 0) {
      this.result = 'over';
      this.events.push({ type: 'over' });
      return;
    }
    this.newOrb();
  }
}
