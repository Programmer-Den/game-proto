import type { WeaponId } from './weapons';

/**
 * The Quartermaster: lasting upgrades for your side in campaign battles, bought with acorns won in
 * them. Each upgrade has levels, each dearer than the last. Names and what they do are in `i18n/`
 * as `u_<id>` and `ud_<id>`. Quick matches never use them, so a match against a friend stays fair.
 */

export const UPGRADE_IDS = ['helmet', 'time', 'heavy', 'shield', 'repair', 'crates', 'recruit'] as const;
export type UpgradeId = (typeof UPGRADE_IDS)[number];

/** The price of each level, in acorns; its length is the upgrade's top level. */
export const UPGRADE_COSTS: Record<UpgradeId, number[]> = {
  helmet: [60, 100, 150],
  time: [50, 90],
  heavy: [40, 70],
  shield: [40, 70],
  repair: [40, 70],
  crates: [60, 100],
  recruit: [200],
};

export type Levels = Partial<Record<UpgradeId, number>>;

/** What the bought levels add up to in a battle. */
export function boosts(levels: Levels) {
  const lv = (id: UpgradeId) => Math.max(0, Math.min(UPGRADE_COSTS[id].length, levels[id] ?? 0));
  const ammo: Partial<Record<WeaponId, number>> = { heavy: lv('heavy'), shield: lv('shield'), repair: lv('repair') };
  return {
    /** Extra health for each of your moles. */
    hp: lv('helmet') * 10,
    /** Extra seconds a turn. */
    time: lv('time') * 5,
    ammo,
    /** Added to the 40% chance of a crate after a turn. */
    crates: lv('crates') * 0.15,
    /** Extra moles on your side. */
    moles: lv('recruit'),
  };
}

/** Acorns for a campaign battle: a little for trying, more for a win and each star. */
export const reward = (won: boolean, stars: number) => (won ? 40 + stars * 15 : 15);
