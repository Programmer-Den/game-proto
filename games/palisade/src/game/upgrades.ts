// Every level-up offers three of these. Most have several ranks; follow-ups only show up once the
// upgrade they improve has been picked. Adding an upgrade is an entry here plus its effect in
// `stats` (state.ts). Names and texts are keys of `i18n/en.ts`, shown with `t`.

import type { TextKey } from '../i18n';
import type { HeroClass } from './hero';

export type UpgradeId =
  | 'swift'
  | 'sharp'
  | 'volley'
  | 'pierce'
  | 'crit'
  | 'fire'
  | 'wildfire'
  | 'frost'
  | 'deepFreeze'
  | 'shatter'
  | 'blast'
  | 'bigBlast'
  | 'fireball'
  | 'pyromancy'
  | 'storm'
  | 'forked'
  | 'timber'
  | 'lore'
  | 'finisher'
  | 'slayer'
  | 'cloudburst'
  | 'barbs'
  | 'stakes'
  | 'bounty'
  | 'drill'
  | 'mend'
  | 'purse'
  | 'wind'
  | 'focus'
  | 'potency'
  | 'twin'
  | 'chain'
  | 'nova'
  | 'frostbolt'
  | 'glacier'
  | 'ember'
  | 'inferno'
  | 'orb'
  | 'orbMastery'
  | 'tempest'
  | 'arc'
  | 'hex';

export type Icon =
  | 'bow'
  | 'tip'
  | 'volley'
  | 'pierce'
  | 'eye'
  | 'fire'
  | 'frost'
  | 'blast'
  | 'fireball'
  | 'storm'
  | 'barricade'
  | 'book'
  | 'shatter'
  | 'finisher'
  | 'slayer'
  | 'cloudburst'
  | 'barbs'
  | 'stakes'
  | 'bounty'
  | 'drill'
  | 'mend'
  | 'purse'
  | 'wind'
  | 'staff'
  | 'rune'
  | 'twin'
  | 'chain'
  | 'nova'
  | 'hex';

export interface Upgrade {
  name: TextKey;
  /** What one more rank does. */
  text: TextKey;
  maxRank: number;
  icon: Icon;
  /** Only offered once this upgrade has a rank. */
  requires?: UpgradeId;
  /** Only offered when fewer than three others are left, to fill the empty cards (see `FILLERS`). */
  filler?: boolean;
  /** Only this class learns it (see hero.ts); with none, both do. */
  hero?: HeroClass;
}

export const UPGRADES: Record<UpgradeId, Upgrade> = {
  swift: { name: 'swiftName', text: 'swiftText', maxRank: 5, icon: 'bow', hero: 'ranger' },
  sharp: { name: 'sharpName', text: 'sharpText', maxRank: 5, icon: 'tip', hero: 'ranger' },
  volley: { name: 'volleyName', text: 'volleyText', maxRank: 3, icon: 'volley', hero: 'ranger' },
  pierce: { name: 'pierceName', text: 'pierceText', maxRank: 3, icon: 'pierce', hero: 'ranger' },
  crit: { name: 'critName', text: 'critText', maxRank: 3, icon: 'eye', hero: 'ranger' },
  fire: { name: 'fireName', text: 'fireText', maxRank: 1, icon: 'fire', hero: 'ranger' },
  wildfire: { name: 'wildfireName', text: 'wildfireText', maxRank: 3, icon: 'fire', requires: 'fire', hero: 'ranger' },
  frost: { name: 'frostName', text: 'frostText', maxRank: 1, icon: 'frost', hero: 'ranger' },
  deepFreeze: { name: 'deepFreezeName', text: 'deepFreezeText', maxRank: 3, icon: 'frost', requires: 'frost', hero: 'ranger' },
  shatter: { name: 'shatterName', text: 'shatterText', maxRank: 3, icon: 'shatter', requires: 'frost', hero: 'ranger' },
  blast: { name: 'blastName', text: 'blastText', maxRank: 1, icon: 'blast', hero: 'ranger' },
  bigBlast: { name: 'bigBlastName', text: 'bigBlastText', maxRank: 3, icon: 'blast', requires: 'blast', hero: 'ranger' },
  fireball: { name: 'fireballName', text: 'fireballText', maxRank: 1, icon: 'fireball', hero: 'ranger' },
  pyromancy: { name: 'pyromancyName', text: 'pyromancyText', maxRank: 3, icon: 'fireball', requires: 'fireball', hero: 'ranger' },
  storm: { name: 'stormName', text: 'stormText', maxRank: 1, icon: 'storm', hero: 'ranger' },
  forked: { name: 'forkedName', text: 'forkedText', maxRank: 3, icon: 'storm', requires: 'storm', hero: 'ranger' },
  timber: { name: 'timberName', text: 'timberText', maxRank: 5, icon: 'barricade' },
  lore: { name: 'loreName', text: 'loreText', maxRank: 3, icon: 'book' },
  finisher: { name: 'finisherName', text: 'finisherText', maxRank: 3, icon: 'finisher', hero: 'ranger' },
  slayer: { name: 'slayerName', text: 'slayerText', maxRank: 3, icon: 'slayer', hero: 'ranger' },
  cloudburst: { name: 'cloudburstName', text: 'cloudburstText', maxRank: 3, icon: 'cloudburst' },
  barbs: { name: 'barbsName', text: 'barbsText', maxRank: 3, icon: 'barbs' },
  stakes: { name: 'stakesName', text: 'stakesText', maxRank: 3, icon: 'stakes' },
  bounty: { name: 'bountyName', text: 'bountyText', maxRank: 3, icon: 'bounty' },
  drill: { name: 'drillName', text: 'drillText', maxRank: 3, icon: 'drill' },
  mend: { name: 'mendName', text: 'mendText', maxRank: Infinity, icon: 'mend', filler: true },
  purse: { name: 'purseName', text: 'purseText', maxRank: Infinity, icon: 'purse', filler: true },
  wind: { name: 'windName', text: 'windText', maxRank: Infinity, icon: 'wind', filler: true },
  // The mage's own skills, after every other so the ranger's random picks stay as they were.
  focus: { name: 'focusName', text: 'focusText', maxRank: 5, icon: 'staff', hero: 'mage' },
  potency: { name: 'potencyName', text: 'potencyText', maxRank: 5, icon: 'rune', hero: 'mage' },
  twin: { name: 'twinName', text: 'twinText', maxRank: 2, icon: 'twin', hero: 'mage' },
  chain: { name: 'chainName', text: 'chainText', maxRank: 3, icon: 'chain', hero: 'mage' },
  nova: { name: 'novaName', text: 'novaText', maxRank: 3, icon: 'nova', hero: 'mage' },
  frostbolt: { name: 'frostboltName', text: 'frostboltText', maxRank: 1, icon: 'frost', hero: 'mage' },
  glacier: { name: 'glacierName', text: 'glacierText', maxRank: 3, icon: 'frost', requires: 'frostbolt', hero: 'mage' },
  ember: { name: 'emberName', text: 'emberText', maxRank: 1, icon: 'fire', hero: 'mage' },
  inferno: { name: 'infernoName', text: 'infernoText', maxRank: 3, icon: 'fire', requires: 'ember', hero: 'mage' },
  orb: { name: 'orbName', text: 'orbText', maxRank: 1, icon: 'fireball', hero: 'mage' },
  orbMastery: { name: 'orbMasteryName', text: 'orbMasteryText', maxRank: 3, icon: 'fireball', requires: 'orb', hero: 'mage' },
  tempest: { name: 'tempestName', text: 'tempestText', maxRank: 1, icon: 'storm', hero: 'mage' },
  arc: { name: 'arcName', text: 'arcText', maxRank: 3, icon: 'storm', requires: 'tempest', hero: 'mage' },
  hex: { name: 'hexName', text: 'hexText', maxRank: 3, icon: 'hex', hero: 'mage' },
};

/** The fillers: Mend fills the one empty card with two upgrades left, War Chest and Second Wind the two with one left. */
export const FILLERS: UpgradeId[] = ['mend', 'purse', 'wind'];
/**
 * The base skills: once every other skill is learned, each level-up offers these three again, with
 * no cap on their ranks, so the hero keeps growing with the waves.
 */
export const BASE_SKILLS: UpgradeId[] = ['swift', 'sharp', 'timber'];
/** The mage's base skills, offered the same way once the mage has learned every skill. */
export const MAGE_BASE_SKILLS: UpgradeId[] = ['focus', 'potency', 'timber'];
/** A class's base skills. */
export const baseSkills = (hero: HeroClass = 'ranger') => (hero === 'mage' ? MAGE_BASE_SKILLS : BASE_SKILLS);
/** Whether a hero of this class learns this upgrade. */
export const learns = (id: UpgradeId, hero: HeroClass = 'ranger') => (UPGRADES[id].hero ?? hero) === hero;
/** Coins a War Chest gives. */
export const PURSE_COINS = 25;

export const UPGRADE_IDS = Object.keys(UPGRADES) as UpgradeId[];

/**
 * The skill book's order, one theme a row of four: the bow, harder hits, fire, chill and slow,
 * powder and lightning, the barricade and guards, then experience and the fillers. Only the book
 * reads it; `UPGRADE_IDS` keeps the table's order, which the level-up's random picks depend on.
 */
export const BOOK_ORDER: UpgradeId[] = [
  'swift', 'sharp', 'volley', 'pierce',
  'crit', 'finisher', 'slayer', 'cloudburst',
  'fire', 'wildfire', 'fireball', 'pyromancy',
  'frost', 'deepFreeze', 'shatter', 'barbs',
  'blast', 'bigBlast', 'storm', 'forked',
  'timber', 'stakes', 'drill', 'bounty',
  'lore', 'mend', 'purse', 'wind',
];

/**
 * The mage's skill book, laid out the same way: the staff, the bolt, fire, chill, the fire orb and
 * lightning, the barricade and guards, then experience and the fillers.
 */
export const MAGE_BOOK_ORDER: UpgradeId[] = [
  'focus', 'potency', 'twin', 'chain',
  'nova', 'hex', 'cloudburst', 'barbs',
  'ember', 'inferno', 'orb', 'orbMastery',
  'frostbolt', 'glacier', 'tempest', 'arc',
  'timber', 'stakes', 'drill', 'bounty',
  'lore', 'mend', 'purse', 'wind',
];

/** A class's skill book. */
export const bookOrder = (hero: HeroClass = 'ranger') => (hero === 'mage' ? MAGE_BOOK_ORDER : BOOK_ORDER);
