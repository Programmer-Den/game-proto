import type { Translation } from '../../../../../shared/i18n';
import type en from './en';

/** Shrine Stack's trophy texts whose US English spelling differs from the British source in `en.ts`. */
const enUS: Partial<Translation<typeof en>> = {
  cursedText: 'Finish a tier under a curse you took for double favor.',
};

export default enUS;
