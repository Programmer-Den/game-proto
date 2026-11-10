import { flight, WIND_ACC } from './terrain';
import { WEAPONS, type WeaponId } from './weapons';
import { World, windFactor, type Mole } from './world';

/**
 * The Burrow AI: picks a target and a weapon, then tries shots over a grid of angles and powers
 * with the same flight steps the game uses (`flight`), and keeps the one that lands closest without
 * hurting its own side. `aimError` (from the difficulty) shakes the chosen angle and power, so it
 * misses now and then.
 */

export interface Plan {
  weapon: WeaponId;
  /** Radians, 0 right, negative up. */
  angle: number;
  power: number;
  /** For `target` weapons, the spot tapped. */
  tx: number;
  ty: number;
  /** Walk this way for a moment first (no good shot from here). */
  walk: number;
  /** How far off the best shot lands, in px. */
  miss: number;
  target: Mole | null;
}

const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) * 1.15;

export function planTurn(world: World, me: Mole, ammo: Record<WeaponId, number>, aimError: number, canWalk: boolean): Plan {
  const enemies = world.moles.filter((m) => m.alive && m.team !== me.team);
  const has = (id: WeaponId) => ammo[id] !== 0;
  const base: Plan = { weapon: 'skip', angle: -Math.PI / 2, power: 0.5, tx: 0, ty: 0, walk: 0, miss: 9999, target: null };
  if (!enemies.length) return base;
  // The weakest enemy in sight is the favourite target.
  const target = enemies.slice().sort((a, b) => a.hp - b.hp + (Math.abs(a.x - me.x) - Math.abs(b.x - me.x)) * 0.05)[0];

  // Close by: hit them with a paw or a slam.
  const close = enemies.find((m) => Math.abs(m.x - me.x) < 24 && Math.abs(m.y - me.y) < 18);
  if (close) {
    const angle = close.x >= me.x ? 0 : Math.PI;
    if (has('pound') && Math.random() < 0.4) return { ...base, weapon: 'pound', angle, target: close, miss: 0 };
    return { ...base, weapon: 'swipe', angle, target: close, miss: 0 };
  }
  if (me.hp < 40 && has('repair') && Math.random() < 0.6) return { ...base, weapon: 'repair', target: me, miss: 0 };
  if (has('bolt') && Math.random() < 0.22) return { ...base, weapon: 'bolt', tx: target.x + gauss() * aimError * 30, ty: target.y, target, miss: 0 };
  if (has('skyrain') && Math.random() < 0.22) {
    // The acorns drift with the wind on the way down: aim upwind of the target.
    const fall = Math.sqrt((2 * Math.max(40, target.y - 60)) / 520);
    const drift = world.wind * WIND_ACC * 1.2 * 0.5 * fall * fall;
    return { ...base, weapon: 'skyrain', tx: target.x - drift + gauss() * aimError * 30, ty: target.y, target, miss: 0 };
  }

  // Aimed weapons: always a rocket and a grenade, and now and then something special.
  const specials = (['heavy', 'splitter', 'seeker', 'firecracker', 'drill', 'cluster', 'bouncer', 'roller', 'ember', 'beehive'] as WeaponId[]).filter(
    (id) => has(id) && WEAPONS[id].ai,
  );
  const choices: WeaponId[] = ['rocket', 'grenade'];
  if (specials.length && Math.random() < 0.45) choices.unshift(specials[Math.floor(Math.random() * specials.length)]);
  const friends = world.moles.filter((m) => m.alive && m.team === me.team && m !== me);
  const bodies = enemies.map((m) => ({ x: m.x, y: m.y }));
  let best: Plan = { ...base };
  for (const id of choices) {
    const w = WEAPONS[id];
    const ax = world.wind * WIND_ACC * windFactor(id);
    const reach = w.radius + 12;
    for (let a = -Math.PI - 0.3; a <= 0.3; a += 0.055) {
      for (let p = 0.25; p <= 1.001; p += 0.05) {
        const m = World.muzzle(me, a);
        const f = flight(world.terrain, m.x, m.y, Math.cos(a) * w.speed * p, Math.sin(a) * w.speed * p, ax, world.water, 4.5, bodies, 1000);
        if (!f.hit) continue;
        let score = Math.hypot(f.hit.x - target.x, f.hit.y - (target.y - 10));
        // Any enemy in the blast counts.
        for (const e of enemies) score = Math.min(score, Math.hypot(f.hit.x - e.x, f.hit.y - (e.y - 10)) + (e === target ? 0 : 12));
        if (Math.hypot(f.hit.x - me.x, f.hit.y - (me.y - 10)) < reach + 6) score += 600;
        for (const fr of friends) if (Math.hypot(f.hit.x - fr.x, f.hit.y - (fr.y - 10)) < reach) score += 250;
        // A thrown weapon rolls on: a little worse than a clean hit at the same spot.
        if (w.group === 'throw') score += 6;
        // Specials are worth a little more, so the AI uses them when they land as well.
        if (id !== 'rocket' && id !== 'grenade') score -= 8;
        if (score < best.miss) best = { ...base, weapon: id, angle: a, power: p, miss: score, target };
      }
    }
  }
  if (best.miss > 170 && canWalk) return { ...best, walk: Math.sign(target.x - me.x) || 1 };
  if (best.miss >= 9999) return { ...base, weapon: 'rocket', angle: target.x >= me.x ? -0.9 : -Math.PI + 0.9, power: 0.7, target };
  best.angle += gauss() * aimError * 0.06;
  best.power = Math.max(0.15, Math.min(1, best.power + gauss() * aimError * 0.035));
  return best;
}
