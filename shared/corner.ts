import { settings, updateSettings } from './settings';
import { t } from './i18n';
import { setVolumes, ui, unlockAudio } from './audio';

/** The key that mutes every sound and turns it back on, on any screen. */
const SOUND_KEY = 'm';

let bar: HTMLDivElement | null = null;

/** The screen corner a game puts its corner row in, for one whose own buttons sit in the bottom left. */
export type Corner = 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';

/**
 * The row of buttons in a corner of every game, the bottom left unless the game picks another
 * (`setupGame(game, { corner })`): full screen and pause, in that order (`setupGame.ts` and
 * `startScreen.ts` add them). It keeps 12px clear of the edges, plus the screen's safe area where a
 * phone reports one, so rounded corners and notches never cut a button. The safe area is read
 * through `--safe-left`, `--safe-right`, `--safe-top` and `--safe-bottom`, which `scaling.ts` sets
 * to the screen's other sides while it turns the page round.
 */
export function cornerBar() {
  if (bar) return bar;
  const style = document.createElement('style');
  style.textContent = `
.game-corner { position: fixed; z-index: 10; display: flex; gap: 6px; }
.game-corner[data-corner$="left"] { left: calc(12px + var(--safe-left, env(safe-area-inset-left, 0px))); }
.game-corner[data-corner$="right"] { right: calc(12px + var(--safe-right, env(safe-area-inset-right, 0px))); }
.game-corner[data-corner^="bottom"] { bottom: calc(12px + var(--safe-bottom, env(safe-area-inset-bottom, 0px))); }
.game-corner[data-corner^="top"] { top: calc(12px + var(--safe-top, env(safe-area-inset-top, 0px))); }
.corner-button { width: 30px; height: 30px; padding: 5px; cursor: pointer; color: #f3e9d2; background: rgba(0, 0, 0, 0.55);
  border: 1px solid rgba(243, 233, 210, 0.35); border-radius: 3px; }
.corner-button[hidden] { display: none; }
`;
  document.head.append(style);
  bar = document.createElement('div');
  bar.className = 'game-corner';
  bar.dataset.corner = 'bottom-left';
  document.body.append(bar);
  return bar;
}

/** Moves the corner row to another corner of the screen. */
export function setCorner(corner: Corner) {
  cornerBar().dataset.corner = corner;
}

let muted = settings.muted;
const listeners: (() => void)[] = [];
/** Every volume slider on the page, kept showing the same value. */
const sliders: HTMLInputElement[] = [];

function setMuted(on: boolean) {
  muted = on;
  setVolumes({ muted });
  updateSettings({ muted });
  for (const listener of listeners) listener();
}

function toggleMuted() {
  unlockAudio();
  setMuted(!muted);
  ui('click');
}

/** The M key, which mutes every sound or turns it back on, on any screen. */
export function addMuteKey() {
  window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() !== SOUND_KEY || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    toggleMuted();
  });
}

/** The pause screen's Mute button, which mutes every sound or turns it back on, like the M key. */
export function muteButton() {
  const mute = document.createElement('button');
  mute.type = 'button';
  mute.className = 'sound-mute';
  mute.addEventListener('click', toggleMuted);
  const draw = () => {
    mute.textContent = t(muted ? 'soundOnButton' : 'soundOffButton');
    mute.setAttribute('aria-pressed', String(muted));
  };
  listeners.push(draw);
  draw();
  return mute;
}

/**
 * The music and effects volumes, for the pause screen, saved to the hub's
 * settings as they move. `place` keeps each slider's id apart.
 */
export function volumeSliders(place: string) {
  return (['music', 'effects'] as const).flatMap((key) => {
    const label = document.createElement('label');
    label.textContent = t(key === 'music' ? 'musicVolume' : 'effectsVolume');
    const input = document.createElement('input');
    input.type = 'range';
    input.min = '0';
    input.max = '100';
    input.step = '5';
    input.value = String(settings[key]);
    input.className = `volume-${key}`;
    label.htmlFor = input.id = `game-volume-${place}-${key}`;
    sliders.push(input);
    input.addEventListener('input', () => {
      const value = Number(input.value);
      setVolumes({ [key]: value });
      updateSettings({ [key]: value });
      for (const other of sliders) if (other !== input && other.className === input.className) other.value = input.value;
    });
    // Moving a volume turns the sound on, since a muted game would play nothing to hear it by.
    input.addEventListener('change', () => {
      if (muted) setMuted(false);
      if (key === 'effects') ui('coin');
    });
    return [label, input];
  });
}
