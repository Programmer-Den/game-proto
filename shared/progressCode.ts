import { ALL, cryptoKey, progressPayload, writeProgress } from './saveFile';
import { SAVE_CODES } from './saveCodes';
import { formatDate, t } from './i18n';
import { qrCode, qrSvg } from './qr';
import { loadSettings } from './settings';
import { pack, unpack } from './pack';

/**
 * Progress codes: the same progress a file carries (`saveFile.ts`), as a link with the data in its
 * `#p=` part, to show as a QR code that another device's camera opens, or to copy and paste. It
 * leaves out what only files carry (`fileOnly`: saved replays and a run under way), and an import keeps this device's ones. The code is a format version byte,
 * the two-letter kind (the game's code from `saveCodes.ts`, `gh` for every game), a 12-byte IV and the deflated payload sealed with AES-GCM, the first three bytes
 * included in the seal, so a code that was changed, cut short or is of another kind fails to
 * unseal. Its bytes are written as digits, 7 bytes to 17 digits, which the QR code's numeric mode
 * packs almost as tightly as raw bytes and which pass through any link unchanged. Format 2 packs
 * the payload with `pack.ts` (each stored value that is JSON as packed data, its numbers rounded to
 * six significant digits, the rest as text); format 1, still read, carried it as JSON text.
 *
 * Progress too big for one QR code is shown as a loop of smaller ones, frames that the hub's own
 * scanner (`scanner.ts`) collects: `gp:<transfer id>:<n>:<count>:<digits>`, each with one slice of
 * the digits, the transfer id telling two loops apart.
 */
const FORMAT = 2;
const ALL_CODE = 'gh';
/** The hash that carries a code in the hub's link. */
const HASH = '#p=';
/** The largest QR code shown; denser ones are hard to scan from a screen. */
const MAX_VERSION = 25;
/**
 * Digits per frame of a loop, so each frame, with its `gp:` header, stays within `MAX_VERSION`
 * (2,350 digits fit one with the longest header) like a single code.
 */
const FRAME_DIGITS = 2300;
/** The most frames a loop shows; more is quicker to copy and paste. */
const MAX_FRAMES = 40;
/** How long each frame shows, in ms, and with reduced motion. */
const FRAME_MS = 250;
const CALM_FRAME_MS = 1500;
const FRAME = /^gp:([0-9a-f]+):(\d+):(\d+):(\d+)$/;
// Digits for a last group of 0 to 7 bytes: each the fewest that hold every value of that many bytes.
const DIGITS = [0, 3, 5, 8, 10, 13, 15, 17];

function toDigits(bytes: Uint8Array) {
  let out = '';
  for (let i = 0; i < bytes.length; i += 7) {
    const group = bytes.subarray(i, i + 7);
    let n = 0n;
    for (const b of group) n = (n << 8n) | BigInt(b);
    out += n.toString().padStart(DIGITS[group.length], '0');
  }
  return out;
}

function fromDigits(digits: string): Uint8Array<ArrayBuffer> | null {
  const last = DIGITS.indexOf(digits.length % 17);
  if (last < 0) return null;
  const bytes: number[] = [];
  for (let i = 0; i < digits.length; i += 17) {
    const len = i + 17 <= digits.length ? 7 : last;
    let n = BigInt(digits.slice(i, i + 17));
    if (n >= 1n << BigInt(len * 8)) return null;
    const group: number[] = [];
    for (let j = 0; j < len; j++, n >>= 8n) group.unshift(Number(n & 0xffn));
    bytes.push(...group);
  }
  return new Uint8Array(bytes);
}

async function through(bytes: Uint8Array<ArrayBuffer>, stream: CompressionStream | DecompressionStream) {
  return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());
}

/** A stored value that JSON writes back exactly as it was, so a code can carry it packed. */
function asJson(value: string): { value: unknown } | null {
  try {
    const parsed = JSON.parse(value);
    return JSON.stringify(parsed) === value ? { value: parsed } : null;
  } catch {
    return null;
  }
}

/**
 * The progress `kind` covers, packed: when it was saved (ms since 1970), its JSON values as data
 * and the other values as text. The kind itself is in the code's header.
 */
function packPayload(kind: string, games: string[]) {
  const { saved, data } = progressPayload(kind, games, true);
  const json: Record<string, unknown> = {};
  const text: Record<string, string> = {};
  for (const [key, value] of Object.entries(data)) {
    const parsed = asJson(value);
    if (parsed) json[key] = parsed.value;
    else text[key] = value;
  }
  return pack([Date.parse(saved), json, text]);
}

/** The payload `packPayload` packed for `kind`, its data back as stored text. */
function unpackPayload(bytes: Uint8Array, kind: string) {
  const [saved, json, text] = unpack(bytes) as [number, Record<string, unknown>, Record<string, string>];
  const data: Record<string, string> = { ...text };
  for (const [key, value] of Object.entries(json)) data[key] = JSON.stringify(value);
  return { kind, saved: new Date(saved).toISOString(), data };
}

const kindCode = (kind: string) => (kind === ALL ? ALL_CODE : SAVE_CODES[kind]);

/** The hub's own address, without a query, a hash or `index.html`. */
export const hubLink = () => `${location.origin}${location.pathname.replace(/index\.html$/, '')}`;

/** The link that carries the progress `kind` covers (a game's folder name, or `ALL` for every game in `games`). */
export async function progressLink(kind: string, games: string[]) {
  const code = kindCode(kind);
  const header = new Uint8Array([FORMAT, code.charCodeAt(0), code.charCodeAt(1)]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const packed = await through(packPayload(kind, games), new CompressionStream('deflate-raw'));
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: header }, await cryptoKey(), packed));
  const bytes = new Uint8Array(header.length + iv.length + sealed.length);
  bytes.set(header);
  bytes.set(iv, header.length);
  bytes.set(sealed, header.length + iv.length);
  return `${hubLink()}${HASH}${toDigits(bytes)}`;
}

/** A code's progress, unsealed: `newer` when a later version of the hub made it, `invalid` when it isn't one or was changed. */
type Unpacked = { kind: string; saved: string; payload: unknown } | 'invalid' | 'newer';

/** Reads a progress link, or just its digits, as pasted or opened. */
export async function unpackProgress(text: string, games: string[]): Promise<Unpacked> {
  const digits = text.replace(/\s/g, '').split(HASH).at(-1)!;
  const bytes = /^\d+$/.test(digits) ? fromDigits(digits) : null;
  if (!bytes || bytes.length < 3 + 12 + 16) return 'invalid';
  if (bytes[0] > FORMAT) return 'newer';
  const code = String.fromCharCode(bytes[1], bytes[2]);
  const kind = code === ALL_CODE ? ALL : games.find((g) => SAVE_CODES[g] === code);
  if (bytes[0] < 1 || !kind) return 'invalid';
  try {
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: bytes.subarray(3, 15), additionalData: bytes.subarray(0, 3) },
      await cryptoKey(),
      bytes.subarray(15),
    );
    const inflated = await through(new Uint8Array(plain), new DecompressionStream('deflate-raw'));
    const payload = bytes[0] === 1 ? JSON.parse(new TextDecoder().decode(inflated)) : unpackPayload(inflated, kind);
    return { kind, saved: String(payload?.saved ?? ''), payload };
  } catch {
    return 'invalid';
  }
}

/** The frames of a loop for `link`, each a QR code's text. */
function frames(link: string) {
  const digits = link.split(HASH)[1];
  const id = [...crypto.getRandomValues(new Uint8Array(3))].map((b) => b.toString(16).padStart(2, '0')).join('');
  const count = Math.ceil(digits.length / FRAME_DIGITS);
  return Array.from({ length: count }, (_, i) => `gp:${id}:${i + 1}:${count}:${digits.slice(i * FRAME_DIGITS, (i + 1) * FRAME_DIGITS)}`);
}

/**
 * Collects the frames of a loop as the scanner reads them. `add` takes a QR code's text and returns
 * the whole code's digits once every frame of its loop is in, else null; `progress` says how many
 * of how many are in, or null before the first frame.
 */
export function frameCollector() {
  let id = '';
  let parts: string[] = [];
  return {
    isFrame: (text: string) => FRAME.test(text),
    add(text: string): string | null {
      const m = FRAME.exec(text);
      if (!m) return null;
      const [, from, n, count] = m;
      if (from !== id || parts.length !== Number(count)) {
        id = from;
        parts = new Array<string>(Number(count)).fill('');
      }
      if (Number(n) >= 1 && Number(n) <= parts.length) parts[Number(n) - 1] = m[4];
      return parts.every(Boolean) ? parts.join('') : null;
    },
    progress: () => (parts.length ? { n: parts.filter(Boolean).length, count: parts.length } : null),
  };
}

let looping: ReturnType<typeof setInterval> | undefined;

/**
 * Shows the progress `kind` covers in the `#progress-code` dialog: its QR code when it fits one
 * that scans easily, else a loop of frames for the hub's scanner, and its link to copy. `title`
 * names the game, or is empty for every game.
 */
export async function showProgressCode(kind: string, games: string[], title: string) {
  const dialog = document.getElementById('progress-code') as HTMLDialogElement;
  const link = await progressLink(kind, games);
  const qr = dialog.querySelector<HTMLElement>('.qr')!;
  const counter = dialog.querySelector<HTMLElement>('.frame-count')!;
  let fits = false;
  try {
    fits = (qrCode(link).length - 17) / 4 <= MAX_VERSION;
  } catch {
    // Too long for any QR code.
  }
  const loop = fits ? [] : frames(link);
  const shown = fits ? [qrSvg(link)] : loop.length <= MAX_FRAMES ? loop.map((f) => qrSvg(f)) : [];
  qr.hidden = !shown.length;
  counter.hidden = shown.length < 2;
  let i = 0;
  const show = () => {
    qr.innerHTML = shown[i] ?? '';
    counter.textContent = t('frameCount', { n: i + 1, count: shown.length });
    i = (i + 1) % Math.max(1, shown.length);
  };
  show();
  clearInterval(looping);
  if (shown.length > 1) looping = setInterval(show, loadSettings().reduceMotion ? CALM_FRAME_MS : FRAME_MS);
  dialog.querySelector('h2')!.textContent = kind === ALL ? t('progressCodeAll') : t('progressCodeGame', { game: title });
  dialog.querySelector('.lede')!.textContent = fits
    ? t('progressCodeHint')
    : shown.length
      ? t('progressCodeLoop', { count: shown.length })
      : t('progressCodeTooBig');
  dialog.querySelector('textarea')!.value = link;
  dialog.showModal();
}

/** Wires the `#progress-code` dialog's Copy code and close buttons. */
export function mountProgressCode() {
  const dialog = document.getElementById('progress-code') as HTMLDialogElement;
  const copy = dialog.querySelector<HTMLButtonElement>('.copy-code')!;
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(dialog.querySelector('textarea')!.value);
      copy.textContent = t('codeCopied');
    } catch {
      copy.textContent = t('copyFailed');
    }
    setTimeout(() => (copy.textContent = t('copyCode')), 2000);
  });
  for (const button of dialog.querySelectorAll('.close, .done')) button.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (e) => e.target === dialog && dialog.close());
  dialog.addEventListener('close', () => clearInterval(looping));
}

/**
 * Imports a progress link or code once the player agrees, then calls `done` with its kind, or says
 * it was refused. `titleOf` names a game by its folder name; `games` are every game's.
 */
export async function askToImportCode(text: string, games: string[], titleOf: (game: string) => string, done: (kind: string) => void) {
  const code = await unpackProgress(text, games);
  if (code === 'invalid' || code === 'newer') {
    alert(t(code === 'newer' ? 'importCodeNewer' : 'importCodeFailed'));
    return;
  }
  const saved = new Date(code.saved);
  const date = Number.isNaN(saved.getTime()) ? '?' : formatDate(saved, { dateStyle: 'medium', timeStyle: 'short' });
  const all = code.kind === ALL;
  if (!confirm(all ? t('importCodeAllConfirm', { date }) : t('importCodeGameConfirm', { game: titleOf(code.kind), date }))) return;
  const result = writeProgress(code.payload, code.kind, games, true);
  if (result !== 'ok') {
    alert(t(result === 'noSpace' ? 'importNoSpace' : 'importCodeFailed'));
    return;
  }
  done(code.kind);
}

/** Asks the player to paste a progress code or link, then imports it as `askToImportCode` does. */
export function askToPasteCode(games: string[], titleOf: (game: string) => string, done: (kind: string) => void) {
  const text = prompt(t('pasteCodePrompt'));
  if (text?.trim()) askToImportCode(text, games, titleOf, done);
}

/** A progress link the hub was opened with (a phone camera opens a scanned code this way), taken off the address. */
export function openedCode(): string | null {
  if (!location.hash.startsWith(HASH)) return null;
  const text = location.hash;
  history.replaceState(null, '', `${location.pathname}${location.search}`);
  return text;
}
