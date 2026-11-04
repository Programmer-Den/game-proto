import { beamTap, mirrorsLeft, trace, type BeamState } from '../../game/puzzles/beam';
import { t } from '../../i18n';
import { C } from '../theme';
import { fitGrid, type PuzzleView } from './types';

const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];

export const beamView: PuzzleView<BeamState> = {
  draw(ctx) {
    const { p, s, r } = ctx;
    const n = s.size;
    // A cell's margin round the board leaves room for the lamp at the edge.
    const { cell, x, y } = fitGrid({ ...r, w: r.w - 140 }, n + 1, n + 1, 60);
    const ox = x + cell / 2;
    const oy = y + cell / 2;
    const g = p.g;
    const centre = (k: number) => ({ x: ox + (k % n) * cell + cell / 2, y: oy + Math.floor(k / n) * cell + cell / 2 });
    const { cells, lit, exit } = trace(s);
    for (let k = 0; k < n * n; k++) {
      const { x: cx, y: cy } = centre(k);
      g.fillStyle(C.deep, 1).fillRect(cx - cell / 2 + 1, cy - cell / 2 + 1, cell - 2, cell - 2);
      g.lineStyle(1, C.line, 0.7).strokeRect(cx - cell / 2 + 1, cy - cell / 2 + 1, cell - 2, cell - 2);
      p.hit(`cell-${k}`, cx - cell / 2, cy - cell / 2, cell, cell, () => ctx.act((st) => beamTap(st, k)));
    }
    // The beam: from the lamp outside the board, through each cell's centre, out at the far edge.
    const start = centre(s.entry);
    const lamp = { x: start.x - DX[s.dir] * cell * 0.75, y: start.y - DY[s.dir] * cell * 0.75 };
    const last = centre(cells[cells.length - 1]);
    const pts = [lamp, ...cells.map(centre), { x: last.x + DX[exit] * cell * 0.6, y: last.y + DY[exit] * cell * 0.6 }];
    for (const [w, a] of [[8, 0.18], [3, 1]] as const) {
      g.lineStyle(w, C.goldBright, a).beginPath().moveTo(pts[0].x, pts[0].y);
      for (const pt of pts.slice(1)) g.lineTo(pt.x, pt.y);
      g.strokePath();
    }
    g.fillStyle(C.goldBright, 1).fillCircle(lamp.x, lamp.y, cell * 0.22);
    g.lineStyle(2, C.gold, 1).strokeCircle(lamp.x, lamp.y, cell * 0.3);
    for (let k = 0; k < n * n; k++) {
      const { x: cx, y: cy } = centre(k);
      const h = cell * 0.36;
      if (s.crystals[k]) {
        // A crystal: a diamond, cyan once the beam lights it.
        const on = lit.has(k);
        if (on) g.fillStyle(C.cyan, 0.25).fillCircle(cx, cy, h * 1.2);
        g.fillStyle(on ? C.cyan : C.panel, 1).beginPath().moveTo(cx, cy - h).lineTo(cx + h * 0.7, cy).lineTo(cx, cy + h).lineTo(cx - h * 0.7, cy).closePath().fillPath();
        g.lineStyle(1.5, on ? C.cyan : C.rose, 1).strokePath();
      }
      const m = s.mirrors[k];
      if (m) {
        // A mirror: a silver bar from corner to corner, / or \.
        const sign = m === 1 ? -1 : 1;
        g.lineStyle(5, 0xe9dcff, 1).lineBetween(cx - h, cy - sign * h, cx + h, cy + sign * h);
      }
    }
    const sx = r.x + r.w - 70;
    const total = s.crystals.filter(Boolean).length;
    p.text(sx, r.y + r.h / 2 - 40, `${lit.size}/${total}`, { size: 30, color: C.goldText });
    p.text(sx, r.y + r.h / 2 - 10, t('beamLit'), { size: 13, color: C.inkDim });
    p.text(sx, r.y + r.h / 2 + 34, String(mirrorsLeft(s)), { size: 38, color: C.goldText });
    p.text(sx, r.y + r.h / 2 + 64, t('beamLeft'), { size: 13, color: C.inkDim });
  },
};
