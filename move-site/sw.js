// The service worker of the redirect site at the hub's old address. It replaces the hub's own
// worker, which kept every game there for offline play: a browser checks the worker's file for a
// change whenever a page of the site opens, and this file is new, so it installs at once, even
// where the hub's Updates setting held updates back (that check lived in the old worker's code).
// It then deletes the old offline copies, takes over the open pages and reloads them, so an
// installed app shows the redirect page and moves its saves on. Saves live in the page's storage,
// not in these caches, so none are lost. Made by scripts/move-site.mjs.
const PREFIX = 'game-proto';
const CACHE = 'game-proto.moved';
const PAGE = './';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add(PAGE))
      .catch(() => {})
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Other sites of the same owner share the address, so only the hub's caches are touched.
      const old = (await caches.keys()).filter((k) => k.startsWith(PREFIX) && k !== CACHE);
      await Promise.all(old.map((k) => caches.delete(k)));
      await self.clients.claim();
      const windows = await self.clients.matchAll({ type: 'window' });
      await Promise.all(windows.map((w) => w.navigate(w.url).catch(() => {})));
    })(),
  );
});

// Every page is the redirect page: from the network while online, and offline from the copy kept
// at install, which then says to go online. Nothing else is served from here any more.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.mode !== 'navigate' || new URL(request.url).origin !== location.origin) return;
  event.respondWith(
    fetch(request).catch(() =>
      caches
        .open(CACHE)
        .then((cache) => cache.match(PAGE))
        .then((page) => page ?? Response.error()),
    ),
  );
});
