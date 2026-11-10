/**
 * The skill overview: every path, pool skill, gear piece, specialisation and fusion on pages, each
 * shown with its text once a run has taken it (`progress.skills`). Entry ids are an upgrade's id,
 * `branch:<BranchId>` and `fusion:<id>`.
 */
import type { TextKey } from '../i18n';
import { HEROES, HERO_IDS } from './heroes';
import type { GameState } from './state';
import { BRANCH_IDS, DRILLS, FUSIONS, FUSION_PREFIX, UPGRADES, UPGRADE_IDS, type BranchId } from './upgrades';

export type SkillPageId = 'paths' | 'blaster' | 'blade' | 'current' | 'hollow' | 'gear' | 'branches' | 'fusions';

export interface SkillPage {
  id: SkillPageId;
  name: TextKey;
  entries: readonly string[];
}

export const BRANCH_PREFIX = 'branch:';

const pool = (p: string) => UPGRADE_IDS.filter((id) => UPGRADES[id].kind === 'pool' && UPGRADES[id].pool === p);

/** The pages, in the panel's order; the paths go hero by hero, each hero's drill last. */
export const SKILL_PAGES: readonly SkillPage[] = [
  { id: 'paths', name: 'codexPaths', entries: HERO_IDS.flatMap((h) => [...HEROES[h].paths, DRILLS[h].id]) },
  { id: 'blaster', name: 'skillsBlaster', entries: pool('blaster') },
  { id: 'blade', name: 'skillsBlade', entries: pool('blade') },
  { id: 'current', name: 'skillsCurrent', entries: pool('current') },
  { id: 'hollow', name: 'skillsHollow', entries: pool('hollow') },
  { id: 'gear', name: 'codexGear', entries: UPGRADE_IDS.filter((id) => UPGRADES[id].kind === 'gear') },
  { id: 'branches', name: 'skillsBranches', entries: BRANCH_IDS.map((b) => `${BRANCH_PREFIX}${b}`) },
  { id: 'fusions', name: 'skillsFusions', entries: FUSIONS.map((f) => `${FUSION_PREFIX}${f.id}`) },
];

/** Every entry's id, to check a save against. */
export const SKILL_ENTRIES: ReadonlySet<string> = new Set(SKILL_PAGES.flatMap((pg) => pg.entries));

/** The overview entries the run holds that `known` lacks. Reads the state only (no `rand`). */
export function skillsNew(s: GameState, known: ReadonlySet<string>): string[] {
  const out = new Set<string>();
  const add = (id: string) => {
    if (!known.has(id) && SKILL_ENTRIES.has(id)) out.add(id);
  };
  for (const id in s.ranks) add(id);
  for (const id in s.branches) add(`${BRANCH_PREFIX}${s.branches[id].b}`);
  for (const id in s.fusions) add(`${FUSION_PREFIX}${id}`);
  return [...out];
}

/** A specialisation entry's id, back to its `BranchId`. */
export const branchOf = (entry: string) => entry.slice(BRANCH_PREFIX.length) as BranchId;
