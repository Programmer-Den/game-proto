/**
 * The rivals' commanders (and the player's seat under `?watch`): a plan phase in one go, a power
 * card pick and a draft pick. Simple rules: chase copies and shared traits, level up on a schedule,
 * keep savings for interest from stage 3, bolt parts onto the best robot, tanks in front.
 */
import { aiLog } from '../../../../shared/watch';
import { t } from '../i18n';
import { BENCH_SLOTS, CLASS_STATS, ECONOMY, RANKS, UNIT_BY_ID, type AugmentId } from './data';
import {
  allUnits, boardUnits, buy, buyXp, countTraits, draftPick, equip, pickAugment, removeUnit, reroll, sell, unitCost,
  type Match, type Owned, type Player,
} from './match';

const AUGMENT_TASTE: AugmentId[] = ['thick-hull', 'rapid-fire', 'war-chest', 'hot-wiring', 'front-plates', 'big-battery', 'lucky-bolt', 'spare-parts', 'level-up', 'overtime', 'last-stand', 'duplicator', 'scrap-dividend', 'gold-rush', 'recycler'];

const value = (o: Owned) => unitCost(o) * 3 ** (o.star - 1) + o.items.length * 2;

/** The level a rival aims for in each stage. */
const targetLevel = (stage: number) => [3, 3, 5, 7, 8, 9, 9][Math.min(stage, 6)];

export function aiPickAugment(m: Match, p: Player) {
  if (!p.augmentOffer) return;
  const offer = p.augmentOffer;
  let best = 0;
  for (let i = 1; i < offer.length; i++) if (AUGMENT_TASTE.indexOf(offer[i]) < AUGMENT_TASTE.indexOf(offer[best])) best = i;
  aiLog(`p${p.seat}`, `takes the power card ${offer[best]}`);
  pickAugment(m, p, best);
}

export function aiPlan(m: Match, p: Player) {
  aiPickAugment(m, p);
  const reserve = m.stage >= 3 ? Math.min(50, 10 * (m.stage - 1)) : 0;
  // Level up toward the stage's target.
  while (p.level < targetLevel(m.stage) && p.gold - ECONOMY.xpCost >= Math.min(reserve, 20) && buyXp(p)) aiLog(`p${p.seat}`, `buys XP (level ${p.level})`);
  // Buy what fits: copies first, then shared traits, then plain strength.
  const shop = () => {
    const traits = countTraits(boardUnits(p));
    p.shop.forEach((s, i) => {
      if (!s || p.gold < unitCost(s)) return;
      const def = UNIT_BY_ID[s.defId];
      const copies = allUnits(p).filter((o) => o.defId === s.defId).length;
      const synergy = (traits[def.origin] ?? 0) + (traits[def.cls] ?? 0);
      const score = copies * 3 + synergy + def.cost * 0.6 + (s.gilded ? 3 : 0);
      const short = allUnits(p).length < p.level;
      const spend = p.gold - unitCost(s) >= reserve || copies >= 1 || short;
      if ((score >= 1.5 || short) && spend && buy(m, p, i)) aiLog(`p${p.seat}`, `buys ${t(def.name)}${copies ? ' (another copy)' : ''}`);
    });
  };
  shop();
  let rolls = 0;
  // The player's seat under `?watch` plays as designed; the rivals roll sooner at higher ranks.
  const rank = RANKS[p.seat === 0 ? 0 : m.opts.rank];
  while (m.stage >= rank.rollFrom && p.gold > rank.rollAbove + ECONOMY.rerollCost && rolls++ < 6 && reroll(m, p)) shop();
  // Clear a full bench of its weakest robot.
  const benched = p.bench.filter((b): b is Owned => !!b);
  if (benched.length >= BENCH_SLOTS - 1) {
    const weakest = benched.sort((a, b) => value(a) - value(b))[0];
    aiLog(`p${p.seat}`, `sells ${t(UNIT_BY_ID[weakest.defId].name)}`);
    sell(p, weakest);
  }
  arrange(p);
  // Parts onto the strongest robots on the board.
  const carriers = boardUnits(p).sort((a, b) => value(b) - value(a));
  for (const carrier of carriers) {
    while (p.items.length && equip(p, 0, carrier)) aiLog(`p${p.seat}`, `bolts a part onto ${t(UNIT_BY_ID[carrier.defId].name)}`);
  }
}

/** Puts the strongest robots on the board, tanks and brawlers in front, shooters at the back. */
export function arrange(p: Player) {
  const all = allUnits(p).sort((a, b) => value(b) - value(a));
  const chosen = all.slice(0, p.level);
  for (const o of all) removeUnit(p, o);
  const benchSpots = all.slice(p.level);
  benchSpots.forEach((o, i) => (p.bench[i] = o));
  const front = [3, 4, 2, 5, 1, 6, 0, 7];
  const rowFor = (o: Owned) => {
    const cls = UNIT_BY_ID[o.defId].cls;
    return cls === 'guardian' || cls === 'brawler' ? 4 : cls === 'saboteur' ? 5 : CLASS_STATS[cls].range >= 4 ? 7 : 6;
  };
  for (const o of chosen) {
    let row = rowFor(o);
    let col = front.find((c) => !p.board[`${c},${row}`]);
    while (col === undefined) {
      row = row === 7 ? 4 : row + 1;
      col = front.find((c) => !p.board[`${c},${row}`]);
    }
    p.board[`${col},${row}`] = o;
  }
}

export function aiDraft(m: Match, p: Player) {
  const d = m.draft!;
  const traits = countTraits(allUnits(p));
  let best = -1;
  let bestScore = -Infinity;
  d.options.forEach((o, i) => {
    if (o.takenBy !== null) return;
    const def = UNIT_BY_ID[o.defId];
    const copies = allUnits(p).filter((u) => u.defId === o.defId).length;
    const score = def.cost + copies * 3 + (traits[def.origin] ?? 0) + (traits[def.cls] ?? 0) + (o.item.includes('-') ? 2 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  });
  if (best >= 0) {
    aiLog(`p${p.seat}`, `drafts ${t(UNIT_BY_ID[d.options[best].defId].name)}`);
    draftPick(m, p.seat, best);
  }
}
