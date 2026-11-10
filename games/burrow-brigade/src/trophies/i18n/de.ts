import type { Translation } from '../../../../../shared/i18n';
import type en from './en';

/** Burrow Brigade's trophy texts in German. */
const de: Translation<typeof en> = {
  firstHit: 'Erste Delle',
  firstHitText: 'Verletze einen gegnerischen Maulwurf.',
  crate: 'Eilzustellung',
  crateText: 'Sammle eine Kiste ein.',
  splash: 'Platsch',
  splashText: 'Stoße einen gegnerischen Maulwurf ins Wasser.',
  firstWin: 'König des Maulwurfshügels',
  firstWinText: 'Gewinne eine Partie gegen die Bau-KI.',
  triple: 'Drei auf einen Streich',
  tripleText: 'Verletze drei gegnerische Maulwürfe in einer Runde.',
  longShot: 'Über alle Hügel',
  longShotText: 'Triff einen gegnerischen Maulwurf mit einer Rakete aus mehr als 500 Schritt.',
  arsenal: 'Gut gerüstet',
  arsenalText: 'Setze 15 verschiedene Waffen ein.',
  flawless: 'Kein Kratzer verloren',
  flawlessText: 'Besiege die Bau-KI, ohne einen Maulwurf zu verlieren.',
  hardWin: 'Brigadegeneral',
  hardWinText: 'Besiege die Bau-KI auf Schwer.',
  allWeapons: 'Die ganze Waffenkammer',
  allWeaponsText: 'Setze jede der 26 Waffen ein.',
};

export default de;
