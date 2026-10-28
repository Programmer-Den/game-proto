import type { Theme } from '../art/paint';
import en from '../i18n/en';
import type { TextKey } from '../i18n';
import { findFeatures, makeIsland } from './island';
import { GRID, WRECK_SUPPLIES, indexOf, maxSupplies, type Clue, type GameState, type Ground, type Riddle, type Tile } from './state';

// The whole game is saved after every successful action, so a
// reload carries on where it left off. The best Royal Atlas (fewest voyages) is kept apart, so it
// outlives a new game, and so is the sheet's theme.
//
// The isle is saved as its seed, which rolls it again on load (`makeIsland`), with the charted tiles
// as a bitmask and only the riddle's flags; the next isle is saved as its seed alone. An isle from a
// save made before seeds has none, and keeps saving in full.
const KEY = 'mapmaker-save';
const BEST_KEY = 'mapmaker-best';
const THEME_KEY = 'mapmaker-theme';

export function loadGame(): GameState | null {
  try {
    const s = unpack(JSON.parse(localStorage.getItem(KEY) ?? 'null') as Stored | GameState | null);
    // A save from a different grid size or a broken one starts over.
    if (!s || !Array.isArray(s.tiles) || s.tiles.length !== GRID.w * GRID.h || !s.port || !s.phase) return null;
    // Supplies saved on an easier difficulty can exceed this one's maximum (plus this voyage's wrecks).
    const wrecks = (s.surveyed ?? []).filter((p) => s.tiles[indexOf(p.x, p.y)]?.find === 'wreck').length;
    s.supplies = Math.min(s.supplies, maxSupplies(s) + wrecks * WRECK_SUPPLIES);
    // Saves from before the isle goal and the sell-back start with none of either.
    s.milestones ??= 0;
    s.isleStart ??= s.voyage;
    s.atlas ??= [];
    // Saves from before isle kinds, finds, camps and riddles: a green isle with none of them.
    s.kind ??= 'green';
    for (const page of s.atlas) page.kind ??= 'green';
    s.camps ??= [];
    s.storms ??= [];
    s.artifacts ??= 0;
    s.treasure ??= 0;
    s.riddle ??= null;
    s.dug ??= [];
    // Saves from before features, the board, hands, the rival and the Royal Atlas: the features
    // are read off the tiles, the rest starts empty (the first harbor lays the board out).
    s.features ??= findFeatures(s.tiles.map((t) => t.terrain), s.island);
    s.board ??= [];
    s.hands ??= [];
    s.hand ??= null;
    s.rival ??= null;
    s.royal ??= null;
    // Saves from before the next isle was rolled at the sale: setSail rolls it.
    s.next ??= null;
    // Saves from before the translations kept feature names and riddle clues in English words.
    for (const f of [...s.features, ...(s.next?.features ?? []), ...(s.chart?.features ?? [])]) f.name = nameKey(f.name);
    for (const r of [s.riddle, s.next?.riddle]) if (r) r.clues = r.clues.map(oldClue).filter((c) => c !== null);
    for (const c of [s.commission, ...s.board]) {
      if (!c) continue;
      c.voyages ??= 1;
      c.done ??= 0;
      c.left ??= 1;
    }
    if (s.chart) {
      const old: Partial<typeof s.chart> = s.chart;
      s.chart = {
        ...s.chart,
        unused: old.unused ?? 0,
        sellBack: old.sellBack ?? 0,
        milestones: old.milestones ?? 0,
        milestoneCoins: old.milestoneCoins ?? 0,
        atlas: old.atlas ?? false,
        artifacts: old.artifacts ?? 0,
        artifactCoins: old.artifactCoins ?? 0,
        treasure: old.treasure ?? 0,
        features: old.features ?? [],
        featureCoins: old.featureCoins ?? 0,
        rivalTiles: old.rivalTiles ?? 0,
        rivalLoss: old.rivalLoss ?? 0,
      };
    }
    return s;
  } catch {
    return null;
  }
}

/** The key of a feature name saved as its English words, from before the names were keys. */
function nameKey(name: string): TextKey {
  return name in en ? (name as TextKey) : ((Object.keys(en) as TextKey[]).find((k) => en[k] === name) ?? 'otterBrook');
}

const OLD_TILES = ['', 'One tile', 'Two tiles', 'Three tiles'];
type FromClue = Extract<Clue, { kind: 'from' }>;
const OLD_MARKS: Record<string, FromClue['mark']> = {
  'a peak': 'mountain',
  'a village': 'village',
  'the ruins': 'ruins',
  'the port': 'port',
};
const OLD_GROUND: Record<string, Ground> = { 'on a meadow': 'grass', 'in a forest': 'forest', 'on the sand': 'beach', 'on the hills': 'hills' };
const OLD_TRAITS: Record<string, Clue> = {
  'by the water': { kind: 'water' },
  'out of sight of the sea': { kind: 'inland' },
  'beside a river': { kind: 'river' },
};

/** A riddle clue saved as its English words, from before the clues were translated, or null if unread. */
function oldClue(clue: Riddle['clues'][number] | string): Clue | null {
  if (typeof clue !== 'string') return clue;
  if (OLD_GROUND[clue]) return { kind: 'ground', ground: OLD_GROUND[clue] };
  if (OLD_TRAITS[clue]) return OLD_TRAITS[clue];
  const m = /^(\w+ tiles?) (north|east|south|west) of (.+)$/.exec(clue);
  const tiles = m ? OLD_TILES.indexOf(m[1]) : -1;
  if (!m || tiles < 1 || !OLD_MARKS[m[3]]) return null;
  return { kind: 'from', tiles, dir: m[2] as FromClue['dir'], mark: OLD_MARKS[m[3]] };
}

/** The save as kept: the isle as its seed, the charted tiles and the riddle's flags; the next isle as its seed. */
type Stored = Omit<GameState, 'kind' | 'tiles' | 'port' | 'features' | 'riddle' | 'next'> & {
  seed: number;
  /** One bit a tile, row by row, set where it is charted, in base64. */
  revealed: string;
  riddle: Pick<Riddle, 'known' | 'found' | 'rival'> | null;
  next: number | GameState['next'];
};

function pack(s: GameState): Stored | GameState {
  const next = s.next?.seed !== undefined ? s.next.seed : s.next;
  if (s.seed === undefined) return { ...s, next } as GameState;
  const { kind: _kind, tiles, port: _port, features: _features, riddle, ...rest } = s;
  const r = riddle && { known: riddle.known, found: riddle.found, ...(riddle.rival ? { rival: true } : {}) };
  return { ...rest, seed: s.seed, revealed: bitmask(tiles), riddle: r, next };
}

/** Rolls a seeded save's isles again, and lays its charted tiles and riddle flags over them; a full save comes back as it is. */
function unpack(saved: Stored | GameState | null): GameState | null {
  if (!saved) return null;
  if (typeof saved.next === 'number') saved.next = makeIsland(saved.island + 1, saved.next);
  if (!('revealed' in saved) || typeof saved.seed !== 'number') return saved as GameState;
  const { revealed, riddle, ...rest } = saved;
  const isle = makeIsland(saved.island, saved.seed);
  const open = unmask(revealed);
  for (let i = 0; i < isle.tiles.length; i++) isle.tiles[i].revealed = open[i];
  return {
    ...(rest as Omit<Stored, 'revealed' | 'riddle'> & { next: GameState['next'] }),
    kind: isle.kind,
    tiles: isle.tiles,
    port: isle.port,
    features: isle.features,
    riddle: isle.riddle && riddle && { ...isle.riddle, ...riddle },
  };
}

function bitmask(tiles: Tile[]) {
  const bytes = new Uint8Array(Math.ceil(tiles.length / 8));
  tiles.forEach((t, i) => {
    if (t.revealed) bytes[i >> 3] |= 1 << (i & 7);
  });
  return btoa(String.fromCharCode(...bytes));
}

function unmask(text: string) {
  const bytes = Array.from(atob(text), (c) => c.charCodeAt(0));
  return Array.from({ length: GRID.w * GRID.h }, (_, i) => ((bytes[i >> 3] ?? 0) >> (i & 7)) & 1).map(Boolean);
}

export function saveGame(s: GameState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(pack(s)));
  } catch {
    // Storage can be full or blocked (private mode); the game keeps running unsaved.
  }
}

/** The fewest voyages a Royal Atlas has been completed in, or null before the first. */
export function loadBest(): number | null {
  try {
    const n = Number(localStorage.getItem(BEST_KEY));
    return n > 0 ? n : null;
  } catch {
    return null;
  }
}

/** Records a completed Royal Atlas's voyages when they beat the best so far, and says whether they did. */
export function saveBest(voyages: number) {
  const best = loadBest();
  if (best !== null && voyages >= best) return false;
  try {
    localStorage.setItem(BEST_KEY, String(voyages));
  } catch {
    // Storage can be full or blocked; the best is simply not kept.
  }
  return true;
}

/** The theme picked in the game, or the device's dark-mode preference until one is picked. */
export function loadTheme(): Theme {
  try {
    const t = localStorage.getItem(THEME_KEY);
    if (t === 'light' || t === 'dark') return t;
  } catch {
    // Blocked storage falls back to the device's preference.
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function saveTheme(t: Theme) {
  try {
    localStorage.setItem(THEME_KEY, t);
  } catch {
    // Storage can be full or blocked; the theme button hands the theme to Boot itself, so it
    // still switches and lasts until the page is closed.
  }
}
