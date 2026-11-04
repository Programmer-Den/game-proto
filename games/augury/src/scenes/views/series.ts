import { SERIES_WRONG, seriesPick, type SeriesState } from '../../game/puzzles/series';
import { formatNumber } from '../../../../../shared/i18n';
import { t } from '../../i18n';
import { C } from '../theme';
import type { PuzzleView } from './types';

export const seriesView: PuzzleView<SeriesState> = {
  draw(ctx) {
    const { p, s, r } = ctx;
    const g = p.g;
    const rowH = Math.min(64, Math.floor((r.h - 120) / s.rows.length));
    // The rows: answered ones show their answer, the one in play a question mark, the rest wait.
    s.rows.forEach((row, k) => {
      const cy = r.y + 20 + k * rowH + rowH / 2;
      const terms = [...row.terms.map((n) => formatNumber(n)), k < s.at ? formatNumber(row.answer) : '?'];
      const box = Math.min(84, (r.w - 20) / terms.length);
      const x0 = r.x + (r.w - box * terms.length) / 2;
      terms.forEach((text, i) => {
        const cx = x0 + i * box + box / 2;
        const last = i === terms.length - 1;
        if (last) g.lineStyle(1.5, k === s.at ? C.cyan : C.line, 1).strokeRect(cx - box / 2 + 4, cy - rowH / 2 + 6, box - 8, rowH - 12);
        p.text(cx, cy, k > s.at && !last ? '·' : text, { size: 20, color: k < s.at ? C.cyanText : k === s.at ? C.goldText : C.inkDim, bold: last });
      });
    });
    // The four options for the row in play.
    const row = s.rows[s.at];
    const by = r.y + r.h - 44;
    if (row) {
      const w = Math.min(120, (r.w - 40) / 4);
      row.options.forEach((n, i) => {
        const cx = r.x + r.w / 2 + (i - 1.5) * (w + 10);
        p.button(`option-${i}`, cx, by, w, 44, formatNumber(n), () => ctx.act((st) => seriesPick(st, i)), { enabled: !s.struck.includes(i) });
      });
    }
    p.text(r.x + r.w / 2, by - 40, t('seriesWrong', { n: SERIES_WRONG - s.wrong }), { size: 13, color: C.inkDim });
  },
};
