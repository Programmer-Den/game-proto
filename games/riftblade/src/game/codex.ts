/**
 * The codex: every foe, boss and card met fills a page, kept in the save (`progress.codex`) across
 * runs. A page filled for the first time pays its credits into the Armoury's bank (`recordCodex`).
 * An entry's id is `foe:<FoeKind>`, `boss:<BossId>` or `card:<upgrade id>`; a card counts as seen
 * once dealt on a level-up, offered by a trader or held.
 */
import type { TextKey } from '../i18n';
import { BOSSES, PLANETS, type BossId, type FoeKind } from './planets';
import { UPGRADES, UPGRADE_IDS } from './upgrades';
import type { GameState } from './state';

export type CodexPageId = 'foes' | 'bosses' | 'skills' | 'gear' | 'paths';

/** Every swarm foe, in the order of their worlds. */
const FOES: readonly FoeKind[] = [
  'clanker', 'rollerbomb', 'mirerat', 'toad', 'linetrooper', 'walker', 'acolyte', 'knight',
  'sporeling', 'puffcap', 'scrapper', 'hauler', 'shardling', 'prism', 'wisp', 'conductor',
];

export interface CodexEntry {
  id: string;
  name: TextKey;
}

export interface CodexPage {
  id: CodexPageId;
  name: TextKey;
  /** Credits banked the first time the page is full. */
  pay: number;
  entries: CodexEntry[];
}

const cards = (kind: 'path' | 'pool' | 'gear') =>
  UPGRADE_IDS.filter((id) => UPGRADES[id].kind === kind).map((id) => ({ id: `card:${id}`, name: UPGRADES[id].name }));

/** The pages, in the panel's order. */
export const CODEX_PAGES: readonly CodexPage[] = [
  { id: 'foes', name: 'codexFoes', pay: 60, entries: FOES.map((k) => ({ id: `foe:${k}`, name: `foe_${k}` as TextKey })) },
  { id: 'bosses', name: 'codexBosses', pay: 100, entries: (Object.keys(BOSSES) as BossId[]).map((b) => ({ id: `boss:${b}`, name: BOSSES[b].name })) },
  { id: 'skills', name: 'codexSkills', pay: 80, entries: cards('pool') },
  { id: 'gear', name: 'codexGear', pay: 50, entries: cards('gear') },
  { id: 'paths', name: 'codexPaths', pay: 150, entries: cards('path') },
];

/** Every entry's id, to check a save against. */
export const CODEX_ENTRIES: ReadonlySet<string> = new Set(CODEX_PAGES.flatMap((pg) => pg.entries.map((e) => e.id)));

/** Whether every entry of a page is in `seen`. */
export const pageDone = (page: CodexPage, seen: ReadonlySet<string>) => page.entries.every((e) => seen.has(e.id));

/** How many of a page's entries are in `seen`. */
export const pageCount = (page: CodexPage, seen: ReadonlySet<string>) => page.entries.filter((e) => seen.has(e.id)).length;

/**
 * The codex entries the run shows now that `known` lacks: foes and the boss on the field, the cards
 * on offer and the ones held. Reads the state only (no `rand`), so it never changes a run.
 */
export function codexNew(s: GameState, known: ReadonlySet<string>): string[] {
  const out = new Set<string>();
  const add = (id: string) => {
    if (!known.has(id) && CODEX_ENTRIES.has(id)) out.add(id);
  };
  for (const e of s.enemies) add(e.kind === 'boss' ? `boss:${PLANETS[s.planet].boss}` : `foe:${e.kind}`);
  if (s.phase === 'levelup') for (const id of s.choices ?? []) add(`card:${id}`);
  if (s.phase === 'trader') for (const id of s.offers) if (id) add(`card:${id}`);
  for (const id in s.ranks) add(`card:${id}`);
  return [...out];
}
