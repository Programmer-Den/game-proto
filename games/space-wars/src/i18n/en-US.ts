import type { Translation } from '../../../../shared/i18n';
import type en from './en';

/** Space Wars' texts whose US English spelling differs from the British source in `en.ts`. */
const enUS: Partial<Translation<typeof en>> = {
  skirmishTeamsText: 'Teams: you and the top-left start against the two starts on the right, with the center on its own. Allies share their sight.',
  activeScreen: 'Point-defense screen',
  groupsText: 'Shift and a number, or holding a chip, saves the selected ships as that group. The number or a tap on the chip selects them again; twice centers the map on them.',
  scenarioRelayBrief: 'Every rival wants the relay beacon in the center. Be the first to hold it for {s} seconds in all.',
};

export default enUS;
