import type { Translation } from '../../../../shared/i18n';
import type en from './en';

/** Lane Brawl's texts whose US English spelling differs from the British source in `en.ts`. */
const enUS: Partial<Translation<typeof en>> = {
  itemCloth: 'Cloth Armor',
  statArmour: '+{n} armor',
  pickSkinLine: 'Colors: {skin}',
  pickSkinTitle: 'Colors: {skin}, {n} of {of} won',
  pickSkinDesc: 'Each ranked tier you reach wins your champion its color. Click to change.',
  ladderSkin: '{line} New colors: {skin}.',
  talentRowDefence: 'Defense',
  talentThickHideDesc: '+6 armor',
};

export default enUS;
