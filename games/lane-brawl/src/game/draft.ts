// Pick and ban before a ranked match (LB19). Plain rules, free of Phaser: the scene calls `redBan`
// once the player has banned a class and `runDraft` once the player has picked, and hands the
// rosters to `createGame` (`MatchOptions.roster`).

import { COUNTERS, ChampionDef, DRAFT, Team } from './data';

export interface DraftPick {
  team: Team;
  def: ChampionDef;
  /** A red pick made to counter this blue champion. */
  counters?: ChampionDef;
}
export interface Draft {
  bans: { blue: ChampionDef; red: ChampionDef };
  /** Every pick in turn, the player's first. */
  picks: DraftPick[];
  blue: ChampionDef[];
  red: ChampionDef[];
}

/**
 * Red's ban, after the player's: below `DRAFT.counterFrom` any class at random; from that tier the
 * one the player has won most with (`wins`, mastery), if any is left.
 */
export function redBan(pool: ChampionDef[], blueBan: string, tier: number, wins: Record<string, number>, rnd: () => number = Math.random): ChampionDef {
  const left = pool.filter((c) => c.id !== blueBan);
  if (tier >= DRAFT.counterFrom) {
    const best = [...left].sort((a, b) => (wins[b.id] ?? 0) - (wins[a.id] ?? 0))[0];
    if (best && (wins[best.id] ?? 0) > 0) return best;
  }
  return left[Math.floor(rnd() * left.length) % left.length];
}

/** The class left that beats `target`'s role best (`COUNTERS`), or null when none does. */
export function counterTo(target: ChampionDef, left: ChampionDef[]): ChampionDef | null {
  for (const role of COUNTERS[target.role] ?? []) {
    const c = left.find((d) => d.role === role);
    if (c) return c;
  }
  return null;
}

/**
 * The draft once the player has picked: blue and red pick in turn by `DRAFT.order` from the classes
 * neither banned. Blue's AI picks at random; red at random below `DRAFT.counterFrom`, its first pick
 * a counter to the player from that tier and every pick a counter to blue's last from `DRAFT.allFrom`.
 */
export function runDraft(pool: ChampionDef[], pick: ChampionDef, bans: { blue: ChampionDef; red: ChampionDef }, tier: number, rnd: () => number = Math.random): Draft {
  const left = pool.filter((c) => c.id !== pick.id && c.id !== bans.blue.id && c.id !== bans.red.id);
  const picks: DraftPick[] = [];
  let lastBlue = pick;
  let redPicks = 0;
  DRAFT.order.forEach((team, i) => {
    if (i === 0) {
      picks.push({ team, def: pick });
      return;
    }
    let def: ChampionDef | null = null;
    let counters: ChampionDef | undefined;
    if (team === 'red' && (tier >= DRAFT.allFrom || (tier >= DRAFT.counterFrom && redPicks === 0))) {
      def = counterTo(lastBlue, left);
      if (def) counters = lastBlue;
    }
    def ??= left[Math.floor(rnd() * left.length) % left.length];
    left.splice(left.indexOf(def), 1);
    picks.push({ team, def, counters });
    if (team === 'blue') lastBlue = def;
    else redPicks++;
  });
  return {
    bans,
    picks,
    blue: picks.filter((p) => p.team === 'blue' && p.def !== pick).map((p) => p.def),
    red: picks.filter((p) => p.team === 'red').map((p) => p.def),
  };
}
