import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { pwa } from './scripts/pwa';
import { gameDates } from './scripts/gameDates';

// The hub page and every game in games/<name>/index.html are built together into dist/, with
// the hub at the root and each game under games/<name>/.
const games = readdirSync(resolve(import.meta.dirname, 'games'), { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

// Relative base so the build works on GitHub Pages and inside Capacitor/Tauri wrappers.
export default defineConfig({
  base: './',
  plugins: [pwa(games)],
  // Each game's added and last updated dates, for shared/gameDates.ts.
  define: { __GAME_DATES__: JSON.stringify(gameDates(games)) },
  build: {
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      input: {
        hub: resolve(import.meta.dirname, 'index.html'),
        ...Object.fromEntries(games.map((g) => [g, resolve(import.meta.dirname, 'games', g, 'index.html')])),
      },
    },
  },
});
