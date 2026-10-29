import { settings } from './settings';
import { openSoundMenu } from './corner';
import { onPadFrame } from './gamepad';

/** Below this the sticks count as at rest, since a stick seldom comes back to exactly 0. */
const DEAD_ZONE = 0.2;
/** At full tilt the cursor crosses this share of the screen's shorter side per second, per step of Cursor speed. */
const SPEED_PER_STEP = 0.12;
/** The right stick at full tilt scrolls this many pixels per second, like a mouse wheel. */
const SCROLL_SPEED = 900;

/**
 * A cursor over the game for a controller (`gamepad.ts`), so every game that is played by tapping
 * can be played with one without code of its own: the left stick moves it (slowly near the middle
 * of the stick, for aiming), A taps and holds like the left mouse button, B is the right button and
 * the right stick scrolls like a mouse wheel. It sends the mouse and pointer events a real mouse
 * would to whatever lies under it, so games keep reading `pointer.worldX/Y` as they do, and the
 * corner buttons work under it too. It shows once the stick moves or A or B is pressed, hides on the
 * first real mouse move or tap, and stays off while the start, pause or How to play screen or the
 * sound menu is up, which the controller moves around in instead. The hub's Controller setting turns
 * it off and its Cursor speed sets how fast it goes.
 */
export function addPadCursor() {
  if (!settings.controller) return;
  injectStyles();
  const cursor = document.createElement('div');
  cursor.className = 'pad-cursor';
  cursor.hidden = true;
  cursor.innerHTML =
    '<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">' +
    '<path d="M3 2l15 9-6.5 1.5L15 20l-3 1.5-3.5-7.5L3 19z" fill="#f3e9d2" stroke="#1b1410" stroke-width="1.5" stroke-linejoin="round"/></svg>';
  // Outside <body>, which `scaling.ts` turns for a phone held the wrong way, so the arrow is drawn
  // at the screen point it taps.
  document.documentElement.append(cursor);

  let x = innerWidth / 2;
  let y = innerHeight / 2;
  /** The mouse buttons the cursor holds down, as in `MouseEvent.buttons`: 1 for A, 2 for B. */
  let buttons = 0;
  /** Whether A and B were held last frame, to find presses and releases. */
  let heldA = false;
  let heldB = false;
  let target: Element | null = null;
  /** The element the cursor is over, to send `mouseover` and `mouseout` as it moves, as a real mouse does. */
  let over: Element | null = null;

  const show = (on: boolean) => {
    cursor.hidden = !on;
    if (on) cursor.style.transform = `translate(${x}px, ${y}px)`;
  };
  // The start, pause and How to play screens and the sound menu take the controller instead.
  const active = () => !document.querySelector('.game-overlay:not([hidden])') && !openSoundMenu();
  // Phaser only counts the pointer as over the canvas after a `mouseover` on it (`input.isOver`).
  const hover = (under: Element, init: MouseEventInit) => {
    if (under === over) return;
    const pointer = { ...init, pointerId: 1, pointerType: 'mouse', isPrimary: true };
    over?.dispatchEvent(new PointerEvent('pointerout', { ...pointer, relatedTarget: under }));
    over?.dispatchEvent(new MouseEvent('mouseout', { ...init, relatedTarget: under }));
    under.dispatchEvent(new PointerEvent('pointerover', { ...pointer, relatedTarget: over }));
    under.dispatchEvent(new MouseEvent('mouseover', { ...init, relatedTarget: over }));
    over = under;
  };
  const send = (type: 'move' | 'down' | 'up', button = 0) => {
    const under = document.elementFromPoint(x, y) ?? document.body;
    const init: MouseEventInit = {
      bubbles: true,
      cancelable: true,
      composed: true,
      view: window,
      clientX: x,
      clientY: y,
      screenX: x,
      screenY: y,
      button,
      buttons,
    };
    hover(under, init);
    under.dispatchEvent(new PointerEvent(`pointer${type}`, { ...init, pointerId: 1, pointerType: 'mouse', isPrimary: true }));
    under.dispatchEvent(new MouseEvent(`mouse${type}`, init));
    if (type === 'down') target = under;
    if (type === 'up' && under === target) under.dispatchEvent(new MouseEvent(button === 2 ? 'contextmenu' : 'click', init));
  };
  const release = () => {
    if (buttons & 1) {
      buttons &= ~1;
      send('up', 0);
    }
    if (buttons & 2) {
      buttons &= ~2;
      send('up', 2);
    }
  };

  onPadFrame(({ left, right, held, dt }) => {
    const a = held.has('a');
    const b = held.has('b');
    const pressedA = a && !heldA;
    const pressedB = b && !heldB;
    heldA = a;
    heldB = b;
    if (!active()) {
      release();
      show(false);
      return;
    }
    const tilt = Math.hypot(left.x, left.y);
    if (tilt > DEAD_ZONE) {
      // The square of the tilt past the dead zone: small moves for aiming, full speed at the rim.
      const ease = ((Math.min(tilt, 1) - DEAD_ZONE) / (1 - DEAD_ZONE)) ** 2;
      const speed = SPEED_PER_STEP * settings.cursorSpeed * Math.min(innerWidth, innerHeight) * ease;
      // On a turned page (`scaling.ts`) the stick moves along the game's axes, turned onto the screen's.
      const turned = Number(document.body.dataset.turned ?? 0);
      const [dx, dy] = turned === 90 ? [-left.y, left.x] : turned === -90 ? [left.y, -left.x] : [left.x, left.y];
      x = Math.max(0, Math.min(innerWidth - 1, x + (dx / tilt) * speed * dt));
      y = Math.max(0, Math.min(innerHeight - 1, y + (dy / tilt) * speed * dt));
      show(true);
      send('move');
    }
    if (Math.abs(right.y) > DEAD_ZONE || Math.abs(right.x) > DEAD_ZONE) {
      const under = document.elementFromPoint(x, y) ?? document.body;
      under.dispatchEvent(
        new WheelEvent('wheel', {
          bubbles: true,
          cancelable: true,
          clientX: x,
          clientY: y,
          deltaX: Math.abs(right.x) > DEAD_ZONE ? right.x * SCROLL_SPEED * dt : 0,
          deltaY: Math.abs(right.y) > DEAD_ZONE ? right.y * SCROLL_SPEED * dt : 0,
          deltaMode: 0,
        }),
      );
    }
    if (pressedA) {
      show(true);
      buttons |= 1;
      send('down', 0);
    } else if (!a && buttons & 1) {
      buttons &= ~1;
      send('up', 0);
    }
    if (pressedB) {
      show(true);
      buttons |= 2;
      send('down', 2);
    } else if (!b && buttons & 2) {
      buttons &= ~2;
      send('up', 2);
    }
  });

  // A real mouse or a finger takes over again.
  const hide = (e: Event) => {
    if (!e.isTrusted) return;
    // The real mouse may rest where the cursor last left (the browser sends no `mouseover` then), so hover it again.
    if (e instanceof MouseEvent && e.target instanceof Element) {
      hover(e.target, { bubbles: true, clientX: e.clientX, clientY: e.clientY });
    }
    if (cursor.hidden) return;
    release();
    show(false);
  };
  // The real mouse's own hovers, also while the cursor is hidden, so the cursor's next move hovers what it is over.
  const seen = (e: Event) => {
    if (e.isTrusted && e.target instanceof Element) over = e.target;
  };
  window.addEventListener('mouseover', seen, true);
  // The real mouse left the page (no `mouseover` follows), so the cursor's next move hovers what it is over again.
  window.addEventListener('mouseout', (e) => {
    if (e.isTrusted && !e.relatedTarget) over = null;
  }, true);
  // A pad that drops mid-press sends no last frame, so let go of what it held.
  window.addEventListener('gamepaddisconnected', () => {
    if ([...navigator.getGamepads()].some((pad) => pad?.connected)) return;
    release();
    show(false);
  });
  window.addEventListener('mousemove', hide, true);
  window.addEventListener('pointerdown', hide, true);
  window.addEventListener('resize', () => {
    x = Math.min(x, innerWidth - 1);
    y = Math.min(y, innerHeight - 1);
    if (!cursor.hidden) show(true);
  });
}

function injectStyles() {
  const style = document.createElement('style');
  // The tip of the arrow sits on the point it taps; it never takes a tap itself.
  style.textContent = `
.pad-cursor { position: fixed; left: 0; top: 0; z-index: 12; pointer-events: none; margin: -2px 0 0 -3px;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.6)); }
.pad-cursor[hidden] { display: none; }
`;
  document.head.append(style);
}
