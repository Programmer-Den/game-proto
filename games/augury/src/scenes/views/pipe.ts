import { E, N, S, W, pipeTap, watered, type PipeState } from '../../game/puzzles/pipe';
import { t } from '../../i18n';
import { C } from '../theme';
import { fitGrid, type PuzzleView } from './types';

export const pipeView: PuzzleView<PipeState> = {
  draw(ctx) {
    const { p, s, r } = ctx;
    const n = s.size;
    const { cell, x, y } = fitGrid({ ...r, w: r.w - 140 }, n, n, 72);
    const g = p.g;
    const wet = watered(s);
    const houses = new Set(s.houses);
    const width = Math.max(4, cell * 0.2);
    for (let k = 0; k < n * n; k++) {
      const left = x + (k % n) * cell;
      const top = y + Math.floor(k / n) * cell;
      const cx = left + cell / 2;
      const cy = top + cell / 2;
      g.fillStyle(C.deep, 1).fillRect(left + 1, top + 1, cell - 2, cell - 2);
      g.lineStyle(1, C.line, 0.7).strokeRect(left + 1, top + 1, cell - 2, cell - 2);
      const m = s.tiles[k];
      const color = wet.has(k) ? C.cyan : C.gold;
      const half = cell / 2;
      g.fillStyle(color, wet.has(k) ? 1 : 0.75);
      if (m & N) g.fillRect(cx - width / 2, top, width, half);
      if (m & S) g.fillRect(cx - width / 2, cy, width, half);
      if (m & W) g.fillRect(left, cy - width / 2, half, width);
      if (m & E) g.fillRect(cx, cy - width / 2, half, width);
      g.fillCircle(cx, cy, width * 0.75);
      if (k === s.well) {
        // The well: a ring of stone round the water.
        g.fillStyle(C.cyan, 1).fillCircle(cx, cy, cell * 0.26);
        g.lineStyle(3, C.goldBright, 1).strokeCircle(cx, cy, cell * 0.26);
      } else if (houses.has(k)) {
        // A house: a roof over a square, lit when the water reaches it.
        const hs = cell * 0.22;
        const lit = wet.has(k);
        g.fillStyle(lit ? C.cyan : C.panel, 1).fillRect(cx - hs, cy - hs * 0.4, hs * 2, hs * 1.4);
        g.fillStyle(lit ? C.goldBright : C.gold, 1).fillTriangle(cx - hs * 1.3, cy - hs * 0.4, cx + hs * 1.3, cy - hs * 0.4, cx, cy - hs * 1.5);
        g.lineStyle(1.5, lit ? C.goldBright : C.gold, 1).strokeRect(cx - hs, cy - hs * 0.4, hs * 2, hs * 1.4);
      }
      p.hit(`cell-${k}`, left, top, cell, cell, () => ctx.act((st) => pipeTap(st, k)));
    }
    const sx = r.x + r.w - 70;
    const reached = s.houses.filter((h) => wet.has(h)).length;
    p.text(sx, r.y + r.h / 2 - 40, `${reached}/${s.houses.length}`, { size: 30, color: C.goldText });
    p.text(sx, r.y + r.h / 2 - 10, t('pipeHouses'), { size: 13, color: C.inkDim });
    p.text(sx, r.y + r.h / 2 + 34, String(s.taps), { size: 38, color: C.goldText });
    p.text(sx, r.y + r.h / 2 + 64, t('pipeTaps'), { size: 13, color: C.inkDim });
  },
};
