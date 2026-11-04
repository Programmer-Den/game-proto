// The Admiralty's bounties: from wave 2, one optional side goal per wave that pays a share of the
// wave's loot on top when it is met.

import { random } from './random';
import type { Vars } from '../../../../shared/i18n';
import type { TextKey } from '../i18n';
import { isConvoyWave } from './convoy';
import type { EnemyKind } from './ships';
import type { GameState } from './state';
import { waveShips } from './waves';

export type BountyId = 'hull' | 'aground' | 'swift' | 'prize' | 'ketch';

export interface Bounty {
  /** What the Admiralty asks: a key of `i18n/en.ts`, filled with `vars` for the wave (`swift` names its time). */
  desc: TextKey;
  vars?: (s: GameState) => Vars;
  /**
   * `keep` bounties hold from the start and are lost by a slip; `do` bounties are earned by a
   * deed. `met` says whether it stands right now; at the harbor that decides the pay.
   */
  kind: 'keep' | 'do';
  met: (s: GameState) => boolean;
  /** Whether the wave can offer it at all. */
  offered?: (wave: number) => boolean;
}

/** How much hull a `hull` bounty allows losing. */
export const BOUNTY_HULL = 20;
/** The share of the wave's loot a met bounty pays on top. */
export const BOUNTY_SHARE = 0.5;
/** The time a `swift` bounty allows: a base plus some seconds a ship on the wave's course. */
export const swiftMs = (s: GameState) => (30 + 8 * waveShips(s.wave, s.course).length) * 1000;

const firstSunk = (s: GameState, kind: EnemyKind) => s.waveSunk.indexOf(kind);

export const BOUNTIES: Record<BountyId, Bounty> = {
  hull: { desc: 'hullBounty', vars: () => ({ hull: BOUNTY_HULL }), kind: 'keep', met: (s) => s.waveDamage <= BOUNTY_HULL },
  aground: { desc: 'agroundBounty', kind: 'keep', met: (s) => s.waveAground === 0 },
  swift: { desc: 'swiftBounty', vars: (s) => ({ seconds: Math.round(swiftMs(s) / 1000) }), kind: 'keep', met: (s) => s.waveMs <= swiftMs(s), offered: (wave) => !isConvoyWave(wave) },
  prize: { desc: 'prizeBounty', kind: 'do', met: (s) => s.wavePrizes > 0 },
  ketch: {
    desc: 'ketchBounty',
    kind: 'do',
    met: (s) => firstSunk(s, 'ketch') >= 0 && (firstSunk(s, 'brig') < 0 || firstSunk(s, 'ketch') < firstSunk(s, 'brig')),
    offered: (wave) => waveShips(wave).includes('ketch') && waveShips(wave).includes('brig'),
  },
};

export const BOUNTY_IDS = Object.keys(BOUNTIES) as BountyId[];

/** The first wave the Admiralty posts a bounty for. */
export const FIRST_BOUNTY_WAVE = 2;

/** A bounty for `wave`, never the same as the last. Uses random() once. */
export function drawBounty(wave: number, last: BountyId | null): BountyId | null {
  if (wave < FIRST_BOUNTY_WAVE) return null;
  const choices = BOUNTY_IDS.filter((id) => id !== last && (BOUNTIES[id].offered?.(wave) ?? true));
  return choices[Math.floor(random() * choices.length)];
}

/** Whether the wave's bounty stands as things are: a `keep` bounty not yet lost, or a `do` bounty done. */
export const bountyMet = (s: GameState) => (s.bounty ? BOUNTIES[s.bounty].met(s) : false);

/** What the wave's bounty pays if met, from the loot gathered this wave. */
export const bountyPay = (s: GameState) => Math.round(s.waveLoot * BOUNTY_SHARE);
