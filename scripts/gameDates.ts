import { execFileSync } from 'node:child_process';

/** When a game was added and last changed, as `YYYY-MM-DD` dates from git. */
export type GameDates = Record<string, { added: string; updated: string }>;

/**
 * Reads each game's dates from git history for the hub's Last updated line and its New and Updated
 * badges (`shared/gameDates.ts`). Only a change to the game's own code or page counts, so a change to
 * its screenshots or docs, or to `shared/`, marks nothing as updated. A build without git history
 * (or a game not committed yet) leaves the game out, and it then shows neither.
 */
export function gameDates(games: string[]): GameDates {
  const git = (...args: string[]) => {
    try {
      return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    } catch {
      return '';
    }
  };
  const dates: GameDates = {};
  for (const game of games) {
    const updated = git('log', '-1', '--format=%cs', '--', `games/${game}/src`, `games/${game}/index.html`);
    const added = git('log', '--diff-filter=A', '--format=%cs', '--', `games/${game}/index.html`).split('\n').pop();
    if (updated && added) dates[game] = { added, updated };
  }
  return dates;
}
