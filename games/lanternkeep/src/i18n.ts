import { translator } from '../../../shared/i18n';
import en from './i18n/en';
import de from './i18n/de';
import enUS from './i18n/en-US';

/**
 * Lanternkeep's texts in the hub's language (`shared/i18n.ts`); the sources are in `i18n/en.ts`.
 * US English spells only the harbour's texts differently (`i18n/en-US.ts`).
 */
export const t = translator({ en, 'en-US': enUS, de });

/** A key of Lanternkeep's texts. */
export type TextKey = keyof typeof en;
