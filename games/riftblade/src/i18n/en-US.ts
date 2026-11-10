import type { Translation } from '../../../../shared/i18n';
import type en from './en';

/** Riftblade's texts whose US English spelling differs from the British source in `en.ts`. */
const enUS: Partial<Translation<typeof en>> = {
  armourName: 'Plate Armor',
  vharnBlurb: 'Throws his blade, which flies out and back. Very tough and armored, but slow.',
  lifeSupportBlurb: 'Armor plates that regrow; rage when nearly down.',
  breakerBlurb: 'Hits strip armor: elites and bosses take more damage.',
  armouryButton: 'Armory  ·  {n} credits',
  armouryTitle: 'ARMORY',
  banked: '+{n} credits banked for the Armory',
  dailySubtitle: '{day}: three worlds, the same mutator and worlds for everyone today, and a hero drawn from those you have open. One try a day, at heat 0, without the Armory.',
  codexSubtitle: 'Every foe, boss and card you meet fills a page. A full page pays credits into the Armory\'s bank, once.',
  masteryColours: 'Mastery colors',
  usualColours: 'Usual colors',
  masteryColour: 'mastery colors to wear',
  rushRules: 'No heat, Armory or mastery: the same kit for every try. Fewest seconds wins.',
  branchKind: 'SPECIALIZATION',
  branchBlurb: 'Tiers 6 and 7 of {name}. Only one specialization per skill.',
  branchPop: 'Specialized: {name}',
  hollowRebirthText: 'Armored and slow: +60 health, -30% damage taken, double slash damage',
};

export default enUS;
