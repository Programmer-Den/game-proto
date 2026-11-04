import type { Translation } from '../../../../shared/i18n';
import type en from './en';

/** Space Wars' texts whose US English spelling differs from the British source in `en.ts`. */
const enUS: Partial<Translation<typeof en>> = {
  skirmishTeamsText: 'Teams: you and the top-left start against the two starts on the right, with the center on its own. Allies share their sight.',
};

export default enUS;
