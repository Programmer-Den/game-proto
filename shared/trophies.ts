import { formatDate, formatNumber, t, translator, type Texts, type Translation } from './i18n';
import { settings, type Language } from './settings';
import { ui } from './audio';

/**
 * Trophies, the same in every game: a game lists its trophies once with `trophySet` in
 * `games/<name>/src/trophies/index.ts` (exported as `trophies`), hands the set to
 * `setupGame(game, { trophies })` for the pause screen's Trophies list, and calls `award(trophies, id)`
 * when the player earns one. The hub reads every game's set from the same file for its cards' counts
 * and its trophy shelf, so that file imports nothing from the game but its own trophy texts.
 *
 * Earned trophies are saved under `<game>-trophies` (each id with the time it was earned), so they
 * travel with the game's progress export, code and link, and deleting the game's progress on the
 * hub clears them. A new game of the game itself keeps them.
 */
export type Tier = 'bronze' | 'silver' | 'gold';
export const TIERS: readonly Tier[] = ['bronze', 'silver', 'gold'];
const TIER_KEY = { bronze: 'trophyBronze', silver: 'trophySilver', gold: 'trophyGold' } as const;

export interface Trophy {
  id: string;
  tier: Tier;
  /** An emoji shown on the trophy's badge. */
  icon: string;
  /** Shown as a hidden trophy, with no name or description, until it is earned. */
  hidden?: boolean;
}

export interface TrophySet {
  /** The game's folder name, the prefix of its storage key. */
  game: string;
  list: readonly Trophy[];
  /** A trophy's name in the hub's language. */
  name(id: string): string;
  /** What earns a trophy, in the hub's language. */
  text(id: string): string;
}

/**
 * A game's trophies. Their texts are a text set of their own (`trophies/i18n/en.ts`, `de.ts` and
 * `en-US.ts`, like the game's other texts): the name keyed by the trophy's id, and what earns it by
 * `<id>Text`.
 */
export function trophySet<E extends Texts>(
  game: string,
  list: readonly Trophy[],
  texts: { en: E } & Partial<Record<Language, Partial<Translation<E>>>>,
): TrophySet {
  const tr = translator(texts) as (key: string) => string;
  return { game, list, name: (id) => tr(id), text: (id) => tr(`${id}Text`) };
}

const storageKey = (game: string) => `${game}-trophies`;

/** The trophies earned in a game on this device, each id with the time it was earned (`Date.now`). */
export function earnedTrophies(game: string): Record<string, number> {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(storageKey(game)) ?? '{}');
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return {};
    return Object.fromEntries(Object.entries(saved).filter((e): e is [string, number] => typeof e[1] === 'number'));
  } catch {
    return {};
  }
}

/** How many of a game's trophies are earned, and how many it has. */
export function trophyCount(set: TrophySet) {
  const earned = earnedTrophies(set.game);
  return { earned: set.list.filter((trophy) => earned[trophy.id]).length, total: set.list.length };
}

/** The earned trophies `award` has seen, per game, so a game can award every frame without reading storage. */
const known = new Map<string, Record<string, number>>();

/**
 * Earns a trophy: saves it, shows a toast at the top of the page with its name and plays the trophy
 * jingle. A trophy already earned does nothing, so a game may call this whenever the condition
 * holds. Pass `quiet` while the game replays time or restores a save: the trophy is saved with no
 * toast or sound. Returns whether the trophy was new.
 */
export function award(set: TrophySet, id: string, options: { quiet?: boolean } = {}): boolean {
  let earned = known.get(set.game);
  if (!earned) known.set(set.game, (earned = earnedTrophies(set.game)));
  const trophy = set.list.find((tr) => tr.id === id);
  if (!trophy || earned[id]) return false;
  earned[id] = Date.now();
  try {
    localStorage.setItem(storageKey(set.game), JSON.stringify({ ...earnedTrophies(set.game), [id]: earned[id] }));
  } catch {
    // Storage can be blocked; the trophy then lasts until the page closes.
  }
  if (!options.quiet) {
    showToast(set, trophy);
    ui('trophy');
  }
  return true;
}

/** A trophy's round badge in its tier's colour, with its icon, or a lock while it is still to earn. */
function badge(trophy: Trophy, earned: boolean) {
  return `<span class="trophy-badge tier-${trophy.tier}${earned ? '' : ' locked'}" aria-hidden="true">${earned ? trophy.icon : '🔒'}</span>`;
}

function showToast(set: TrophySet, trophy: Trophy) {
  injectStyles();
  let stack = document.querySelector<HTMLDivElement>('.trophy-toasts');
  if (!stack) {
    stack = document.createElement('div');
    stack.className = 'trophy-toasts';
    stack.setAttribute('role', 'status');
    document.body.append(stack);
  }
  const toast = document.createElement('div');
  toast.className = 'trophy-toast';
  toast.innerHTML =
    badge(trophy, true) +
    `<span><small>${escapeHtml(t('trophyEarned'))}</small><b>${escapeHtml(set.name(trophy.id))}</b></span>`;
  stack.append(toast);
  setTimeout(() => toast.classList.add('leaving'), 4000);
  setTimeout(() => toast.remove(), 4400);
}

/** The game's trophies as a list, earned and still to earn, for the pause screen. */
export function trophyListHtml(set: TrophySet) {
  injectStyles();
  const earned = earnedTrophies(set.game);
  const rows = set.list.map((trophy) => {
    const when = earned[trophy.id];
    const secret = trophy.hidden && !when;
    return (
      `<li class="trophy-row${when ? ' earned' : ''}">` +
      badge(trophy, !!when) +
      `<span class="trophy-words"><b>${escapeHtml(secret ? t('trophyHidden') : set.name(trophy.id))}</b>` +
      `<span>${escapeHtml(secret ? t('trophyHiddenText') : set.text(trophy.id))}</span></span>` +
      `<span class="trophy-when">${escapeHtml(t(TIER_KEY[trophy.tier]))}${when ? `<br>${escapeHtml(formatDate(when))}` : ''}</span>` +
      '</li>'
    );
  });
  return `<ul class="trophy-list">${rows.join('')}</ul>`;
}

/** "4/8" with a trophy, for a hub card or the pause screen's button. */
export function trophyCountText(set: TrophySet) {
  const { earned, total } = trophyCount(set);
  return `🏆 ${formatNumber(earned)}/${formatNumber(total)}`;
}

/**
 * The hub's trophy shelf: the totals per tier over every game, then each game with a trophy earned,
 * its earned trophies as badges with their names. `about` gives a game's title and icon.
 */
export function trophyShelfHtml(sets: readonly TrophySet[], about: (game: string) => { title: string; icon: string }) {
  injectStyles();
  const totals = Object.fromEntries(TIERS.map((tier) => [tier, 0])) as Record<Tier, number>;
  const games: string[] = [];
  for (const set of sets) {
    const earned = earnedTrophies(set.game);
    const won = set.list.filter((trophy) => earned[trophy.id]);
    for (const trophy of won) totals[trophy.tier]++;
    if (!won.length) continue;
    const { title, icon } = about(set.game);
    games.push(
      `<section class="trophy-game"><h3><img class="icon" src="${escapeHtml(icon)}" alt="">${escapeHtml(title)}` +
        `<span class="trophy-game-count">${escapeHtml(trophyCountText(set))}</span></h3><ul class="trophy-chips">` +
        won
          .map(
            (trophy) =>
              `<li class="trophy-chip" title="${escapeHtml(set.text(trophy.id))}">${badge(trophy, true)}${escapeHtml(set.name(trophy.id))}</li>`,
          )
          .join('') +
        '</ul></section>',
    );
  }
  const tiers = TIERS.map(
    (tier) =>
      `<span class="trophy-total"><span class="trophy-badge tier-${tier}" aria-hidden="true">🏆</span>` +
      `${escapeHtml(t(TIER_KEY[tier]))} ${formatNumber(totals[tier])}</span>`,
  ).join('');
  return (
    `<div class="trophy-totals">${tiers}</div>` +
    (games.length ? games.join('') : `<p class="trophy-empty">${escapeHtml(t('trophyShelfEmpty'))}</p>`)
  );
}

function escapeHtml(text: string) {
  return text.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
}

let styled = false;

function injectStyles() {
  if (styled) return;
  styled = true;
  const style = document.createElement('style');
  style.textContent = `
.trophy-badge { display: inline-flex; flex: none; align-items: center; justify-content: center; width: 32px; height: 32px;
  box-sizing: border-box; font-size: 17px; line-height: 1; border: 3px solid; border-radius: 50%; background: rgba(0, 0, 0, 0.35); }
.trophy-badge.tier-bronze { border-color: #c8814a; }
.trophy-badge.tier-silver { border-color: #c9d1d9; }
.trophy-badge.tier-gold { border-color: #f3c64e; }
.trophy-badge.locked { opacity: 0.45; filter: grayscale(1); }
.trophy-toasts { position: fixed; top: calc(12px + env(safe-area-inset-top)); left: 50%; z-index: 12; display: flex;
  flex-direction: column; align-items: center; gap: 8px; transform: translateX(-50%); pointer-events: none; }
.trophy-toast { display: flex; align-items: center; gap: 10px; padding: 8px 16px 8px 10px; font: 15px system-ui, sans-serif;
  color: #f3e9d2; background: rgba(20, 16, 12, 0.92); border: 1px solid rgba(243, 233, 210, 0.35); border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4); white-space: nowrap; transition: opacity 0.4s;
  ${settings.reduceMotion ? '' : 'animation: trophy-in 0.35s ease-out;'} }
.trophy-toast small { display: block; font-size: 12px; color: #f0a830; text-transform: uppercase; letter-spacing: 0.06em; }
.trophy-toast.leaving { opacity: 0; }
@keyframes trophy-in { from { opacity: 0; transform: translateY(-16px); } to { opacity: 1; transform: none; } }
.trophy-list { margin: 0; padding: 0; list-style: none; }
.trophy-row { display: flex; align-items: center; gap: 12px; padding: 8px 0; border-top: 1px solid rgba(243, 233, 210, 0.15); }
.trophy-row:not(.earned) .trophy-words { opacity: 0.65; }
.trophy-words { flex: 1; display: flex; flex-direction: column; text-align: left; }
.trophy-words span { font-size: 14px; }
.trophy-when { flex: none; font-size: 12px; text-align: right; opacity: 0.75; }
.trophy-totals { display: flex; flex-wrap: wrap; gap: 8px 20px; margin-bottom: 8px; }
.trophy-total { display: flex; align-items: center; gap: 8px; }
.trophy-game { padding: 10px 0; border-top: 2px solid #3d2b1f; }
.trophy-game h3 { display: flex; align-items: center; gap: 8px; margin: 0 0 8px; font-size: 16px; color: #f3c64e; }
.trophy-game h3 .icon { width: 24px; height: 24px; }
.trophy-game-count { margin-left: auto; font-size: 13px; color: #a8957a; }
.trophy-chips { display: flex; flex-wrap: wrap; gap: 8px; margin: 0; padding: 0; list-style: none; }
.trophy-chip { display: flex; align-items: center; gap: 8px; padding: 2px 10px 2px 2px; font-size: 14px;
  background: #3d2b1f; border-radius: 18px; }
.trophy-empty { color: #a8957a; }
`;
  document.head.append(style);
}
