import type { Translation } from '../../../../shared/i18n';
import type en from './en';

/** Only the texts spelled differently in US English. */
const enUS: Partial<Translation<typeof en>> = {
  d_seeker: 'After a moment in the air it turns toward the nearest enemy mole.',
};

export default enUS;
