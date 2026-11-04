import { translator } from '../../../shared/i18n';
import en from './i18n/en';
import enUS from './i18n/en-US';
import de from './i18n/de';

/** Scrapyard Titans' texts in the hub's language (`shared/i18n.ts`); the sources are in `i18n/en.ts`. */
export const t = translator({ en, 'en-US': enUS, de });

/** A key of Scrapyard Titans' texts. */
export type TextKey = keyof typeof en;

/** A place in the match as the language writes it: 1st, 2nd, 3rd, 4th in English. */
export const ordinal = (n: number) => t(n === 1 ? 'place1' : n === 2 ? 'place2' : n === 3 ? 'place3' : 'placeN', { n });

/** A robot's name: a workshop robot's own (`UnitDef.label`), or its text in the hub's language. */
export const unitName = (def: { name: TextKey; label?: string }) => def.label ?? t(def.name);
