import { award } from '../../../../shared/trophies';
import { isCharm } from '../game/catalog';
import { KINDS } from '../game/kinds';
import type { Progress } from '../game/progress';
import { DAILY_LEVELS, type Run } from '../game/run';
import { trophies } from './index';

/** Solves in a row for Unbroken, and charms held at once for Charmed life. */
const STREAK = 10;
const CHARMS_HELD = 5;

/** Whether each trophy's condition holds in the records, or in the run in play (if any). */
const EARNED: Record<string, (p: Progress, run: Run | null) => boolean> = {
  firstSight: (p) => KINDS.some((k) => p.kinds[k].solved > 0),
  omen: (_, run) => !!run?.results.some((r) => r.omen && r.reason === 'solved'),
  charm: (_, run) => !!run?.relics.some(isCharm),
  fullDeck: (p) => KINDS.every((k) => p.kinds[k].solved > 0),
  boss: (_, run) => !!run?.results.some((r) => r.boss && r.reason === 'solved'),
  perfectDay: (_, run) =>
    run?.mode === 'daily' && run.results.length === DAILY_LEVELS.length && run.results.every((r) => r.reason === 'solved'),
  oracle: (p) => KINDS.some((k) => p.kinds[k].best[3] > 0),
  streak: (_, run) => !!run && run.mode !== 'practice' && run.streak >= STREAK,
  charmed: (_, run) => !!run && run.relics.filter(isCharm).length >= CHARMS_HELD,
  tempted: (_, run) => !!run?.results.some((r) => r.boss && r.omen && r.reason === 'solved'),
};

/**
 * Awards every trophy whose condition holds. The scene calls it when the page loads, quietly, so
 * records kept from before trophies earn theirs without a toast, and after each change to a run.
 */
export function checkTrophies(progress: Progress, run: Run | null, quiet = false) {
  for (const trophy of trophies.list) if (EARNED[trophy.id]?.(progress, run)) award(trophies, trophy.id, { quiet });
}
