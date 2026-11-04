import type { TextKey } from '../i18n';
import { SHAPES, type Puzzle } from './sudoku';
import type { Technique } from './techniques';

/**
 * The technique school's lessons, in order: each is a 6x6 board stopped at a spot where its
 * technique is the way on (found by `explain` from seeded boards, so `xWing` really needs the
 * X-wing and nothing easier). The board's filled cells are givens, every empty cell starts with
 * its candidates noted, `marks` are the cells that show the technique and `target` is the cell it
 * unlocks: placing its digit earns the lesson's stamp.
 */
export interface Lesson {
  id: Technique;
  /** The board as digits row by row, 0 empty, and its solution. */
  board: string;
  solution: string;
  target: number;
  marks: number[];
  /** What the technique is, shown before the board, and the one-line task under the heading. */
  text: TextKey;
  task: TextKey;
}

export const LESSONS: Lesson[] = [
  {
    id: 'hiddenSingle', board: '000240240305002050400000604000100430', solution: '563241241365312654456123634512125436',
    target: 17, marks: [15, 16, 17, 21, 22, 23], text: 'hiddenSingleLesson', task: 'hiddenSingleTask',
  },
  {
    id: 'nakedPair', board: '060040204600506304403060640031000406', solution: '361542254613516324423165645231132456',
    target: 10, marks: [13, 19], text: 'nakedPairLesson', task: 'nakedPairTask',
  },
  {
    id: 'pointingPair', board: '020000003026205003030250012000000002', solution: '426531153426245163631254312645564312',
    target: 5, marks: [18, 20], text: 'pointingPairLesson', task: 'pointingPairTask',
  },
  {
    id: 'xWing', board: '100400030102003010010304501000360001', solution: '152436436152643215215364521643364521',
    target: 33, marks: [8, 10, 20, 22], text: 'xWingLesson', task: 'xWingTask',
  },
];

/** A lesson's board as a puzzle: its filled cells are the givens. */
export function lessonPuzzle(lesson: Lesson): Puzzle {
  const digits = (s: string) => [...s].map(Number);
  const board = digits(lesson.board);
  return { ...SHAPES[6], solution: digits(lesson.solution), givens: board.map((v) => v !== 0) };
}
