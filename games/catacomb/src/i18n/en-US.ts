import type { Translation } from '../../../../shared/i18n';
import type en from './en';

/** Catacomb's texts whose US English spelling differs from the British source in `en.ts`. */
const enUS: Partial<Translation<typeof en>> = {
  distilCard: 'Distill',
};

export default enUS;
