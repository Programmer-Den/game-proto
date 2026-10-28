import type { Translation } from '../../../../../shared/i18n';
import type en from './en';

/** Augury's trophy texts in German. */
const de: Translation<typeof en> = {
  firstSight: 'Erster Blick',
  firstSightText: 'Löse dein erstes Rätsel.',
  omen: 'Das Schicksal herausfordern',
  omenText: 'Löse ein Rätsel unter einem Omen.',
  charm: 'Glücksbringer',
  charmText: 'Nimm in einem Lauf einen Talisman.',
  fullDeck: 'Das ganze Deck',
  fullDeckText: 'Löse jede Rätselart mindestens einmal.',
  boss: 'Zwei in einem',
  bossText: 'Besiege ein Boss-Rätsel.',
  perfectDay: 'Perfekter Tag',
  perfectDayText: 'Löse alle fünf Rätsel einer Tagesfünf.',
  oracle: 'Orakel',
  oracleText: 'Löse ein Orakel-Rätsel ohne Tipp.',
  streak: 'Ungebrochen',
  streakText: 'Löse in einem Lauf zehn Rätsel am Stück.',
  charmed: 'Verzaubertes Leben',
  charmedText: 'Halte in einem Lauf fünf Talismane.',
  tempted: 'Allen Omen zum Trotz',
  temptedText: 'Besiege einen Boss unter einem Omen.',
};

export default de;
