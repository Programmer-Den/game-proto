import type { Translation } from '../../../../shared/i18n';
import type en from './en';

/** Shrine Stack's texts whose US English spelling differs from the British source in `en.ts`. */
const enUS: Partial<Translation<typeof en>> = {
  goldenText: 'Every stone you place earns 1 more favor.',
  marbleShort: 'tight, x2 favor',
  sandstoneShort: 'easy, 1/2 favor',
  gildedBoon: 'Every stone earns 1 more favor.',
  patientBane: 'Perfect drops earn no extra favor.',
  gildedGoal: 'Tier {tier} gilded: x{mult} favor',
  favour: 'Favor {n}',
  toppledFavourLeft: 'Leaned too far left: -{n} favor',
  toppledFavourRight: 'Leaned too far right: -{n} favor',
  gildedFavour: 'x{mult} favor',
  gildedTierFavour: 'Tier {tier} is gilded: x{mult} favor',
  altarFavour: 'x{mult} favor and a blessing',
  altarTierFavour: 'Tier {tier} is a sky altar: x{mult} favor',
  cursedWith: 'Cursed with {curse}: x{mult} favor',
  spendFavour: 'Spend favor (you have {n})',
  takeCurse: 'Take a curse on tier {tier}: {curse}, {text}. Earn x{mult} favor.',
  fallenSky: 'Your crowned shrine climbed the sky\nto {tiers} tiers, for {favour} favor.',
  crownedText: 'All {tiers} tiers stand,\n{balanced} of them balanced, for {favour} favor.\n\nKeep building into the windy sky?',
  fallenStood: {
    one: 'Your shrine stood {n} tier tall,\n{balanced} of them balanced, for {favour} favor.',
    other: 'Your shrine stood {n} tiers tall,\n{balanced} of them balanced, for {favour} favor.',
  },
};

export default enUS;
