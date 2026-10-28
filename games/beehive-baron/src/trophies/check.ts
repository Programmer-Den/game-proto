import { award } from '../../../../shared/trophies';
import { MEADOWS } from '../game/meadows';
import { MAX_HIVES } from '../game/swarm';
import type { GameState } from '../game/state';
import { trophies } from './index';

/** Jars sold for the Full shelves trophy. */
const HUNDRED_JARS = 100;
/** County fair golds for the Blue-ribbon keeper trophy. */
const THREE_GOLDS = 3;

/** Whether each trophy's condition holds in the state, with the events not yet drawn. */
const EARNED: Record<string, (state: GameState) => boolean> = {
  firstJar: (s) => s.sold >= 1,
  lavender: (s) => s.meadows >= 1,
  swatter: (s) => s.events.some((e) => e.kind === 'swatted'),
  orchard: (s) => s.contract?.phase === 'lent',
  mead: (s) => s.casks.some((c) => c.agingMs === 0),
  secondHive: (s) => s.hives >= MAX_HIVES,
  allMeadows: (s) => s.meadows >= MEADOWS.length,
  hundredJars: (s) => s.sold >= HUNDRED_JARS,
  baron: (s) => s.baron,
  threeGolds: (s) => s.golds >= THREE_GOLDS,
};

/** False until the first check of the page, which finds what a restored save earned. */
let checked = false;

/**
 * Awards every trophy whose condition holds. The scene calls it every frame after the tick and
 * before it draws (and so empties) the events; the first call after the page loads is quiet, so a
 * loaded save and the nectar gathered away earn their trophies without a toast.
 */
export function checkTrophies(state: GameState) {
  for (const trophy of trophies.list) if (EARNED[trophy.id]?.(state)) award(trophies, trophy.id, { quiet: !checked });
  checked = true;
}
