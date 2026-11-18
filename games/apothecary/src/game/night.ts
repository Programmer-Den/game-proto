import { isFine, plainOf, type PotionId } from './items';
import { alchemyOpen, SATCHEL, WILD_HERBS, alchemyName, type MixId, type WildHerb } from './alchemy';
import { nudgeReputation, type GameState } from './state';
import type { Feedback } from './sim';
import { t } from '../i18n';

// Night customers (AP21): once the study has taught every recipe, the shop can stay open after dusk.
// The craftsmen sleep, so everything is done by hand, and night folk come in for the nightshade
// potions and the bench's potions, paying in rare herbs or, now and then, a lasting town seal. Closed,
// the default, the day goes on to the next as it always did. The rules live here, free of Phaser;
// `tick` runs them and `GameScene` draws them.

export type FolkKind = 'witch' | 'lamplighter' | 'sailor';
export const FOLK_KINDS: readonly FolkKind[] = ['witch', 'lamplighter', 'sailor'];

/** One of the night folk: who, what they want, what they pay, and how long they wait once in. */
export interface NightFolk {
  id: number;
  kind: FolkKind;
  want: PotionId | MixId;
  /** Wild herbs they pay with (into the satchel), or a town seal. */
  pays: { herbs: Partial<Record<WildHerb, number>> } | { seal: true };
  /** Milliseconds still to walk in from the street; they are served once at the counter. */
  walk: number;
  patience: number;
  maxPatience: number;
}

export interface Night {
  /** Whether the shop stays open tonight: set by the night sign, off by default. */
  open: boolean;
  /** Milliseconds left of the night under way, 0 by day. */
  left: number;
  /** Nights the shop has stayed open, all game long. */
  nights: number;
  /** Night folk come in this night so far, and milliseconds until the next. */
  came: number;
  next: number;
  folk: NightFolk[];
  nextId: number;
  /** Night folk served, all game long. */
  served: number;
}
export const createNight = (): Night => ({ open: false, left: 0, nights: 0, came: 0, next: 0, folk: [], nextId: 1, served: 0 });

/** How long a night is: a little over a third of a day. */
export const NIGHT_MS = 90_000;
/** Time from dusk to the first of the night folk, and between them. */
export const FIRST_FOLK_MS = 4_000;
export const FOLK_GAP_MS = 18_000;
/** The most night folk in a night. */
export const FOLK_PER_NIGHT = 4;
/** How long one walks in from the street, and waits at the counter. */
export const FOLK_WALK_MS = 4_000;
export const FOLK_PATIENCE = 40_000;
/** The ghostly sailor comes every this many nights kept open, for a bench potion, and pays a town seal. */
export const SAILOR_EVERY = 3;
/** The witch pays this many of one wild herb; the lamplighter one of each. */
export const WITCH_HERBS = 2;
/** What a night folk served does for the shop's name. */
export const FOLK_REPUTATION = 1;
/** The potions brewed with nightshade, which the night folk ask for. */
export const NIGHT_POTIONS: readonly PotionId[] = ['shadowElixir', 'moonlightSalve', 'witchsBrew'];

/** The night sign stands once the study has taught every recipe, the late game. */
export const nightOpen = (state: GameState) => alchemyOpen(state);
/** Whether a night is under way. */
export const isNight = (state: GameState) => (state.night?.left ?? 0) > 0;
/** Whether one of the night folk stands at the counter, to be served. */
export const folkIn = (folk: NightFolk) => folk.walk <= 0;
/** The bench potions a sailor can ask for: the ones discovered. */
const benchPotions = (state: GameState) => state.alchemy.found;

/** Turns the night sign: open tonight, or closed at dusk as by default. */
export function toggleNight(state: GameState): Feedback | null {
  if (!nightOpen(state)) return null;
  state.night.open = !state.night.open;
  return [t(state.night.open ? 'nightOpenTonight' : 'nightClosedTonight')];
}

/** Dusk with the shop kept open: the day's customers go home, the craftsmen to bed, and the night begins. */
export function startNight(state: GameState) {
  const night = state.night;
  night.left = NIGHT_MS;
  night.nights++;
  night.came = 0;
  night.next = FIRST_FOLK_MS;
  night.folk = [];
  // A market day's crowd still waiting at dusk goes home with the rest; its bonus is lost.
  if (state.orders.some((o) => o.rush) && state.rush) state.rush.lost = true;
  state.orders = [];
}

/**
 * Who comes in `k`th tonight and what they want, the same in every game: a witch and a lamplighter
 * by turns for the nightshade potions, and on every `SAILOR_EVERY`th night the ghostly sailor last,
 * for a bench potion, once one is discovered.
 */
function folkFor(state: GameState, k: number): Omit<NightFolk, 'id' | 'walk' | 'patience' | 'maxPatience'> {
  const n = state.night.nights;
  const found = benchPotions(state);
  if (k === FOLK_PER_NIGHT - 1 && n % SAILOR_EVERY === 0 && found.length > 0) {
    return { kind: 'sailor', want: found[(n / SAILOR_EVERY - 1) % found.length], pays: { seal: true } };
  }
  const want = NIGHT_POTIONS[(n + 2 * k) % NIGHT_POTIONS.length];
  if (k % 2 === 0) return { kind: 'witch', want, pays: { herbs: { [WILD_HERBS[(n + k) % WILD_HERBS.length]]: WITCH_HERBS } } };
  return { kind: 'lamplighter', want, pays: { herbs: Object.fromEntries(WILD_HERBS.map((h) => [h, 1])) } };
}

/**
 * Runs the night for `dt`: the night folk come in and wait, the doctor on the counter's work spot
 * serves them, and at its end those still waiting leave. Returns true when the night is over, for
 * the next day to begin.
 */
export function runNight(state: GameState, dt: number, atCounter: boolean): boolean {
  const night = state.night;
  night.left -= dt;
  night.next -= dt;
  if (night.next <= 0 && night.came < FOLK_PER_NIGHT && night.left > FOLK_WALK_MS) {
    night.folk.push({ id: night.nextId++, ...folkFor(state, night.came), walk: FOLK_WALK_MS, patience: FOLK_PATIENCE, maxPatience: FOLK_PATIENCE });
    night.came++;
    night.next = FOLK_GAP_MS;
  }
  for (const folk of night.folk) {
    if (folkIn(folk)) folk.patience -= dt;
    else folk.walk -= dt;
  }
  // Night folk who wait too long drift off into the dark; the street never sees them go.
  night.folk = night.folk.filter((f) => f.patience > 0);
  if (atCounter) for (const folk of [...night.folk]) if (folkIn(folk)) serveFolk(state, folk.id);
  if (night.left > 0) return false;
  night.left = 0;
  night.folk = [];
  return true;
}

/** Whether what one of the night folk wants is at hand: on its shelf, or on the bench's rack. */
export const hasWant = (state: GameState, want: NightFolk['want']) =>
  (NIGHT_POTIONS as readonly string[]).includes(want) ? state.counter.shelf.some((p) => plainOf(p) === want) : (state.alchemy.rack[want as MixId] ?? 0) > 0;

/**
 * Serves one of the night folk standing at the counter: their potion off its shelf (a plain one
 * first, since they pay the same) or off the bench's rack, for herbs into the satchel or a town seal.
 */
export function serveFolk(state: GameState, id: number): Feedback | null {
  const night = state.night;
  const folk = night.folk.find((f) => f.id === id);
  if (!folk || !folkIn(folk) || !hasWant(state, folk.want)) return null;
  if ((NIGHT_POTIONS as readonly string[]).includes(folk.want)) {
    const shelf = state.counter.shelf;
    let i = shelf.findIndex((p) => p === folk.want);
    if (i < 0) i = shelf.findIndex((p) => isFine(p) && plainOf(p) === folk.want);
    shelf.splice(i, 1);
  } else state.alchemy.rack[folk.want as MixId]!--;
  night.folk = night.folk.filter((f) => f !== folk);
  night.served++;
  nudgeReputation(state, FOLK_REPUTATION);
  const name = t(folk.kind);
  if ('seal' in folk.pays) {
    state.seals = (state.seals ?? 0) + 1;
    return [t('folkPaidSeal', { name })];
  }
  const lab = state.alchemy;
  const got = Object.entries(folk.pays.herbs).map(([herb, n]) => {
    const have = lab.wild[herb as WildHerb] ?? 0;
    // Like the courier's, the satchel takes what fits and never loses what it holds.
    lab.wild[herb as WildHerb] = Math.max(have, Math.min(SATCHEL, have + n!));
    return t('herbGain', { n: n!, herb: alchemyName(herb as WildHerb) });
  });
  return [t('folkPaidHerbs', { name, herbs: got.join(', ') })];
}
