import type { Translation } from '../../../../shared/i18n';
import type en from './en';

/** Mapmaker's texts whose US English spelling differs from the British source in `en.ts`. */
const enUS: Partial<Translation<typeof en>> = {
  harbourName: 'Harbor',
  caveFound: 'Cave: an artifact ({n}c)',
  artefactsRow: 'Artifacts from caves   {n} × {each}',
  harbourTitle: 'The harbor',
  noHands: 'No hands at the harbor',
  backToHarbour: 'Back to the harbor',
};

export default enUS;
