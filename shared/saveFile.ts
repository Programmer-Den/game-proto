import { RECENT_KEY, progressKeys } from './progress';
import { SETTINGS_KEY } from './settings';
import { t } from './i18n';
import { fileEnding as ending } from './saveCodes';

/**
 * Progress files: a player exports one game's saves (the ⚙ on its card) or every game's saves and
 * the settings (the Settings panel) to a file, to keep or to carry to another device, since the
 * website and the installed app keep separate saves. A game's file ends in `.gh` and its two-letter
 * code (`apothecary-2026-10-19.ghap`, see `saveCodes.ts`), the whole hub's in plain `.gh`. The file is encrypted with
 * AES-GCM so it can't be read or edited by hand: a changed file fails to decrypt and is refused, and
 * so is another game's file. The key ships with the code, so this keeps casual editing out, not a
 * determined player.
 */
const MAGIC = 'GAMEPROTO1';
const KEY_TEXT = 'game-proto progress file, v1';
/** What a file holds: one game's progress (its folder name), or `ALL` for every game and the settings. */
export const ALL = 'gamehub';

let key: Promise<CryptoKey> | undefined;
/** The AES-GCM key progress files and progress codes (`progressCode.ts`) are sealed with. */
export function cryptoKey() {
  key ??= crypto.subtle
    .digest('SHA-256', new TextEncoder().encode(KEY_TEXT))
    .then((raw) => crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']));
  return key;
}

/** Whether storage `key` belongs in a file of `kind`, so an import never writes anything else. */
function belongs(key: string, kind: string, games: string[]) {
  const ofGame = (g: string) => key === g || key.startsWith(`${g}-`);
  return kind === ALL ? key === RECENT_KEY || key === SETTINGS_KEY || games.some(ofGame) : ofGame(kind);
}

/** The file ending for `kind`, with its dot (`saveCodes.ts`). */
export function fileEnding(kind: string) {
  return ending(kind === ALL ? undefined : kind);
}

/** What a file or code holds: its kind, when it was saved and every storage key it carries. */
export interface ProgressPayload {
  kind: string;
  saved: string;
  data: Record<string, string>;
}

/**
 * Whether storage `key` is too big for a progress code, so only files carry it: a game's saved
 * replays (`<game>-replays`) and a run under way (`<game>-run`, saved mid-fight), which would push
 * the code past what a QR code holds. A code then moves only the lasting progress.
 */
export const fileOnly = (key: string) => key.endsWith('-replays') || key.endsWith('-run');

/** The progress `kind` covers on this device, saved now; `forCode` leaves out the `fileOnly` keys. */
export function progressPayload(kind: string, games: string[], forCode = false): ProgressPayload {
  const keys = kind === ALL ? [...games.flatMap(progressKeys), RECENT_KEY, SETTINGS_KEY] : progressKeys(kind);
  const data: Record<string, string> = {};
  for (const k of keys) {
    if (forCode && fileOnly(k)) continue;
    const value = localStorage.getItem(k);
    if (value !== null) data[k] = value;
  }
  return { kind, saved: new Date().toISOString(), data };
}

/**
 * The progress of one game (`kind` is its folder name), or of every game in `games` with the hub's
 * settings (`kind` is `ALL`), as an encrypted file.
 */
export async function exportProgress(kind: string, games: string[]): Promise<Blob> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plain = new TextEncoder().encode(JSON.stringify(progressPayload(kind, games)));
  const sealed = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await cryptoKey(), plain);
  return new Blob([MAGIC, iv, sealed], { type: 'application/x-gamehub-progress' });
}

/**
 * Replaces the progress `kind` covers with a file from `exportProgress` of the same kind. Returns
 * `ok`, or, changing nothing, `invalid` when the file isn't one, is of another kind or was edited,
 * and `noSpace` when storage is full or blocked (the progress there before is put back).
 */
export async function importProgress(file: Blob, kind: string, games: string[]): Promise<'ok' | 'invalid' | 'noSpace'> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (new TextDecoder().decode(bytes.subarray(0, MAGIC.length)) !== MAGIC) return 'invalid';
  const iv = bytes.subarray(MAGIC.length, MAGIC.length + 12);
  let payload: unknown;
  try {
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, await cryptoKey(), bytes.subarray(MAGIC.length + 12));
    payload = JSON.parse(new TextDecoder().decode(plain));
  } catch {
    return 'invalid';
  }
  return writeProgress(payload, kind, games);
}

/**
 * Replaces the progress `kind` covers with the decrypted `payload` of a file or code. Returns `ok`,
 * or, changing nothing, `invalid` when it is of another kind, and `noSpace` when storage is full or
 * blocked (the progress there before is put back).
 */
export function writeProgress(payload: unknown, kind: string, games: string[]): 'ok' | 'invalid' | 'noSpace' {
  const p = payload as { kind?: unknown; data?: unknown } | null;
  if (p?.kind !== kind || !p.data || typeof p.data !== 'object') return 'invalid';
  const entries = Object.entries(p.data).filter(
    (entry): entry is [string, string] => typeof entry[1] === 'string' && belongs(entry[0], kind, games),
  );
  // Every key the import removes or writes, with its value before, to put back if a write fails.
  const removed = kind === ALL ? [...games.flatMap(progressKeys), RECENT_KEY] : progressKeys(kind);
  const before = new Map<string, string | null>();
  try {
    for (const k of [...removed, ...entries.map(([k]) => k)]) before.set(k, localStorage.getItem(k));
    for (const k of removed) localStorage.removeItem(k);
    for (const [k, value] of entries) localStorage.setItem(k, value);
  } catch {
    try {
      for (const k of before.keys()) localStorage.removeItem(k);
      for (const [k, value] of before) if (value !== null) localStorage.setItem(k, value);
    } catch {
      // Storage is blocked, so there was nothing to put back.
    }
    return 'noSpace';
  }
  return 'ok';
}

/** Hands the player the file to save, named `<game>-<date>.gh<code>` (`game-hub-progress-<date>.gh` for all). */
export function download(blob: Blob, kind: string) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  const name = kind === ALL ? 'game-hub-progress' : kind;
  link.download = `${name}-${new Date().toISOString().slice(0, 10)}${fileEnding(kind)}`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

/** Exports `kind` and hands the player the file, or says it failed. */
export async function askToExport(kind: string, games: string[]) {
  try {
    download(await exportProgress(kind, games), kind);
  } catch {
    alert(t('exportProgressFailed'));
  }
}

/**
 * Imports a progress file of `kind` once the player agrees (`title` is the game's name), then calls
 * `done`, or says the file was refused. Used by the Import buttons and by opening a progress file
 * with the installed app.
 */
export async function askToImport(file: Blob, kind: string, games: string[], title: string, done: () => void) {
  const all = kind === ALL;
  if (!confirm(all ? t('importAllConfirm') : t('importGameConfirm', { game: title }))) return;
  const result = await importProgress(file, kind, games).catch(() => 'invalid' as const);
  if (result === 'noSpace') {
    alert(t('importNoSpace'));
    return;
  }
  if (result === 'invalid') {
    alert(all ? t('importAllFailed') : t('importGameFailed', { game: title }));
    return;
  }
  done();
}

/** Asks the player for a file, then calls `picked` with it. Any file can be picked, since phones don't know these endings. */
export function pickFile(picked: (file: File) => void) {
  const input = document.createElement('input');
  input.type = 'file';
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (file) picked(file);
  });
  input.click();
}
