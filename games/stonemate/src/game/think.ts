import { type Move, type Position, moveText } from './chess';
import type { DeepLevel } from './deep';
import { type ThinkReply, type ThinkRequest, think } from './aiWorker';
import type { Style } from './rivals';

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

/** Sends `req` to the worker, or answers it on the page when there is none or it failed. */
async function ask(req: ThinkRequest): Promise<ThinkReply> {
  const w = getWorker();
  let reply: ThinkReply | null = null;
  if (w) {
    reply = await new Promise<ThinkReply>((done) => {
      waiting.set(req.id, done);
      w.postMessage(req);
    });
  }
  // No worker, or it failed: search here.
  if (!reply || (reply.move === null && reply.score === undefined)) reply = think(req);
  return reply;
}

/** The position's start as FEN and its moves as text, as the worker plays them out. */
function game(pos: Position) {
  return { start: pos.start, moves: pos.history.map((u) => moveText(u.move)) };
}

export async function thinkDeep(pos: Position, level: DeepLevel, style?: Style): Promise<Move | undefined> {
  const reply = await ask({ id: ++next, kind: 'move', ...game(pos), level, seed: Math.floor(Math.random() * 2 ** 31), style });
  return reply.move ? pos.findMove(reply.move) : undefined;
}

/** The best move (as `e2e4` text) and the score for the side to move, for the game review. */
export async function analyse(pos: Position, level: DeepLevel): Promise<{ move: string | null; score: number }> {
  const reply = await ask({ id: ++next, kind: 'analyse', ...game(pos), level, seed: 0 });
  return { move: reply.move, score: reply.score ?? 0 };
}
