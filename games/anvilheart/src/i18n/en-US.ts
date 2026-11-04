import type { Translation } from '../../../../shared/i18n';
import type en from './en';

/** Anvilheart's texts whose US English spelling differs from the British source in `en.ts`. */
const enUS: Partial<Translation<typeof en>> = {
  armouryName: 'Armory',
  jewellerName: 'Jeweler',
};

export default enUS;
