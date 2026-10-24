import { ALL, cryptoKey, progressPayload, writeProgress } from './saveFile';
import { SAVE_CODES } from './saveCodes';
import { formatDate, t } from './i18n';
import { qrCode, qrSvg } from './qr';

/**
 * Progress codes: the same progress a file carries (`saveFile.ts`), as a link with the data in its
 * `#p=` part, to show as a QR code that another device's camera opens, or to copy and paste. It
 * leaves out what only files carry (`fileOnly`: saved replays). The code is a format version byte,
 * the two-letter kind (the game's code from `saveCodes.ts`, `gh` for every game), a 12-byte IV and the deflated JSON sealed with AES-GCM, the first three bytes
 * included in the seal, so a code that was changed, cut short or is of another kind fails to
 * unseal. Its bytes are written as digits, 7 bytes to 17 digits, which the QR code's numeric mode
 * packs almost as tightly as raw bytes and which pass through any link unchanged.
 */
const FORMAT = 1;
const ALL_CODE = 'gh';
/** The hash that carries a code in the hub's link. */
const HASH = '#p=';
/** The largest QR code shown; denser ones are hard to scan from a screen. */
const MAX_VERSION = 25;
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

const kindCode = (kind: string) => (kind === ALL ? ALL_CODE : SAVE_CODES[kind]);

/** The hub's own address, without a query, a hash or `index.html`. */
export const hubLink = () => `${location.origin}${location.pathname.replace(/index\.html$/, '')}`;

/** The link that carries the progress `kind` covers (a game's folder name, or `ALL` for every game in `games`). */
export async function progressLink(kind: string, games: string[]) {
  const code = kindCode(kind);
  const header = new Uint8Array([FORMAT, code.charCodeAt(0), code.charCodeAt(1)]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const packed = await through(new TextEncoder().encode(JSON.stringify(progressPayload(kind, games, true))), new CompressionStream('deflate-raw'));
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
  if (bytes[0] !== FORMAT || !kind) return 'invalid';
  try {
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: bytes.subarray(3, 15), additionalData: bytes.subarray(0, 3) },
      await cryptoKey(),
      bytes.subarray(15),
    );
    const payload = JSON.parse(new TextDecoder().decode(await through(new Uint8Array(plain), new DecompressionStream('deflate-raw'))));
    return { kind, saved: String(payload?.saved ?? ''), payload };
  } catch {
    return 'invalid';
  }
}

/**
 * Shows the progress `kind` covers in the `#progress-code` dialog: its QR code, when it fits one
 * that scans easily, and its link to copy. `title` names the game, or is empty for every game.
 */
export async function showProgressCode(kind: string, games: string[], title: string) {
  const dialog = document.getElementById('progress-code') as HTMLDialogElement;
  const link = await progressLink(kind, games);
  const qr = dialog.querySelector<HTMLElement>('.qr')!;
  let fits = false;
  try {
    fits = (qrCode(link).length - 17) / 4 <= MAX_VERSION;
  } catch {
    // Too long for any QR code.
  }
  qr.hidden = !fits;
  qr.innerHTML = fits ? qrSvg(link) : '';
  dialog.querySelector('h2')!.textContent = kind === ALL ? t('progressCodeAll') : t('progressCodeGame', { game: title });
  dialog.querySelector('.lede')!.textContent = t(fits ? 'progressCodeHint' : 'progressCodeTooBig');
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
  const result = writeProgress(code.payload, code.kind, games);
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
