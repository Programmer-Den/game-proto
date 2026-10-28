import type { Translation } from '../../../../../shared/i18n';
import type en from './en';

/** Broadside's trophy texts spelled differently in US English. */
const enUS: Partial<Translation<typeof en>> = {
  convoy: 'Safe harbor',
  flagship: 'Strike the colors',
};

export default enUS;
