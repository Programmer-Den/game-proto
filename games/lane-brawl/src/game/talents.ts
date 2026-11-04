// Talent pages (LB18): the player's page for each class, kept in the browser under
// `lane-brawl-talents` as JSON `{ classId: [talentId, ...] }`, one id per row. Every read and write is
// in try/catch and odd saves are cleaned on load, so blocked or damaged storage only forgets the page.

import { TALENTS, TALENT_ROWS, TalentId, TalentRow } from './data';

const KEY = 'lane-brawl-talents';

/** Every saved page, each kept only as a list of talent ids (anything else in the save is dropped). */
function loadAll(): Record<string, TalentId[]> {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    const all: Record<string, TalentId[]> = {};
    for (const [classId, page] of Object.entries(raw)) {
      if (Array.isArray(page)) all[classId] = page.filter((id): id is TalentId => TALENTS.some((t) => t.id === id));
    }
    return all;
  } catch {
    return {};
  }
}

/** The rows a mastery rank opens, in order. */
export const openRows = (rank: number): TalentRow[] => TALENT_ROWS.filter((r) => rank >= r.rank).map((r) => r.row);

/** The talents of a row, in order. */
export const talentsOf = (row: TalentRow) => TALENTS.filter((t) => t.row === row);

/** A class's page at a rank: the saved talent of each opened row, or the row's first. */
export function loadPage(classId: string, rank: number): TalentId[] {
  const saved = loadAll()[classId] ?? [];
  return openRows(rank).map((row) => saved.find((id) => TALENTS.some((t) => t.id === id && t.row === row)) ?? talentsOf(row)[0].id);
}

/** Keeps a talent in its row of a class's page. */
export function chooseTalent(classId: string, id: TalentId): void {
  const all = loadAll();
  const row = TALENTS.find((t) => t.id === id)?.row;
  all[classId] = [...(all[classId] ?? []).filter((x) => TALENTS.find((t) => t.id === x)?.row !== row), id];
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // Storage blocked: the page holds for this match only.
  }
}
