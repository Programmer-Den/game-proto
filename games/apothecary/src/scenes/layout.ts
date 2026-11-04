import type { ItemId, PlantId } from '../game/items';
import { BELT_MS, BELTS, PLOTS_PER_GARDEN, type BeltId } from '../game/state';
import type { TextKey } from '../i18n';

// World positions for the apothecary with its shop at the heart. The shop stands in the middle of
// the map, and each production line runs sideways into it: the first line from the left, the
// second, mirrored, from the right. A line's three gardens stand one above the other on the outer
// edge; its goods ride from them to the refining table, on to the cauldron and in through the shop's
// side wall onto the shelves that stand along it. Every station keeps one rule: the doctor's drop,
// work and pick-up markers stand north of it, and its sign, priority, upgrade, hire and pixie markers
// south of it. The doctor goes into the shop by the door in its north wall, past the drop-off just
// outside it, and customers come in from the street below. The outfitter and the study stand below
// the first line, the guild below the second. The second line is plain grass until the expansion
// is bought. The world is bigger than the 960x540 view, so the camera follows the doctor.

export const HUD_HEIGHT = 44;
export const WORLD = { w: 1680, h: 900 };

/** The second line mirrors the first across the middle of the map. */
const mirror = (p: { x: number; y: number }) => ({ x: WORLD.w - p.x, y: p.y });
/** The height goods ride across the first line at, from its gardens into the shop. */
const LINE_Y = 360;
/** The doctor's drop and pick-up markers stand in a row north of the stations, the work spot just above each. */
const HANDS_Y = 250;
const WORK_Y = 288;
/** Below each station: its sign, its priority sign, then its upgrade, hire and pixie markers in a row. */
const SIGN_Y = LINE_Y + 92;
const PRIORITY_Y = LINE_Y + 118;
const COINS_Y = LINE_Y + 164;
/** How far apart the markers in that row stand, so their captions don't run together. */
const COINS_GAP = 66;

/**
 * Fenced garden areas, matching the order of GARDENS in the game state: the first line's wheat field
 * and mandrake patch, then the second line's, mirrored, then the two shade gardens, each below its
 * line's mandrake patch.
 */
const GARDEN = { x: 24, w: 200, h: 176 };
const LINE1_GARDENS = [
  { ...GARDEN, y: 64, name: 'wheatField' as TextKey },
  { ...GARDEN, y: 256, name: 'mandrakePatch' as TextKey },
];
const SHADE_GARDEN = { ...GARDEN, y: 448, name: 'shadeGarden' as TextKey };
const mirrorArea = <T extends { x: number; w: number }>(g: T) => ({ ...g, x: WORLD.w - g.x - g.w });
export const GARDEN_AREAS = [...LINE1_GARDENS, ...LINE1_GARDENS.map(mirrorArea), SHADE_GARDEN, mirrorArea(SHADE_GARDEN)];
/** A plot's bed is 56 by 44, and beds stand edge to edge. */
const PLOT = { w: 56, h: 44 };
/**
 * Plot i is slot i % 9 of garden i / 9: three rows of three beds, edge to edge, in the middle of the
 * garden below its name, filling it left to right and top to bottom.
 */
export const plotPosition = (i: number) => {
  const area = GARDEN_AREAS[Math.floor(i / PLOTS_PER_GARDEN)];
  const slot = i % PLOTS_PER_GARDEN;
  return { x: area.x + area.w / 2 + ((slot % 3) - 1) * PLOT.w, y: area.y + 104 + (Math.floor(slot / 3) - 1) * PLOT.h };
};

/**
 * Packed earth: the first line's yard between its gardens and the shop, the forecourt north of the
 * shop's door, and the two markets below the lines (the outfitter's and study's on the left, the
 * guild's on the right). The second line's yard stays grass until the expansion's land is bought.
 */
const LINE1_YARD = { x: 236, y: 190, w: 444, h: 430 };
export const YARDS = [LINE1_YARD, { x: 680, y: 150, w: 320, h: 80 }, { x: 236, y: 640, w: 400, h: 220 }, { x: 1044, y: 640, w: 400, h: 220 }];
/** The second line's yard, laid once the expansion's land is bought. */
export const EXPANSION_YARDS = [mirrorArea(LINE1_YARD)];
/** The outfitter's stall in the left market: its sign and its upgrade markers in a row below it. */
export const OUTFITTER = {
  sign: { x: 330, y: 664 },
  pack: { x: 240, y: 716 },
  boots: { x: 330, y: 716 },
  sickle: { x: 420, y: 716 },
};
/**
 * The guild in the right market: the marker to join it, then growth, pixie speed and storage in the
 * top row, prices, customers and the extra order slot in the one below, each unlocking the next.
 */
export const GUILD = {
  sign: { x: 1244, y: 664 },
  join: { x: 1109, y: 716 },
  growth: { x: 1199, y: 716 },
  belts: { x: 1289, y: 716 },
  storage: { x: 1379, y: 716 },
  prices: { x: 1109, y: 796 },
  customers: { x: 1199, y: 796 },
  slots: { x: 1289, y: 796 },
  herbalist: { x: 1379, y: 796 },
};
/**
 * The study in the left market, beside the outfitter: a writing desk under its sign, the marker
 * below it where the doctor pays to learn the next recipe, either side of the desk the markers to
 * learn replanting and the price signs, and left of the recipe's the one for the crafting order.
 */
export const STUDY = {
  sign: { x: 560, y: 664 },
  desk: { x: 560, y: 706 },
  learn: { x: 615, y: 780 },
  replant: { x: 500, y: 716 },
  priceSigns: { x: 620, y: 716 },
  craftOrder: { x: 510, y: 780 },
};
/** Where the doctor stands to buy the expansion's land: at the corner of the second line's yard by the shop. */
export const EXPANSION_LAND = { x: 1030, y: 584 };

/** The refining table stands right of the gardens; goods run through it from left to right. */
export const REFINER = { x: 350, y: LINE_Y };
/** The cauldron stands right of the table, by the shop's wall. */
export const CAULDRON = { x: 552, y: LINE_Y };

/**
 * Markers around a station: drop-off above the pallets goods come in on, the work spot just north
 * of the station and pick-up above the pallets they leave from; the upgrade marker on the left of the
 * row south of it.
 */
export interface StationMarkers {
  drop: { x: number; y: number };
  pickUp: { x: number; y: number };
  work: { x: number; y: number };
  upgrade: { x: number; y: number };
}

/** Where each station's pallets stand: a column of goods coming in on its left, going out on its right. */
const IN_X = { refiner: REFINER.x - 60, cauldron: CAULDRON.x - 60 };
const OUT_X = { refiner: REFINER.x + 64, cauldron: CAULDRON.x + 72 };

export const REFINER_MARKERS: StationMarkers = {
  drop: { x: IN_X.refiner, y: HANDS_Y },
  work: { x: REFINER.x, y: WORK_Y },
  pickUp: { x: OUT_X.refiner, y: HANDS_Y },
  upgrade: { x: REFINER.x - COINS_GAP, y: COINS_Y },
};
export const CAULDRON_MARKERS: StationMarkers = {
  drop: { x: IN_X.cauldron, y: HANDS_Y },
  work: { x: CAULDRON.x, y: WORK_Y },
  pickUp: { x: OUT_X.cauldron, y: HANDS_Y },
  upgrade: { x: CAULDRON.x - COINS_GAP, y: COINS_Y },
};

/** The second line's stations and markers, mirrored onto the right. */
export const REFINER2 = mirror(REFINER);
export const CAULDRON2 = mirror(CAULDRON);
const mirrorMarkers = (m: StationMarkers): StationMarkers => ({
  drop: mirror(m.drop),
  pickUp: mirror(m.pickUp),
  work: mirror(m.work),
  upgrade: mirror(m.upgrade),
});
export const REFINER2_MARKERS = mirrorMarkers(REFINER_MARKERS);
export const CAULDRON2_MARKERS = mirrorMarkers(CAULDRON_MARKERS);

/**
 * The shop in the middle of the map. The doctor's door is in its north wall, with the drop-off just
 * outside it; both cauldrons' pixies fly in through holes in its side walls, where the shelves stand.
 * Customers come in from the street through the door in its south wall and wait below the counter.
 */
export const SHOP = { x: 680, y: 230, w: 320, h: 430 };
/** The back door in the top wall, the doctor's way in. */
export const SHOP_DOOR = { from: 820, to: 860 };
export const COUNTER = { x: 840, y: 480 };
/** The doctor's markers: the drop-off outside the north door, work right behind the counter and the coins beside it. */
export const COUNTER_MARKERS: StationMarkers = {
  drop: { x: COUNTER.x, y: 180 },
  work: { x: COUNTER.x, y: COUNTER.y - 64 },
  pickUp: { x: COUNTER.x + 52, y: COUNTER.y - 64 },
  // Outside the north door, left of the drop-off.
  upgrade: { x: COUNTER.x - 80, y: 180 },
};
/** Where waiting customer i stands, on the street side of the counter; a market day's crowd fills the row. */
export const customerPosition = (i: number) => ({ x: COUNTER.x - 112 + i * 45, y: COUNTER.y + 80 });
/**
 * The street door in the shop's bottom wall, below the customers, and the spot outside it where
 * customers come from and go back to.
 */
export const SHOP_STREET_DOOR = { from: 820, to: 860 };
export const STREET = { x: COUNTER.x, y: WORLD.h - 16 };
/** The shop's sign, on its front wall facing the street, left of the street door. */
export const SHOP_SIGN = { x: SHOP.x + 70, y: SHOP.y + SHOP.h };
/**
 * The rival's stall across the street, left of the street door and out of the doctor's reach: its
 * feet, its sign above it, and the lines above that saying what it undercuts and how the race goes.
 */
export const RIVAL = { x: 740, y: 800, sign: { x: 740, y: 724 }, offer: { x: 740, y: 704 }, streak: { x: 740, y: 686 } };

/**
 * The merchant wagon's stop across the street, right of the street door and out of the doctor's
 * reach (a tap sells it a crate): its feet and the lines above it saying what it wants.
 */
export const WAGON = { x: 950, y: 820, want: { x: 950, y: 728 }, left: { x: 950, y: 746 } };
/**
 * The royal courier's stop on the green right of the guild (AP17), clear of its markers: its feet, and the lines
 * above it with the reward, the potions it wants and how long it waits.
 */
export const ROYAL = { x: 1562, y: 840, title: 740, wants: 760, left: 780 };
/**
 * The alchemy bench (AP18) on the grass north of the first line's yard, its label above it and the
 * marker where the doctor drops refined goods on it to its right; a tap on the bench opens it.
 */
export const BENCH = { x: 330, y: 150, label: { x: 330, y: 108 }, drop: { x: 430, y: 150 } };
/** The courier's post (AP19) on the same grass, right of the bench: its foot, its label and where the courier waits at home. */
export const COURIER_POST = { x: 560, y: 160, label: { x: 560, y: 108 }, home: { x: 598, y: 166 } };
/**
 * The shop decor (AP20) on the street in front of the shop: the tappable decor board on the front
 * wall right of the street door, the painted sign on its post right of the street path with the
 * fountain beside it (both above the merchant wagon's lines), the herb arch over the path and the
 * lanterns either side of it further down. Each spot is the piece's feet.
 */
export const DECOR_SPOTS = {
  board: { x: SHOP.x + SHOP.w - 52, y: SHOP.y + SHOP.h },
  paintedSign: { x: 898, y: 718 },
  fountain: { x: 960, y: 718 },
  herbArch: { x: 840, y: 744 },
  lanterns: [{ x: 800, y: 832 }, { x: 880, y: 832 }],
};
/**
 * The herb market below the outfitter: its stall, the marker to sell plants and refined goods, the
 * marker to buy the good its tappable sign shows, and that sign above the buy marker.
 */
export const HERB_MARKET = { stall: { x: 250, y: 842 }, label: { x: 250, y: 774 }, sell: { x: 340, y: 806 }, buy: { x: 430, y: 806 }, pick: { x: 430, y: 772 } };

/** How thick the shop's stone walls are; each runs along an edge of the shop, half inside and half out. */
const WALL = 16;
/** Where the cauldrons' pixies fly in through the shop's side walls. */
const BELT_IN_Y = LINE_Y;
/** The gap a pixie route leaves in a side wall it runs through. */
const BELT_GAP = { from: BELT_IN_Y - 16, to: BELT_IN_Y + 16 };
const TOP = SHOP.y - WALL / 2;
const BOTTOM = SHOP.y + SHOP.h - WALL / 2;
const LEFT = SHOP.x - WALL / 2;
const RIGHT = SHOP.x + SHOP.w - WALL / 2;
/** The shop's stone walls as drawn, with gaps for its two doors and the pixies. */
export const SHOP_WALLS = [
  // The top wall, either side of the back door.
  { x: LEFT, y: TOP, w: SHOP_DOOR.from - LEFT, h: WALL },
  { x: SHOP_DOOR.to, y: TOP, w: RIGHT + WALL - SHOP_DOOR.to, h: WALL },
  // The bottom wall, either side of the street door.
  { x: LEFT, y: BOTTOM, w: SHOP_STREET_DOOR.from - LEFT, h: WALL },
  { x: SHOP_STREET_DOOR.to, y: BOTTOM, w: RIGHT + WALL - SHOP_STREET_DOOR.to, h: WALL },
  // The side walls, above and below where the pixies come through.
  ...[LEFT, RIGHT].flatMap((x) => [
    { x, y: SHOP.y, w: WALL, h: BELT_GAP.from - SHOP.y },
    { x, y: BELT_GAP.to, w: WALL, h: SHOP.y + SHOP.h - BELT_GAP.to },
  ]),
];
/**
 * Where the doctor can't walk: the top wall either side of the back door, the side walls whole, and
 * the bottom wall with the street below it, which only customers use.
 */
export const SHOP_BLOCKS = [
  { x: LEFT, y: BOTTOM, w: SHOP.w + WALL, h: WORLD.h - BOTTOM },
  ...SHOP_WALLS.slice(0, 2),
  { x: LEFT, y: SHOP.y, w: WALL, h: SHOP.h },
  { x: RIGHT, y: SHOP.y, w: WALL, h: SHOP.h },
];
/**
 * The hedges either side of the ground below the shop, the street and what stands across it, which
 * the doctor can't walk: each a line of clipped bushes from the shop's bottom wall to the world's
 * edge, just outside `SHOP_BLOCKS`.
 */
export const HEDGES = [LEFT - 10, RIGHT + WALL + 10].map((x) => ({ x, from: BOTTOM + WALL + 10, to: WORLD.h }));
/** The street customers walk up to the street door on. */
export const STREET_PATH = { x: SHOP_STREET_DOOR.from, y: BOTTOM, w: SHOP_STREET_DOOR.to - SHOP_STREET_DOOR.from, h: WORLD.h - BOTTOM };
/** Where the doctor lines up to walk through the back door: just inside it and just outside it. */
export const SHOP_DOORWAY = { inside: SHOP.y + WALL / 2 + 8, outside: SHOP.y - WALL / 2 - 8 };

/** Labels for the stations, south of each. */
export const LABELS = {
  refiner: { x: REFINER.x, y: SIGN_Y },
  cauldron: { x: CAULDRON.x, y: SIGN_Y },
  refiner2: mirror({ x: REFINER.x, y: SIGN_Y }),
  cauldron2: mirror({ x: CAULDRON.x, y: SIGN_Y }),
};
/** The sign under each crafting station's label that shows, and on a tap changes, what it makes first. */
export const PRIORITY_SIGNS = {
  refiner: { x: REFINER.x, y: PRIORITY_Y },
  cauldron: { x: CAULDRON.x, y: PRIORITY_Y },
  refiner2: mirror({ x: REFINER.x, y: PRIORITY_Y }),
  cauldron2: mirror({ x: CAULDRON.x, y: PRIORITY_Y }),
};

/**
 * Where each station's pallets stand, given by the middle of their bottom edge: one for each kind
 * of goods coming in and one for each kind going out, in the order of PLANTS, REFINED and POTIONS.
 * Goods come in on a column of pallets left of the station and leave from a column right of it, each
 * pallet at the end of its kind's lane.
 */
export interface StationPallets {
  in: { x: number; y: number }[];
  out: { x: number; y: number }[];
}
/** Three pallets down the end of a route heading right, whose first lane is on the north side. */
const acrossRoute = (x: number) => [{ x, y: LINE_Y - 36 }, { x, y: LINE_Y }, { x, y: LINE_Y + 36 }];
const REFINER_PALLETS: StationPallets = { in: acrossRoute(IN_X.refiner), out: acrossRoute(OUT_X.refiner) };
/** The cauldron's six potions leave from two columns of three right of it. */
const CAULDRON_PALLETS: StationPallets = {
  in: acrossRoute(IN_X.cauldron),
  out: [...acrossRoute(OUT_X.cauldron - 14), ...acrossRoute(OUT_X.cauldron + 14)],
};
/**
 * The second line's pallets, mirrored left to right only, so both lines stack their kinds the same
 * way from the top: wheat, mandrake, nightshade. Its routes head left, so the scene flies its pixies
 * on the other side of the route (`LINE2_BELTS`) to keep every kind at the end of its lane.
 */
const mirrorColumn = (column: { x: number; y: number }[]) => column.map(mirror);
const mirrorPallets = (p: StationPallets): StationPallets => ({ in: mirrorColumn(p.in), out: mirrorColumn(p.out) });
/** The second line's belts, which head left, so a lane's side of the route is the other way round. */
export const LINE2_BELTS: readonly BeltId[] = ['garden2', 'refiner2', 'cauldron2'];
/**
 * The shop's shelves, one for each potion, stand along its side walls, where the pixies come in,
 * given by the middle of their bottom edge: the first three potions' on the left wall, the others'
 * on the right. Each appears once its recipe is known.
 */
export const shelfPosition = (i: number) => ({
  x: i < 3 ? SHOP.x + 32 : SHOP.x + SHOP.w - 32,
  y: SHOP.y + 80 + (i % 3) * 50,
});
/** Each shelf's price sign, hung beside it on the shop's side, level with its upper board. */
export const shelfSignPosition = (i: number) => {
  const shelf = shelfPosition(i);
  return { x: shelf.x + (i < 3 ? 44 : -44), y: shelf.y - 26 };
};
export const PALLETS = {
  refiner: REFINER_PALLETS,
  cauldron: CAULDRON_PALLETS,
  refiner2: mirrorPallets(REFINER_PALLETS),
  cauldron2: mirrorPallets(CAULDRON_PALLETS),
  // The counter keeps its potions on shelves instead (see `shelfPosition`).
  counter: { in: [], out: [] } as StationPallets,
};

/** Where a route ending on a column of pallets from the left stops, at its left edge, and where one leaving one starts. */
const endLeftOf = (column: { x: number }[]) => column[0].x - 20;
const startRightOf = (column: { x: number }[]) => Math.max(...column.map((p) => p.x)) + 20;
const mirrorRun = (run: { x: number; y: number }[]) => run.map(mirror);

/**
 * Pixie routes, each from a station's out pallets to the next station's in pallets. The first run of
 * each is the main one goods ride along; further runs are feeders that join it. Each route replaces
 * the markers at its two ends once it is built.
 */
/** Where the garden route gathers the three gardens' goods, just right of them. */
const GARDEN_TRUNK_X = GARDEN.x + GARDEN.w + 26;
const gardenMid = (g: { y: number; h: number }) => g.y + g.h / 2;
const LINE1_BELTS = {
  // From the wheat field down the trunk beside the gardens and right to the table; the mandrake
  // patch's and the shade garden's feeders join the trunk.
  garden: [
    [
      { x: GARDEN.x + GARDEN.w, y: gardenMid(LINE1_GARDENS[0]) },
      { x: GARDEN_TRUNK_X, y: gardenMid(LINE1_GARDENS[0]) },
      { x: GARDEN_TRUNK_X, y: LINE_Y },
      { x: endLeftOf(REFINER_PALLETS.in), y: LINE_Y },
    ],
    [{ x: GARDEN.x + GARDEN.w, y: gardenMid(LINE1_GARDENS[1]) }, { x: GARDEN_TRUNK_X, y: gardenMid(LINE1_GARDENS[1]) }],
    [{ x: GARDEN.x + GARDEN.w, y: gardenMid(SHADE_GARDEN) }, { x: GARDEN_TRUNK_X, y: gardenMid(SHADE_GARDEN) }, { x: GARDEN_TRUNK_X, y: LINE_Y }],
  ],
  // Straight across from the table to the cauldron.
  refiner: [[{ x: startRightOf(REFINER_PALLETS.out), y: LINE_Y }, { x: endLeftOf(CAULDRON_PALLETS.in), y: LINE_Y }]],
  // From the cauldron in through the shop's side wall, to the shelves along it.
  cauldron: [[{ x: startRightOf(CAULDRON_PALLETS.out), y: LINE_Y }, { x: SHOP.x + 32, y: LINE_Y }]],
};
export const BELT_PATHS: Record<BeltId, { x: number; y: number }[][]> = {
  ...LINE1_BELTS,
  // The second line mirrors the first; its cauldron's pixies come in through the right wall.
  garden2: LINE1_BELTS.garden.map(mirrorRun),
  refiner2: LINE1_BELTS.refiner.map(mirrorRun),
  cauldron2: LINE1_BELTS.cauldron.map(mirrorRun),
};

/** The length of a belt run in pixels. */
export const runLength = (run: { x: number; y: number }[]) =>
  run.slice(1).reduce((n, p, i) => n + Math.hypot(p.x - run[i].x, p.y - run[i].y), 0);

/** How far along `run` the point `p` on it is, in pixels. */
function distanceTo(run: { x: number; y: number }[], p: { x: number; y: number }) {
  let d = 0;
  for (let i = 1; i < run.length; i++) {
    const a = run[i - 1], b = run[i];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const along = Math.hypot(p.x - a.x, p.y - a.y);
    if (Math.abs(along + Math.hypot(b.x - p.x, b.y - p.y) - len) < 0.01) return d + along;
    d += len;
  }
  throw new Error(`${p.x},${p.y} is not on the belt`);
}

/** The plants of each garden belt's line's gardens, in the order of the belt's runs. */
const GARDEN_RUNS: Partial<Record<BeltId, readonly PlantId[]>> = {
  garden: ['wheat', 'mandrake', 'nightshade'],
  garden2: ['wheat', 'mandrake', 'nightshade'],
};
/**
 * Which of a belt's runs goods of a kind get on at: on the garden belts, the run from the field of
 * its line that grows them, so mandrakes come in on the feeder from their patch. Everything else gets
 * on at the start of the main run.
 */
function beltRun(id: BeltId, kind: ItemId) {
  const run = GARDEN_RUNS[id]?.indexOf(kind as PlantId) ?? 0;
  return run > 0 && run < BELT_PATHS[id].length ? run : 0;
}

/**
 * Where goods on each of a belt's runs get on and where that run joins the main one, in ms along the
 * main run. Goods on a feeder start as far before its join as the feeder is long, so they ride it at
 * the belt's speed before carrying on along the main run.
 */
const RUN_MS = Object.fromEntries(
  BELTS.map((id) => {
    const [main, ...feeders] = BELT_PATHS[id];
    const msPerPx = BELT_MS[id] / runLength(main);
    const runs = feeders.map((feeder) => {
      const join = distanceTo(main, feeder[feeder.length - 1]);
      return { start: (join - runLength(feeder)) * msPerPx, join: join * msPerPx };
    });
    return [id, [{ start: 0, join: 0 }, ...runs]];
  }),
) as Record<BeltId, { start: number; join: number }[]>;

/**
 * The run goods of a kind ride on a belt (or `run`, the garden's they came from), and where on its
 * main run they get on and join it, in ms.
 */
export const beltSpan = (id: BeltId, kind: ItemId, run?: number) => {
  const on = run !== undefined && run < BELT_PATHS[id].length ? run : beltRun(id, kind);
  return { run: on, ...RUN_MS[id][on] };
};

/**
 * Where the doctor stands to pay for each pixie route: a station's own at the right of the row south
 * of it, the garden route's below the table's row. That one stands out of a long sickle's reach of the
 * plots, so the hands the route empties onto itself don't fill up again from the gardens.
 */
const LINE1_BELT_BUILD = {
  garden: { x: REFINER.x - 50, y: COINS_Y + 76 },
  refiner: { x: REFINER.x + COINS_GAP, y: COINS_Y },
  cauldron: { x: CAULDRON.x + COINS_GAP, y: COINS_Y },
};
export const BELT_BUILD: Record<BeltId, { x: number; y: number }> = {
  ...LINE1_BELT_BUILD,
  garden2: mirror(LINE1_BELT_BUILD.garden),
  refiner2: mirror(LINE1_BELT_BUILD.refiner),
  cauldron2: mirror(LINE1_BELT_BUILD.cauldron),
};

/**
 * Craftsmen: the marker where each station's are hired, in the middle of the row south of it, and
 * where the two of them stand once hired (their feet), side by side just below the station.
 */
const rowCraftsmen = (at: { x: number; y: number }, apart: number) => ({
  hire: { x: at.x, y: COINS_Y },
  stand: [{ x: at.x - apart, y: at.y + 54 }, { x: at.x + apart, y: at.y + 54 }],
});
const mirrorCraftsmen = (c: ReturnType<typeof rowCraftsmen>) => ({ hire: mirror(c.hire), stand: c.stand.map(mirror) });
const REFINER_CRAFTSMEN = rowCraftsmen(REFINER, 24);
const CAULDRON_CRAFTSMEN = rowCraftsmen(CAULDRON, 24);
export const CRAFTSMEN = {
  refiner: REFINER_CRAFTSMEN,
  cauldron: CAULDRON_CRAFTSMEN,
  refiner2: mirrorCraftsmen(REFINER_CRAFTSMEN),
  cauldron2: mirrorCraftsmen(CAULDRON_CRAFTSMEN),
  // Behind the counter, the second on the work spot, clear of the coins; hired at a marker outside
  // the north door, right of the drop-off.
  counter: { hire: { x: COUNTER.x + 80, y: 180 }, stand: [{ x: COUNTER.x - 50, y: COUNTER.y - 24 }, { x: COUNTER.x, y: COUNTER.y - 24 }] },
};
