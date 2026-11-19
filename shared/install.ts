import { t } from './i18n';
import { gameOf } from './playCount';
import { settings, type UpdateMode } from './settings';

/**
 * Installing the hub as an app (a PWA). The build's service worker (`scripts/pwa.ts`) caches every
 * game for offline play; the hub and every game register it, so a player who only ever opened one
 * game can still play the rest offline once it has loaded. Only the built site registers it, never
 * the dev server or browser automation, so tests always load fresh files.
 */
export function registerServiceWorker() {
  if (!import.meta.env.PROD || navigator.webdriver || !('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register(`${root()}sw.js`, { scope: root() }).catch(() => {});
  shareUpdates(settings.updates);
  // An installed app asks the browser to keep its saves even when the device runs low on space.
  // Asking from a browser tab would show a prompt in some browsers, so only the app asks.
  if (installed()) navigator.storage?.persist?.().catch(() => {});
}

/** The hub's folder, where the service worker lives, relative to this page. */
function root() {
  return gameOf(location.pathname) ? '../../' : './';
}

/**
 * The service worker can't read the settings, so the Updates setting is also kept where it can:
 * in a cache of its own, which every page refreshes as it opens and the Settings panel on a change.
 * An `update-now` entry there (the time it was asked) lets the next update through whatever the
 * setting says; the worker uses it up and ignores it after a few minutes. See `scripts/sw.js`.
 */
const UPDATES_CACHE = 'game-proto.updates';
const updatesKey = (name: string) => new URL(`${root()}${name}`, location.href).href;

export function shareUpdates(mode: UpdateMode) {
  if (!('caches' in window)) return;
  caches
    .open(UPDATES_CACHE)
    .then((cache) => cache.put(updatesKey('updates'), new Response(mode)))
    .catch(() => {});
}

/**
 * Downloads a new version now, whatever the Updates setting says: `updated` once it is in place
 * (reload the page to show it), `current` when there is none, `failed` when it couldn't download,
 * and `none` when no service worker is installed (the dev server, browser automation, a browser
 * without service workers or a registration that failed), so there is nothing to update.
 */
export async function updateNow(): Promise<'updated' | 'current' | 'failed' | 'none'> {
  if (!('serviceWorker' in navigator)) return 'none';
  const registration = await navigator.serviceWorker.getRegistration(root()).catch(() => undefined);
  if (!registration) return 'none';
  // Storage full or Cache Storage blocked: the worker can't be told to let the update through.
  let cache: Cache;
  try {
    cache = await caches.open(UPDATES_CACHE);
    await cache.put(updatesKey('update-now'), new Response(String(Date.now())));
  } catch {
    return 'failed';
  }
  try {
    await registration.update();
    const worker = registration.installing ?? registration.waiting;
    if (!worker) return 'current';
    return await new Promise((resolve) => {
      const done = () => {
        if (worker.state === 'activated') resolve('updated');
        else if (worker.state === 'redundant') resolve('failed');
      };
      worker.addEventListener('statechange', done);
      done();
    });
  } catch {
    return 'failed';
  } finally {
    await cache.delete(updatesKey('update-now')).catch(() => false);
  }
}

/** Whether the page runs as the installed app rather than in a browser tab. */
export function installed() {
  return matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
}

/** Chromium's install prompt, which it offers once the page can be installed. */
interface InstallPrompt extends Event {
  prompt(): Promise<unknown>;
}

/**
 * Shows an Install button where the page can be installed: browsers built on Chromium offer their
 * install prompt, and on iPhones and iPads the button explains Add to Home Screen. With `always`
 * (a game opened with `?install` from the ⚙ on its hub card) it shows in every browser, and where
 * there is no prompt it says how to install from the browser's menu. In the installed app it stays
 * hidden, except with `always`, where it says to open the game in the browser to install it. The hub
 * has one next to Settings, and every game one on its start and pause screens.
 */
export function mountInstallButton(button: HTMLButtonElement, always = false) {
  if (installed()) {
    if (!always) return;
    button.hidden = false;
    button.addEventListener('click', () => alert(t('installInsideAppHint')));
    return;
  }
  let offer: InstallPrompt | undefined;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    offer = e as InstallPrompt;
    button.hidden = false;
  });
  window.addEventListener('appinstalled', () => {
    offer = undefined;
    button.hidden = true;
  });
  const apple = /iPad|iPhone|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
  if (apple || always) button.hidden = false;
  button.addEventListener('click', async () => {
    if (!offer) {
      alert(t(apple ? 'installAppHint' : 'installAppMenuHint'));
      return;
    }
    await offer.prompt();
    offer = undefined;
    button.hidden = true;
  });
}

/** The files the installed app was opened with, in browsers that let an app open files. */
interface LaunchQueue {
  setConsumer(consumer: (params: { files: { getFile(): Promise<File> }[] }) => void): void;
}

/**
 * Calls `open` with a `.gh` progress file the player opened with the installed app (the
 * manifest's `file_handlers`; desktop browsers built on Chromium support it).
 */
export function onOpenFile(open: (file: File) => void) {
  const queue = (window as { launchQueue?: LaunchQueue }).launchQueue;
  queue?.setConsumer(async ({ files }) => {
    if (files[0]) open(await files[0].getFile());
  });
}
