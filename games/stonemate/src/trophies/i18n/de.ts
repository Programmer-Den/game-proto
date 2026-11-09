import type { Translation } from '../../../../../shared/i18n';
import type en from './en';

/** Stonemate's trophy texts in German. */
const de: Translation<typeof en> = {
  firstCapture: 'Erster Schlag',
  firstCaptureText: 'Zerbrich eine Statue deines Gegenübers.',
  promotion: 'Neu gemeißelt',
  promotionText: 'Bring einen Bauern auf die letzte Reihe und wandle ihn um.',
  joust: 'Tjost',
  joustText: 'Schlage einen Springer mit einem Springer.',
  firstWin: 'Eiskalt wie Stein',
  firstWinText: 'Setze die Stein-KI schachmatt.',
  upset: 'Überraschung!',
  upsetText: 'Schlage eine Dame mit einem Bauern.',
  quickMate: 'Flinker Steinmetz',
  quickMateText: 'Setze die Stein-KI in höchstens 25 eigenen Zügen matt.',
  allScenes: 'Alle Sonderszenen',
  allScenesText: 'Sieh alle 8 Sonderschläge in deinen Partien.',
  hardWin: 'Meistersteinmetz',
  hardWinText: 'Setze die Stein-KI als Vereinsspieler oder stärker matt.',
  grandmasterWin: 'Großmeister aus Stein',
  grandmasterWinText: 'Setze die Stein-KI als Großmeister matt.',
  allPairs: 'Der ganze Steinbruch',
  allPairsText: 'Sieh alle 30 Schlagpaare in deinen Partien.',
};

export default de;
