import { CRATE_WEAPONS, type WeaponId } from './weapons';

/**
 * Round 5's additions to how a match is set up: mole trades for campaign battles, the match kinds
 * of quick matches (Classic, Forts and Flag hill) and the weapon draft. Their texts are in `i18n/`
 * as `trade_<id>`, `tradeDesc_<id>` and `kind_<id>`.
 */

/** A campaign mole's trade, picked on the Trades screen before a battle. */
export const TRADE_IDS = ['digger', 'gunner', 'medic', 'scout'] as const;
export type TradeId = (typeof TRADE_IDS)[number];
export const isTrade = (v: unknown): v is TradeId => TRADE_IDS.includes(v as TradeId);
/** The badge shown before a mole's name (never a red cross: the medic carries a plaster). */
export const TRADE_ICON: Record<TradeId, string> = { digger: '⛏', gunner: '💥', medic: '🩹', scout: '🔭' };
/** A Digger burrows this many times as far. */
export const DIGGER_REACH = 2;
/** A Gunner's blasts hurt enemies this much harder on its turn. */
export const GUNNER_POWER = 1.15;
/** While a Medic stands, its team gets a Repair Kit every this many of its turns. */
export const MEDIC_EVERY = 3;
/** While a Scout stands, its team sees this many winds ahead. */
export const SCOUT_AHEAD = 2;

/** The trades of `n` moles: the saved ones, then the four in turn for any new mole. */
export function tradesFor(saved: readonly unknown[], n: number): TradeId[] {
  return Array.from({ length: n }, (_, i) => (isTrade(saved[i]) ? saved[i] : TRADE_IDS[i % TRADE_IDS.length]));
}

/** The match kinds of quick matches. */
export const KIND_IDS = ['classic', 'forts', 'flag'] as const;
export type KindId = (typeof KIND_IDS)[number];

/** Forts: blocks each side places in the build phase, and the sizes of the blocks. */
export const BUILD_BLOCKS = 4;
export const BLOCKS = { stone: { w: 16, h: 16 }, wood: { w: 40, h: 7 } } as const;
export type BlockKind = keyof typeof BLOCKS;

/** Flag hill: a mole within this reach of the flag at the end of a turn scores, and this many points win. */
export const FLAG_REACH = 34;
export const FLAG_WIN = 5;

/** The weapon draft: the pool's size and who picks when (Blue, Amber, Amber, Blue, ...). */
export const DRAFT_POOL = 12;
export const DRAFT_ORDER = [0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0];
/** The order the Burrow AI likes the weapons in, best first. */
const AI_TASTE: WeaponId[] = [
  'heavy', 'splitter', 'cluster', 'seeker', 'bolt', 'skyrain', 'roller', 'sap', 'drill', 'bouncer', 'dynamite', 'beehive', 'repair',
  'shield', 'pound', 'ember', 'firecracker', 'beam', 'mine', 'quake', 'hop', 'gust', 'clod',
];

/** A fresh pool: `DRAFT_POOL` weapons that run out, drawn at random. */
export function draftPool(): WeaponId[] {
  const all = CRATE_WEAPONS.slice();
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  return all.slice(0, DRAFT_POOL);
}

/** The AI's pick from what is left: one of the two it likes best. */
export function aiDraftPick(left: WeaponId[]): WeaponId {
  const ranked = left.slice().sort((a, b) => rank(a) - rank(b));
  return ranked[ranked.length > 1 && Math.random() < 0.3 ? 1 : 0];
}

const rank = (id: WeaponId) => {
  const i = AI_TASTE.indexOf(id);
  return i < 0 ? AI_TASTE.length : i;
};
