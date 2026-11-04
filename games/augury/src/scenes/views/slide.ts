import { slideTap, type SlideState } from '../../game/puzzles/slide';
import { t } from '../../i18n';
import { C } from '../theme';
import { fitGrid, type PuzzleView } from './types';

export const slideView: PuzzleView<SlideState> = {
  draw(ctx) {
    const { p, s, r } = ctx;
    const n = s.size;
    const { cell, x, y } = fitGrid({ ...r, w: r.w - 140 }, n, n, 80);
    const g = p.g;
    for (let k = 0; k < n * n; k++) {
      const left = x + (k % n) * cell;
      const top = y + Math.floor(k / n) * cell;
      const tile = s.tiles[k];
      if (tile === 0) {
        g.lineStyle(1, C.line, 0.6).strokeRect(left + 3, top + 3, cell - 6, cell - 6);
      } else {
        const home = tile === k + 1;
        p.frame(left + 3, top + 3, cell - 6, cell - 6, { fill: home ? C.key : C.deep, alpha: 1, inner: false });
        p.text(left + cell / 2, top + cell / 2, String(tile), { size: Math.round(cell * 0.38), color: home ? C.cyanText : C.goldText, bold: true });
      }
      p.hit(`cell-${k}`, left, top, cell, cell, () => ctx.act((st) => slideTap(st, k)));
    }
    const sx = r.x + r.w - 70;
    const home = s.tiles.filter((v, i) => v !== 0 && v === i + 1).length;
    p.text(sx, r.y + r.h / 2 - 40, `${home}/${n * n - 1}`, { size: 30, color: C.goldText });
    p.text(sx, r.y + r.h / 2 - 10, t('slideHome'), { size: 13, color: C.inkDim });
    p.text(sx, r.y + r.h / 2 + 34, String(s.moves), { size: 38, color: C.goldText });
    p.text(sx, r.y + r.h / 2 + 64, t('slideMoves'), { size: 13, color: C.inkDim });
  },
};
