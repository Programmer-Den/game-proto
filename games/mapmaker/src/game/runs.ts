// Voyages away from the atlas: expeditions to the far isles (MM11) and the daily isle (MM13). Each is
// one voyage on an isle of its own, with one fixed budget of supplies for the whole isle and no
// restocking (an expedition takes the coastal sloop's landing along), played on a `GameState` of its own (`run` set) while the atlas waits at the harbour.
import { dailyRand, today } from '../../../../shared/daily';
import { byDifficulty } from '../../../../shared/settings';
import { makeIsland } from './island';
import { landingSpot } from './sim';
import type { IsleKind } from './kinds';
import { rankOf, type GameState, type Run } from './state';

/** The storage name the daily isle keeps its record under (`mapmaker-daily`). */
export const DAILY_GAME = 'mapmaker';

/**
 * The far isles: fixed isles (the same number and seed for every player), one of each kind, numbered
 * past the atlas's first round so they hold more villages and ruins. An expedition's score is the
 * share of the isle it charts.
 */
export const FAR_ISLES: { island: number; seed: number; kind: IsleKind }[] = [
  { island: 9, seed: 1_730_201, kind: 'green' },
  { island: 10, seed: 2_904_517, kind: 'archipelago' },
  { island: 11, seed: 3_118_643, kind: 'volcanic' },
  { island: 12, seed: 4_562_009, kind: 'jungle' },
];
/** An expedition's supplies for the whole isle, Provisions or not. */
export const EXPEDITION_SUPPLIES = byDifficulty(40, 30, 24);
/** The daily isle's supplies, the same for everyone. */
export const DAILY_SUPPLIES = 18;

/** Today's daily isle: its number (one of the second round's, 5 to 8, so any kind) and seed. */
export function dailyIsle(day = today()) {
  const random = dailyRand(DAILY_GAME, day);
  const island = 5 + Math.floor(random() * 4);
  return { island, seed: Math.floor(random() * 2 ** 32) };
}

/**
 * A run's state: its isle with only the port charted, the run's supplies, no commission, hand, rival
 * or wonder. An expedition takes the atlas's upgrades along (the Spyglass sees further; Provisions
 * add nothing to its fixed budget); the daily isle sails with none, so every player is equal.
 */
export function newRun(atlas: GameState, run: Run): GameState {
  const { island, seed } = run.mode === 'expedition' ? FAR_ISLES[run.far] : dailyIsle(run.day);
  const isle = makeIsland(island, seed);
  const s: GameState = {
    island,
    kind: isle.kind,
    seed,
    voyage: 1,
    phase: 'survey',
    tiles: isle.tiles,
    port: isle.port,
    surveyor: { ...isle.port },
    supplies: run.supplies,
    coins: 0,
    ranks: run.mode === 'expedition' ? { ...atlas.ranks } : {},
    surveyed: [],
    commission: null,
    board: [],
    hands: [],
    hand: null,
    chart: null,
    lastSale: 0,
    milestones: 0,
    isleStart: 1,
    atlas: [],
    camps: [],
    storms: [],
    artifacts: 0,
    treasure: 0,
    riddle: isle.riddle,
    dug: [],
    features: isle.features,
    rival: null,
    royal: null,
    next: null,
    wonder: null,
    wonders: [],
    landing: null,
    guide: 0,
    stores: 0,
    trade: null,
    traded: [],
    run,
  };
  // An expedition with the coastal sloop gets its second landing too.
  if (rankOf(s, 'sloop') > 0) s.landing = landingSpot(s);
  return s;
}

export const expedition = (far: number): Run => ({ mode: 'expedition', far, supplies: EXPEDITION_SUPPLIES });
export const dailyRun = (day = today()): Run => ({ mode: 'daily', day, supplies: DAILY_SUPPLIES });
