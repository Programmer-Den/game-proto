/**
 * Statue puzzles: positions from Stone AI games where the side to move mates by force, in one, two
 * or three of its moves. Each is `FEN|line`: the line is the solution as `e2e4` text, the solver's
 * moves and the defence the Stone AI plays between them. Every move but the last is the only one
 * that mates in time; the last is any move that mates. They were found by a mate search over Stone
 * AI games (a throwaway script, not in the repo), 24 of each length, mate in one first.
 */

export interface Puzzle {
  /** Its number, from 0. */
  id: number;
  fen: string;
  /** The solution and the defence, as `e2e4` text. */
  line: string[];
  /** Mate in this many of the solver's moves. */
  mateIn: number;
}

const DATA = [
  'rnk4r/p4pp1/2pp3p/Pp1q1b2/1b3P2/2n1K3/1PP1Q1PP/RNB2BR1 b - -|b4c5',
  'r1b1k2r/pp3ppp/4p1n1/3n4/1b5P/2NP1Pq1/RBPQRN2/4K3 b kq -|g3g1',
  '2r1qb2/p1B1kp1r/Q6n/3p4/2Pp4/PN3N2/1P2PPPR/R3KB2 w Q -|a6d6',
  'Nn1k1b1r/1p2npp1/p6p/2PP4/5Qq1/2P5/PP3PBP/R1B2K1R b - -|g4d1',
  '1nb1k2r/rqn4p/8/pP2N1B1/4p3/N2p4/QP3PPP/4KB1R w Kk -|a2f7',
  'r3k3/ppq1npp1/2p5/P1np1r2/5R2/2N1K3/1PPQP2P/2B2B1R b q -|c7f4',
  'rn4nr/1q1p2kp/p7/R3Ppp1/3bQ3/1P3KP1/N1PP3P/2B2B2 b - -|b7e4',
  'N1b5/pp1p4/2n2p1r/2bkp3/4N3/3BPP2/PPPP3P/R1BK3R w - -|a8c7',
  '3k3r/2p2p2/b1n1pn1p/P2p3P/3P1Pp1/1qbBP1P1/1B3N2/1K1R4 b - -|b3b2',
  '1rb1kbn1/1pq5/5p2/1Kp1pPNp/PpQ1P3/6PB/5B1P/7R b - -|c8d7',
  '4kb2/4p1pr/p1p1p2p/3nB1q1/1PNP4/PR5P/4PPP1/4KB1R b K -|g5c1',
  'rnb3Q1/6b1/6k1/p5P1/6Pn/1NB4P/PP6/1RK2Bq1 w - -|g8g7',
  '2k3r1/3n1pb1/N4npp/4p3/P1p3b1/4P3/1PPK1P1P/1RB1R3 b - -|f6e4',
  'k2r4/2n1p3/pp3ppb/5b2/Q6K/2P2PPP/PP1Nq3/R1B5 b - -|h6g5',
  '3qkr2/3b2Qp/1n4p1/1N3p2/p1P1pP1P/1P6/PB2K1P1/2R4R w - -|b5d6',
  '1r1k4/p2bp3/3p1prB/1q1P4/2p5/p3P3/3N2PP/2KQ1B1R b - -|b5b2',
  '4q1r1/2pk1p2/bp1p4/3P2p1/3B2Pp/n4P2/3K1N1P/1r3B1R b - -|e8e1',
  '4rkn1/pp3ppB/2p4p/3p4/8/N4q2/PPPP1P2/1RB2Kb1 b - -|f3f2',
  '4k1nr/5p1p/pp2b1p1/2b3P1/2pq3P/P2B1P2/8/3RK1R1 b k -|d4f2',
  '3r3r/1Pp2k2/6pp/p7/P1P1p1qP/B4b2/3N1P2/Q3RK2 b - -|g4g2',
  '1kn2r2/6p1/1p1p4/5p1p/2P1PP1P/3K1NQ1/rq4PR/5B2 b - -|a2a3',
  'r3k1qQ/p1pb1p2/8/1p1p4/P3n3/BP2P3/5PP1/R3KB2 w Qq -|h8g8',
  '4kr2/4p3/p1p3p1/1qP2n1p/3R1P2/2K3PP/1r3QB1/7R b - -|b5b3',
  '4kb1r/2p1pp1p/p1n4B/p2p3P/3P2b1/P1P1PqP1/3K1P2/8 b k -|f3d1',
  'r3q2r/p1ppn1Q1/bp2k2p/2b1Pp1P/Pn3P1R/1P2P1P1/2P2K2/RNB2BN1 w - -|g7f6 e6d5 b1c3',
  'rn3k1r/5p1p/p3Bn2/qb4bP/pp2p3/2P2P2/3P4/RNBQK1R1 b - -|g5h4 g1g3 h4g3',
  'rnb1k1r1/1pppqpp1/5n2/3P4/1pPQ1KPp/P4P2/5N1P/1NB2B1R b q -|g7g5 f4f5 d7d6',
  'rn4nr/1q1p2kp/p1b5/R3Ppp1/3bP3/1P3KP1/N1PPQ2P/2B2B2 b - -|c6e4 e2e4 b7e4',
  'rnb2b1r/5k1p/8/p3Q1P1/4p1Pn/1NB4P/PP6/1RK2BNq w - -|f1c4 c8e6 e5e6',
  '2b2rk1/3p2p1/p2b3n/3Np2p/2P1P2P/P1NQ1n2/2PP2q1/R1BK3R b - -|g2h1 d3f1 h1f1',
  '4kbr1/1rpq1bp1/2Q1p3/RP2p1B1/7p/2NP4/1PPK2PP/5B1R w - -|a5a8 b7b8 a8b8',
  'rnq2b1r/1b1kp3/pB1p2Q1/P2P3n/1p6/5BpP/8/4KRN1 w - -|f3g4 e7e6 g6e6',
  '3k3r/1qp2p2/b1n1pn1p/P2p3P/3P1Pp1/1PbBP1P1/5N2/1KBR4 b - -|b7b3 c1b2 b3b2',
  'k2r1b2/2n1p3/pp3pp1/8/Q7/2PbKPPP/PP1NN3/R1B1q3 b - -|f8h6 a4f4 e1e2',
  '1rb1kb2/1p3p1p/3q3n/K1p1pPB1/Pp2P2N/6PB/7P/5Q1R b - -|b8a8 a5b5 d6a6',
  'rnb2b2/8/6k1/p2Q2P1/6Pn/1NB4P/PP6/1RK2Bq1 w - -|d5g8 f8g7 g8g7',
  'r1b1kb2/1p4pr/pQ1P1p1p/P3p3/3n4/RP1P3P/1K2n1P1/3q4 b - -|d1c1 b2a2 e2c3',
  'r4r2/2NBk1p1/3p3p/6bP/4Pnq1/2B5/1PQK4/RN6 b - -|g4e2 d2c1 f4d3',
  '2b1q1r1/2pk1p2/1p1p4/3P2p1/3B2Pp/n2K1P2/5N1P/1r3B1R b - -|c8a6 d3c3 e8e1',
  'r3k2r/p1pb1p2/8/1p1p2q1/P2Qn3/BP2P3/5PP1/R3KB2 w Qq -|d4h8 g5g8 h8g8',
  '4kb2/2q1p1p1/5p1p/2p1n3/R7/1Q2P2b/1PPP1P1P/2B1R1K1 b - -|e5f3 g1h1 c7h2',
  '2q4r/1k2n1p1/1p1p4/r4p1p/1K3P2/5N1P/P1P1P1PR/1Q3B2 b - -|e7d5 b4b3 c8c3',
  '3r3r/1Pp2k2/6pp/p4q2/P1P1p2P/B4b2/3N1P2/Q3R1K1 b - -|f5g4 g1h2 g4g2',
  '6k1/6pr/2n1P2p/p2pbQ1P/7B/4P2R/3PKP2/3N2q1 w - -|f5f7 g8h8 f7e8',
  'r1br4/1p2Q3/p4pkp/q5p1/P6P/R2P1PK1/8/5B1R w - -|h4h5 g6f5 e7e4',
  'k1b5/7n/r7/p2PB1n1/2Q4p/P3P2P/4B1P1/5KR1 w - -|c4c8 a8a7 c8a6',
  'r1b3k1/pp6/2P3pQ/8/4P2p/1P6/P4PPP/2RK1B1R w - -|f1c4 c8e6 c4e6',
  '4b2Q/1N2kp2/4p2p/3p4/6nP/q2P4/P1R1Pr2/6K1 w - -|c2c7 e8d7 h8d8',
  'rnk2n1r/pp6/3pp3/NQP1b1p1/1p4p1/P2KPqP1/R1B4P/1N2R3 b - -|f3d5 d3e2 h8h2 e2f1 d5g2',
  '1nb2k2/1p1q1r2/r1p3p1/p3p1P1/Pn2P2p/1PN4P/1R1P2BR/3QK1N1 b - -|b4d3 e1e2 f7f2 e2e3 d7d4',
  'N1bkr3/1p3ppp/2n5/2b1p3/p3P2q/P7/1PPPKNP1/R1BQ1B1R b - -|h4f2 e2d3 f2d4 d3e2 d4e4',
  '1r2kr2/2p1bppp/B1P4n/3q3b/P2B4/2p5/RP3PPP/1N2K1NR b - -|d5e4 a6e2 e4b1 e2d1 b1d1',
  '2b2rk1/3p2p1/p2b2qn/3Np2p/2P1P2P/P1NQ1n2/2PPK3/R1B4R b - -|g6g2 e2d1 g2h1 d3f1 h1f1',
  '2q1kbr1/1rp2bp1/4p3/RP2p1B1/4Q2p/2NP4/1PPK2PP/5B1R w - -|e4c6 c8d7 a5a8 b7b8 a8b8',
  'rnq1kb1r/1b2p3/pB1p4/P2P3n/1p6/5BpP/8/1Q2KRN1 w - -|b1g6 e8d7 f3g4 e7e6 g6e6',
  'r4k1r/pp2npp1/2pb3p/3p4/8/3B1q2/PPPP1P2/RNB2KR1 b - -|d6c5 f1e1 c5f2 e1f1 f2g3',
  '4rk1r/pp2npp1/2pb3p/3p4/8/N2B1q2/PPPP1P2/1RB1K1R1 b - -|e7g6 d3e4 g6f4 a3b5 f3e2',
  'q6r/3kppbp/1p6/2P5/2Kp1Bn1/1P5P/P1n2PP1/RN4R1 b - -|a8a6 c4d5 c2b4 d5e4 a6d3',
  '3q1r2/3b1k1p/1n4p1/pN3p2/2P1pP1P/1PQ5/PB4P1/2R1K2R w K -|c3g7 f7e6 b5d4 e6d6 g7e5',
  '4kb2/4p1p1/2n2p1p/2p1q3/R7/1Q2P2b/1PPP1P1P/2B1R1K1 b - -|e5g5 a4g4 g5g4 g1h1 g4g2',
  '1r1k3r/6Q1/5P2/ppp3p1/PnP1n1B1/1P2K1R1/8/q5N1 b - -|a1d4 e3f3 d4f2 f3e4 f2f4',
  '4k1nr/p4p1p/1p2b1p1/2b3P1/2pq3P/P2B1P2/3K4/3R2R1 b k -|d4d3 d2e1 d3e3 e1f1 e3f2',
  '3k2r1/2pb1p2/2n3p1/2pp1P1p/8/1P4PN/5K1P/rq3R2 b - -|b1f1 f2e3 d5d4 e3e4 f1f5',
  'r1b4k/pp6/2P3p1/8/4PQ1p/1P6/P4PPP/2RK1B1R w - -|f4h6 h8g8 f1c4 c8e6 c4e6',
  '6k1/1b4p1/2p3R1/5p1B/n1p4P/P1p1B3/P3K1R1/1r6 w - -|g6g7 g8f8 g7f7 f8e8 g2g8',
  '7r/pr1k3p/2R5/1P1p4/6pP/B2q2P1/5P2/4K1R1 b - -|h8e8 a3e7 e8e7 c6e6 e7e6',
  '7r/6bk/p2QB3/P7/3B1N1q/1p4pP/8/4K3 w - -|e6f5 h7g8 d6e6 g8f8 f4g6',
  '5k2/p1Q4r/1p2p3/2P5/R3N1pp/8/1P1KPP2/1q6 w - -|c7d8 f8f7 a4a7 f7g6 d8g5',
  '1B3n2/R5NB/2k3P1/7K/7P/5P1b/3R4/8 w - -|a7c7 c6b6 d2b2 b6a6 c7a7',
  '5n2/2p3k1/1p6/pP1b4/P4p2/K1Nr3q/8/5N2 b - -|h3f1 a3b2 d3d2 b2a3 f1c1',
  '8/2p3k1/1p4nq/pP1b4/P4pN1/K1Nr4/8/8 b - -|h6h1 a3b2 d3d2 b2a3 h1c1',
  '6kr/2b2pp1/1p6/pP5p/4n3/P6N/4r1P1/3K4 b - -|e4c3 d1c1 c7d6 a3a4 d6a3',
];

export const PUZZLES: readonly Puzzle[] = DATA.map((text, id) => {
  const [fen, moves] = text.split('|');
  const line = moves.split(' ');
  return { id, fen, line, mateIn: (line.length + 1) / 2 };
});

/** The ladder: the first five of each length, mate in one first, solved in order. */
export const LADDER: readonly number[] = [0, 1, 2, 3, 4, 24, 25, 26, 27, 28, 48, 49, 50, 51, 52];

/** Today's puzzle for every player, from the whole set: `rand` is the daily's seeded source. */
export const dailyPuzzle = (rand: () => number) => PUZZLES[Math.floor(rand() * PUZZLES.length)];
