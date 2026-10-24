import { settings, updateSettings } from './settings';
import { t } from './i18n';
import { setVolumes, ui, unlockAudio } from './audio';

/** The key that mutes every sound and turns it back on, on any screen. */
const SOUND_KEY = 'm';

let bar: HTMLDivElement | null = null;
/** The sound menu, once `addSoundButton` has made it, and how to open or close it. */
let soundMenu: { menu: HTMLDivElement; open: (on: boolean) => void } | null = null;

/**
 * The row of buttons in the bottom left corner of every game: full screen, sound and pause, in that
 * order (`setupGame.ts` and `startScreen.ts` add them). It keeps 12px clear of the edges, plus the
 * screen's safe area where a phone reports one, so rounded corners and notches never cut a button.
 * The safe area is read through `--safe-left` and `--safe-bottom`, which `scaling.ts` sets to the
 * screen's other sides while it turns the page round.
 */
export function cornerBar() {
  if (bar) return bar;
  const style = document.createElement('style');
  style.textContent = `
.game-corner { position: fixed; z-index: 10; display: flex; gap: 6px;
  left: calc(12px + var(--safe-left, env(safe-area-inset-left, 0px))); bottom: calc(12px + var(--safe-bottom, env(safe-area-inset-bottom, 0px))); }
.corner-button { width: 30px; height: 30px; padding: 5px; cursor: pointer; color: #f3e9d2; background: rgba(0, 0, 0, 0.55);
  border: 1px solid rgba(243, 233, 210, 0.35); border-radius: 3px; }
.corner-button[hidden] { display: none; }
`;
  document.head.append(style);
  bar = document.createElement('div');
  bar.className = 'game-corner';
  document.body.append(bar);
  return bar;
}

let muted = settings.muted;
const listeners: (() => void)[] = [];
/** Every volume slider on the page, the sound menu's and the pause screen's, kept showing the same value. */
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

const SPEAKER = '<path d="M2 6h3l4-3v10l-4-3H2z" fill="currentColor" stroke="none"/>';
const WAVES = '<path d="M11 5.5a3.5 3.5 0 0 1 0 5M12.5 3.5a6 6 0 0 1 0 9"/>';
const MUTED = '<path d="M11 6l4 4M15 6l-4 4"/>';

/**
 * The sound button, beside full screen: a tap opens the sound menu above the corner row, with the
 * music and effects volumes and a Mute button. The M key mutes every sound or turns it back on, on
 * any screen. The menu closes with the button, Escape or a tap anywhere else.
 */
export function addSoundButton() {
  injectMenuStyles();
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'sound-button corner-button';
  button.title = t('soundButton');
  button.setAttribute('aria-label', t('soundButton'));
  button.setAttribute('aria-haspopup', 'true');
  button.setAttribute('aria-expanded', 'false');

  const menu = document.createElement('div');
  menu.className = 'sound-menu';
  menu.id = 'game-sound-menu';
  menu.hidden = true;
  menu.setAttribute('role', 'group');
  menu.setAttribute('aria-label', t('soundButton'));
  button.setAttribute('aria-controls', menu.id);
  const title = document.createElement('div');
  title.className = 'sound-menu-title';
  title.textContent = t('soundButton');
  const volumes = document.createElement('div');
  volumes.className = 'sound-menu-volumes';
  volumes.append(...volumeSliders('menu'));
  const mute = document.createElement('button');
  mute.type = 'button';
  mute.className = 'sound-mute';
  mute.addEventListener('click', toggleMuted);
  menu.append(title, volumes, mute);

  const draw = () => {
    button.innerHTML =
      '<svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" ' +
      `stroke-linecap="round" aria-hidden="true">${SPEAKER}${muted ? MUTED : WAVES}</svg>`;
    mute.textContent = t(muted ? 'soundOnButton' : 'soundOffButton');
    mute.setAttribute('aria-pressed', String(muted));
  };
  listeners.push(draw);
  draw();

  const open = (on: boolean) => {
    menu.hidden = !on;
    button.setAttribute('aria-expanded', String(on));
  };
  soundMenu = { menu, open };
  button.addEventListener('click', () => {
    unlockAudio();
    ui('click');
    open(menu.hidden !== false);
    // A focused button is clicked by Space and Enter, which games use, so let go of the focus.
    button.blur();
  });
  // A tap anywhere but the menu and its button closes it.
  document.addEventListener(
    'pointerdown',
    (e) => {
      if (!menu.hidden && !menu.contains(e.target as Node) && !button.contains(e.target as Node)) open(false);
    },
    true,
  );
  // Keys pressed in the menu (arrows on a slider, Space on Mute) stay out of the game, except M.
  menu.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      open(false);
      (document.activeElement as HTMLElement | null)?.blur();
    }
    if (e.key.toLowerCase() !== SOUND_KEY) e.stopPropagation();
  });
  window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() !== SOUND_KEY || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    toggleMuted();
  });
  cornerBar().append(button);
  document.body.append(menu);
}

/** The sound menu while it is open, for a controller to move around in (`startScreen.ts`). */
export function openSoundMenu() {
  return soundMenu && !soundMenu.menu.hidden ? soundMenu.menu : null;
}

/** Opens the sound menu, or closes it when it is open: the controller's Select button. */
export function toggleSoundMenu() {
  if (!soundMenu) return;
  unlockAudio();
  ui('click');
  const { menu, open } = soundMenu;
  if (!menu.hidden && menu.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
  open(menu.hidden !== false);
}

/**
 * The music and effects volumes, for the sound menu and the pause screen, saved to the hub's
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

function injectMenuStyles() {
  const style = document.createElement('style');
  style.textContent = `
.sound-menu { position: fixed; z-index: 11; box-sizing: border-box; width: 240px; max-width: calc(100vw - 24px);
  left: calc(12px + var(--safe-left, env(safe-area-inset-left, 0px))); bottom: calc(50px + var(--safe-bottom, env(safe-area-inset-bottom, 0px)));
  display: flex; flex-direction: column; gap: 10px; padding: 12px 14px; font: 14px system-ui, sans-serif; color: #f3e9d2;
  background: rgba(20, 16, 12, 0.92); border: 1px solid rgba(243, 233, 210, 0.35); border-radius: 6px; }
.sound-menu[hidden] { display: none; }
.sound-menu-title { font-weight: 700; font-size: 15px; }
.sound-menu-volumes { display: grid; grid-template-columns: auto 1fr; align-items: center; gap: 8px 12px; }
.sound-menu-volumes input { width: 100%; min-width: 0; accent-color: #f0a830; }
.sound-mute { padding: 6px 10px; font: 600 14px system-ui, sans-serif; cursor: pointer; color: #f3e9d2;
  background: rgba(243, 233, 210, 0.08); border: 1px solid rgba(243, 233, 210, 0.35); border-radius: 4px; }
.sound-mute:hover, .sound-mute:focus-visible { border-color: #f0a830; outline: none; }
.sound-mute[aria-pressed="true"] { color: #1b1410; background: #f0a830; border-color: #f3e9d2; }
`;
  document.head.append(style);
}
