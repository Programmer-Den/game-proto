import { type Move, type Position, moveText } from './chess';
import type { DeepLevel } from './deep';
import { type ThinkReply, think } from './aiWorker';

/**
 * Runs the deep search for the position in a web worker and resolves with its move. Where a worker
 * can't start, it searches on the page instead (the page then stands still while it thinks).
 */

let worker: Worker | null | undefined;
let next = 0;
const waiting = new Map<number, (reply: ThinkReply) => void>();

function getWorker() {
  if (worker !== undefined) return worker;
  try {
    worker = new Worker(new URL('./aiWorker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<ThinkReply>) => {
      waiting.get(e.data.id)?.(e.data);
      waiting.delete(e.data.id);
    };
    worker.onerror = () => {
      // It failed to load: answer everything waiting on the page, and stop using it.
      worker?.terminate();
      worker = null;
      for (const [id, done] of waiting) done({ id, move: null });
      waiting.clear();
    };
  } catch {
    worker = null;
  }
  return worker;
}

export async function thinkDeep(pos: Position, level: DeepLevel): Promise<Move | undefined> {
  const req = { id: ++next, moves: pos.history.map((u) => moveText(u.move)), level, seed: Math.floor(Math.random() * 2 ** 31) };
  const w = getWorker();
  let reply: ThinkReply | null = null;
  if (w) {
    reply = await new Promise<ThinkReply>((done) => {
      waiting.set(req.id, done);
      w.postMessage(req);
    });
  }
  // No worker, or it failed: search here.
  if (!reply?.move) reply = think(req);
  return reply.move ? pos.findMove(reply.move) : undefined;
}
