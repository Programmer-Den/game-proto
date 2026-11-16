import Phaser from 'phaser';
import type { Kind, Side } from '../game/chess';
import { SIGNATURES, pairKey } from '../game/rules';
import { DUST, RUNE, type Break, fragment } from './art';

// The capture scenes. Every capture is the attacker's strike (one per kind of attacker, 6 in all)
// followed by the victim's fall (one per kind of victim, 5 in all, since a king is never taken), so
// all 30 pairs have their own mix; the 8 pairs in `SIGNATURES` play a hand-made scene instead.
// Quick captures skip the strike and play the fall at double speed. Reduce motion drops the
// screen shake and the flashes, and holds the trembles still.

export type Sfx = 'step' | 'stomp' | 'slam' | 'chop' | 'crack' | 'shatter' | 'rubble' | 'bolt' | 'beam' | 'clash' | 'hum';

export interface Stage {
  scene: Phaser.Scene;
  /** A square's size in game pixels; pieces are drawn this big. */
  size: number;
  quick: boolean;
  still: boolean;
  /** Draw depth for the moving statues and their effects. */
  depth: number;
  sfx: (name: Sfx) => void;
}

export interface Actor {
  img: Phaser.GameObjects.Image;
  kind: Kind;
  side: Side;
}

type P = { x: number; y: number };

/** The attack each kind of piece makes, as its text key. */
export const STRIKES: Record<Kind, string> = { p: 'strikeP', n: 'strikeN', b: 'strikeB', r: 'strikeR', q: 'strikeQ', k: 'strikeK' };
/** How each kind of piece breaks, as its text key. */
export const FALLS: Record<Exclude<Kind, 'k'>, string> = { p: 'fallP', n: 'fallN', b: 'fallB', r: 'fallR', q: 'fallQ' };

class Director {
  private s: Phaser.Scene;
  private S: number;
  private k: number;
  constructor(private st: Stage) {
    this.s = st.scene;
    this.S = st.size;
    this.k = st.quick ? 0.5 : 1.2;
  }

  // ---- timing ----------------------------------------------------------------------------------

  tween(targets: object | object[], props: Record<string, unknown>, ms: number, ease = 'Sine.easeInOut'): Promise<void> {
    return new Promise((done) => this.s.tweens.add({ targets, ...props, duration: Math.max(1, ms * this.k), ease, onComplete: () => done() }));
  }
  wait(ms: number): Promise<void> {
    return new Promise((done) => this.s.time.delayedCall(ms * this.k, () => done()));
  }
  /** Moves `img` to `to` on an arc `height` high. */
  arc(img: Phaser.GameObjects.Image, to: P, height: number, ms: number, ease = 'Sine.easeInOut') {
    const from = { x: img.x, y: img.y };
    const t = { v: 0 };
    return new Promise<void>((done) =>
      this.s.tweens.add({
        targets: t,
        v: 1,
        duration: ms * this.k,
        ease,
        onUpdate: () => {
          img.x = from.x + (to.x - from.x) * t.v;
          img.y = from.y + (to.y - from.y) * t.v - Math.sin(Math.PI * t.v) * height;
        },
        onComplete: () => done(),
      }),
    );
  }
  /** A walk: small hops, as a statue would shuffle. */
  async walk(img: Phaser.GameObjects.Image, to: P, ms = 380) {
    const from = { x: img.x, y: img.y };
    const dist = Math.hypot(to.x - from.x, to.y - from.y);
    const hops = Math.max(1, Math.round(dist / (this.S * 0.8)));
    for (let i = 1; i <= hops; i++) {
      this.st.sfx('step');
      await this.arc(img, { x: from.x + ((to.x - from.x) * i) / hops, y: from.y + ((to.y - from.y) * i) / hops }, this.S * 0.08, ms / hops);
    }
  }

  // ---- effects ---------------------------------------------------------------------------------

  dust(at: P, colour: number, n = 6, spread = 0.45) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
      const puff = this.s.add.image(at.x, at.y + this.S * 0.35, 'sm-puff').setTint(colour).setAlpha(0.7).setDepth(this.st.depth + 2);
      puff.setDisplaySize(this.S * 0.3, this.S * 0.3);
      const sc = puff.scale;
      this.s.tweens.add({
        targets: puff,
        x: at.x + Math.cos(a) * this.S * spread,
        y: at.y + this.S * 0.35 + Math.sin(a) * this.S * spread * 0.4 - this.S * 0.1,
        scale: sc * 2.2,
        alpha: 0,
        duration: 650 * this.k,
        ease: 'Quad.easeOut',
        onComplete: () => puff.destroy(),
      });
    }
  }
  ring(at: P, colour: number, size = 1.2) {
    const g = this.s.add.graphics().setDepth(this.st.depth + 3);
    const r = { v: 0.1 };
    this.s.tweens.add({
      targets: r,
      v: 1,
      duration: 420 * this.k,
      ease: 'Quad.easeOut',
      onUpdate: () => {
        g.clear();
        g.lineStyle(this.S * 0.06 * (1 - r.v) + 1, colour, 1 - r.v);
        g.strokeEllipse(at.x, at.y + this.S * 0.3, this.S * size * r.v, this.S * size * 0.4 * r.v);
      },
      onComplete: () => g.destroy(),
    });
  }
  flash(at: P, colour: number) {
    if (this.st.still) return;
    const f = this.s.add.image(at.x, at.y, 'sm-puff').setTint(colour).setDepth(this.st.depth + 4).setBlendMode(Phaser.BlendModes.ADD);
    f.setDisplaySize(this.S * 0.4, this.S * 0.4);
    this.s.tweens.add({ targets: f, scale: f.scale * 3.5, alpha: 0, duration: 300 * this.k, onComplete: () => f.destroy() });
  }
  sparks(at: P, colour: number) {
    const g = this.s.add.graphics().setDepth(this.st.depth + 4);
    const r = { v: 0 };
    const rays = Array.from({ length: 7 }, (_, i) => (i / 7) * Math.PI * 2 + Math.random());
    this.s.tweens.add({
      targets: r,
      v: 1,
      duration: 260 * this.k,
      onUpdate: () => {
        g.clear();
        g.lineStyle(2.5, colour, 1 - r.v);
        for (const a of rays) {
          const d0 = this.S * (0.1 + 0.3 * r.v);
          const d1 = this.S * (0.2 + 0.45 * r.v);
          g.lineBetween(at.x + Math.cos(a) * d0, at.y + Math.sin(a) * d0, at.x + Math.cos(a) * d1, at.y + Math.sin(a) * d1);
        }
      },
      onComplete: () => g.destroy(),
    });
  }
  shake(strength = 0.006) {
    if (!this.st.still) this.s.cameras.main.shake(180 * this.k, strength);
  }
  /** A glowing rune bolt from `from` to `to`. */
  async bolt(from: P, to: P, colour: number, ms = 360) {
    const b = this.s.add.image(from.x, from.y, 'sm-puff').setTint(colour).setDepth(this.st.depth + 3).setBlendMode(Phaser.BlendModes.ADD);
    b.setDisplaySize(this.S * 0.45, this.S * 0.45);
    const trail = this.s.time.addEvent({
      delay: 30,
      loop: true,
      callback: () => {
        const t = this.s.add.image(b.x, b.y, 'sm-puff').setTint(colour).setAlpha(0.5).setDepth(this.st.depth + 2).setBlendMode(Phaser.BlendModes.ADD);
        t.setDisplaySize(this.S * 0.25, this.S * 0.25);
        this.s.tweens.add({ targets: t, alpha: 0, scale: t.scale * 0.3, duration: 260, onComplete: () => t.destroy() });
      },
    });
    this.st.sfx('bolt');
    await this.tween(b, { x: to.x, y: to.y }, ms, 'Quad.easeIn');
    trail.remove();
    b.destroy();
  }
  /** A beam of light from `from` to `to`, held for `ms`. */
  async beam(from: P, to: P, colour: number, ms = 420) {
    const g = this.s.add.graphics().setDepth(this.st.depth + 3).setBlendMode(Phaser.BlendModes.ADD);
    const r = { v: 0 };
    this.st.sfx('beam');
    await new Promise<void>((done) =>
      this.s.tweens.add({
        targets: r,
        v: 1,
        duration: ms * this.k,
        onUpdate: () => {
          const reach = Math.min(1, r.v * 2.2);
          const fade = r.v < 0.7 ? 1 : 1 - (r.v - 0.7) / 0.3;
          const ex = from.x + (to.x - from.x) * reach;
          const ey = from.y + (to.y - from.y) * reach;
          g.clear();
          g.lineStyle(this.S * 0.22, colour, 0.25 * fade);
          g.lineBetween(from.x, from.y, ex, ey);
          g.lineStyle(this.S * 0.08, colour, 0.9 * fade);
          g.lineBetween(from.x, from.y, ex, ey);
          g.lineStyle(this.S * 0.025, 0xffffff, fade);
          g.lineBetween(from.x, from.y, ex, ey);
        },
        onComplete: () => done(),
      }),
    );
    g.destroy();
  }
  /** Glowing cracks spreading over a statue; returns their drawing, to clear when it breaks. */
  async cracks(v: Actor, ms = 380) {
    const g = this.s.add.graphics().setDepth(this.st.depth + 1);
    const at = { x: v.img.x, y: v.img.y };
    const lines = Array.from({ length: 4 }, (_, i) => {
      const a = -Math.PI / 2 + (i - 1.5) * 0.8 + Math.random() * 0.3;
      const pts: P[] = [{ x: at.x, y: at.y + this.S * 0.1 }];
      for (let j = 1; j <= 3; j++) {
        const d = this.S * 0.12 * j;
        pts.push({ x: at.x + Math.cos(a) * d + (Math.random() - 0.5) * this.S * 0.08, y: at.y + this.S * 0.1 + Math.sin(a) * d * 1.2 });
      }
      return pts;
    });
    const r = { v: 0 };
    this.st.sfx('crack');
    await new Promise<void>((done) =>
      this.s.tweens.add({
        targets: r,
        v: 1,
        duration: ms * this.k,
        onUpdate: () => {
          g.clear();
          g.lineStyle(this.S * 0.03, RUNE[v.side], 1);
          for (const pts of lines) {
            const n = Math.max(1, Math.ceil(r.v * (pts.length - 1)));
            g.beginPath();
            g.moveTo(pts[0].x, pts[0].y);
            for (let j = 1; j <= n; j++) g.lineTo(pts[j].x, pts[j].y);
            g.strokePath();
          }
        },
        onComplete: () => done(),
      }),
    );
    return g;
  }
  /** Hides a statue and puts its fragments in its place. */
  breakUp(v: Actor, how: Break) {
    const { img } = v;
    const scale = img.displayWidth / 100;
    const parts = fragment(this.s, v.kind, v.side, how).map((f) =>
      this.s.add
        .image(img.x + (f.cx - 50) * scale, img.y + (f.cy - 50) * scale, f.key)
        .setOrigin(f.cx / 100, f.cy / 100)
        .setDisplaySize(img.displayWidth, img.displayHeight)
        .setFlipX(img.flipX)
        .setDepth(this.st.depth),
    );
    img.setVisible(false);
    return parts;
  }
  fadeAway(objs: Phaser.GameObjects.GameObject[], ms = 500, delay = 0) {
    return new Promise<void>((done) =>
      this.s.tweens.add({
        targets: objs,
        alpha: 0,
        delay: delay * this.k,
        duration: ms * this.k,
        onComplete: () => {
          objs.forEach((o) => o.destroy());
          done();
        },
      }),
    );
  }

  // ---- strikes: each ends at the moment of the blow ---------------------------------------------

  /** Where an attacker stands to hit the victim: just short of its square. */
  contact(a: Actor, v: Actor, gap = 0.55): P {
    const dx = v.img.x - a.img.x;
    const dy = v.img.y - a.img.y;
    const len = Math.hypot(dx, dy) || 1;
    return { x: v.img.x - (dx / len) * this.S * gap, y: v.img.y - (dy / len) * this.S * gap };
  }
  face(a: Actor, v: Actor) {
    if (Math.abs(v.img.x - a.img.x) > 1) a.img.setFlipX(v.img.x < a.img.x);
  }

  async strike(a: Actor, v: Actor) {
    this.face(a, v);
    const at = { x: v.img.x, y: v.img.y };
    switch (a.kind) {
      case 'p': // Sword chop: shuffle up, rear back, chop down.
        await this.walk(a.img, this.contact(a, v));
        await this.tween(a.img, { angle: a.img.flipX ? 18 : -18 }, 180, 'Quad.easeOut');
        this.st.sfx('chop');
        await this.tween(a.img, { angle: a.img.flipX ? -24 : 24 }, 90, 'Quad.easeIn');
        this.sparks(at, RUNE[a.side]);
        this.tween(a.img, { angle: 0 }, 200);
        break;
      case 'n': // Hoof stomp: a high leap, a rear up, a slam.
        await this.arc(a.img, this.contact(a, v, 0.5), this.S * 0.9, 520);
        await this.tween(a.img, { angle: a.img.flipX ? 20 : -20, y: a.img.y - this.S * 0.12 }, 170, 'Quad.easeOut');
        this.st.sfx('stomp');
        await this.tween(a.img, { angle: 0, y: a.img.y + this.S * 0.12 }, 90, 'Quad.easeIn');
        this.ring(at, RUNE[a.side]);
        this.shake(0.004);
        break;
      case 'b': // Staff blast: the bishop's eyes flare and a rune bolt flies.
        await this.charge(a);
        await this.bolt({ x: a.img.x, y: a.img.y - this.S * 0.12 }, at, RUNE[a.side]);
        this.flash(at, RUNE[a.side]);
        break;
      case 'r': // Body slam: back up, then charge in a straight line.
        await this.tween(a.img, { x: a.img.x - (v.img.x - a.img.x) * 0.08, y: a.img.y - (v.img.y - a.img.y) * 0.08 }, 220, 'Quad.easeOut');
        await this.tween(a.img, this.contact(a, v, 0.45), 260, 'Quad.easeIn');
        this.st.sfx('slam');
        this.dust(at, DUST[a.side], 5);
        this.shake(0.008);
        break;
      case 'q': // Rune beam: the queen rises and burns a beam through.
        await this.tween(a.img, { scale: a.img.scale * 1.12, y: a.img.y - this.S * 0.1 }, 260);
        await this.beam({ x: a.img.x, y: a.img.y - this.S * 0.05 }, at, RUNE[a.side], 520);
        this.flash(at, RUNE[a.side]);
        await this.tween(a.img, { scale: a.img.scale / 1.12, y: a.img.y + this.S * 0.1 }, 180);
        break;
      case 'k': { // Sceptre smite: an orb of light drops from above the king onto the victim.
        await this.walk(a.img, this.contact(a, v, 0.7));
        await this.charge(a);
        const orb = this.s.add.image(at.x, at.y - this.S * 1.2, 'sm-puff').setTint(RUNE[a.side]).setDepth(this.st.depth + 3).setBlendMode(Phaser.BlendModes.ADD);
        orb.setDisplaySize(this.S * 0.5, this.S * 0.5);
        this.st.sfx('hum');
        await this.tween(orb, { y: at.y }, 300, 'Quad.easeIn');
        orb.destroy();
        this.ring(at, RUNE[a.side], 1.5);
        this.flash(at, RUNE[a.side]);
        this.shake(0.005);
        break;
      }
    }
  }
  /** A statue gathers its rune light. */
  async charge(a: Actor) {
    const glow = this.s.add.image(a.img.x, a.img.y - this.S * 0.15, 'sm-puff').setTint(RUNE[a.side]).setAlpha(0).setDepth(this.st.depth + 2).setBlendMode(Phaser.BlendModes.ADD);
    glow.setDisplaySize(this.S * 0.9, this.S * 0.9);
    this.st.sfx('hum');
    await this.tween(glow, { alpha: 0.8 }, 260);
    this.fadeAway([glow], 300);
  }

  // ---- falls: each breaks the victim and clears it away ----------------------------------------

  async fall(v: Actor, from: P, how: Exclude<Kind, 'k'> = v.kind as Exclude<Kind, 'k'>) {
    const at = { x: v.img.x, y: v.img.y };
    const away = Math.sign(at.x - from.x) || 1;
    const dust = DUST[v.side];
    switch (how) {
      case 'p': { // Splits in two.
        this.st.sfx('crack');
        const [l, r] = this.breakUp(v, 'halves');
        const S = this.S;
        await Promise.all([
          this.tween(l, { x: l.x - S * 0.22, y: l.y + S * 0.08, angle: -55 }, 420, 'Quad.easeIn'),
          this.tween(r, { x: r.x + S * 0.22, y: r.y + S * 0.08, angle: 55 }, 420, 'Quad.easeIn'),
        ]);
        this.st.sfx('rubble');
        this.dust(at, dust, 6);
        await this.fadeAway([l, r], 420, 120);
        break;
      }
      case 'n': { // The head topples off and rolls away; the body crumbles.
        this.st.sfx('crack');
        const [head, body] = this.breakUp(v, 'neck');
        const S = this.S;
        const land = { x: head.x + away * S * 0.65, y: at.y + S * 0.3 };
        this.tween(head, { angle: away * 240 }, 520);
        await this.arc(head, land, S * 0.45, 520, 'Linear');
        this.st.sfx('rubble');
        this.dust(land, dust, 4, 0.25);
        this.tween(body, { scaleY: body.scaleY * 0.35, y: body.y + S * 0.2 }, 420, 'Quad.easeIn');
        this.dust(at, dust, 5);
        await this.arc(head, { x: land.x + away * S * 0.2, y: land.y }, S * 0.12, 260);
        await this.fadeAway([head, body], 420, 150);
        break;
      }
      case 'b': { // Cracks open along its veins, then splits and spills.
        const g = await this.cracks(v);
        g.destroy();
        const [l, r] = this.breakUp(v, 'halves');
        const S = this.S;
        this.st.sfx('shatter');
        await Promise.all([
          this.tween(l, { angle: -30, x: l.x - S * 0.12 }, 360, 'Quad.easeOut'),
          this.tween(r, { angle: 30, x: r.x + S * 0.12 }, 360, 'Quad.easeOut'),
        ]);
        await Promise.all([this.tween([l, r], { y: at.y + S * 0.25, scaleY: l.scaleY * 0.6 }, 300, 'Quad.easeIn')]);
        this.dust(at, dust, 7);
        await this.fadeAway([l, r], 380);
        break;
      }
      case 'r': { // Falls to rubble: the blocks drop and spill.
        this.st.sfx('rubble');
        const parts = this.breakUp(v, 'shards');
        const S = this.S;
        this.shake(0.006);
        await Promise.all(
          parts.map((p, i) => {
            const dx = (p.x - at.x) * 0.9 + away * S * 0.1;
            return this.tween(p, { x: p.x + dx, y: at.y + S * 0.3 + (i % 3) * S * 0.04, angle: (Math.random() - 0.5) * 120 }, 380 + i * 30, 'Bounce.easeOut');
          }),
        );
        this.dust(at, dust, 9, 0.6);
        await this.fadeAway(parts, 500, 200);
        break;
      }
      case 'q': { // Bursts to shards.
        this.flash(at, RUNE[v.side]);
        this.st.sfx('shatter');
        const parts = this.breakUp(v, 'shards');
        const S = this.S;
        await Promise.all(
          parts.map((p) => {
            const dx = p.x - at.x;
            const dy = p.y - at.y - S * 0.1;
            const len = Math.hypot(dx, dy) || 1;
            return this.tween(p, { x: p.x + (dx / len) * S * 0.75, y: p.y + (dy / len) * S * 0.75, angle: (Math.random() - 0.5) * 400, alpha: 0 }, 620, 'Quad.easeOut');
          }),
        );
        parts.forEach((p) => p.destroy());
        this.dust(at, dust, 6);
        break;
      }
    }
  }

  // ---- the signature scenes --------------------------------------------------------------------

  async signature(id: string, a: Actor, v: Actor, from: P) {
    const S = this.S;
    const at = { x: v.img.x, y: v.img.y };
    this.face(a, v);
    switch (id) {
      case 'scuffle': { // Two pawns shove each other, then one chops.
        const mid = this.contact(a, v, 0.6);
        await this.walk(a.img, mid);
        for (let i = 0; i < 2; i++) {
          const push = (v.img.x - a.img.x) * 0.12;
          await Promise.all([this.tween(a.img, { x: a.img.x + push }, 110), this.tween(v.img, { x: v.img.x + push * 0.6, angle: Math.sign(push) * 8 }, 110)]);
          this.st.sfx('step');
          await Promise.all([this.tween(a.img, { x: a.img.x - push }, 140), this.tween(v.img, { x: v.img.x - push * 0.6, angle: 0 }, 140)]);
        }
        await this.strike(a, v);
        await this.fall(v, from);
        break;
      }
      case 'upset': { // The queen looms over the pawn; one tiny tap, a silence, and she bursts.
        const qs = v.img.scale;
        this.face(v, a);
        await this.tween(v.img, { scale: qs * 1.2, y: v.img.y - S * 0.08 }, 420);
        // The pawn trembles; with reduce motion on it stands still for the same beat.
        if (this.st.still) await this.wait(180);
        else {
          await this.tween(a.img, { x: a.img.x + 2 }, 60, 'Linear');
          await this.tween(a.img, { x: a.img.x - 4 }, 60, 'Linear');
          await this.tween(a.img, { x: a.img.x + 2 }, 60, 'Linear');
        }
        await this.walk(a.img, this.contact(a, v, 0.5), 420);
        await this.tween(a.img, { angle: a.img.flipX ? -10 : 10 }, 120);
        this.st.sfx('chop');
        await this.tween(a.img, { angle: 0 }, 120);
        await this.wait(500);
        await this.tween(v.img, { scale: qs, y: at.y }, 160);
        const g = await this.cracks(v, 500);
        g.destroy();
        await this.fall(v, from);
        break;
      }
      case 'joust': { // Both knights charge and meet in the middle.
        const mid = { x: (a.img.x + at.x) / 2, y: (a.img.y + at.y) / 2 };
        this.face(v, a);
        await Promise.all([
          this.arc(a.img, this.offset(mid, a.img, 0.3), S * 0.3, 420, 'Quad.easeIn'),
          this.arc(v.img, this.offset(mid, v.img, 0.3), S * 0.3, 420, 'Quad.easeIn'),
        ]);
        this.st.sfx('clash');
        this.sparks(mid, 0xffffff);
        this.flash(mid, RUNE[a.side]);
        this.shake(0.006);
        await this.tween(v.img, { x: at.x, y: at.y, angle: v.img.flipX ? 25 : -25 }, 260, 'Quad.easeOut');
        await this.fall(v, from);
        break;
      }
      case 'vault': { // The knight leaps clean over the tower and kicks it down from behind.
        const behind = this.offset(at, a.img, -0.55);
        await this.arc(a.img, behind, S * 1.3, 620);
        a.img.setFlipX(!a.img.flipX);
        await this.tween(a.img, { angle: a.img.flipX ? -22 : 22 }, 140, 'Quad.easeOut');
        this.st.sfx('stomp');
        await this.tween(a.img, { angle: 0 }, 90, 'Quad.easeIn');
        this.ring(at, RUNE[a.side]);
        await this.tween(v.img, { angle: Math.sign(from.x - at.x || 1) * 12 }, 160);
        await this.fall(v, behind);
        break;
      }
      case 'runeDuel': { // Both bishops fire; the bolts wrestle in the middle until one breaks through.
        const mid = { x: (a.img.x + at.x) / 2, y: (a.img.y + at.y) / 2 - S * 0.1 };
        await Promise.all([this.charge(a), this.charge(v)]);
        await Promise.all([this.bolt({ x: a.img.x, y: a.img.y - S * 0.12 }, mid, RUNE[a.side], 300), this.bolt({ x: at.x, y: at.y - S * 0.12 }, mid, RUNE[v.side], 300)]);
        this.st.sfx('clash');
        const knot = this.s.add.image(mid.x, mid.y, 'sm-puff').setTint(RUNE[a.side]).setDepth(this.st.depth + 3).setBlendMode(Phaser.BlendModes.ADD);
        knot.setDisplaySize(S * 0.6, S * 0.6);
        const sc = knot.scale;
        // The knot throbs and jitters; with reduce motion on it holds still for the same time.
        if (this.st.still) await this.wait(660);
        else {
          for (let i = 0; i < 3; i++) {
            await this.tween(knot, { scale: sc * 1.3, x: mid.x + (Math.random() - 0.5) * S * 0.1 }, 110);
            await this.tween(knot, { scale: sc, x: mid.x }, 110);
          }
        }
        knot.destroy();
        await this.bolt(mid, at, RUNE[a.side], 220);
        this.flash(at, RUNE[a.side]);
        await this.fall(v, from);
        break;
      }
      case 'siege': { // The rook rams the tower three times; it gives on the third.
        const hit = this.contact(a, v, 0.45);
        const back = this.contact(a, v, 0.9);
        for (let i = 0; i < 3; i++) {
          await this.tween(a.img, back, 200, 'Quad.easeOut');
          await this.tween(a.img, hit, 150, 'Quad.easeIn');
          this.st.sfx('slam');
          this.dust(at, DUST[v.side], 3, 0.3);
          this.shake(0.004 + i * 0.003);
          if (i < 2) await this.tween(v.img, { angle: (i + 1) * 4 * Math.sign(at.x - a.img.x || 1) }, 100);
        }
        await this.fall(v, from);
        break;
      }
      case 'royalDuel': { // Two queens' beams meet; the attacker's pushes through.
        const qa = a.img.scale;
        const qv = v.img.scale;
        await Promise.all([this.tween(a.img, { scale: qa * 1.12 }, 260), this.tween(v.img, { scale: qv * 1.12 }, 260)]);
        const mid = { x: (a.img.x + at.x) / 2, y: (a.img.y + at.y) / 2 };
        await Promise.all([this.beam(a.img, mid, RUNE[a.side], 520), this.beam(v.img, mid, RUNE[v.side], 520)]);
        this.st.sfx('clash');
        this.flash(mid, 0xffffff);
        await this.beam(a.img, at, RUNE[a.side], 380);
        await Promise.all([this.tween(a.img, { scale: qa }, 160), this.tween(v.img, { scale: qv }, 160)]);
        await this.fall(v, from);
        break;
      }
      case 'decree': { // The king raises his orb; the queen bows and turns to dust where she stands.
        await this.charge(a);
        await this.tween(v.img, { angle: Math.sign(a.img.x - at.x || 1) * 25, y: at.y + S * 0.08 }, 420);
        await this.wait(200);
        const parts = this.breakUp(v, 'shards');
        this.st.sfx('rubble');
        await Promise.all(parts.map((p, i) => this.tween(p, { y: at.y + S * 0.32, alpha: 0.2, angle: (Math.random() - 0.5) * 40 }, 500 + i * 60, 'Quad.easeIn')));
        this.dust(at, DUST[v.side], 10, 0.5);
        await this.fadeAway(parts, 300);
        break;
      }
    }
  }
  /** A point `frac` squares from `p` towards `toward` (negative: away from it). */
  offset(p: P, toward: P, frac: number): P {
    const dx = toward.x - p.x;
    const dy = toward.y - p.y;
    const len = Math.hypot(dx, dy) || 1;
    return { x: p.x + (dx / len) * this.S * frac, y: p.y + (dy / len) * this.S * frac };
  }
}

/**
 * Plays a capture: `a` takes `v` and ends on `to`. Resolves when it is over; the victim's image is
 * hidden by then (the scene clears it). Gives back the signature scene's id when one played.
 */
export async function playCapture(stage: Stage, a: Actor, v: Actor, to: P): Promise<string | null> {
  const d = new Director(stage);
  const from = { x: a.img.x, y: a.img.y };
  a.img.setDepth(stage.depth + 1);
  v.img.setDepth(stage.depth);
  const sig = stage.quick ? undefined : SIGNATURES[pairKey(a.kind, v.kind)];
  if (stage.quick) {
    await d.tween(a.img, d.contact(a, v, 0.6), 160, 'Quad.easeIn');
    await d.fall(v, from);
  } else if (sig) {
    await d.signature(sig, a, v, from);
  } else {
    await d.strike(a, v);
    await d.fall(v, from);
  }
  v.img.setVisible(false);
  // The attacker takes the square.
  if (Math.hypot(a.img.x - to.x, a.img.y - to.y) > 1) {
    if (a.kind === 'b' || a.kind === 'q' || a.kind === 'r') await d.tween(a.img, { x: to.x, y: to.y }, 260);
    else await d.walk(a.img, to, 260);
  }
  a.img.setAngle(0);
  return sig ?? null;
}

/** A plain move: a knight leaps, everything else glides with a small hop. */
export function playMove(stage: Stage, img: Phaser.GameObjects.Image, kind: Kind, to: P) {
  const d = new Director(stage);
  img.setDepth(stage.depth + 1);
  if (Math.abs(to.x - img.x) > 1) img.setFlipX(to.x < img.x);
  stage.sfx('step');
  if (kind === 'n') return d.arc(img, to, stage.size * 0.6, 340).then(() => stage.sfx('stomp'));
  const dist = Math.hypot(to.x - img.x, to.y - img.y) / stage.size;
  return d.arc(img, to, stage.size * 0.12, 160 + 60 * Math.min(dist, 5));
}

/** Checkmate: the beaten king cracks and falls to rubble. */
export async function playMate(stage: Stage, king: Actor) {
  const d = new Director(stage);
  king.img.setDepth(stage.depth);
  const g = await d.cracks(king, 700);
  g.destroy();
  d.shake(0.01);
  await d.fall(king, { x: king.img.x - 1, y: king.img.y }, 'r');
}

/** A pawn turned into a new piece: a ring of rune light. */
export function playPromote(stage: Stage, at: P, side: Side) {
  const d = new Director(stage);
  d.ring(at, RUNE[side], 1.6);
  d.flash(at, RUNE[side]);
}

export const SCENE_IDS = Object.values(SIGNATURES);
