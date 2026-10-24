import { settings } from './settings';

/**
 * Game controllers, read through the browser's Gamepad API in the standard layout, which every
 * common controller reports. The hub and the shared start and pause screens move the focus with
 * them (`moveFocus`, `pressFocused`), and `padCursor.ts` steers a cursor over the game with them.
 *
 * Nothing runs until a controller is connected: the browser announces one with `gamepadconnected`
 * once a button on it is pressed, then the pads are read every animation frame until the last one
 * goes. The hub's Controller setting turns it all off. Tests stand in for a controller by replacing
 * `navigator.getGamepads` before the page loads.
 */

export type PadButton =
  | 'a'
  | 'b'
  | 'x'
  | 'y'
  | 'lb'
  | 'rb'
  | 'lt'
  | 'rt'
  | 'select'
  | 'start'
  | 'ls'
  | 'rs'
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'home';
export type PadDirection = 'up' | 'down' | 'left' | 'right';

/** The standard layout's buttons, in the order the browser lists them. */
const BUTTONS: PadButton[] = ['a', 'b', 'x', 'y', 'lb', 'rb', 'lt', 'rt', 'select', 'start', 'ls', 'rs', 'up', 'down', 'left', 'right', 'home'];
const DIRECTIONS: readonly PadButton[] = ['up', 'down', 'left', 'right'];
/** How far the left stick goes before it counts as a press of the D-pad. */
const STICK_PRESS = 0.5;
/** A held direction presses again after this long, then every `REPEAT_MS`. */
const REPEAT_DELAY_MS = 400;
const REPEAT_MS = 120;

/** One frame of every connected pad together: both sticks (-1 to 1) and the buttons held. */
export interface PadFrame {
  left: { x: number; y: number };
  right: { x: number; y: number };
  held: ReadonlySet<PadButton>;
  /** Seconds since the last frame, at most 0.1. */
  dt: number;
}

const pressListeners: ((button: PadButton) => void)[] = [];
const frameListeners: ((frame: PadFrame) => void)[] = [];
let listening = false;
let running = false;
/** The buttons held in the last frame; null on the first frame, whose buttons are not presses. */
let last: Set<PadButton> | null = null;
let lastTime = 0;
const repeatAt = new Map<PadButton, number>();

/** Calls `listener` when a button is pressed, and again while a direction is held. */
export function onPadPress(listener: (button: PadButton) => void) {
  pressListeners.push(listener);
  listen();
}

/** Calls `listener` every frame while a pad is connected, before the frame's presses. */
export function onPadFrame(listener: (frame: PadFrame) => void) {
  frameListeners.push(listener);
  listen();
}

function listen() {
  if (listening || !settings.controller || typeof navigator === 'undefined') return;
  listening = true;
  window.addEventListener('gamepadconnected', run);
  if (pads().length) run();
}

function pads(): Gamepad[] {
  try {
    return [...(navigator.getGamepads?.() ?? [])].filter((pad): pad is Gamepad => !!pad?.connected);
  } catch {
    // A page whose permissions policy blocks gamepads throws.
    return [];
  }
}

function run() {
  if (running) return;
  running = true;
  last = null;
  requestAnimationFrame(tick);
}

function tick(time: number) {
  const list = pads();
  if (!list.length) {
    running = false;
    return;
  }
  const held = new Set<PadButton>();
  const left = { x: 0, y: 0 };
  const right = { x: 0, y: 0 };
  for (const pad of list) {
    pad.buttons.forEach((b, i) => {
      if (BUTTONS[i] && (b.pressed || b.value > 0.5)) held.add(BUTTONS[i]);
    });
    left.x += pad.axes[0] ?? 0;
    left.y += pad.axes[1] ?? 0;
    right.x += pad.axes[2] ?? 0;
    right.y += pad.axes[3] ?? 0;
  }
  for (const stick of [left, right]) {
    stick.x = Math.max(-1, Math.min(1, stick.x));
    stick.y = Math.max(-1, Math.min(1, stick.y));
  }
  if (left.y < -STICK_PRESS) held.add('up');
  if (left.y > STICK_PRESS) held.add('down');
  if (left.x < -STICK_PRESS) held.add('left');
  if (left.x > STICK_PRESS) held.add('right');

  const dt = last ? Math.min(time - lastTime, 100) / 1000 : 0;
  lastTime = time;
  for (const listener of frameListeners) listener({ left, right, held, dt });
  if (last) {
    for (const button of held) {
      const repeats = DIRECTIONS.includes(button);
      if (!last.has(button)) {
        if (repeats) repeatAt.set(button, time + REPEAT_DELAY_MS);
        press(button);
      } else if (repeats && time >= (repeatAt.get(button) ?? Infinity)) {
        repeatAt.set(button, time + REPEAT_MS);
        press(button);
      }
    }
  }
  last = held;
  requestAnimationFrame(tick);
}

function press(button: PadButton) {
  for (const listener of pressListeners) listener(button);
}

export function isDirection(button: PadButton): button is PadDirection {
  return DIRECTIONS.includes(button);
}

const FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';

/** The elements in `root` the focus can move to: shown, enabled and not inert. */
function focusables(root: HTMLElement) {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (el) =>
      !(el as HTMLButtonElement).disabled &&
      el.getClientRects().length > 0 &&
      getComputedStyle(el).visibility !== 'hidden' &&
      !el.closest('[inert]'),
  );
}

function focus(el: HTMLElement) {
  el.focus({ preventScroll: true });
  el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

/**
 * Moves the focus inside `root` to the nearest element in `direction`, as the arrow keys would on a
 * screen laid out in rows and columns. With nothing in `root` focused yet, it goes to the first
 * element. Left and right on a focused slider move the slider instead.
 */
export function moveFocus(root: HTMLElement, direction: PadDirection) {
  showPadFocus();
  const all = focusables(root);
  const current = document.activeElement instanceof HTMLElement && all.includes(document.activeElement) ? document.activeElement : null;
  if (!current) {
    if (all[0]) focus(all[0]);
    return;
  }
  if (current instanceof HTMLInputElement && current.type === 'range' && (direction === 'left' || direction === 'right')) {
    if (direction === 'left') current.stepDown();
    else current.stepUp();
    current.dispatchEvent(new Event('input', { bubbles: true }));
    current.dispatchEvent(new Event('change', { bubbles: true }));
    return;
  }
  const from = current.getBoundingClientRect();
  const vertical = direction === 'up' || direction === 'down';
  const sign = direction === 'down' || direction === 'right' ? 1 : -1;
  let best: HTMLElement | null = null;
  let bestScore = Infinity;
  for (const el of all) {
    if (el === current) continue;
    const to = el.getBoundingClientRect();
    // It has to lie that way: its centre past the focused element's edge, so an element sitting on
    // top of another (a card's ⚙) is never stepped into from it.
    const c = centre(to);
    const past = vertical ? (sign > 0 ? c.y - from.bottom : from.top - c.y) : sign > 0 ? c.x - from.right : from.left - c.x;
    if (past <= 0) continue;
    const ahead = sign * (vertical ? c.y - centre(from).y : c.x - centre(from).x);
    // The gap between the two along the direction, and how far apart they lie across it.
    const gap = Math.max(0, vertical ? (sign > 0 ? to.top - from.bottom : from.top - to.bottom) : sign > 0 ? to.left - from.right : from.left - to.right);
    const across = vertical
      ? Math.max(0, to.left - from.right, from.left - to.right)
      : Math.max(0, to.top - from.bottom, from.top - to.bottom);
    const offset = Math.abs(vertical ? centre(to).x - centre(from).x : centre(to).y - centre(from).y);
    const score = gap + 2 * across + 0.1 * offset + 0.01 * ahead;
    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  }
  if (best) focus(best);
}

/**
 * Presses the focused element in `root`, like a tap. With nothing focused it focuses the first
 * element instead. A press that draws the focused element again (the hub's Settings rows) keeps the
 * focus on whatever now sits where it was.
 */
export function pressFocused(root: HTMLElement) {
  showPadFocus();
  const all = focusables(root);
  const current = document.activeElement instanceof HTMLElement && all.includes(document.activeElement) ? document.activeElement : null;
  if (!current) {
    if (all[0]) focus(all[0]);
    return;
  }
  if (current instanceof HTMLInputElement && current.type === 'range') return;
  const at = centre(current.getBoundingClientRect());
  current.click();
  if (current.isConnected || document.activeElement !== document.body) return;
  const near = focusables(root)
    .map((el) => ({ el, d: Math.hypot(centre(el.getBoundingClientRect()).x - at.x, centre(el.getBoundingClientRect()).y - at.y) }))
    .sort((a, b) => a.d - b.d)[0];
  if (near) focus(near.el);
}

function centre(rect: DOMRect) {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

let styled = false;

/**
 * Rings the focused element while a controller moves the focus, since browsers show their own ring
 * only for keys; the first mouse move or tap takes it away again.
 */
export function showPadFocus() {
  if (!styled) {
    styled = true;
    const style = document.createElement('style');
    style.textContent = 'html.pad-focus :focus { outline: 3px solid #ffc04d !important; outline-offset: 2px; }';
    document.head.append(style);
    const off = (e: Event) => e.isTrusted && document.documentElement.classList.remove('pad-focus');
    window.addEventListener('pointerdown', off, true);
    window.addEventListener('mousemove', off, true);
  }
  document.documentElement.classList.add('pad-focus');
}
