import type { PotionId } from './items';
import type { CraftingId, GameState } from './state';

// The shop ledger (AP22): how each refining table and cauldron spent the day, at work or waiting, and
// how long each shelf stood empty. `tick` fills it, also while away; the ledger at the counter shows it.

/** What an idle station waited for: plants or goods to work, room on its output pallets, or hands to work it. */
export type Wait = 'input' | 'room' | 'hands';
export const WAITS: readonly Wait[] = ['input', 'room', 'hands'];

/** One station's day: milliseconds at work and milliseconds waiting, by what for. */
export type StationDay = { work: number } & Record<Wait, number>;

export interface LedgerDay {
  day: number;
  stations: Partial<Record<CraftingId, StationDay>>;
  /** Milliseconds each known potion's shelf stood empty. */
  empty: Partial<Record<PotionId, number>>;
}

export interface Ledger {
  today: LedgerDay;
  yesterday: LedgerDay | null;
}

const blankDay = (day: number): LedgerDay => ({ day, stations: {}, empty: {} });
export const createLedger = (day = 1): Ledger => ({ today: blankDay(day), yesterday: null });

/** The ledger opens once anything works without the doctor: a craftsman hired or pixies flying. */
export const ledgerOpen = (state: GameState) =>
  Object.values(state.craftsmen).some((c) => c.level > 0) || Object.values(state.belts).some((b) => b.built);

/** Starts a new page when the day has changed, keeping the last one as yesterday's. */
export function turnPage(state: GameState) {
  const ledger = state.ledger;
  if (ledger.today.day === state.contract.day) return;
  ledger.yesterday = ledger.today;
  ledger.today = blankDay(state.contract.day);
}

/** Writes `dt` ms of a station's day down: at work, or waiting for `wait`. */
export function note(state: GameState, id: CraftingId, dt: number, wait: Wait | null) {
  const day = (state.ledger.today.stations[id] ??= { work: 0, input: 0, room: 0, hands: 0 });
  if (wait) day[wait] += dt;
  else day.work += dt;
}

/** Writes `dt` ms of an empty shelf down. */
export function noteEmpty(state: GameState, potion: PotionId, dt: number) {
  const empty = state.ledger.today.empty;
  empty[potion] = (empty[potion] ?? 0) + dt;
}

/** How long a station stood idle, all waits together. */
export const idleOf = (day: StationDay) => day.input + day.room + day.hands;
/** What a station waited for longest, or null when it never waited. */
export const mostlyFor = (day: StationDay): Wait | null => {
  const wait = [...WAITS].sort((a, b) => day[b] - day[a])[0];
  return day[wait] > 0 ? wait : null;
};

/** The station that worked the smallest share of its day, the slowest link; null with fewer than two written down. */
export function slowest(day: LedgerDay): CraftingId | null {
  const rows = Object.entries(day.stations) as [CraftingId, StationDay][];
  if (rows.length < 2) return null;
  const share = (d: StationDay) => d.work / Math.max(1, d.work + idleOf(d));
  return rows.reduce((a, b) => (share(b[1]) < share(a[1]) ? b : a))[0];
}
