import type { Translation } from '../../../../shared/i18n';
import type en from './en';

/** Scrapyard Titans' texts whose US English spelling differs from the British source in `en.ts`. */
const enUS: Partial<Translation<typeof en>> = {
  heavyTraitText: 'Heavy robots gain {v} armor.',
  magnetTraitText: 'Enemies lose {v} armor.',
  guardianTraitText: 'All your robots gain {v} armor.',
  plateText: '+25 armor',
  steelText: 'Robots on it gain 25 armor.',
  sirSprocket3: 'A duel of honor!',
  rustRainText: 'armor cut by 40%',
  terrainLegend: 'Terrain: dark oil slows, green pad charges, gray plate armors, orange grate burns',
};

export default enUS;
