import type { Translation } from '../../../../../shared/i18n';
import type en from './en';

/** Scrapyard Titans' trophy texts in German. */
const de: Translation<typeof en> = {
  firstWin: 'Erster Funke',
  firstWinText: 'Gewinne einen Kampf.',
  topFour: 'Fast ganz oben',
  topFourText: 'Beende eine Partie unter den ersten vier.',
  threeStar: 'Vergoldet',
  threeStarText: 'Bringe einen Roboter auf drei Sterne.',
  rareCard: 'Glücksgriff',
  rareCardText: 'Wähle eine seltene Machtkarte.',
  fullOrigin: 'Komplettes Set',
  fullOriginText: 'Gewinne einen Kampf mit sechs Robotern einer Herkunft auf dem Brett.',
  maxLevel: 'Gipfel des Schrotthaufens',
  maxLevelText: 'Erreiche Stufe 9.',
  champion: 'Als Letzter übrig',
  championText: 'Gewinne eine Partie.',
  allCommanders: 'Volle Riege',
  allCommandersText: 'Schalte alle acht Kommandanten frei.',
  titanRank: 'Titan',
  titanRankText: 'Erreiche den Rang Titan.',
  weeklyWin: 'Sieger der Woche',
  weeklyWinText: 'Gewinne eine Partie in der Wochensaison.',
};

/** Texts that are the same in German. */
export const keepEnglish: (keyof typeof en)[] = ['titanRank'];

export default de;
