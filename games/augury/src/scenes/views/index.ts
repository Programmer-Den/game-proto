import type { KindId } from '../../game/kinds';
import { bridgesView } from './bridges';
import { calcView } from './calc';
import { codeView } from './code';
import { echoView } from './echo';
import { flipView } from './flip';
import { linkView } from './link';
import { nonogramView } from './nonogram';
import { seriesView } from './series';
import { slideView } from './slide';
import { sumsView } from './sums';
import type { PuzzleView } from './types';
import { unjamView } from './unjam';

export const VIEWS: Record<KindId, PuzzleView> = {
  nonogram: nonogramView,
  bridges: bridgesView,
  code: codeView,
  calc: calcView,
  sums: sumsView,
  unjam: unjamView,
  flip: flipView,
  link: linkView,
  slide: slideView,
  series: seriesView,
  echo: echoView,
};

export { resetUnjam } from './unjam';
