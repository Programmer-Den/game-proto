/**
 * Rift heat: harder runs, opened one at a time by winning. Heat 0 is the crusade as designed; each
 * level adds one rule to those below it, and winning at a heat opens the next for that hero.
 */
import type { TextKey } from '../i18n';

export const MAX_HEAT = 5;

/** The numbers of the heat rules (see `HEAT_RULES` for the level each comes in at). */
export const HEAT = {
  /** Heat 1: elites come this much more often (the gap between them is divided by it). */
  elites: 2,
  /** Heat 2: foes' hits on the hero are this much harder. */
  hurt: 1.25,
  /** Heat 4: below this share of its health a boss goes into a frenzy, attacking this much faster and moving faster. */
  frenzyAt: 0.25,
  frenzy: 1.5,
  frenzySpeed: 1.2,
  /** Heat 5: foes and bosses have this much more health. */
  hp: 1.25,
};

/** The heat each rule comes in at. */
export const HEAT_AT = { elites: 1, hurt: 2, noRest: 3, frenzy: 4, hp: 5 } as const;

/** The rule each heat adds, by heat (index 0 is heat 0, no rule). */
export const HEAT_RULES: readonly TextKey[] = ['heat0', 'heat1', 'heat2', 'heat3', 'heat4', 'heat5'];

/** Whether a heat rule holds in a run at `heat`. */
export const hot = (heat: number, rule: keyof typeof HEAT_AT) => heat >= HEAT_AT[rule];

/**
 * The highest heat open to a hero: one above the best heat it has won at (`best` is undefined when
 * it has never won), never above `MAX_HEAT`.
 */
export const heatOpen = (best: number | undefined) => (best === undefined ? 0 : Math.min(MAX_HEAT, best + 1));
