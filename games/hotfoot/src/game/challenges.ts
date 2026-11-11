// The challenge courses: ten short courses laid out by hand, each a fixed row of pieces on its own
// ground at its own pace, run bare (no armoury, boons or companion) from the run's hearts (three on Normal) to a finish
// banner. Each pays up to three stars: one for reaching the banner, one for reaching it without a
// hit, and one for reaching it with every coin on the course. Every star of all ten wins the gold
// boots, worn in every run after. A piece's sizes come from the course's own seed, so a course is
// the same every time it is run. Names are keys of `i18n/en.ts`, shown with `t`.
import type { TextKey } from '../i18n';
import type { Piece } from './course';
import type { Terrain } from './state';

export interface Challenge {
  name: TextKey;
  /** The stage whose pace it runs at (speed, goblins' and bats' speed, tall ledges from 3). */
  stage: number;
  terrain: Terrain;
  /** Open road between one piece and the next, in px. */
  gap: number;
  pieces: Piece[];
}

export const CHALLENGES: Challenge[] = [
  { name: 'trial1', stage: 1, terrain: 'road', gap: 470, pieces: ['spikes', 'goblin', 'spikes', 'ledge', 'blade', 'spikes'] },
  { name: 'trial2', stage: 2, terrain: 'road', gap: 450, pieces: ['blade', 'bat', 'spikes', 'blade', 'bat', 'goblin', 'blade'] },
  { name: 'trial3', stage: 2, terrain: 'road', gap: 440, pieces: ['pit', 'spikes', 'pit', 'ledge', 'pit', 'pit'] },
  { name: 'trial4', stage: 3, terrain: 'road', gap: 430, pieces: ['flames', 'spikes', 'flames', 'blade', 'flames', 'goblin', 'flames'] },
  { name: 'trial5', stage: 3, terrain: 'ice', gap: 440, pieces: ['steps', 'spikes', 'blade', 'pit', 'steps', 'bat'] },
  { name: 'trial6', stage: 3, terrain: 'marsh', gap: 430, pieces: ['spikes', 'pit', 'goblin', 'ledge', 'spikes', 'pit', 'flames'] },
  { name: 'trial7', stage: 4, terrain: 'road', gap: 400, pieces: ['goblin', 'bat', 'goblin', 'ledge', 'goblin', 'bat', 'goblin'] },
  { name: 'trial8', stage: 4, terrain: 'wind', gap: 420, pieces: ['pit', 'spikes', 'steps', 'bat', 'pit', 'flames', 'blade'] },
  { name: 'trial9', stage: 5, terrain: 'road', gap: 390, pieces: ['ledge', 'blade', 'steps', 'flames', 'ledge', 'pit', 'steps', 'bat'] },
  { name: 'trial10', stage: 6, terrain: 'ice', gap: 380, pieces: ['spikes', 'blade', 'pit', 'goblin', 'flames', 'bat', 'steps', 'spikes', 'pit', 'blade'] },
];

/** The stars, as bits of a course's score: reached the banner, with no hit, with every coin. */
export const STAR = { finish: 1, nohit: 2, coins: 4 };
/** Stars in a score (0 to 3). */
export const starCount = (bits: number) => (bits & 1) + ((bits >> 1) & 1) + ((bits >> 2) & 1);
/** Every star there is: all of them win the gold boots. */
export const ALL_STARS = CHALLENGES.length * 3;
/** Stars held over all courses, from each course's best score. */
export const totalStars = (scores: number[]) => scores.reduce((n, b) => n + starCount(b), 0);

/** A challenge run under way: which course, the coins laid on it and taken, and whether the banner was reached. */
export interface ChallengeRun {
  index: number;
  coins: number;
  got: number;
  done: boolean;
}

/** The stars a challenge run has earned (0 until the banner is reached). */
export function starsOf(c: ChallengeRun, hits: number) {
  if (!c.done) return 0;
  return STAR.finish | (hits === 0 ? STAR.nohit : 0) | (c.got >= c.coins ? STAR.coins : 0);
}
