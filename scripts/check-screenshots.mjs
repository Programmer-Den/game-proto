// Checks the images a PR adds or changes against the screenshot rules in AGENTS.md:
// - a screenshot (any image under a docs/screenshots/ folder) is a .webp of at most 200 KB,
// - any other image is at most 500 KB,
// - no image is wider or taller than 1280 pixels,
// - a PR adds at most 4 new screenshots (a screenshot that replaces one under the same name,
//   in any format, is not new).
//
//   node scripts/check-screenshots.mjs <base-commit>
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const SCREENSHOT_KB = 200;
const IMAGE_KB = 500;
const MAX_SIDE = 1280;
const MAX_NEW_SCREENSHOTS = 4;

const base = process.argv[2];
if (!base) {
  console.error('Usage: node scripts/check-screenshots.mjs <base-commit>');
  process.exit(1);
}

// Width and height from the file header, for the formats a screenshot can come in.
function size(buf) {
  const ascii = (at, n) => buf.toString('latin1', at, at + n);
  if (ascii(1, 3) === 'PNG') return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
  if (ascii(0, 3) === 'GIF') return [buf.readUInt16LE(6), buf.readUInt16LE(8)];
  if (ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') {
    const chunk = ascii(12, 4);
    if (chunk === 'VP8 ') return [buf.readUInt16LE(26) & 0x3fff, buf.readUInt16LE(28) & 0x3fff];
    if (chunk === 'VP8L') {
      const bits = buf.readUInt32LE(21);
      return [(bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1];
    }
    if (chunk === 'VP8X') return [buf.readUIntLE(24, 3) + 1, buf.readUIntLE(27, 3) + 1];
  }
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    for (let at = 2; at + 9 < buf.length; ) {
      const marker = buf[at + 1];
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return [buf.readUInt16BE(at + 7), buf.readUInt16BE(at + 5)];
      }
      at += 2 + buf.readUInt16BE(at + 2);
    }
  }
  return null;
}

const isImage = (path) => /\.(png|jpe?g|gif|webp)$/i.test(path);
const isScreenshot = (path) => /(^|\/)docs\/screenshots\//.test(path);
const stem = (path) => path.replace(/\.[^./]+$/, '');

// Diff from the merge base (three dots), so changes main made since the branch was cut don't count.
// -z prints each status and path as NUL-terminated fields and never quotes unusual path names.
const fields = execFileSync('git', ['diff', '-z', '--name-status', '--no-renames', `${base}...HEAD`], {
  encoding: 'utf8',
}).split('\0');
const changes = [];
for (let i = 0; i + 1 < fields.length; i += 2) {
  if (isImage(fields[i + 1])) changes.push([fields[i], fields[i + 1]]);
}

const errors = [];
const deleted = new Set(changes.filter(([s]) => s === 'D').map(([, path]) => stem(path)));
const added = [];
for (const [status, path] of changes) {
  if (status === 'D') continue;
  const buf = readFileSync(path);
  const kb = Math.round(buf.length / 1024);
  const dims = size(buf);
  const shot = isScreenshot(path);
  console.log(`${status} ${path}: ${kb} KB, ${dims ? dims.join('x') : 'unknown size'}`);
  if (shot && !/\.webp$/i.test(path)) {
    errors.push(`${path} is a screenshot, so save it as WebP: npm run screenshots -- ${path}`);
  }
  const limit = shot ? SCREENSHOT_KB : IMAGE_KB;
  if (kb > limit) errors.push(`${path} is ${kb} KB, over the ${limit} KB limit`);
  if (!dims) errors.push(`${path}: could not read its size`);
  else if (Math.max(...dims) > MAX_SIDE) errors.push(`${path} is ${dims.join('x')}, over ${MAX_SIDE} pixels`);
  if (shot && status === 'A' && !deleted.has(stem(path))) added.push(path);
}
if (added.length > MAX_NEW_SCREENSHOTS) {
  errors.push(
    `This PR adds ${added.length} new screenshots; keep it to ${MAX_NEW_SCREENSHOTS} (show only what the PR adds, ` +
      'reuse or replace existing ones under the same name)',
  );
}

if (errors.length) {
  for (const error of errors) console.log(`::error::${error}`);
  process.exit(1);
}
console.log(`OK: ${changes.length} image change(s), ${added.length} new screenshot(s)`);
