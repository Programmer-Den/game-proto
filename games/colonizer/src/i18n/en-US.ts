import type { Translation } from '../../../../shared/i18n';
import type en from './en';

/** Colonizer's texts whose US English spelling differs from the British source in `en.ts`. */
const enUS: Partial<Translation<typeof en>> = {
  town: 'Town Center',
  valorName: 'Relic of Valor',
  menuIntro: 'Pick your faction. Gather, build, earn the ages and destroy the enemy Town Center.',
  rivalsOne: 'One AI, one Town Center to bring down',
  rivalsTwo: 'Two AIs: everyone raids everyone, the last Town Center standing wins',
  researchAge3: 'Research Age III at the Town Center',
  townFallen: 'Your Town Center has fallen',
  endBothFallen: 'Both rival Town Centers have fallen',
  endFoeFallen: 'The enemy Town Center has fallen',
  watchBothFallen: "Both rivals' Town Centers have fallen",
  watchFallen: 'The {faction} Town Center has fallen',
  researchAge4: 'Research Age IV at the Town Center',
  scnWatchGoal: 'Hold out for 12 minutes, Town Center standing',
  scnValour: 'The Relic of Valor',
  scnValourGoal: 'Hold the Relic of Valor for 4 minutes in a row',
  scnStandingGoal: 'Be the last Town Center standing against two rivals',
};

export default enUS;
