// Checks every translation against its British English source: each `i18n/en.ts` in `shared/`, a
// game's `src/` or its `src/trophies/` and the language files next to it (`de.ts`, `en-US.ts`). `npm run build` already
// fails on a missing or extra key; this catches what the types can't:
// - a text whose placeholders (`{n}`, `{name}`) differ from the English one,
// - a plain text where English has plural forms, or the other way round,
// - a text left the same as English, unless the file lists it in `keepEnglish`
//   (US English only lists the texts that differ, so it may leave any key out),
// - a `keepEnglish` entry whose text no longer matches English.
// A text much longer than its English one gets a warning, since it may not fit its button or panel.
//
// Run: node scripts/check-translations.mjs (Node 22.18 or later reads the .ts files as they are).
import { readdirSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = join(import.meta.dirname, '..');
/** A text this many times longer than its English one, and at least `LONG_MIN` characters, gets a warning. */
const LONG_RATIO = 1.5;
const LONG_MIN = 16;

const dirs = [join(ROOT, 'shared', 'i18n')];
// A game's trophy texts are a set of their own (shared/trophies.ts), so the hub can load them alone.
for (const game of readdirSync(join(ROOT, 'games'))) dirs.push(join(ROOT, 'games', game, 'src', 'i18n'), join(ROOT, 'games', game, 'src', 'trophies', 'i18n'));

let errors = 0;
let warnings = 0;
const report = (kind, file, message) => {
  const path = relative(ROOT, file);
  if (kind === 'error') errors++;
  else warnings++;
  // GitHub annotations on the PR's files when run in a workflow, plain lines otherwise.
  console.log(process.env.GITHUB_ACTIONS ? `::${kind} file=${path}::${message}` : `${kind}: ${path}: ${message}`);
};

const placeholders = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
const forms = (text) => (typeof text === 'string' ? { text } : text);

for (const dir of dirs.filter((d) => existsSync(join(d, 'en.ts')))) {
  const en = (await import(pathToFileURL(join(dir, 'en.ts')).href)).default;
  for (const name of readdirSync(dir).filter((f) => f.endsWith('.ts') && f !== 'en.ts')) {
    const file = join(dir, name);
    const mod = await import(pathToFileURL(file).href);
    const texts = mod.default;
    const keep = new Set(mod.keepEnglish ?? []);
    // US English only lists the texts it spells differently.
    const partial = name.startsWith('en-');
    for (const key of Object.keys(texts)) if (!(key in en)) report('error', file, `"${key}" is not in en.ts`);
    for (const key of keep) {
      if (!(key in en)) report('error', file, `keepEnglish lists "${key}", which is not in en.ts`);
      else if (JSON.stringify(texts[key]) !== JSON.stringify(en[key])) report('error', file, `keepEnglish lists "${key}", but its text differs from English`);
    }
    for (const [key, source] of Object.entries(en)) {
      const text = texts[key];
      if (text === undefined) {
        if (!partial) report('error', file, `"${key}" is missing`);
        continue;
      }
      if (typeof text !== typeof source) {
        report('error', file, `"${key}" must be ${typeof source === 'string' ? 'a plain text' : 'plural forms { one, other }'} like the English one`);
        continue;
      }
      if (JSON.stringify(text) === JSON.stringify(source) && !keep.has(key)) {
        report('error', file, `"${key}" is the same as English; translate it, or add it to keepEnglish if that is right`);
      }
      const from = forms(source);
      const to = forms(text);
      for (const form of Object.keys(from)) {
        if (typeof to[form] !== 'string') {
          report('error', file, `"${key}" is missing its "${form}" form`);
          continue;
        }
        if (placeholders(to[form]) !== placeholders(from[form])) {
          report('error', file, `"${key}" has placeholders {${placeholders(to[form])}} where English has {${placeholders(from[form])}}`);
        }
        if (to[form].length >= LONG_MIN && to[form].length > LONG_RATIO * from[form].length) {
          report('warning', file, `"${key}" is ${Math.round((100 * to[form].length) / from[form].length)}% as long as English; check that it fits`);
        }
      }
    }
  }
}

console.log(`Translations: ${errors} error(s), ${warnings} warning(s).`);
process.exit(errors ? 1 : 0);
