// Every card in the game. A card costs energy and does some of: damage to the foe in front (or to
// every foe), a number of times; block; drawing cards; energy; healing; and statuses on the foe in
// front (or on every foe). Each card can be tempered once at a campfire, which makes it better:
// its id gets a '+' and its `up` fields replace the plain ones. Names and rules are shown in the
// hub's language through `t` (`cardName`, `describe`).
import { t, type TextKey } from '../i18n';

export type Icon =
  | 'sword'
  | 'shield'
  | 'axe'
  | 'twin'
  | 'boot'
  | 'bolt'
  | 'heart'
  | 'hammer'
  | 'whirl'
  | 'fire'
  | 'fang'
  | 'shieldBash'
  | 'cut'
  | 'crack'
  | 'dart'
  | 'cloud'
  | 'horn'
  | 'knife'
  | 'rage'
  | 'thorns'
  | 'veil'
  | 'bulwark'
  | 'skull'
  | 'rust'
  | 'doubt'
  | 'eye'
  | 'fireTonic'
  | 'ironTonic'
  | 'venomTonic'
  | 'mortar';

/** A power that stays in play for the rest of the fight. */
export type PowerKind = 'rage' | 'thorns' | 'splash' | 'bulwark' | 'hex';
/** A curse: an unplayable card that clogs the hand (Rust), hurts when drawn (Wound) or makes the first card of a turn dearer (Doubt). */
export type CurseKind = 'rust' | 'wound' | 'doubt';

/** What a card does; `up` is what tempering changes. */
interface Effects {
  cost: number;
  damage?: number;
  /** Extra damage per hit to a hexed foe: one with any status on it (the Hexer's cards). */
  hexed?: number;
  /** How many times the damage is dealt; 1 if not given. */
  hits?: number;
  /** Damage and statuses go to every foe instead of only the one in front. */
  all?: boolean;
  block?: number;
  draw?: number;
  energy?: number;
  heal?: number;
  /** Statuses put on the foe in front (or every foe, with `all`). */
  weak?: number;
  vulnerable?: number;
  poison?: number;
  /** A power card: played, it stays in play and does this for the rest of the fight. */
  power?: PowerKind;
  /** A curse card: it can't be played; `curse` says what it does instead. */
  curse?: CurseKind;
  /** Puts a copy of this card (a tonic, a key of `CARDS`) into the hand for this fight (the Alchemist's cards). */
  brew?: string;
}

export interface Card extends Effects {
  /** Its name, a key of `i18n/en.ts`; `cardName` shows it. */
  name: TextKey;
  icon: Icon;
  /** Common cards are offered after a fight; rare ones in treasure rooms and by elites. Starter and curse cards neither. */
  rarity: 'starter' | 'common' | 'rare' | 'curse';
  /** A card only this hero finds, in rewards and at the merchant; no one else's pools hold it. */
  hero?: 'hexer' | 'alchemist';
  /** A tonic: two of it in hand combine into this stronger one (a key of `CARDS`). */
  tonic?: string;
  /** The fields a tempered copy changes. */
  up: Partial<Effects>;
}

export const CARDS = {
  strike: { name: 'strikeCard', cost: 1, icon: 'sword', rarity: 'starter', damage: 6, up: { damage: 9 } },
  defend: { name: 'defendCard', cost: 1, icon: 'shield', rarity: 'starter', block: 5, up: { block: 8 } },
  bash: { name: 'bashCard', cost: 2, icon: 'hammer', rarity: 'starter', damage: 10, up: { damage: 14 } },
  cleave: { name: 'cleaveCard', cost: 1, icon: 'axe', rarity: 'common', damage: 7, all: true, up: { damage: 10 } },
  twinStrike: { name: 'twinStrikeCard', cost: 1, icon: 'twin', rarity: 'common', damage: 4, hits: 2, up: { damage: 6 } },
  ironWall: { name: 'ironWallCard', cost: 2, icon: 'shield', rarity: 'common', block: 13, up: { block: 18 } },
  scout: { name: 'scoutCard', cost: 0, icon: 'boot', rarity: 'common', draw: 2, up: { draw: 3 } },
  shieldBash: { name: 'shieldBashCard', cost: 1, icon: 'shieldBash', rarity: 'common', damage: 5, block: 5, up: { damage: 7, block: 7 } },
  heavyBlow: { name: 'heavyBlowCard', cost: 2, icon: 'hammer', rarity: 'common', damage: 16, up: { damage: 22 } },
  bandage: { name: 'bandageCard', cost: 1, icon: 'heart', rarity: 'common', heal: 4, draw: 1, up: { heal: 7 } },
  secondWind: { name: 'secondWindCard', cost: 0, icon: 'bolt', rarity: 'common', energy: 1, draw: 1, up: { energy: 2 } },
  hamstring: { name: 'hamstringCard', cost: 1, icon: 'cut', rarity: 'common', damage: 5, weak: 2, up: { damage: 7, weak: 3 } },
  sunder: { name: 'sunderCard', cost: 1, icon: 'crack', rarity: 'common', damage: 4, vulnerable: 2, up: { damage: 6, vulnerable: 3 } },
  poisonDart: { name: 'poisonDartCard', cost: 1, icon: 'dart', rarity: 'common', damage: 3, poison: 4, up: { poison: 6 } },
  whirlwind: { name: 'whirlwindCard', cost: 2, icon: 'whirl', rarity: 'rare', damage: 6, hits: 2, all: true, up: { damage: 8 } },
  fireball: { name: 'fireballCard', cost: 2, icon: 'fire', rarity: 'rare', damage: 15, all: true, up: { damage: 20 } },
  vampBite: { name: 'vampBiteCard', cost: 2, icon: 'fang', rarity: 'rare', damage: 12, heal: 6, up: { damage: 15, heal: 8 } },
  fortress: { name: 'fortressCard', cost: 1, icon: 'shield', rarity: 'rare', block: 12, draw: 1, up: { cost: 0 } },
  toxicCloud: { name: 'toxicCloudCard', cost: 2, icon: 'cloud', rarity: 'rare', poison: 5, all: true, up: { poison: 8 } },
  warCry: { name: 'warCryCard', cost: 1, icon: 'horn', rarity: 'rare', weak: 2, vulnerable: 2, all: true, up: { cost: 0 } },
  // The Hunter's starters.
  venomKnife: { name: 'venomKnifeCard', cost: 1, icon: 'knife', rarity: 'starter', damage: 4, poison: 2, up: { damage: 6, poison: 3 } },
  dodge: { name: 'dodgeCard', cost: 1, icon: 'boot', rarity: 'starter', block: 4, draw: 1, up: { block: 6 } },
  // Powers: played once, they stay in play for the rest of the fight.
  bulwark: { name: 'bulwarkCard', cost: 1, icon: 'bulwark', rarity: 'common', power: 'bulwark', up: { cost: 0 } },
  thorns: { name: 'thornsCard', cost: 1, icon: 'thorns', rarity: 'common', power: 'thorns', up: { cost: 0 } },
  battleRage: { name: 'battleRageCard', cost: 1, icon: 'rage', rarity: 'rare', power: 'rage', up: { cost: 0 } },
  venomVeil: { name: 'venomVeilCard', cost: 1, icon: 'veil', rarity: 'rare', power: 'splash', up: { cost: 0 } },
  // Curses: they can't be played, and only leave the deck when burnt or removed.
  rust: { name: 'rustCard', cost: 0, icon: 'rust', rarity: 'curse', curse: 'rust', up: {} },
  wound: { name: 'woundCard', cost: 0, icon: 'skull', rarity: 'curse', curse: 'wound', up: {} },
  doubt: { name: 'doubtCard', cost: 0, icon: 'doubt', rarity: 'curse', curse: 'doubt', up: {} },
  // The Hexer's starters and the cards only the Hexer finds.
  hexBolt: { name: 'hexBoltCard', cost: 1, icon: 'eye', rarity: 'starter', damage: 4, hexed: 4, up: { damage: 6, hexed: 5 } },
  evilEye: { name: 'evilEyeCard', cost: 0, icon: 'eye', rarity: 'starter', weak: 1, vulnerable: 1, up: { weak: 2, vulnerable: 2 } },
  soulDrain: { name: 'soulDrainCard', cost: 1, icon: 'fang', rarity: 'common', hero: 'hexer', damage: 4, hexed: 3, heal: 3, up: { damage: 6, heal: 4 } },
  hexWard: { name: 'hexWardCard', cost: 1, icon: 'veil', rarity: 'common', hero: 'hexer', block: 7, weak: 1, up: { block: 10 } },
  blight: { name: 'blightCard', cost: 1, icon: 'cloud', rarity: 'common', hero: 'hexer', poison: 3, vulnerable: 1, up: { poison: 5, vulnerable: 2 } },
  hexStorm: { name: 'hexStormCard', cost: 2, icon: 'whirl', rarity: 'rare', hero: 'hexer', damage: 5, hexed: 5, all: true, up: { damage: 7, hexed: 7 } },
  malediction: { name: 'maledictionCard', cost: 1, icon: 'eye', rarity: 'rare', hero: 'hexer', power: 'hex', up: { cost: 0 } },
  // The Alchemist's tonics: two of the same in hand combine at once into a strong one (`tonic`),
  // which costs the same as one. The strong ones are only ever made in hand, never in a deck.
  fireTonic: { name: 'fireTonicCard', cost: 1, icon: 'fireTonic', rarity: 'starter', damage: 4, all: true, tonic: 'strongFireTonic', up: { damage: 6 } },
  ironTonic: { name: 'ironTonicCard', cost: 1, icon: 'ironTonic', rarity: 'starter', block: 5, tonic: 'strongIronTonic', up: { block: 7 } },
  venomTonic: { name: 'venomTonicCard', cost: 1, icon: 'venomTonic', rarity: 'common', hero: 'alchemist', poison: 3, all: true, tonic: 'strongVenomTonic', up: { poison: 4 } },
  strongFireTonic: { name: 'strongFireTonicCard', cost: 1, icon: 'fireTonic', rarity: 'starter', damage: 11, all: true, up: { damage: 14 } },
  strongIronTonic: { name: 'strongIronTonicCard', cost: 1, icon: 'ironTonic', rarity: 'starter', block: 13, up: { block: 17 } },
  strongVenomTonic: { name: 'strongVenomTonicCard', cost: 1, icon: 'venomTonic', rarity: 'starter', poison: 8, all: true, up: { poison: 10 } },
  // The cards only the Alchemist finds: they brew a tonic into the hand.
  grind: { name: 'grindCard', cost: 1, icon: 'mortar', rarity: 'common', hero: 'alchemist', damage: 5, brew: 'fireTonic', up: { damage: 8 } },
  distil: { name: 'distilCard', cost: 1, icon: 'mortar', rarity: 'common', hero: 'alchemist', block: 5, brew: 'ironTonic', up: { block: 8 } },
  transmute: { name: 'transmuteCard', cost: 1, icon: 'fireTonic', rarity: 'rare', hero: 'alchemist', brew: 'strongFireTonic', draw: 1, up: { cost: 0 } },
} satisfies Record<string, Card>;

/** What each power does every turn (Bulwark, Battle Rage) or whenever it applies (Thorns, Venom Veil). */
export const POWER_BLOCK = 3;
export const POWER_STRENGTH = 1;
export const THORNS = 3;
/** The Weak Malediction puts on every foe at the start of each turn. */
export const HEX_WEAK = 1;
/** What a Wound costs when drawn (it never kills), and how much dearer Doubt makes the first card of a turn. */
export const WOUND_HURT = 2;
export const DOUBT_COST = 1;

/** Each power's rules, after the "Power." lead-in. */
const POWER_TEXT: Record<PowerKind, () => string> = {
  bulwark: () => t('bulwarkPower', { n: POWER_BLOCK }),
  thorns: () => t('thornsPower', { n: THORNS }),
  rage: () => t('ragePower', { n: POWER_STRENGTH }),
  splash: () => t('splashPower'),
  hex: () => t('hexPower', { n: HEX_WEAK }),
};

/** Each curse's rules, after the "Curse. Unplayable." lead-in. */
const CURSE_TEXT: Record<CurseKind, () => string> = {
  rust: () => t('rustCurse'),
  wound: () => t('woundCurse', { n: WOUND_HURT }),
  doubt: () => t('doubtCurse', { n: DOUBT_COST }),
};

export type BaseId = keyof typeof CARDS;
/** A card in a deck: its base id, with a '+' once tempered. */
export type CardId = BaseId | `${BaseId}+`;

export const isTempered = (id: CardId) => id.endsWith('+');
export const baseOf = (id: CardId) => (isTempered(id) ? id.slice(0, -1) : id) as BaseId;
export const tempered = (id: CardId): CardId => (isTempered(id) ? id : `${baseOf(id)}+`);

/** The card's rules; a tempered copy has its `up` fields applied. */
export const card = (id: CardId): Card => {
  const base: Card = CARDS[baseOf(id)];
  return isTempered(id) ? { ...base, ...base.up } : base;
};

/** The card's name in the hub's language, with a '+' once tempered. */
export const cardName = (id: CardId) => t(card(id).name) + (isTempered(id) ? '+' : '');

/** The Knight's starting deck of ten. */
export const STARTER_DECK: CardId[] = ['strike', 'strike', 'strike', 'strike', 'strike', 'defend', 'defend', 'defend', 'defend', 'bash'];
/** The Hunter's starting deck of ten: fewer shields, poison knives and dodges. */
export const HUNTER_DECK: CardId[] = ['strike', 'strike', 'strike', 'venomKnife', 'venomKnife', 'venomKnife', 'dodge', 'dodge', 'dodge', 'defend'];

/** The Hexer's starting deck of ten: hex bolts that hit harder on a foe with a status, and an Evil Eye to put one on. */
export const HEXER_DECK: CardId[] = ['strike', 'strike', 'strike', 'defend', 'defend', 'defend', 'hexBolt', 'hexBolt', 'hexBolt', 'evilEye'];

/** The Alchemist's starting deck of ten: two Fire Tonics and two Iron Tonics, which combine when two meet in hand. */
export const ALCHEMIST_DECK: CardId[] = ['strike', 'strike', 'strike', 'defend', 'defend', 'defend', 'fireTonic', 'fireTonic', 'ironTonic', 'ironTonic'];

/** The reward pools every hero shares (curses and the heroes' own cards are in neither). */
export const COMMON = (Object.keys(CARDS) as BaseId[]).filter((id) => card(id).rarity === 'common' && !card(id).hero);
export const RARE = (Object.keys(CARDS) as BaseId[]).filter((id) => card(id).rarity === 'rare' && !card(id).hero);

/** A hero's reward pool: the shared one, plus the cards only that hero finds. */
export const poolFor = (hero: string, rarity: 'common' | 'rare'): BaseId[] => [
  ...(rarity === 'common' ? COMMON : RARE),
  ...(Object.keys(CARDS) as BaseId[]).filter((id) => card(id).rarity === rarity && card(id).hero === hero),
];

/** A power's rules, without the "Power." lead-in its card face carries; for the tip of a power in play. */
export const describePower = (id: CardId) => {
  const power = card(id).power;
  return power ? POWER_TEXT[power]() : '';
};

/** The card's rules as a line of text for its face, in the hub's language. */
export function describe(id: CardId) {
  const c = card(id);
  if (c.power) return `${t('powerLead')} ${POWER_TEXT[c.power]()}`;
  if (c.curse) return `${t('curseLead')} ${CURSE_TEXT[c.curse]()}`;
  const parts: string[] = [];
  if (c.damage && c.hexed) parts.push(t(c.all ? 'dealHexedAll' : 'dealHexed', { damage: c.damage, n: c.hexed }));
  else if (c.damage) parts.push(t(c.hits ? (c.all ? 'dealHitsAll' : 'dealHits') : c.all ? 'dealAll' : 'deal', { damage: c.damage, hits: c.hits ?? 1 }));
  const statuses = (['weak', 'vulnerable', 'poison'] as const).filter((k) => c[k]).map((k) => `${c[k]} ${t(k)}`);
  if (statuses.length) {
    const list = statuses.reduce((a, b) => t('and', { a, b }));
    parts.push(t(c.all && !c.damage ? 'applyAll' : 'apply', { statuses: list }));
  }
  if (c.block) parts.push(t('gainBlock', { n: c.block }));
  if (c.heal) parts.push(t('heal', { n: c.heal }));
  if (c.energy) parts.push(t('gainEnergy', { n: c.energy }));
  if (c.brew) parts.push(t('brew', { name: cardName(c.brew as BaseId) }));
  if (c.draw) parts.push(t('draw', { n: c.draw }));
  if (c.tonic) parts.push(t('tonicRider'));
  return parts.join(' ');
}

export type CardKind = 'attack' | 'skill' | 'power' | 'curse';

/** What kind of card it is, for the colour of its frame. */
export const kindOf = (id: CardId): CardKind => {
  const c = card(id);
  return c.curse ? 'curse' : c.power ? 'power' : c.damage ? 'attack' : 'skill';
};
export const isCurse = (id: CardId) => !!card(id).curse;
/** Whether tempering would change the card: not tempered yet, and not a curse (a tempered curse is the same curse). */
export const canBeTempered = (id: CardId) => !isTempered(id) && !isCurse(id);
/** What two of this tonic make when they meet in hand (tempered if either was), or null for a card that isn't a tonic. */
export const tonicOf = (a: CardId, b: CardId): CardId | null => {
  const into = card(a).tonic as BaseId | undefined;
  if (!into || baseOf(a) !== baseOf(b)) return null;
  return isTempered(a) || isTempered(b) ? tempered(into) : into;
};
