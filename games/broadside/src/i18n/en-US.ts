import type { Translation } from '../../../../shared/i18n';
import type en from './en';

/** Broadside's texts whose US English spelling differs from the British source in `en.ts`. */
const enUS: Partial<Translation<typeof en>> = {
  harborTitle: 'Harbor: wave {wave} beaten',
  reachesHarborTitle: 'Harbor: Reaches wave {wave} beaten',
  keepNone: 'Bring a prize to harbor to keep her: she sails on with you for a wage',
  keepShip: 'Keep the {ship}: she sails on with you, {wage} gold wage a harbor',
};

export default enUS;
