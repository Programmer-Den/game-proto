// The coach after the match (LB23, round 5): three plain notes on how the player played, each with
// one tip, read from what the match kept in `s.coach` and the player's champion. Problems come first,
// the worst first; with fewer than three, praise and then general tips fill the rest.

import type { TextKey } from '../i18n';
import { COACH } from './data';
import { getUnit, type GameState } from './state';

export interface CoachNote {
  note: TextKey;
  tip: TextKey;
  vars: Record<string, number>;
  /** Praise rather than a problem (drawn in green). */
  good: boolean;
}

export function coachNotes(s: GameState): CoachNote[] {
  const me = getUnit(s, s.player);
  if (!me || s.watch) return [];
  const c = s.coach;
  const minutes = s.time / 60_000;
  const marked = s.lastHits + c.missed;
  const share = marked ? s.lastHits / marked : 1;
  const takedowns = me.kills + me.assists;
  const bad: (CoachNote & { weight: number })[] = [];
  const add = (weight: number, note: TextKey, tip: TextKey, vars: Record<string, number> = {}) => bad.push({ weight, note, tip, vars, good: false });
  if (c.towerDeaths >= 2) add(c.towerDeaths * 3, 'coachTowerDeaths', 'coachTowerDeathsTip', { n: c.towerDeaths });
  if (c.missed >= 8 && share <= 0.6) add((1 - share) * 10, 'coachMissedHits', 'coachMissedHitsTip', { pct: Math.round((1 - share) * 100), n: c.missed });
  if (me.deaths >= 4 && me.deaths > takedowns) add(me.deaths, 'coachDeaths', 'coachDeathsTip', { n: me.deaths, k: takedowns });
  if (c.richMs >= COACH.richMs) add((c.richMs / 60_000) * 2, 'coachRich', 'coachRichTip', { gold: COACH.rich, m: Math.round(c.richMs / 60_000) });
  if (c.objMissed >= 2) add(c.objMissed * 2, 'coachObjectives', 'coachObjectivesTip', { n: c.objMissed });
  if (c.wards === 0 && s.time >= COACH.wardsBy) add(4, 'coachNoWards', 'coachNoWardsTip');
  if (c.spells === 0 && s.time >= COACH.spellBy) add(3, 'coachNoSpell', 'coachNoSpellTip');
  if (s.quest?.state === 'missed') add(3, 'coachQuestMissed', 'coachQuestMissedTip');
  bad.sort((a, b) => b.weight - a.weight);
  const notes: CoachNote[] = bad.slice(0, COACH.notes).map(({ note, tip, vars, good }) => ({ note, tip, vars, good }));
  const good = (note: TextKey, tip: TextKey, vars: Record<string, number> = {}) => {
    if (notes.length < COACH.notes) notes.push({ note, tip, vars, good: true });
  };
  if (s.quest?.state === 'done') good('coachQuestDone', 'coachQuestDoneTip');
  if (s.lastHits >= 15 && share >= 0.7) good('coachGoodHits', 'coachGoodHitsTip', { pct: Math.round(share * 100) });
  if (me.deaths <= 2 && minutes >= 5) good('coachGoodSafe', 'coachGoodSafeTip', { n: me.deaths });
  if (takedowns >= 5) good('coachGoodTeam', 'coachGoodTeamTip', { n: takedowns });
  if (s.objectivesDone >= 2) good('coachGoodObjectives', 'coachGoodObjectivesTip', { n: s.objectivesDone });
  // Nothing stood out: general tips.
  good('coachTipWaves', 'coachTipWavesTip');
  good('coachTipMap', 'coachTipMapTip');
  good('coachTipRecall', 'coachTipRecallTip');
  return notes;
}
