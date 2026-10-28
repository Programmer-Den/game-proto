import type { Translation } from '../../../../../shared/i18n';
import type en from './en';

/** Mapmaker's trophy texts whose US English spelling differs from the British source in `en.ts`. */
const enUS: Partial<Translation<typeof en>> = {
  firstArtefactText: 'Find an artifact in a cave.',
};

export default enUS;
