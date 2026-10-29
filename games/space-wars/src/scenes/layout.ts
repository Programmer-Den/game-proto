import type { Role, UnitId } from '../game/factions';
import { TRACKS, type Track } from '../game/research';
import type { Build } from '../game/world';
import type { TextKey } from '../i18n';

/** The designed view: the game's size at 16:9, where nothing moves. */
export const DESIGN = { w: 960, h: 540 } as const;
/**
 * The view the game is laid out in: the designed size grown to the screen's shape (`fitView`, from
 * `viewSize` at the scene's start). The layout below starts at the designed size and is moved there.
 */
export const VIEW = { w: DESIGN.w, h: DESIGN.h };
/** How much wider (`dx`) and taller (`dy`) the view is than designed: right-pinned things move by `dx`, bottom-pinned ones by `dy`. */
export const GROW = { dx: 0, dy: 0 };
/** How far the command bar's left part moves right (`x`) and its contents up (`lift`) to clear the shared corner buttons: see `fitView`. */
export const LEAD = { x: 0, lift: 0 };
/** The top bar: the faction's crystal and counts. */
export const TOP = { h: 34 };
/** The command bar along the bottom: build and train buttons, and the messages. */
export const BAR = { y: 440, h: 100 };
/** The window of the battlefield on screen, between the bars; the camera scrolls inside it. */
export const MAP_VIEW = { x: 0, y: TOP.h, w: VIEW.w, h: BAR.y - TOP.h };
/** The cover's lettering: a geometric sans, bold italic for headings. System fonts only. */
export const FONT = '"Avenir Next", Futura, "Century Gothic", "Trebuchet MS", "Segoe UI", Inter, system-ui, sans-serif';

export const BUTTON = { w: 107, h: 30 };

export type ButtonKey = Role | UnitId | 'expansion' | Track | 'fallback' | 'flagship' | 'rally';

/** The generic role of each building and unit type, as the buttons and hover labels name it: keys of `i18n/en.ts`. */
export const ROLE_LABEL: Record<ButtonKey, TextKey> = {
  hub: 'roleHub',
  depot: 'roleDepot',
  barracks: 'roleBarracks',
  turret: 'roleTurret',
  harvester: 'roleHarvester',
  scout: 'roleScout',
  gunship: 'roleGunship',
  heavy: 'roleHeavy',
  expansion: 'roleExpansion',
  hull: 'roleResearch',
  weapons: 'roleResearch',
  engines: 'roleResearch',
  fallback: 'roleCommand',
  flagship: 'roleFlagship',
  rally: 'roleCommand',
};

export interface Button {
  kind: 'build' | 'train' | 'research' | 'command';
  key: ButtonKey;
  x: number;
  y: number;
  w: number;
  h: number;
}

const COLUMN = 110;
/**
 * Where the build and train rows start: the bar's bottom-left corner is left clear for the shared
 * corner buttons (full screen, pause), which sit over the canvas there on a phone held
 * sideways and on a 16:9 screen.
 */
export const GRID_X = 84;
const BUILD_ROW = 468;
const TRAIN_ROW = 504;
const BUILD_KEYS: Build[] = ['depot', 'barracks', 'turret', 'expansion'];
const TRAIN_KEYS: UnitId[] = ['harvester', 'scout', 'gunship', 'heavy'];
/** The research column: three slim buttons stacked right of the build and train rows. */
export const RESEARCH_COLUMN = { x: 525, y: 446, w: 106, h: 26, gap: 3 };
/** The Fall back button, at the right end of the message line: sends the selected ships home to repair. */
export const FALL_BACK_BUTTON: Button = { kind: 'command', key: 'fallback', x: 868, y: 445, w: 84, h: 24 };
/** The Flagship button, a slim pill above the build row: locked until the third contract, then builds the one flagship at the hub. */
export const FLAGSHIP_BUTTON: Button = { kind: 'command', key: 'flagship', x: 330, y: 444, w: 191, h: 21 };
/** The Rally button, a slim pill left of the Flagship button (also the R key): plants or moves the rally point for new warships. */
export const RALLY_BUTTON: Button = { kind: 'command', key: 'rally', x: 180, y: 444, w: 144, h: 21 };

/** The buttons of the command bar, in the top-left corner of each one. */
export const BUTTONS: Button[] = [
  ...BUILD_KEYS.map((key, i): Button => ({ kind: 'build', key, x: GRID_X + i * COLUMN, y: BUILD_ROW, ...BUTTON })),
  ...TRAIN_KEYS.map((key, i): Button => ({ kind: 'train', key, x: GRID_X + i * COLUMN, y: TRAIN_ROW, ...BUTTON })),
  ...TRACKS.map((key, i): Button => {
    const c = RESEARCH_COLUMN;
    return { kind: 'research', key, x: c.x, y: c.y + i * (c.h + c.gap), w: c.w, h: c.h };
  }),
  FALL_BACK_BUTTON,
  FLAGSHIP_BUTTON,
  RALLY_BUTTON,
];
/** Where the message line and the contract panel start, right of the research column. */
export let PANEL_X = RESEARCH_COLUMN.x + RESEARCH_COLUMN.w + 8;
/** The rivals panel (truces and tribute), opened from the top bar's rivals or with T: its box on the map's top right, in view pixels. */
export const RIVALS_PANEL = { x: VIEW.w - 326, y: TOP.h + 8, w: 318, head: 24, row: 64 };
/** The minimap: the whole battlefield at a tenth of its size, one pixel a fog cell, in the map's bottom-right corner. */
export const MINIMAP = { x: VIEW.w - 168, y: BAR.y - 108, w: 160, h: 100 };
/** The army count on the top bar: tapping it selects every warship. */
export const ARMY_TAB = { x: 360, w: 70 };
/** The contract pill in the middle of the top bar: its left edge (it is 308 wide). */
export const CONTRACT_PILL = { x: 482 };
/** The part of the top bar that opens the rivals panel when tapped. */
export const RIVALS_TAB = { x: 798, w: VIEW.w - 798 };
/** The contract board over the map's top: its header line and its two cards, in view pixels. */
export const BOARD = { y: MAP_VIEW.y + 6, cardY: MAP_VIEW.y + 26, w: 236, h: 58, gap: 10 };
/** The sector campaign's strip on the faction picker, under the cards: its box and the row of sector nodes. */
export const SECTOR_STRIP = { x: 16, y: 352, w: VIEW.w - 32, h: 82, nodeX: 330, nodeStep: 140, nodeY: 380, r: 13 };
/** The cards a victory offers to keep one perk for the campaign, in a row under the overlay. */
export const KEEP = { y: MAP_VIEW.y + 210, w: 172, h: 64, gap: 8 };

const base = {
  BAR: { ...BAR },
  RESEARCH_COLUMN: { ...RESEARCH_COLUMN },
  RIVALS_PANEL: { ...RIVALS_PANEL },
  MINIMAP: { ...MINIMAP },
  RIVALS_TAB: { ...RIVALS_TAB },
  PANEL_X,
  CONTRACT_PILL: { ...CONTRACT_PILL },
  SECTOR_STRIP: { ...SECTOR_STRIP },
  KEEP: { ...KEEP },
  BUTTONS: BUTTONS.map((b) => ({ ...b })),
};

/**
 * Lays the HUD out for a view of `w` x `h` (the designed size or bigger, see `setupScaling`'s fill
 * mode): the top bar stays on top, the command bar and every button on it move to the bottom, the
 * message line and contract panel stretch to the right edge, the Fall back button, minimap and
 * rivals pin to it, the map's window takes the space between the bars, and the picker, sector strip
 * and perk cards stay centred in it.
 *
 * `corner` is the shared corner buttons' footprint (full screen, pause) in view pixels from
 * the view's bottom-left. A filled view no longer has page bars for them, so when they would cover
 * the build and train rows, a wider view moves the bar's left part right of them (`LEAD.x`), and a
 * taller one lifts the bar's contents over them (`LEAD.lift`, the bar growing to match). At the
 * designed size nothing moves.
 */
export function fitView(w: number, h: number, corner = { w: 0, h: 0 }) {
  const dx = w - DESIGN.w;
  const dy = h - DESIGN.h;
  const need = Math.ceil(Math.max(0, corner.w + 6 - GRID_X));
  const x = need > 0 && need <= dx ? need : 0;
  const lift = need > 0 && !x && dy >= corner.h ? Math.ceil(corner.h) : 0;
  Object.assign(VIEW, { w, h });
  Object.assign(GROW, { dx, dy });
  Object.assign(LEAD, { x, lift });
  BAR.y = base.BAR.y + dy - lift;
  BAR.h = base.BAR.h + lift;
  Object.assign(MAP_VIEW, { w, h: BAR.y - TOP.h });
  RESEARCH_COLUMN.y = base.RESEARCH_COLUMN.y + dy - lift;
  PANEL_X = base.PANEL_X + x;
  RIVALS_PANEL.x = base.RIVALS_PANEL.x + dx;
  Object.assign(MINIMAP, { x: base.MINIMAP.x + dx, y: base.MINIMAP.y + dy - lift });
  RIVALS_TAB.x = base.RIVALS_TAB.x + dx;
  CONTRACT_PILL.x = base.CONTRACT_PILL.x + dx / 2;
  Object.assign(SECTOR_STRIP, {
    x: base.SECTOR_STRIP.x + dx / 2,
    y: base.SECTOR_STRIP.y + dy / 2,
    nodeX: base.SECTOR_STRIP.nodeX + dx / 2,
    nodeY: base.SECTOR_STRIP.nodeY + dy / 2,
  });
  KEEP.y = base.KEEP.y + dy / 2;
  BUTTONS.forEach((b, i) => {
    const from = base.BUTTONS[i];
    b.y = from.y + dy - lift;
    // The Fall back button sits at the right end of the message line, which pins to the right.
    b.x = from.x + (b.key === 'fallback' ? dx : x);
  });
}
