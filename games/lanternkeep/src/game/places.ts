// Where the lanterns hang and where the moths live, in view pixels, for each district the keep can
// stand in. The scenery in src/art/puppet.ts is drawn around these spots.

import type { TextKey } from '../i18n';

/** The moth jar in front of the gate, where idle moths wait and return to. */
export const JAR = { x: 480, y: 500 };
/** The jars moths can rest at: the one at the gate, and the second jar by the east wall, once bought (LK14). */
export const JARS = [JAR, { x: 800, y: 500 }] as const;

/** A lantern spot: where it hangs, and a short name for the herald's orders. */
export interface Spot {
  x: number;
  y: number;
  name: TextKey;
}

/**
 * A lantern chain: lanterns side by side, joined by a cord. A chain whose lanterns are all lit at
 * nightfall pays a bonus. A chain only counts on a night that has every one of its lanterns, so
 * the first night (lanterns 0 to 4) has none. Listed in the order the cord runs.
 */
export interface Chain {
  /** A label for code readers; it is never shown, so it is not translated. */
  name: string;
  lanterns: readonly number[];
}

/**
 * A district the keep can move to at every fifth nightfall (LK10): its ten lantern spots, in the
 * order nights add them (the first night of a game uses the first five of the keep), its chains
 * and its rule. `rule` is applied in state.ts: `seawind` makes each gust blow out a second lantern,
 * `vespers` pays more a lantern but asks for three lanterns in four, `trade` doubles close calls
 * and window calls but burns oil faster, `tide` (the harbour's, LK15) floods the low quay and
 * brings ships to guide in, and `none` changes nothing.
 */
export interface District {
  name: TextKey;
  /** The rule, in a line for the panel. */
  blurb: TextKey;
  rule: 'none' | 'seawind' | 'vespers' | 'trade' | 'tide' | 'avalanche';
  spots: readonly Spot[];
  chains: readonly Chain[];
}

export const DISTRICTS = {
  keep: {
    name: 'keepName',
    blurb: 'keepBlurb',
    rule: 'none',
    spots: [
      { x: 170, y: 184, name: 'spotLeftTower' },
      { x: 790, y: 184, name: 'spotRightTower' },
      { x: 480, y: 112, name: 'spotKeep' },
      { x: 330, y: 304, name: 'spotLeftWall' },
      { x: 630, y: 304, name: 'spotRightWall' },
      { x: 64, y: 304, name: 'spotFarLeft' },
      { x: 896, y: 304, name: 'spotFarRight' },
      { x: 424, y: 230, name: 'spotLeftSconce' },
      { x: 536, y: 230, name: 'spotRightSconce' },
      { x: 480, y: 392, name: 'spotGate' },
    ],
    chains: [
      { name: 'West wall', lanterns: [5, 0, 3] },
      { name: 'East wall', lanterns: [4, 1, 6] },
      { name: 'Keep', lanterns: [7, 2, 8] },
      { name: 'Gate', lanterns: [3, 9, 4] },
    ],
  },
  docks: {
    name: 'docksName',
    blurb: 'docksBlurb',
    rule: 'seawind',
    spots: [
      { x: 150, y: 184, name: 'spotCrane' },
      { x: 810, y: 150, name: 'spotLighthouse' },
      { x: 480, y: 112, name: 'spotMast' },
      { x: 300, y: 304, name: 'spotWarehouse' },
      { x: 660, y: 304, name: 'spotFishHall' },
      { x: 60, y: 304, name: 'spotWestMooring' },
      { x: 900, y: 304, name: 'spotEastMooring' },
      { x: 400, y: 392, name: 'spotLeftQuay' },
      { x: 560, y: 392, name: 'spotRightQuay' },
      { x: 480, y: 230, name: 'spotCustoms' },
    ],
    chains: [
      { name: 'Warehouse', lanterns: [5, 3, 7] },
      { name: 'Fish hall', lanterns: [8, 4, 6] },
      { name: 'Rigging', lanterns: [0, 2, 1] },
      { name: 'Quay', lanterns: [7, 9, 8] },
    ],
  },
  chapel: {
    name: 'chapelName',
    blurb: 'chapelBlurb',
    rule: 'vespers',
    spots: [
      { x: 120, y: 184, name: 'spotBellTower' },
      { x: 840, y: 184, name: 'spotYew' },
      { x: 480, y: 112, name: 'spotSteeple' },
      { x: 280, y: 304, name: 'spotLeftWall' },
      { x: 680, y: 304, name: 'spotRightWall' },
      { x: 60, y: 304, name: 'spotFarLeft' },
      { x: 900, y: 304, name: 'spotFarRight' },
      { x: 410, y: 230, name: 'spotLeftWindow' },
      { x: 550, y: 230, name: 'spotRightWindow' },
      { x: 480, y: 392, name: 'spotPorch' },
    ],
    chains: [
      { name: 'Lychgate', lanterns: [5, 3, 7] },
      { name: 'Yew walk', lanterns: [8, 4, 6] },
      { name: 'Nave', lanterns: [7, 2, 8] },
      { name: 'Porch', lanterns: [3, 9, 4] },
    ],
  },
  market: {
    name: 'marketName',
    blurb: 'marketBlurb',
    rule: 'trade',
    spots: [
      { x: 200, y: 184, name: 'spotLeftGable' },
      { x: 760, y: 184, name: 'spotRightGable' },
      { x: 480, y: 112, name: 'spotClockTower' },
      { x: 320, y: 304, name: 'spotBreadStall' },
      { x: 640, y: 304, name: 'spotClothStall' },
      { x: 100, y: 304, name: 'spotFarLeftStall' },
      { x: 860, y: 304, name: 'spotFarRightStall' },
      { x: 430, y: 230, name: 'spotLeftSconce' },
      { x: 530, y: 230, name: 'spotRightSconce' },
      { x: 480, y: 392, name: 'spotHallArch' },
    ],
    chains: [
      { name: 'West stalls', lanterns: [5, 0, 3] },
      { name: 'East stalls', lanterns: [4, 1, 6] },
      { name: 'Hall', lanterns: [7, 2, 8] },
      { name: 'Arch', lanterns: [3, 9, 4] },
    ],
  },
  /**
   * The harbour town (LK15), the second keep: sailed to from the Great Festival, never one of the
   * fifth nightfall's choices. Its low quay (7, 8, 9) is the row the tide floods; ships are guided
   * in by the lighthouse (1) and the harbour master's lamp (0).
   */
  harbour: {
    name: 'harbourName',
    blurb: 'harbourBlurb',
    rule: 'tide',
    spots: [
      { x: 150, y: 184, name: 'spotHarbourMaster' },
      { x: 820, y: 150, name: 'spotLighthouse' },
      { x: 480, y: 112, name: 'spotSignalMast' },
      { x: 300, y: 304, name: 'spotNetLoft' },
      { x: 660, y: 304, name: 'spotChandler' },
      { x: 60, y: 304, name: 'spotWestBreakwater' },
      { x: 900, y: 304, name: 'spotEastBreakwater' },
      { x: 360, y: 392, name: 'spotWestSlip' },
      { x: 600, y: 392, name: 'spotEastSlip' },
      { x: 480, y: 392, name: 'spotSlipway' },
    ],
    chains: [
      { name: 'Net loft', lanterns: [5, 3, 7] },
      { name: 'Chandler', lanterns: [8, 4, 6] },
      { name: 'Signals', lanterns: [0, 2, 1] },
      { name: 'Slipway', lanterns: [7, 9, 8] },
    ],
  },
  /**
   * The mountain monastery (LK20), the third keep: climbed to from the Great Festival, never one of
   * the fifth nightfall's choices. Its pilgrims' path (7, 8, 9) is the row avalanches bury; the
   * west and east bell towers (0, 1) are rung to warn the pilgrims.
   */
  monastery: {
    name: 'monasteryName',
    blurb: 'monasteryBlurb',
    rule: 'avalanche',
    spots: [
      { x: 160, y: 184, name: 'spotWestBell' },
      { x: 800, y: 184, name: 'spotEastBell' },
      { x: 480, y: 112, name: 'spotDome' },
      { x: 310, y: 304, name: 'spotCloister' },
      { x: 650, y: 304, name: 'spotRefectory' },
      { x: 64, y: 304, name: 'spotWestCrag' },
      { x: 896, y: 304, name: 'spotEastCrag' },
      { x: 340, y: 392, name: 'spotLowerPath' },
      { x: 620, y: 392, name: 'spotUpperPath' },
      { x: 480, y: 392, name: 'spotShrine' },
    ],
    chains: [
      { name: 'West cloister', lanterns: [5, 0, 3] },
      { name: 'East cloister', lanterns: [4, 1, 6] },
      { name: 'Bells', lanterns: [0, 2, 1] },
      { name: 'Path', lanterns: [7, 9, 8] },
    ],
  },
} as const satisfies Record<string, District>;
export type DistrictId = keyof typeof DISTRICTS;
export const DISTRICT_IDS = Object.keys(DISTRICTS) as DistrictId[];
/** The districts of the first keep, offered at a fifth nightfall (the harbour is sailed to and the monastery climbed to instead). */
export const MOVE_IDS: readonly DistrictId[] = ['keep', 'docks', 'chapel', 'market'];
/** The lanterns that guide the harbour's ships in, in the order ships ask for them. */
export const SHIP_GUIDES = [1, 0] as const;
/** The monastery's bell towers, rung to warn the pilgrims (LK20), in the order the pilgrims need them. */
export const BELL_TOWERS = [0, 1] as const;

/** The keep's lantern spots, where every game starts: the first night uses the first five. */
export const LANTERN_SPOTS: readonly Spot[] = DISTRICTS.keep.spots;

/** Where idle moth `i` of the `n` resting at `jar` sits on its rim. */
export function mothRest(i: number, n: number, jar: { x: number; y: number } = JAR) {
  return { x: jar.x + (i - (n - 1) / 2) * 30, y: jar.y - 30 };
}
