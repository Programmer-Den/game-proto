// Makes the redirect site for the hub's old address, for when the site moves (see
// move-site/README.md): `node scripts/move-site.mjs [new address] [folder]`. The new address is
// the hub's full address after the move, ending in a slash; without one it comes from
// move-site/config.json (`newHome`). It writes index.html and 404.html (the same page, so every old
// address forwards), sw.js and favicon.svg into the folder (dist-move/ by default), ready to push
// to the repo that serves the old address.
import { copyFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const config = JSON.parse(readFileSync(join(root, 'move-site/config.json'), 'utf8'));
const newHome = process.argv[2] ?? config.newHome;
const out = resolve(process.argv[3] ?? join(root, 'dist-move'));

if (!newHome || !/^https?:\/\/[^/]+\/(.*\/)?$/.test(newHome)) {
  console.error('Give the hub\'s new address, ending in a slash, like https://example.github.io/game-proto/ (or set newHome in move-site/config.json).');
  process.exit(1);
}
const games = readdirSync(join(root, 'games'), { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

const page = readFileSync(join(root, 'move-site/index.html'), 'utf8')
  .replaceAll('__NEW_HOME__', newHome)
  .replaceAll('__OLD_HOME__', config.oldHome)
  .replace('__GAMES__', JSON.stringify(games));
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'index.html'), page);
writeFileSync(join(out, '404.html'), page);
copyFileSync(join(root, 'move-site/sw.js'), join(out, 'sw.js'));
copyFileSync(join(root, 'favicon.svg'), join(out, 'favicon.svg'));
console.log(`Redirect site for ${newHome} written to ${out}`);
