/**
 * The two letters that end each game's progress file name, after `.gh` (`.ghap` for Apothecary);
 * a file of every game's progress ends in plain `.gh`. Keyed by the game's folder name, each code
 * used once. A new game adds its code here.
 */
export const SAVE_CODES: Record<string, string> = {
  anvilheart: 'an',
  apothecary: 'ap',
  augury: 'au',
  'beehive-baron': 'bb',
  bramblecrest: 'br',
  broadside: 'bs',
  catacomb: 'ca',
  colonizer: 'co',
  deadline: 'de',
  'golem-garden': 'gg',
  hotfoot: 'hf',
  'lane-brawl': 'lb',
  lanternkeep: 'lk',
  mapmaker: 'mm',
  mazewright: 'mw',
  ninefold: 'nf',
  palisade: 'pa',
  riftblade: 'rb',
  'scrapyard-titans': 'st',
  'shrine-stack': 'ss',
  'space-wars': 'sw',
  'tincture-tinker': 'tt',
  'tiny-kingdom': 'tk',
  wyrmrail: 'wr',
};

/** The progress file ending, with its dot, for a game's folder name, or for every game when `game` is omitted. */
export function fileEnding(game?: string) {
  return `.gh${game ? (SAVE_CODES[game] ?? '') : ''}`;
}
