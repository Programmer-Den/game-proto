/**
 * Watch AI: a game opened with `?watch` in its URL (the hub's "Watch AI" link on a card) lets its
 * AI play every side while you look on. This module is the part every such game shares: the flag,
 * a panel in the top right (below the corner row when a game puts that there) with pause and speed
 * buttons, and a log of what each AI decides.
 *
 * A game that supports it reads `watching`, hands the player's side to its AI when it is set, calls
 * `mountWatch` once its match starts, runs its sim through `watchSteps`, and reports AI decisions
 * with `aiLog`. Nothing here runs or shows unless the page was opened with `?watch`.
 *
 * Keys: `[` and `]` step the speed down and up, L shows or hides the log. Its pause button holds the
 * match still without covering it; P is the shared pause screen's key (`shared/startScreen.ts`).
 */

/** Whether the page was opened to watch the AI play (`?watch` in the URL). */
export const watching: boolean = new URLSearchParams(location.search).has('watch');

/** The speeds on offer, as multiples of normal speed. */
export const WATCH_SPEEDS = [1, 2, 4, 8] as const;

/** The longest log kept; older lines drop off the top. */
const LOG_LINES = 200;

export interface WatchSide {
  /** The side's name as the log shows it, like "Red" or a faction's name. */
  name: string;
  /** A CSS colour for its name. */
  color: string;
}

const state = { speed: 1 as number, paused: false };
let log: HTMLOListElement | null = null;
let clock: () => number = () => performance.now();
const sides = new Map<string, WatchSide>();

/**
 * How many sim steps of `dt` to run this frame: 0 while paused, otherwise the speed. A game runs its
 * own step that many times, so a fast match plays out exactly like a slow one, only sooner.
 * Outside watch mode it is always 1.
 */
export function watchSteps(): number {
  if (!watching) return 1;
  return state.paused ? 0 : state.speed;
}

/**
 * Shows the watch panel: a "Watching AI" title, pause, the speeds and the log button. `sides` names
 * and colours the sides `aiLog` writes for, and `time` gives the match clock in ms for each log
 * line (real time if left out). Does nothing outside watch mode; called again for a new match, it
 * keeps the panel and its log and takes the new sides and clock.
 */
export function mountWatch(opts: { title?: string; sides?: Record<string, WatchSide>; time?: () => number } = {}) {
  if (!watching) return;
  // A new match calls this again with its own sides and clock; the panel and its log stay.
  sides.clear();
  for (const [key, side] of Object.entries(opts.sides ?? {})) sides.set(key, side);
  if (opts.time) clock = opts.time;
  if (log) {
    aiLog('', '— a new match —');
    return;
  }
  addStyles();

  const panel = document.createElement('div');
  panel.className = 'watch-panel';
  panel.setAttribute('role', 'region');
  panel.setAttribute('aria-label', 'Watch AI');
  const title = document.createElement('div');
  title.className = 'watch-title';
  title.textContent = opts.title ?? 'Watching AI';
  const bar = document.createElement('div');
  bar.className = 'watch-bar';

  const pause = button('Hold the match', '❚❚');
  const speeds = WATCH_SPEEDS.map((s) => button(`${s}x speed`, `${s}x`));
  const logButton = button('AI log (L)', 'Log');
  bar.append(pause, ...speeds, logButton);

  log = document.createElement('ol');
  log.className = 'watch-log';
  log.setAttribute('aria-label', 'AI log');
  log.hidden = true;
  panel.append(title, bar, log);
  document.body.append(panel);

  const show = () => {
    pause.setAttribute('aria-pressed', String(state.paused));
    pause.textContent = state.paused ? '▶' : '❚❚';
    pause.title = state.paused ? 'Play on' : 'Hold the match';
    pause.setAttribute('aria-label', pause.title);
    speeds.forEach((b, i) => b.setAttribute('aria-pressed', String(WATCH_SPEEDS[i] === state.speed)));
    logButton.setAttribute('aria-pressed', String(!log!.hidden));
  };
  const setSpeed = (s: number) => {
    state.speed = s;
    state.paused = false;
    show();
  };
  const togglePause = () => {
    state.paused = !state.paused;
    show();
  };
  const toggleLog = () => {
    log!.hidden = !log!.hidden;
    show();
  };
  pause.addEventListener('click', togglePause);
  speeds.forEach((b, i) => b.addEventListener('click', () => setSpeed(WATCH_SPEEDS[i])));
  logButton.addEventListener('click', toggleLog);
  // A focused button is clicked by Space and Enter, which games use, so let go of the focus.
  for (const b of [pause, ...speeds, logButton]) b.addEventListener('click', () => b.blur());
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    const i = WATCH_SPEEDS.indexOf(state.speed as (typeof WATCH_SPEEDS)[number]);
    if (e.key === 'l' || e.key === 'L') toggleLog();
    else if (e.key === ']') setSpeed(WATCH_SPEEDS[Math.min(i + 1, WATCH_SPEEDS.length - 1)]);
    else if (e.key === '[') setSpeed(WATCH_SPEEDS[Math.max(i - 1, 0)]);
  });
  show();
}

/**
 * Adds a line to the AI log: `side` is a key of the `sides` given to `mountWatch` (or any name),
 * `text` what it decided, like "trains 3 archers". Kept to the last 200 lines. Outside watch mode
 * it does nothing, so a game can call it from its AI unconditionally.
 */
export function aiLog(side: string, text: string) {
  if (!watching || !log) return;
  const known = sides.get(side);
  const line = document.createElement('li');
  const time = document.createElement('span');
  time.className = 'watch-time';
  const s = Math.max(0, Math.floor(clock() / 1000));
  time.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const who = document.createElement('b');
  who.textContent = known?.name ?? side;
  if (known) who.style.color = known.color;
  line.append(time, who, ` ${text}`);
  // Stay at the bottom only when the reader already was, so scrolling back to read stays put.
  const atEnd = log.scrollTop + log.clientHeight >= log.scrollHeight - 4;
  log.append(line);
  while (log.childElementCount > LOG_LINES) log.firstElementChild!.remove();
  if (atEnd) log.scrollTop = log.scrollHeight;
}

function button(label: string, text: string) {
  const b = document.createElement('button');
  b.type = 'button';
  b.title = label;
  b.setAttribute('aria-label', label);
  b.textContent = text;
  return b;
}

function addStyles() {
  const style = document.createElement('style');
  style.textContent = `
    .watch-panel { position: fixed; top: 6px; right: 6px; z-index: 11; width: min(300px, calc(100vw - 12px));
      box-sizing: border-box; padding: 6px; font: 12px/1.35 ui-monospace, monospace; color: #f3e9d2;
      background: rgba(16, 11, 8, 0.86); border: 1px solid rgba(243, 233, 210, 0.35); border-radius: 3px; }
    /* A game whose corner row sits in the top right (setupGame's corner) keeps it clear: the panel goes below it. */
    .game-corner[data-corner="top-right"] ~ .watch-panel { top: calc(48px + var(--safe-top, env(safe-area-inset-top, 0px))); }
    .watch-title { margin: 0 0 5px; font-weight: bold; letter-spacing: 1px; color: #f3c64e; }
    .watch-bar { display: flex; gap: 4px; }
    .watch-bar button { flex: 1; min-width: 0; height: 26px; padding: 0 4px; font: inherit; cursor: pointer;
      color: #f3e9d2; background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(243, 233, 210, 0.35); border-radius: 3px; }
    .watch-bar button[aria-pressed="true"] { color: #1b1410; background: #f3c64e; border-color: #f3c64e; }
    .watch-log { max-height: min(50vh, 360px); margin: 6px 0 0; padding: 0; overflow-y: auto; list-style: none; }
    .watch-log li { padding: 1px 0; border-top: 1px solid rgba(243, 233, 210, 0.12); }
    .watch-time { display: inline-block; min-width: 3.4em; color: #a8957a; }
  `;
  document.head.append(style);
}
