import Phaser from 'phaser';
import { settings } from './settings';
import { t } from './i18n';
import type { HowToPlay } from './howToPlay';
import { cornerBar, openSoundMenu, toggleSoundMenu, volumeSliders } from './corner';
import { isDirection, moveFocus, onPadPress, pressFocused } from './gamepad';
import { resumeAudio, suspendAudio, ui, unlockAudio } from './audio';
import { mountInstallButton } from './install';
import { trophyCountText, trophyListHtml, type TrophySet } from './trophies';

/** The key that pauses the game and resumes it. Esc is left to the games, some of which close panels with it. */
const PAUSE_KEY = 'p';
/** The key that opens How to play from the start and pause screens, and closes it again. */
const HELP_KEY = 'h';

/**
 * Covers the page while the game starts up, then shows a start screen, and gives every game a
 * pause screen:
 * - Loading: from the moment the game is created until the first scene after Boot (or the only
 *   scene, in a game without one) has drawn, so the player never looks at a blank page while the
 *   art is baked. The game waits for the page to show it before its first step, which may be a
 *   long one.
 * - Start: the game's icon, its name and a Start button over its first drawn frame. The scenes
 *   stand paused until Start is pressed (or Enter or Space), so nothing happens unseen. Under
 *   browser automation it is skipped (see `skipStart`).
 * - Pause: a button next to full screen, the P key, or leaving the tab pauses every running scene
 *   and shows Resume, the music and effects volumes and a link back to all games.
 *   P, Enter, Space or Esc resume.
 * - How to play: when the game hands over its `howToPlay`, the start and pause screens get a How to
 *   play button (and the H key) that shows it in place of the card; Back, H or Esc go back.
 * - Install: where the game can be installed as an app, the start and pause screens show an Install
 *   button (`install.ts`).
 * - Trophies: when the game hands over its `trophies` (`trophies.ts`), the start and pause screens get
 *   a Trophies button with the count earned, which lists them in place of the card; Back or Esc go back.
 * - Controller (`gamepad.ts`): Start pauses and resumes, the D-pad or left stick moves between the
 *   screen's buttons and sliders, A presses, B resumes from the pause screen and leaves How to play
 *   and Trophies, and Select opens the sound menu (on any screen, and while playing).
 * While a screen is up, keys go to it and not to the game.
 */
export function addStartScreen(game: Phaser.Game, howToPlay?: HowToPlay, trophies?: TrophySet): () => boolean {
  injectStyles();
  const overlay = document.createElement('div');
  overlay.className = 'game-overlay loading';
  overlay.innerHTML =
    '<div class="game-overlay-card">' +
    `<img class="game-overlay-icon" alt="" src="${iconUrl()}">` +
    `<div class="game-overlay-title" data-paused="${escapeHtml(t('paused'))}">${escapeHtml(document.title)}</div>` +
    `<div class="game-overlay-loading" role="status">${escapeHtml(t('loading'))}<span>.</span><span>.</span><span>.</span></div>` +
    `<button type="button" class="game-overlay-button game-start-button">${escapeHtml(t('start'))}</button>` +
    `<button type="button" class="game-overlay-button game-resume-button">${escapeHtml(t('resume'))}</button>` +
    (howToPlay ? `<button type="button" class="game-overlay-link game-help-button">${escapeHtml(t('howToPlay'))}</button>` : '') +
    (trophies ? '<button type="button" class="game-overlay-link game-trophies-button"></button>' : '') +
    `<button type="button" class="game-overlay-link game-install-button" hidden>${escapeHtml(t('installGame'))}</button>` +
    '<div class="game-overlay-volumes"></div>' +
    '<div class="game-overlay-hint"></div>' +
    `<a class="game-overlay-hub" href="../../">${escapeHtml(t('allGames'))}</a>` +
    '</div>' +
    (howToPlay ? helpHtml(howToPlay) : '') +
    (trophies ? trophiesHtml() : '');
  document.body.append(overlay);
  const startButton = overlay.querySelector<HTMLButtonElement>('.game-start-button')!;
  const resumeButton = overlay.querySelector<HTMLButtonElement>('.game-resume-button')!;
  const hint = overlay.querySelector<HTMLDivElement>('.game-overlay-hint')!;
  const help = overlay.querySelector<HTMLElement>('.game-help-body');
  const trophyButton = overlay.querySelector<HTMLButtonElement>('.game-trophies-button');
  const trophyBody = overlay.querySelector<HTMLElement>('.game-trophies .game-panel-body');
  overlay.querySelector('.game-overlay-volumes')!.append(...volumeSliders('pause'));
  // Install the game as an app of its own; opened with ?install (the Install on its hub card), the
  // button shows in every browser and stands out as the main button.
  const installButton = overlay.querySelector<HTMLButtonElement>('.game-install-button')!;
  const installAsked = new URLSearchParams(location.search).has('install');
  if (installAsked) installButton.className = 'game-overlay-button game-install-button';
  mountInstallButton(installButton, installAsked);

  const pauseButton = document.createElement('button');
  pauseButton.type = 'button';
  pauseButton.className = 'pause-button corner-button';
  pauseButton.title = t('pauseButton');
  pauseButton.setAttribute('aria-label', t('pauseButton'));
  pauseButton.innerHTML =
    '<svg viewBox="0 0 16 16" width="18" height="18" fill="currentColor" aria-hidden="true">' +
    '<rect x="3" y="2" width="3.5" height="12"/><rect x="9.5" y="2" width="3.5" height="12"/></svg>';
  pauseButton.hidden = true;
  cornerBar().append(pauseButton);

  type Mode = 'loading' | 'start' | 'paused' | 'help' | 'trophies' | 'playing';
  let mode: Mode = 'loading';
  /** The screen How to play or Trophies was opened from, to go back to. */
  let helpFrom: 'start' | 'paused' = 'start';
  /** The scenes this pause stopped, to start again on resume, and none the game paused itself. */
  let held: Phaser.Scene[] = [];

  const show = (next: Mode) => {
    mode = next;
    overlay.className = `game-overlay ${next}`;
    overlay.hidden = next === 'playing';
    pauseButton.hidden = next !== 'playing';
    hint.textContent =
      next === 'start'
        ? t(help ? 'hintStartHelp' : 'hintStart')
        : next === 'paused'
          ? t(help ? 'hintPausedHelp' : 'hintPaused')
          : '';
    // The help scrolls on its own, from the top, and takes the focus so arrow keys scroll it.
    const body = next === 'help' ? help : next === 'trophies' ? trophyBody : null;
    if (body) {
      body.scrollTop = 0;
      body.focus({ preventScroll: true });
    }
    // The count changes as trophies are earned, so it is filled in each time the card shows.
    if (trophies && trophyButton) trophyButton.textContent = `${t('trophies')} ${trophyCountText(trophies)}`;
    const button = next === 'start' ? startButton : next === 'paused' ? resumeButton : null;
    button?.focus({ preventScroll: true });
  };
  const openHelp = () => {
    if (!help || (mode !== 'start' && mode !== 'paused')) return;
    helpFrom = mode;
    show('help');
  };
  const openTrophies = () => {
    if (!trophies || !trophyBody || (mode !== 'start' && mode !== 'paused')) return;
    helpFrom = mode;
    trophyBody.innerHTML = trophyListHtml(trophies);
    show('trophies');
  };
  const closeHelp = () => show(helpFrom);

  const hold = () => {
    held = game.scene.getScenes(true);
    // Through the scenes' systems, at once: the scene plugin would queue it for the next step.
    for (const scene of held) scene.sys.pause();
    game.sound.pauseAll();
  };
  const play = () => {
    for (const scene of held) {
      if (!scene.sys.isPaused()) continue;
      // A paused scene misses the key-ups of the keys let go behind the screen, so its keys start
      // again from up, as after the tab lost the focus.
      scene.input?.keyboard?.resetKeys();
      scene.sys.resume();
    }
    held = [];
    game.sound.resumeAll();
    // Start and Resume are a tap or a key press, which lets the browser play sound.
    unlockAudio();
    show('playing');
    // A focused button is clicked by Space and Enter, which games use, so let go of the focus.
    (document.activeElement as HTMLElement | null)?.blur();
  };
  const pause = () => {
    if (mode !== 'playing') return;
    hold();
    show('paused');
  };

  // Ready once a scene other than Boot has drawn: its first frame stays on screen behind Start.
  const onRender = () => {
    if (!game.scene.getScenes(true).some((scene) => scene.sys.settings.key !== 'Boot')) return;
    game.events.off(Phaser.Core.Events.POST_RENDER, onRender);
    if (skipStart()) return show('playing');
    hold();
    show('start');
  };
  game.events.on(Phaser.Core.Events.POST_RENDER, onRender);
  holdFirstStep(game);

  startButton.addEventListener('click', play);
  resumeButton.addEventListener('click', play);
  pauseButton.addEventListener('click', () => {
    ui('click');
    pause();
  });
  // Any tap or key press lets the browser play sound, so a game asked for music early gets it then.
  for (const type of ['pointerdown', 'keydown'] as const) {
    window.addEventListener(type, unlockAudio, { capture: true });
  }
  overlay.querySelector('.game-help-button')?.addEventListener('click', openHelp);
  overlay.querySelector('.game-help-back')?.addEventListener('click', closeHelp);
  trophyButton?.addEventListener('click', openTrophies);
  overlay.querySelector('.game-trophies-back')?.addEventListener('click', closeHelp);

  // Captured on window, before the game's own listeners, so a screen that is up keeps its keys.
  // Key-ups always reach the game, so a key held when the screen came up is let go there too.
  window.addEventListener(
    'keydown',
    (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const key = e.key.toLowerCase();
      if (mode === 'playing') {
        if (key === PAUSE_KEY && !e.repeat) {
          e.stopPropagation();
          pause();
        }
        return;
      }
      // Full screen and sound still work from any screen, and the sound menu keeps its own keys.
      if (key === 'f' || key === 'm' || openSoundMenu()?.contains(document.activeElement)) return;
      e.stopPropagation();
      if (e.repeat) return;
      if (mode === 'help' || mode === 'trophies') {
        // Arrow and page keys stay with the browser, to scroll the help.
        if ((key === HELP_KEY && mode === 'help') || key === 'escape' || key === 'enter') {
          e.preventDefault();
          closeHelp();
        }
        return;
      }
      if (key === HELP_KEY) return openHelp();
      const go = key === 'enter' || key === ' ';
      if ((mode === 'start' && go) || (mode === 'paused' && (go || key === PAUSE_KEY || key === 'escape'))) {
        e.preventDefault();
        play();
      }
    },
    { capture: true },
  );
  onPadPress((button) => {
    if (button === 'select') return toggleSoundMenu();
    const menu = openSoundMenu();
    if (menu) {
      if (button === 'b') toggleSoundMenu();
      else if (isDirection(button)) moveFocus(menu, button);
      else if (button === 'a') pressFocused(menu);
      return;
    }
    if (mode === 'loading') return;
    if (mode === 'playing') {
      if (button === 'start') pause();
      return;
    }
    if (mode === 'help' || mode === 'trophies') {
      const body = mode === 'help' ? help : trophyBody;
      if (button === 'up' || button === 'down') body?.scrollBy({ top: button === 'up' ? -80 : 80 });
      else if (button === 'a' || button === 'b') closeHelp();
      return;
    }
    if (button === 'start' || (button === 'b' && mode === 'paused')) play();
    else if (isDirection(button)) moveFocus(overlay, button);
    else if (button === 'a') pressFocused(overlay);
  });
  // The music plays on behind the pause screen, so its volume can be heard as it is set, but stops
  // with the tab out of sight.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      pause();
      suspendAudio();
    } else resumeAudio();
  });
  return () => mode === 'playing';
}

/**
 * Skips the game's steps until the page has drawn once with the loading screen up, since the
 * first steps bake the art and draw nothing until they are done.
 */
function holdFirstStep(game: Phaser.Game) {
  const loop = game.loop;
  const step = loop.step.bind(loop);
  let shown = false;
  // A callback two animation frames on runs after the first frame with the screen was drawn.
  requestAnimationFrame(() => requestAnimationFrame(() => (shown = true)));
  loop.step = (time: number) => {
    if (shown) step(time);
  };
}

/**
 * Under browser automation (the playthroughs) the game starts at once, without waiting on Start,
 * so no game's test needs to know about the start screen. A test that checks the start screen
 * itself sets `window.showStartScreen` first.
 */
function skipStart() {
  return navigator.webdriver && !(window as { showStartScreen?: boolean }).showStartScreen;
}

/** The game's favicon, the bear with its prop. */
function iconUrl() {
  return document.querySelector<HTMLLinkElement>('link[rel="icon"]')?.href ?? '';
}

/** The How to play screen: the goal, the controls with the shared ones added, the loop and the tips. */
function helpHtml(howToPlay: HowToPlay) {
  const controls = [
    ...howToPlay.controls,
    { input: t('pauseInput'), action: t('pauseAction') },
    { input: t('soundInput'), action: t('soundAction') },
    { input: t('soundMenuInput'), action: t('soundMenuAction') },
    ...(document.fullscreenEnabled ? [{ input: t('fullScreenInput'), action: t('fullScreenAction') }] : []),
    ...(settings.controller
      ? [
          { input: t('padCursorInput'), action: t('padCursorAction') },
          { input: t('padInput'), action: t('padAction') },
        ]
      : []),
  ];
  const list = (items: string[]) => items.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
  return (
    '<section class="game-help" aria-labelledby="game-help-title">' +
    `<h2 id="game-help-title">${escapeHtml(t('howToPlayTitle', { game: document.title }))}</h2>` +
    // Only the text between the title and Back scrolls.
    '<div class="game-help-body" tabindex="-1">' +
    `<p class="game-help-goal">${escapeHtml(howToPlay.goal)}</p>` +
    `<h3>${escapeHtml(t('controls'))}</h3><table class="game-help-controls"><tbody>` +
    controls.map((c) => `<tr><th scope="row">${escapeHtml(c.input)}</th><td>${escapeHtml(c.action)}</td></tr>`).join('') +
    '</tbody></table>' +
    `<h3>${escapeHtml(t('roundSteps'))}</h3><ol>${list(howToPlay.loop)}</ol>` +
    (howToPlay.tips.length ? `<h3>${escapeHtml(t('goodToKnow'))}</h3><ul>${list(howToPlay.tips)}</ul>` : '') +
    '</div>' +
    `<button type="button" class="game-overlay-button game-help-back">${escapeHtml(t('back'))}</button>` +
    '</section>'
  );
}

/** The Trophies screen: the title, then the list, filled in each time it opens. */
function trophiesHtml() {
  return (
    '<section class="game-trophies" aria-labelledby="game-trophies-title">' +
    `<h2 id="game-trophies-title">${escapeHtml(t('trophiesTitle', { game: document.title }))}</h2>` +
    '<div class="game-panel-body" tabindex="-1"></div>' +
    `<button type="button" class="game-overlay-button game-trophies-back">${escapeHtml(t('back'))}</button>` +
    '</section>'
  );
}

function escapeHtml(text: string) {
  return text.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
}

function injectStyles() {
  const style = document.createElement('style');
  style.textContent = `
.game-overlay { position: fixed; inset: 0; z-index: 9; display: flex; align-items: center; justify-content: center;
  padding: 16px; font: 16px system-ui, sans-serif; color: #f3e9d2; background: rgba(20, 16, 12, 0.6); }
.game-overlay[hidden] { display: none; }
.game-overlay.loading { background: #1b1410; }
.game-overlay-card { display: flex; flex-direction: column; align-items: center; gap: 12px; min-width: 200px;
  padding: 24px 32px; text-align: center; background: rgba(20, 16, 12, 0.85);
  border: 1px solid rgba(243, 233, 210, 0.35); border-radius: 8px; }
.game-overlay.loading .game-overlay-card { background: none; border-color: transparent; }
.game-overlay-icon { width: 64px; height: 64px; }
.game-overlay-title { font-size: 26px; font-weight: 700; letter-spacing: 0.02em; }
.game-overlay.paused .game-overlay-title::after { content: ' \\00b7  ' attr(data-paused); font-weight: 400; }
.game-overlay-loading span { animation: game-overlay-dot 1.2s infinite; }
.game-overlay-loading span:nth-child(2) { animation-delay: 0.2s; }
.game-overlay-loading span:nth-child(3) { animation-delay: 0.4s; }
@keyframes game-overlay-dot { 0%, 60%, 100% { opacity: 1; } 30% { opacity: 0.2; } }
.game-overlay-button { min-width: 160px; padding: 10px 24px; font: 700 20px system-ui, sans-serif; cursor: pointer;
  color: #1b1410; background: #f0a830; border: 2px solid #f3e9d2; border-radius: 6px; }
.game-overlay-button:hover, .game-overlay-button:focus-visible { background: #ffc04d; outline: none; }
.game-overlay-volumes { display: grid; grid-template-columns: auto 1fr; align-items: center; gap: 6px 12px;
  width: 100%; font-size: 14px; text-align: left; }
.game-overlay-volumes input { width: 100%; min-width: 120px; accent-color: #f0a830; }
.game-overlay:not(.paused) .game-overlay-volumes { display: none; }
.game-overlay-hint { font-size: 13px; opacity: 0.7; }
.game-overlay-hint:empty { display: none; }
.game-overlay-hub { font-size: 14px; color: #f3e9d2; }
.game-overlay-link { padding: 4px 8px; font: 15px system-ui, sans-serif; cursor: pointer; color: #f3e9d2;
  background: none; border: none; text-decoration: underline; text-underline-offset: 3px; }
.game-overlay-link:hover, .game-overlay-link:focus-visible { color: #ffc04d; outline: none; }
.game-help, .game-trophies { display: none; flex-direction: column; box-sizing: border-box; width: min(600px, 100%); max-height: 100%;
  padding: 20px 24px; line-height: 1.4; background: rgba(20, 16, 12, 0.92);
  border: 1px solid rgba(243, 233, 210, 0.35); border-radius: 8px; }
.game-help-body, .game-panel-body { flex: 1 1 auto; min-height: 0; overflow-y: auto; outline: none; }
.game-overlay.help .game-overlay-card, .game-overlay.trophies .game-overlay-card { display: none; }
.game-overlay.help .game-help, .game-overlay.trophies .game-trophies { display: flex; }
.game-help h2, .game-trophies h2 { margin: 0 0 8px; font-size: 22px; }
.game-help h3 { margin: 16px 0 6px; font-size: 15px; color: #f0a830; text-transform: uppercase; letter-spacing: 0.06em; }
.game-help-goal { margin: 0; }
.game-help ol, .game-help ul { margin: 0; padding-left: 22px; }
.game-help li + li { margin-top: 4px; }
.game-help-controls { border-collapse: collapse; width: 100%; }
.game-help-controls th, .game-help-controls td { padding: 4px 0; vertical-align: top; text-align: left;
  border-top: 1px solid rgba(243, 233, 210, 0.15); }
.game-help-controls th { width: 45%; padding-right: 12px; font-weight: 600; }
.game-help-back, .game-trophies-back { flex: none; display: block; margin: 16px auto 0; }
.game-overlay:not(.loading) .game-overlay-loading,
.game-overlay:not(.start) .game-start-button,
.game-overlay:not(.paused) .game-resume-button,
.game-overlay:not(.paused) .game-overlay-hub,
.game-overlay:not(.start):not(.paused) .game-help-button,
.game-overlay:not(.start):not(.paused) .game-trophies-button,
.game-overlay:not(.start):not(.paused) .game-install-button { display: none; }
.game-install-button[hidden] { display: none; }
${settings.reduceMotion ? '.game-overlay-loading span { animation: none; }' : ''}
`;
  document.head.append(style);
}
