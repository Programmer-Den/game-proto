import type { Translation } from '../../../../../shared/i18n';
import type en from './en';

/** Ninefold's trophy texts in German. */
const de: Translation<typeof en> = {
  firstSolve: 'Erstes Feld',
  firstSolveText: 'Löse dein erstes Rätsel, in irgendeinem Modus.',
  flawless: 'Weiße Weste',
  flawlessText: 'Löse ein Rätsel ohne Fehler.',
  fast: 'Flinker Stift',
  fastText: 'Löse ein 9×9 in unter 10 Minuten.',
  streak3: 'Drei in Folge',
  streak3Text: 'Löse das Tagesrätsel drei Tage hintereinander.',
  firstBoss: 'Bossbrecher',
  firstBossText: 'Schaffe eine Bossebene im Abstieg.',
  floor10: 'Tiefgräber',
  floor10Text: 'Schaffe Ebene 10 im Abstieg.',
  allStyles: 'Volle Palette',
  allStylesText: 'Schalte alle neun Stile frei.',
  streak7: 'Eine Woche Rätsel',
  streak7Text: 'Löse das Tagesrätsel sieben Tage hintereinander.',
  floor20: 'Grund des Brunnens',
  floor20Text: 'Schaffe Ebene 20 im Abstieg.',
};

export default de;
