export type PlantId = 'wheat' | 'mandrake' | 'nightshade';
export type RefinedId = 'flour' | 'mandrakeSeeds' | 'nightshadeExtract';
export type PotionId = 'healingDraught' | 'sleepingTonic' | 'vigourTonic' | 'shadowElixir' | 'moonlightSalve' | 'witchsBrew';
/** A potion taken out of the cauldron in its fine window, worth more than the plain one. */
export type FineId =
  | 'fineHealingDraught'
  | 'fineSleepingTonic'
  | 'fineVigourTonic'
  | 'fineShadowElixir'
  | 'fineMoonlightSalve'
  | 'fineWitchsBrew';
/**
 * A plant picked in its bed's prime window (AP23), and the good it refines into: a potion brewed only
 * from Prime goods is always Fine. They ride in the doctor's hands only; at a station they count as
 * the plain plant or good (see `primeIn` and `primeOut` on the stations).
 */
export type PrimeId = 'primeWheat' | 'primeMandrake' | 'primeNightshade' | 'primeFlour' | 'primeMandrakeSeeds' | 'primeNightshadeExtract';
export type ItemId = PlantId | RefinedId | PotionId | FineId | PrimeId;
/** What can stand on the counter's shelf for sale: a potion, plain or fine. */
export type SellableId = PotionId | FineId;

/** An item's kind and colour; its name is the text keyed by its id (`itemName` in `i18n.ts`). */
export interface ItemDef {
  kind: 'plant' | 'refined' | 'potion' | 'fine' | 'prime';
  color: number;
}

export const ITEMS: Record<ItemId, ItemDef> = {
  wheat: { kind: 'plant', color: 0xd9b24a },
  mandrake: { kind: 'plant', color: 0xb07a4a },
  nightshade: { kind: 'plant', color: 0x4a3060 },
  flour: { kind: 'refined', color: 0xf1e8d0 },
  mandrakeSeeds: { kind: 'refined', color: 0x6b4426 },
  nightshadeExtract: { kind: 'refined', color: 0x5a3a78 },
  healingDraught: { kind: 'potion', color: 0xd9434b },
  sleepingTonic: { kind: 'potion', color: 0x6a5bd6 },
  vigourTonic: { kind: 'potion', color: 0xe0862e },
  shadowElixir: { kind: 'potion', color: 0x2f8a72 },
  moonlightSalve: { kind: 'potion', color: 0x6fa8d6 },
  witchsBrew: { kind: 'potion', color: 0x7a8f22 },
  fineHealingDraught: { kind: 'fine', color: 0xd9434b },
  fineSleepingTonic: { kind: 'fine', color: 0x6a5bd6 },
  fineVigourTonic: { kind: 'fine', color: 0xe0862e },
  fineShadowElixir: { kind: 'fine', color: 0x2f8a72 },
  fineMoonlightSalve: { kind: 'fine', color: 0x6fa8d6 },
  fineWitchsBrew: { kind: 'fine', color: 0x7a8f22 },
  primeWheat: { kind: 'prime', color: 0xd9b24a },
  primeMandrake: { kind: 'prime', color: 0xb07a4a },
  primeNightshade: { kind: 'prime', color: 0x4a3060 },
  primeFlour: { kind: 'prime', color: 0xf1e8d0 },
  primeMandrakeSeeds: { kind: 'prime', color: 0x6b4426 },
  primeNightshadeExtract: { kind: 'prime', color: 0x5a3a78 },
};

/**
 * How long a plot takes to go from freshly harvested to ripe. Every refined good goes into four of
 * the six recipes' ingredients, so the gardens grow at close to the same pace: wheat a little faster,
 * since the first recipes known lean on flour.
 */
export const GROW_MS: Record<PlantId, number> = {
  wheat: 24_000,
  mandrake: 30_000,
  nightshade: 32_000,
};

/** What the refining table turns each plant into, and how long one takes. */
export const REFINE: Record<PlantId, { out: RefinedId; ms: number }> = {
  wheat: { out: 'flour', ms: 2_500 },
  mandrake: { out: 'mandrakeSeeds', ms: 3_500 },
  nightshade: { out: 'nightshadeExtract', ms: 4_000 },
};

export interface Recipe {
  out: PotionId;
  inputs: RefinedId[];
  ms: number;
}

/**
 * The town's cure, which ends the plague: brewed once from one of each refined good, when the plague's
 * last stage is over, and handed to the town as soon as it is done. It is never sold, so it is no item.
 */
export const PANACEA = 'panacea';
/** What a cauldron can brew: a potion, or the Panacea. */
export type BrewOut = PotionId | typeof PANACEA;
export const PANACEA_RECIPE: { out: typeof PANACEA; inputs: RefinedId[]; ms: number } = {
  out: PANACEA,
  inputs: ['flour', 'mandrakeSeeds', 'nightshadeExtract'],
  ms: 9_000,
};

// A cauldron brews whichever of these the shop is shortest of; ties go in this order, rarer ingredient first.
export const RECIPES: Recipe[] = [
  { out: 'witchsBrew', inputs: ['nightshadeExtract', 'nightshadeExtract'], ms: 7_000 },
  { out: 'shadowElixir', inputs: ['nightshadeExtract', 'mandrakeSeeds'], ms: 6_000 },
  { out: 'moonlightSalve', inputs: ['nightshadeExtract', 'flour'], ms: 5_500 },
  { out: 'sleepingTonic', inputs: ['mandrakeSeeds', 'mandrakeSeeds'], ms: 5_000 },
  { out: 'vigourTonic', inputs: ['flour', 'mandrakeSeeds'], ms: 4_500 },
  { out: 'healingDraught', inputs: ['flour', 'flour'], ms: 4_000 },
];

/** What each potion sells for, before the counter's and the guild's price upgrades. In `POTIONS` order. */
export const POTION_PRICE: Record<PotionId, number> = {
  healingDraught: 8,
  sleepingTonic: 15,
  vigourTonic: 11,
  shadowElixir: 24,
  moonlightSalve: 20,
  witchsBrew: 34,
};

export const isPlant = (id: ItemId): id is PlantId => ITEMS[id].kind === 'plant';
export const isRefined = (id: ItemId): id is RefinedId => ITEMS[id].kind === 'refined';
export const isPotion = (id: ItemId): id is PotionId => ITEMS[id].kind === 'potion';
export const isFine = (id: ItemId): id is FineId => ITEMS[id].kind === 'fine';
/** Whether an item can be sold at the counter: a potion, plain or fine. */
export const isSellable = (id: ItemId): id is SellableId => isPotion(id) || isFine(id);

/** Each potion's fine version, and back. */
export const FINE: Record<PotionId, FineId> = {
  healingDraught: 'fineHealingDraught',
  sleepingTonic: 'fineSleepingTonic',
  vigourTonic: 'fineVigourTonic',
  shadowElixir: 'fineShadowElixir',
  moonlightSalve: 'fineMoonlightSalve',
  witchsBrew: 'fineWitchsBrew',
};
const PLAIN = Object.fromEntries(Object.entries(FINE).map(([plain, fine]) => [fine, plain])) as Record<FineId, PotionId>;
/** The potion an item on sale is: itself, or the plain potion of a fine one. */
export const plainOf = (id: SellableId): PotionId => (isFine(id) ? PLAIN[id] : id);

/** Whether an item is a Prime plant or good (AP23). */
export const isPrime = (id: ItemId): id is PrimeId => ITEMS[id].kind === 'prime';
/** Each plant's and refined good's Prime version, and back. */
export const PRIME: Record<PlantId | RefinedId, PrimeId> = {
  wheat: 'primeWheat',
  mandrake: 'primeMandrake',
  nightshade: 'primeNightshade',
  flour: 'primeFlour',
  mandrakeSeeds: 'primeMandrakeSeeds',
  nightshadeExtract: 'primeNightshadeExtract',
};
const UNPRIMED = Object.fromEntries(Object.entries(PRIME).map(([plain, prime]) => [prime, plain])) as Record<PrimeId, PlantId | RefinedId>;
/** The plain plant or good a Prime one is. */
export const unprimed = (id: PrimeId) => UNPRIMED[id];
/** Whether an item is a plant, plain or Prime. */
export const anyPlant = (id: ItemId) => isPlant(id) || (isPrime(id) && isPlant(unprimed(id)));
/** Whether an item is a refined good, plain or Prime. */
export const anyRefined = (id: ItemId) => isRefined(id) || (isPrime(id) && isRefined(unprimed(id)));

/** Every item of each kind, in the order their pallets stand. */
export const PLANTS = Object.keys(GROW_MS) as PlantId[];
export const REFINED = [...new Set(PLANTS.map((p) => REFINE[p].out))];
export const POTIONS = Object.keys(POTION_PRICE) as PotionId[];
