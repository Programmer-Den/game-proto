import { settings, type Difficulty } from '../../../../shared/settings';

/**
 * Burrow Brigade's own options, set on the menu's Options panel and kept in `burrow-brigade-prefs`:
 * a difficulty of its own (or the hub's), the turn time and crates for quick matches, and weather.
 * The defaults keep the hub's difficulty, a 30 second turn and the usual crates; weather is on.
 */

export const DIFFICULTY_CHOICES = ['hub', 'easy', 'normal', 'hard'] as const;
export type DifficultyChoice = (typeof DIFFICULTY_CHOICES)[number];
export const TURN_CHOICES = [20, 30, 45, 60];
export const CRATE_CHOICES = ['none', 'few', 'normal', 'many'] as const;
export type CrateChoice = (typeof CRATE_CHOICES)[number];
/** The chance of a crate after a turn for each crate choice. */
export const CRATE_ODDS: Record<CrateChoice, number> = { none: 0, few: 0.2, normal: 0.4, many: 0.7 };

export interface Options {
  difficulty: DifficultyChoice;
  /** Seconds a turn in quick matches (the campaign keeps 30). */
  turn: number;
  crates: CrateChoice;
  /** Rain, fog and gusts now and then (not in the daily range). */
  weather: boolean;
}

export const DEFAULT_OPTIONS: Options = { difficulty: 'hub', turn: 30, crates: 'normal', weather: true };

/** The options as saved, each checked against its choices. */
export function cleanOptions(o: Partial<Options>): Options {
  return {
    difficulty: DIFFICULTY_CHOICES.includes(o.difficulty as DifficultyChoice) ? (o.difficulty as DifficultyChoice) : DEFAULT_OPTIONS.difficulty,
    turn: TURN_CHOICES.includes(Number(o.turn)) ? Number(o.turn) : DEFAULT_OPTIONS.turn,
    crates: CRATE_CHOICES.includes(o.crates as CrateChoice) ? (o.crates as CrateChoice) : DEFAULT_OPTIONS.crates,
    weather: typeof o.weather === 'boolean' ? o.weather : DEFAULT_OPTIONS.weather,
  };
}

/** The game's difficulty under way: its own choice, or the hub's when it follows the hub. */
let choice: DifficultyChoice = 'hub';
export const setDifficulty = (c: DifficultyChoice) => (choice = c);
export const difficulty = (): Difficulty => (choice === 'hub' ? settings.difficulty : choice);

/** Like the shared `byDifficulty`, but honouring the game's own difficulty. */
export function byLevel<T>(easy: T, normal: T, hard: T): T {
  return { easy, normal, hard }[difficulty()];
}
