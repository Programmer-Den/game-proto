import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import type { Plugin } from 'vite';
import { SAVE_CODES, fileEnding } from '../shared/saveCodes';

const HUB_COLOUR = '#1b1410';

/**
 * Makes the hub and every game installable apps (PWAs) that play offline. The hub's page gets the
 * hub's manifest (`public/manifest.webmanifest`), and each game's page its own, made here from the
 * game's title and background colour, with the icons `scripts/pwa-icons.mjs` draws, so a game
 * installs from its page as an app of its own. The build also gets `sw.js`, the service worker
 * from `scripts/sw.js` with every file of the build and a hash of its content to cache, which
 * `shared/install.ts` registers.
 * The hub's built manifest lets the installed hub open progress files (`.gh`, and each game's
 * `.gh<code>` from `shared/saveCodes.ts`). `games` are the folder names; the build fails for a game
 * without a code or icons.
 */
export function pwa(games: string[]): Plugin {
  const root = resolve(import.meta.dirname, '..');
  let outDir = '';
  const gameOfPage = (path: string) => /^\/games\/([a-z0-9-]+)\/index\.html$/.exec(path)?.[1];
  return {
    name: 'game-proto-pwa',
    configResolved(config) {
      if (config.command === 'build') outDir = resolve(config.root, config.build.outDir);
    },
    buildStart() {
      const noCode = games.filter((g) => !SAVE_CODES[g]);
      if (noCode.length) this.error(`Add a progress file code to shared/saveCodes.ts for: ${noCode.join(', ')}`);
      const noIcons = games.filter((g) => !existsSync(join(root, 'public/icons/games', `${g}-512.png`)));
      if (noIcons.length) this.error(`Draw the app icons with: node scripts/pwa-icons.mjs ${noIcons.join(' ')}`);
    },
    // The dev server serves the games' manifests too.
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const game = /^\/games\/([a-z0-9-]+)\/manifest\.webmanifest$/.exec(req.url ?? '')?.[1];
        if (!game || !games.includes(game)) return next();
        res.setHeader('Content-Type', 'application/manifest+json');
        res.end(JSON.stringify(gameManifest(root, game)));
      });
    },
    transformIndexHtml(_html, ctx) {
      const game = gameOfPage(ctx.path);
      // The pages are at the root (the hub) or in games/<name>/, and links stay relative.
      return [
        { tag: 'link', attrs: { rel: 'manifest', href: './manifest.webmanifest' }, injectTo: 'head' },
        {
          tag: 'link',
          attrs: { rel: 'apple-touch-icon', href: game ? `../../icons/games/${game}-192.png` : './icons/apple-touch-icon.png' },
          injectTo: 'head',
        },
        { tag: 'meta', attrs: { name: 'theme-color', content: game ? colour(root, game) : HUB_COLOUR }, injectTo: 'head' },
      ];
    },
    closeBundle() {
      if (!outDir) return;
      const hubManifest = join(outDir, 'manifest.webmanifest');
      const manifest = JSON.parse(readFileSync(hubManifest, 'utf8'));
      manifest.file_handlers = [
        { action: './', accept: { 'application/x-gamehub-progress': [fileEnding(), ...games.map((g) => fileEnding(g))] } },
      ];
      writeFileSync(hubManifest, JSON.stringify(manifest, null, 2));
      for (const game of games) {
        const file = join(outDir, 'games', game, 'manifest.webmanifest');
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, JSON.stringify(gameManifest(root, game), null, 2));
      }

      // Every file with a hash of its content, so an update downloads only what changed.
      const files: Record<string, string> = {};
      for (const file of walk(outDir).map((f) => relative(outDir, f).split('\\').join('/')).sort()) {
        files[`./${file}`] = createHash('sha256').update(readFileSync(join(outDir, file))).digest('hex').slice(0, 16);
      }
      // The worker's own code counts too, so a change to sw.js alone still gets a new cache.
      const worker = readFileSync(join(root, 'scripts/sw.js'), 'utf8');
      const version = createHash('sha256').update(JSON.stringify(files)).update(worker).digest('hex').slice(0, 12);
      const source = worker
        .replace('__VERSION__', version)
        .replace('__FILES__', JSON.stringify(files));
      writeFileSync(join(outDir, 'sw.js'), source);
    },
  };
}

/** A game's background colour, from the styles in its index.html. */
function colour(root: string, game: string) {
  const html = readFileSync(join(root, 'games', game, 'index.html'), 'utf8');
  return /background: *(#[0-9a-fA-F]{3,6})/.exec(html)?.[1] ?? HUB_COLOUR;
}

/** A game's own web app manifest, served at games/<name>/manifest.webmanifest. */
function gameManifest(root: string, game: string) {
  const html = readFileSync(join(root, 'games', game, 'index.html'), 'utf8');
  const name = /<title>([^<]*)<\/title>/.exec(html)?.[1].trim() || game;
  const background = colour(root, game);
  // No `id`: a manifest's id resolves against the origin, not the manifest, so every app's `./`
  // would be the same id and only one could be installed. Without it the id is the start_url.
  return {
    name,
    short_name: name,
    start_url: './',
    scope: './',
    display: 'standalone',
    background_color: background,
    theme_color: background,
    icons: [192, 512].map((size) => ({
      src: `../../icons/games/${game}-${size}.png`,
      sizes: `${size}x${size}`,
      type: 'image/png',
      purpose: 'any maskable',
    })),
  };
}

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? walk(join(dir, d.name)) : d.name === 'sw.js' ? [] : [join(dir, d.name)],
  );
}
