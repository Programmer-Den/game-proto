import type { StyleId } from '../game/catalog';

/**
 * How each art style draws the game: colours, the digit font and the backdrop (`deco`, drawn by
 * `drawDeco` in GameScene). The digits always stay plain, high-contrast numbers; colour only marks
 * the selection, mistakes and finished rows, columns and boxes. Fonts are the device's own, so
 * nothing is downloaded.
 */
export interface Theme {
  font: string;
  bold: boolean;
  /** The player's digits in italics, like handwriting (Ink & Parchment). */
  italicPlayer?: boolean;
  /** The backdrop's top and bottom colours. */
  bg: [number, number];
  /** The board's frame and lines, and their widths in pixels. */
  line: number;
  thin: number;
  thick: number;
  frame: number;
  /** Corner rounding of the board and cells. */
  radius: number;
  cellRadius: number;
  cell: number;
  /** A colour per box instead of `cell`, for Stained Glass. */
  boxes?: number[];
  peer: number;
  same: number;
  sel: number;
  done: number;
  wrongBg: number;
  given: string;
  player: string;
  wrong: string;
  note: string;
  /** Digits on the selected cell, where `sel` is bright. */
  selText?: string;
  /** A glow behind the digits. */
  glow?: string;
  /** A drop shadow offset under the board, panel and keys (Paper, Pixel, Garden). */
  shadow?: { color: number; dy: number; dx?: number };
  panel: number;
  panelAlpha: number;
  panelLine: number;
  text: string;
  accent: string;
  key: number;
  keyLine: number;
  keyText: string;
  heart: string;
}

const sans = '"Segoe UI", Inter, Roboto, "Helvetica Neue", Arial, sans-serif';
const serif = 'Georgia, "Times New Roman", serif';
const mono = '"Courier New", Courier, monospace';

export const THEMES: Record<StyleId, Theme> = {
  paper: {
    font: sans, bold: true, bg: [0xf7e3d4, 0xefcbb4], line: 0xf3c2a6, thin: 4, thick: 10, frame: 10, radius: 18, cellRadius: 8,
    cell: 0xfffaf3, peer: 0xfde9d8, same: 0xfbd9bd, sel: 0xffd27a, done: 0xe3f1e4, wrongBg: 0xe2725b,
    given: '#3b3a5a', player: '#d9644a', wrong: '#ffffff', note: '#8a8aa8', shadow: { color: 0xd9a488, dy: 7 },
    panel: 0xfffaf3, panelAlpha: 1, panelLine: 0xf0d2bd, text: '#3b3a5a', accent: '#d9644a', key: 0xfdeee2, keyLine: 0xe9cbb4, keyText: '#3b3a5a', heart: '#e2725b',
  },
  garden: {
    font: sans, bold: true, bg: [0xa6d47a, 0x5f9a3e], line: 0x5a3a1e, thin: 3, thick: 6, frame: 8, radius: 8, cellRadius: 5,
    cell: 0xd8b07a, peer: 0xe5c696, same: 0xefd49c, sel: 0xf6cc58, done: 0xbfd88a, wrongBg: 0xc0503a,
    given: '#3a2410', player: '#2e6b2a', wrong: '#ffffff', note: '#6e4e2e', shadow: { color: 0x3e2810, dy: 7 },
    panel: 0x7a4e28, panelAlpha: 1, panelLine: 0x5a3a1e, text: '#fff4dc', accent: '#ffe08a', key: 0xd8b07a, keyLine: 0x5a3a1e, keyText: '#3a2410', heart: '#ff8a7a',
  },
  chalk: {
    font: '"Chalkboard SE", "Comic Sans MS", "Segoe Print", ' + sans, bold: false, bg: [0x2f4a3a, 0x253d2f], line: 0xe8e6da, thin: 1, thick: 3, frame: 3, radius: 0, cellRadius: 0,
    cell: 0x2f4a3a, peer: 0x37543f, same: 0x3f5f49, sel: 0x557a5e, done: 0x3d5e48, wrongBg: 0x5a4038,
    given: '#f4f2e8', player: '#f7d96a', wrong: '#ff9a8a', note: '#c8d6c8',
    panel: 0x2f4a3a, panelAlpha: 0, panelLine: 0xe8e6da, text: '#f4f2e8', accent: '#f7d96a', key: 0x2f4a3a, keyLine: 0xc8c6ba, keyText: '#f4f2e8', heart: '#ff9a8a',
  },
  parchment: {
    font: serif, bold: false, italicPlayer: true, bg: [0xf1e2bb, 0xd2b47e], line: 0x4a3218, thin: 1, thick: 3, frame: 4, radius: 0, cellRadius: 0,
    cell: 0xf3e5c0, peer: 0xead6a6, same: 0xe0c78c, sel: 0xd7bb7a, done: 0xe3d6a2, wrongBg: 0xe9c0a0,
    given: '#2a1a08', player: '#1d3c78', wrong: '#a01818', note: '#6b5434',
    panel: 0xf3e5c0, panelAlpha: 0.55, panelLine: 0x4a3218, text: '#3a2410', accent: '#8a1a1a', key: 0xf3e5c0, keyLine: 0x4a3218, keyText: '#2a1a08', heart: '#9a1c1c',
  },
  pixel: {
    font: mono, bold: true, bg: [0x7fb069, 0x76a660], line: 0x3d5a3a, thin: 2, thick: 4, frame: 6, radius: 0, cellRadius: 0,
    cell: 0xf6efd2, peer: 0xe6f0c4, same: 0xdde8b0, sel: 0xffd166, done: 0xcfe8a8, wrongBg: 0xd0485a,
    given: '#3d2b1f', player: '#2f6fb0', wrong: '#ffffff', note: '#7a6a55', shadow: { color: 0x2e4430, dy: 8, dx: 8 },
    panel: 0xf6efd2, panelAlpha: 1, panelLine: 0x3d5a3a, text: '#3d2b1f', accent: '#2f6fb0', key: 0xffe8a8, keyLine: 0x3d2b1f, keyText: '#3d2b1f', heart: '#d0485a',
  },
  stars: {
    font: sans, bold: false, bg: [0x1c2a5a, 0x070b1e], line: 0x56669c, thin: 1, thick: 3, frame: 2, radius: 4, cellRadius: 0,
    cell: 0x0a102c, peer: 0x1d2a5e, same: 0x2a3a80, sel: 0x5a68c8, done: 0x2c3478, wrongBg: 0x4a1a3a,
    given: '#f4f6ff', player: '#ffd76a', wrong: '#ff9aa8', note: '#9fb0e0', glow: '#9fb4ff',
    panel: 0x0a102c, panelAlpha: 0.82, panelLine: 0x56669c, text: '#dfe6ff', accent: '#ffd76a', key: 0x1d2a5e, keyLine: 0x6a7ab0, keyText: '#f4f6ff', heart: '#ffd76a',
  },
  stone: {
    font: serif, bold: true, bg: [0x3e3a38, 0x141212], line: 0x1a1817, thin: 3, thick: 5, frame: 10, radius: 4, cellRadius: 0,
    cell: 0x7c766f, peer: 0x8c857c, same: 0x9a8f80, sel: 0xb08a54, done: 0x93866a, wrongBg: 0x4a2622,
    given: '#231f1d', player: '#ffb04a', wrong: '#ff8a6a', note: '#e8dcc8', glow: '#ff9a20',
    panel: 0x4a4541, panelAlpha: 1, panelLine: 0x1a1817, text: '#e8dcc8', accent: '#e8a33c', key: 0x6b655f, keyLine: 0x1a1817, keyText: '#231f1d', heart: '#e8a33c',
  },
  neon: {
    font: sans, bold: true, bg: [0x0a0014, 0x1a0030], line: 0xff3df0, thin: 1, thick: 3, frame: 3, radius: 6, cellRadius: 0,
    cell: 0x0d0020, peer: 0x1c0640, same: 0x2a0a58, sel: 0x3a0a5a, done: 0x0a2a3a, wrongBg: 0x3a0018,
    given: '#7ef9ff', player: '#ffef5a', wrong: '#ff5a7a', note: '#a07ad0', glow: 'auto',
    panel: 0x0d0020, panelAlpha: 0.88, panelLine: 0xff3df0, text: '#e8d8ff', accent: '#ff3df0', key: 0x0d0020, keyLine: 0x7ef9ff, keyText: '#7ef9ff', heart: '#ff3df0',
  },
  glass: {
    font: sans, bold: true, bg: [0x2a1a3c, 0x0b0812], line: 0x0a0a0a, thin: 3, thick: 3, frame: 8, radius: 10, cellRadius: 0,
    cell: 0x1f2f5b, boxes: [0x6e2848, 0x284a6e, 0x3a6e28, 0x6e5a28, 0x48286e, 0x286e64, 0x6e3a28, 0x283a6e, 0x5a6e28],
    peer: 0xffffff, same: 0xffffff, sel: 0xd8a93a, done: 0xffe9a8, wrongBg: 0x8a1024,
    given: '#fff4d6', player: '#9fe8ff', wrong: '#ffd0d0', note: '#e9d9b0', selText: '#1a0f00', glow: '#ffe8b0',
    panel: 0x1a1226, panelAlpha: 1, panelLine: 0x0a0a0a, text: '#f3e6c8', accent: '#ffd77a', key: 0x2b1d3f, keyLine: 0x000000, keyText: '#fff4d6', heart: '#ff6b8a',
  },
  almanac: {
    font: serif, bold: true, bg: [0xe8edf1, 0xc9d4dd], line: 0x2c3e50, thin: 1.5, thick: 4, frame: 5, radius: 6, cellRadius: 2,
    cell: 0xfdfdfb, peer: 0xe4edf3, same: 0xcfe3ee, sel: 0x9fd3e0, done: 0xe3f0e0, wrongBg: 0xd9826a,
    given: '#1f2d3a', player: '#1f6f78', wrong: '#ffffff', note: '#6a7a88', shadow: { color: 0xaebbc6, dy: 5 },
    panel: 0xfdfdfb, panelAlpha: 1, panelLine: 0x2c3e50, text: '#1f2d3a', accent: '#1f6f78', key: 0xeef3f6, keyLine: 0x8a9aa8, keyText: '#1f2d3a', heart: '#c0504a',
  },
};

/** The colour a hex string names, as a number. */
export const hex = (color: string) => parseInt(color.slice(1), 16);
