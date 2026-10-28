import type { Translation } from '../../../../../shared/i18n';
import type en from './en';

/** Golem Garden's trophy texts in German. */
const de: Translation<typeof en> = {
  firstWave: 'Grüner Daumen',
  firstWaveText: 'Schaffe deine erste Welle.',
  combo: 'Gute Nachbarn',
  comboText: 'Lass einen Moosgolem neben einem Kiesel- oder Dorngolem wachsen.',
  form: 'Ausgewachsen',
  formText: 'Bringe einen Golem auf Stufe 3 und wähle seine Form.',
  boldCall: 'Mutiger Ruf',
  boldCallText: 'Rufe eine Welle früher und verliere kein Blatt, bis ihr letzter Schädling weg ist.',
  bloom: 'In voller Blüte',
  bloomText: 'Öffne alle fünf Knospen am Herzholz.',
  queen: 'Königinnenquetscher',
  queenText: 'Zerquetsche eine Schneckenkönigin.',
  harvest: 'Erste Ernte',
  harvestText: 'Erreiche in einem Garten die Ernte bei Welle 30.',
  perfectHarvest: 'Perfekte Ernte',
  perfectHarvestText: 'Ernte einen Garten mit allen zehn Blättern am Herzholz.',
  allGardens: 'Jeder Garten',
  allGardensText: 'Ernte alle drei Gärten.',
  laurel: 'Dornenlorbeer',
  laurelText: 'Ernte einen dornigen Garten.',
};

export default de;
