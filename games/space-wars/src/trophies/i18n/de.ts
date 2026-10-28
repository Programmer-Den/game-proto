import type { Translation } from '../../../../../shared/i18n';
import type en from './en';

/** Space Wars' trophy texts in German. */
const de: Translation<typeof en> = {
  firstContract: 'Unter Vertrag',
  firstContractText: 'Erfülle deinen ersten Vertrag.',
  beacon: 'Signal gefunden',
  beaconText: 'Erobere das Relaisfeuer.',
  truce: 'Waffenruhe',
  truceText: 'Nimm von einem Rivalen einen Waffenstillstand an.',
  ace: 'Ass der Flotte',
  aceText: 'Lass eines deiner Schiffe zum Ass aufsteigen.',
  derelicts: 'Wrackbaron',
  derelictsText: 'Halte alle drei Wracks zugleich.',
  flagship: 'Stolz der Flotte',
  flagshipText: 'Lass dein Flaggschiff starten.',
  victory: 'Die letzte Fraktion',
  victoryText: 'Gewinne eine Schlacht.',
  outpaced: 'Allen voraus',
  outpacedText: 'Erfülle alle fünf Verträge, bevor ein Rivale seine Kette erfüllt.',
  campaign: 'Herr der Sektoren',
  campaignText: 'Gewinne den letzten Sektor der Kampagne.',
};

export default de;
