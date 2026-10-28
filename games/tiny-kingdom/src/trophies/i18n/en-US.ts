import type { Translation } from '../../../../../shared/i18n';
import type en from './en';

/** Tiny Kingdom's trophy texts whose US English spelling differs from the British source in `en.ts`. */
const enUS: Partial<Translation<typeof en>> = {
  firstCrownText: 'Fulfill a royal decree and win a crown.',
  allGifts: 'Royal favor',
};

export default enUS;
