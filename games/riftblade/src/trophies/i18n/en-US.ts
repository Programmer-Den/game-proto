import type { Translation } from '../../../../../shared/i18n';
import type en from './en';

/** Riftblade's trophy texts whose US English spelling differs from the British source in `en.ts`. */
const enUS: Partial<Translation<typeof en>> = {
  firstPieceText: 'Buy your first piece in the Armory.',
  armouryFullText: 'Buy every rank of every piece in the Armory.',
};

export default enUS;
