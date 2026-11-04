import type { Translation } from '../../../../shared/i18n';
import type en from './en';

/** Tiny Kingdom's texts whose US English spelling differs from the British source in `en.ts`: harbor for harbour. */
const enUS: Partial<Translation<typeof en>> = {
  harborName: 'Harbor',
  harborCount: { one: '{n} harbor', other: '{n} harbors' },
  harborGift: 'Harbor',
  harborDesc: 'A new tile: 2 harbors',
  harborsGift: '+2 Harbors',
  harborsDesc: '2 more harbors',
  springRule: 'Markets and harbors score double',
  springShort: 'markets, harbors x2',
  lighthouseRule: 'Coast only: +1 per sea side, +2 per harbor around it',
  bannerCargo: { one: "The last island's harbors shipped {n} tile", other: "The last island's harbors shipped {n} tiles" },
  bannerNoCargo: 'No cargo: harbors ship tiles to the next island',
  featHarbourLight: 'A lighthouse with 2 harbors around it',
  overTrade: { one: '{n} harbor traded with the islands behind: +{trade}.', other: '{n} harbors traded with the islands behind: +{trade}.' },
};

export default enUS;
