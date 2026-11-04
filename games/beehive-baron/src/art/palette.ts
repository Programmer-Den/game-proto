// Colours of the card stock, as CSS strings for the baked textures, plus the few numbers the scene
// draws with every frame (glowing comb edges, the ripening arc and the progress bars).

export const CARD = {
  sky: '#a9d6ee',
  sun: '#ffd76a',
  cloud: '#ffffff',
  farHill: '#a6d18a',
  nearHill: '#7fbf5c',
  grass: '#6aae4a',
  roof: '#c07a3e',
  roofTrim: '#d99456',
  box: '#e0a868',
  slat: '#d39a5a',
  recess: '#6a3f1c',
  slit: '#2e1a0a',
  landing: '#d6a062',
  plaque: '#fff1c8',
  wax: '#c98a3a',
  well: '#3f230c',
  preview: '#bfe8a0',
  previewLine: '#3f8a2e',
  stem: '#3e8a34',
  leaf: '#58a845',
  middle: '#f2b01e',
  middleShine: '#f8c84a',
  lid: '#a8743e',
  label: '#fff4d8',
  shelf: '#c98a4a',
  shelfLeg: '#a86e36',
  board: '#b07a44',
  boardInner: '#c48d55',
  hud: '#4a2e16',
  goal: '#fff4d6',
  away: '#34506e',
  tag: '#5a3e96',
  green: '#2f5a24',
  bee: '#f7c531',
  beeDark: '#2b2118',
};

/** Petal colours, one per flower: pinks, lilac, cream, blue and orange, never a red cross. */
export const PETALS = ['#ec7fa6', '#a888e0', '#f6f1e4', '#6c9ee8', '#f39a4c', '#f2c6e6'];

/** The meadows' card strips, by `MEADOWS` index: two alternating rows, and the blooms cut on them. */
export const MEADOW_CARD = [
  { rows: ['#b9a6e6', '#a48fd6'], bloom: ['#7d5cc4', '#c9b6f2'] },
  { rows: ['#f4d466', '#e8bd3a'], bloom: ['#ffd23a', '#7a4410'] },
  { rows: ['#dca3c9', '#c886b4'], bloom: ['#a2508a', '#f2c6e6'] },
];

/**
 * Each kind of honey's card: the nectar in a filling cell, a ripening cell's two layers, a capped
 * cell's three layers of wax and the jar. Clover keeps the original golden honey.
 */
export const KIND_CARD = {
  clover: { nectar: '#f2a92e', ripe: ['#f29a26', '#f7b444'], capped: ['#f6dc94', '#fff0c2', '#fbe6a8'], jar: '#f2a226' },
  lavender: { nectar: '#b48ae0', ripe: ['#9f74d2', '#bf9cea'], capped: ['#ddd0f4', '#f3edfc', '#e8def8'], jar: '#a982d6' },
  heather: { nectar: '#df7aa6', ripe: ['#cc6294', '#e68ab4'], capped: ['#f4d0e0', '#fdeef4', '#f8e0ea'], jar: '#d9739e' },
};

/** The wasp: a brighter yellow than the bee, near-black stripes and smoky wings; the order card and its pin; brood. */
export const WASP_CARD = { body: '#ffd21f', dark: '#1d1a16', wing: 'rgba(214,224,236,0.9)' };
export const NOTE_CARD = { paper: '#fff8e4', edge: '#c9a46a', pin: '#4f9a42' };
export const BROOD_CARD = { cap: '#c98f4a', dome: '#dba560', larva: '#fff4e0' };
export const WAX_CARD = { cake: '#f3d98c', shine: '#fff0c0' };
/** The orchard contract's note (a green-tinged paper with a brown pin) and the mead cask's staves, hoops and bung. */
export const ORCHARD_CARD = { paper: '#eef8dc', edge: '#9bb878', pin: '#a86e36' };
export const MEAD_CARD = { stave: '#8a5a2e', hoop: '#3f2a16', bung: '#d9a95c' };

/** The tint laid over the scenery each season (the hive and the cards stay as they are), as a colour and how strong. */
export const SEASON_TINT = {
  spring: { colour: 0xffffff, alpha: 0 },
  summer: { colour: 0xfff0a0, alpha: 0.12 },
  autumn: { colour: 0xe89a3c, alpha: 0.28 },
  winter: { colour: 0xeaf2fa, alpha: 0.68 },
};

export const LIVE = {
  edgeGlow: 0xffd640,
  edge: 0xffe070,
  edgeCore: 0xfff6c8,
  previewGlow: 0x9cf060,
  preview: 0xb8f57a,
  ripenArc: 0xfff4d0,
  cappedRim: 0xfff6dc,
  barTrack: 0xead9ad,
  bar: 0xf2b01e,
  awayTrack: 0x203448,
  trail: 0xffffff,
  broodArc: 0xc8f0a8,
  stealBar: 0xf08a1c,
  stealTrack: 0x3a2410,
  marketPick: 0xffd25a,
  marketLine: 0xd9b880,
  meadArc: 0xffd25a,
  meadReady: 0xfff0b0,
  swarmBar: 0xffd25a,
  swarmTrack: 0x5a3416,
  fairPick: 0x9cf060,
  tired: 0xc0602a,
  tiredTrack: 0xead9ad,
  snow: 0xffffff,
};

/** The garden card's dots: each bed's flower, and the link between two beds that give a rare honey. */
export const GARDEN_LIVE = {
  bloom: { clover: 0xf2a226, lavender: 0xa982d6, heather: 0xd9739e, sunflower: 0xf5c518 },
  rare: { blossom: 0xf08cc0, sunburst: 0xffb020, mountain: 0x7a5cc8 },
};
