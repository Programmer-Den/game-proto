import { Position, moveText } from './chess';
import { type DeepLevel, chooseMoveDeep } from './deep';

/**
 * The web worker the deep search runs in, so the page keeps drawing while the Stone AI thinks on
 * its top levels. It gets the game as its moves, plays them out and answers with its move as text.
 */

export interface ThinkRequest {
  id: number;
  moves: string[];
  level: DeepLevel;
  /** Seeds the shuffle of equal moves, picked by the page's Math.random. */
  seed: number;
}
export interface ThinkReply {
  id: number;
  move: string | null;
}

/** A small seeded generator, so a seed from the page decides the shuffle. */
export function seeded(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Plays out `moves` and returns the deep search's answer as `e2e4` text. */
export function think(req: ThinkRequest): ThinkReply {
  const pos = new Position();
  for (const text of req.moves) {
    const m = pos.findMove(text);
    if (!m) break;
    pos.make(m);
  }
  const m = chooseMoveDeep(pos, req.level, seeded(req.seed));
  return { id: req.id, move: m ? moveText(m) : null };
}

const scope = globalThis as unknown as { postMessage?: (reply: ThinkReply) => void; document?: unknown };
// Only inside a worker (no document): the page imports `think` from here for its fallback too.
if (!scope.document && scope.postMessage) {
  addEventListener('message', (e) => scope.postMessage!(think((e as MessageEvent<ThinkRequest>).data)));
}
