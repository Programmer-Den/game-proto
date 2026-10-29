import { cryptoKey } from './saveFile';
import { SAVE_CODES } from './saveCodes';
import { SETTINGS_KEY } from './settings';

/**
 * Taking in the saves of the site's old address, once the site has moved. Saves live in the
 * browser under the site's address, so a move leaves them behind. The redirect site left at the
 * old address (`move-site/`, made by `scripts/move-site.mjs`) reads them there and opens
 * `move.html` here with them in its `#move=` part, as base64url of a format byte (1 deflated, 0
 * not), a 12-byte IV and the JSON `{ to, data }` sealed with AES-GCM under the progress files' key
 * (`saveFile.ts`), the format byte included in the seal. `to` is where the player was headed,
 * relative to the hub, and `data` the old address's storage keys of the games and the hub.
 *
 * Nothing newer here is overwritten: a game takes the old saves only when it has nothing saved
 * here yet, and a hub key (`hub-...`) only when it is missing, except that lists (favourites,
 * recently played) gain the old entries they lack and maps (time played) the old entries they
 * lack. So opening an old link again later fills in only games never played here.
 */
const HASH = '#move=';
const SEAL = new TextEncoder().encode('game-proto move');

const isHubKey = (key: string) => key.startsWith('hub-');
const gameOfKey = (key: string) => Object.keys(SAVE_CODES).find((g) => key === g || key.startsWith(`${g}-`));

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> | null {
  try {
    const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(binary, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

/** The handover in `hash`, unsealed, or null when it isn't one or was changed. */
export async function unpackMove(hash: string): Promise<{ to: string; data: Record<string, string> } | null> {
  if (!hash.startsWith(HASH)) return null;
  const bytes = fromBase64Url(hash.slice(HASH.length));
  if (!bytes || bytes.length < 1 + 12 + 16 || bytes[0] > 1) return null;
  try {
    const additionalData = new Uint8Array([...SEAL, bytes[0]]);
    const plain = new Uint8Array(
      await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.subarray(1, 13), additionalData }, await cryptoKey(), bytes.subarray(13)),
    );
    const text = bytes[0] === 1 ? await new Response(new Blob([plain]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text() : new TextDecoder().decode(plain);
    const payload: unknown = JSON.parse(text);
    if (!payload || typeof payload !== 'object') return null;
    const { to, data } = payload as { to?: unknown; data?: unknown };
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
    const kept = Object.entries(data).filter((e): e is [string, string] => typeof e[1] === 'string' && (isHubKey(e[0]) || !!gameOfKey(e[0])));
    return { to: typeof to === 'string' ? to : '', data: Object.fromEntries(kept) };
  } catch {
    return null;
  }
}

/**
 * A stored hub value with the old one's missing entries added: lists and maps merge, anything else
 * (the settings, the sort) stays as it is, since a player who set it here meant it.
 */
function mergeHubValue(key: string, mine: string, old: string) {
  if (key === SETTINGS_KEY) return mine;
  try {
    const a: unknown = JSON.parse(mine);
    const b: unknown = JSON.parse(old);
    if (Array.isArray(a) && Array.isArray(b)) return JSON.stringify([...a, ...b.filter((x) => !a.some((y) => JSON.stringify(y) === JSON.stringify(x)))]);
    const isMap = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
    if (isMap(a) && isMap(b)) return JSON.stringify({ ...b, ...a });
  } catch {
    // Not JSON, so this device's value stays.
  }
  return mine;
}

/**
 * Writes the old address's `data` where it fills a gap here (see above). Each game goes in whole or
 * not at all: a game that doesn't fit in storage is put back as it was and the rest go on. Returns
 * the games that took the old saves.
 */
export function takeOldSaves(data: Record<string, string>): string[] {
  const byGame = new Map<string, [string, string][]>();
  const hub: [string, string][] = [];
  for (const entry of Object.entries(data)) {
    const game = gameOfKey(entry[0]);
    if (game) byGame.set(game, [...(byGame.get(game) ?? []), entry]);
    else if (isHubKey(entry[0])) hub.push(entry);
  }
  let here: string[];
  try {
    here = Object.keys(localStorage);
  } catch {
    // Storage is blocked, so there is nowhere to put them.
    return [];
  }
  const taken: string[] = [];
  for (const [game, entries] of byGame) {
    if (here.some((k) => gameOfKey(k) === game)) continue;
    try {
      for (const [k, v] of entries) localStorage.setItem(k, v);
      taken.push(game);
    } catch {
      for (const [k] of entries) localStorage.removeItem(k);
    }
  }
  for (const [k, old] of hub) {
    try {
      const mine = localStorage.getItem(k);
      localStorage.setItem(k, mine === null ? old : mergeHubValue(k, mine, old));
    } catch {
      // Storage is full; the hub's own keys are conveniences, so the move goes on without them.
    }
  }
  return taken;
}

/**
 * Where the player was headed, as an address under the hub (`root`), or the hub itself when `to`
 * leads anywhere else.
 */
export function moveTarget(to: string, root: string) {
  try {
    const url = new URL(to, root);
    if (url.origin === new URL(root).origin && url.pathname.startsWith(new URL(root).pathname)) return url.href;
  } catch {
    // Not an address.
  }
  return root;
}

/** Takes in the saves `move.html` was opened with, then goes on to where the player was headed. */
export async function receiveMove() {
  const root = new URL('./', location.href).href;
  const hash = location.hash;
  history.replaceState(null, '', location.pathname);
  const move = await unpackMove(hash);
  if (move) takeOldSaves(move.data);
  location.replace(moveTarget(move?.to ?? '', root));
}
