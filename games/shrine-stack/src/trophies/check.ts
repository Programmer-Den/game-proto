import { award } from '../../../../shared/trophies';
import { GILDED_TIER, GOAL_TIER, type GameEvent, type GameState } from '../game/state';
import { trophies } from './index';

/** Sky altars finished in one temple for the Stairway of altars trophy. */
const THREE_ALTARS = 3;

/** Whether each trophy is earned by an event, read with the state after it. */
const EARNED: Record<string, (s: GameState, e: GameEvent) => boolean> = {
  firstTier: (_, e) => e.type === 'tier',
  regrown: (_, e) => e.type === 'regrown',
  cursed: (_, e) => e.type === 'tier' && e.cursed,
  gilded: (_, e) => e.type === 'tier' && e.tier === GILDED_TIER,
  crowned: (_, e) => e.type === 'tier' && e.tier === GOAL_TIER,
  flawless: (s, e) => e.type === 'tier' && e.tier === GOAL_TIER && s.balancedTiers === GOAL_TIER,
  skyAltar: (_, e) => e.type === 'altar',
  threeAltars: (s, e) => e.type === 'altar' && s.altars >= THREE_ALTARS,
};

/** Awards every trophy the event earns; the scene calls it for each event it shows. */
export function checkTrophies(s: GameState, e: GameEvent) {
  for (const trophy of trophies.list) if (EARNED[trophy.id]?.(s, e)) award(trophies, trophy.id);
}
