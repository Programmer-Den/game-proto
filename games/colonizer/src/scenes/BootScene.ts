import Phaser from 'phaser';
import { watching } from '../../../../shared/watch';
import { BUILDINGS, FACTION_IDS, RELICS, UNITS, type BuildingId, type FactionId, type RelicId } from '../game/data';
import { bakeFigureSheet, FRAME, WOOL } from '../art/figures';
import { bakeBuilding, bakeBush, bakeCache, bakeFogPattern, bakeMine, bakeNeedle, bakePost, bakeRallyFlag, bakeRelic, bakeTree } from '../art/scenery';
import { bakeBackdrop, bakeButton, bakeCard, bakeIcon, bakePanel, bakeTopBar, type IconKind } from '../art/ui';
import { BOON, DEED_CARD, fitLayout, MENU_CARDS, MENU_MODE, MENU_OPTS, MENU_SCENARIOS, MISSION_CARD, STATUS_CARD, TOAST } from './layout';
import { viewSize } from '../../../../shared/scaling';
import { T } from '../art/stitch';

/**
 * Texture keys. Figures: `fig-<unit type>` for a faction's soldiers and `fig-<unit type>-<faction>`
 * for the units every faction shares (villagers, trade carts and rams), one strip each with frames
 * named `<pose>-<n>` (see figures.ts). Buildings: `bld-<faction>-<type>`; the trading post is `post`.
 * Nodes: `tree-0`..`tree-3`, `bush`, `mine`. Camps: `camp-cache-<res>`, and `camp-relic-<relic>-<faction>`
 * (or `-none` while nobody holds it). Wild guards: `fig-wild-<name>`. The ground is painted by the game in chunks, since
 * each match has its own map.
 */
export const figKey = (type: string, faction: FactionId) => (UNITS[type]?.faction === 'neutral' ? `fig-${type}-${faction}` : `fig-${type}`);
export const buildingKey = (faction: FactionId, type: BuildingId) => `bld-${faction}-${type}`;
export const TREE_VARIANTS = 4;
export const relicKey = (relic: RelicId, holder: FactionId | null) => `camp-relic-${relic}-${holder ?? 'none'}`;

/**
 * How far down the view, in game pixels, the shared full-screen and pause buttons in the top right
 * corner (`setupGame`'s `corner`) reach, safe area included: on a small screen they cover more of the
 * view. The page may be turned round (`shared/scaling.ts`), so this reads layout sizes, not boxes on
 * screen. The canvas is fitted into the window taken the game's way round on a touch screen, like
 * `fillView`, so a phone held upright under the hub's Ask me to turn it measures the canvas it shows
 * once it is turned.
 */
function cornerReach(scene: Phaser.Scene, viewW: number, viewH: number): number {
  const bar = document.querySelector<HTMLElement>('.game-corner');
  let pw = scene.scale.parentSize.width;
  let ph = scene.scale.parentSize.height;
  if (window.matchMedia('(pointer: coarse)').matches && pw > ph !== viewW > viewH) [pw, ph] = [ph, pw];
  const shown = Math.min(ph, (pw * viewH) / viewW);
  if (!bar || !shown) return 0;
  const top = parseFloat(getComputedStyle(bar).top) || 12;
  const canvasTop = Math.max(0, (ph - shown) / 2);
  // The buttons are 30 CSS px tall (`shared/corner.ts`).
  return ((top + 30 - canvasTop) * viewH) / shown;
}

/** Paints every texture once, so the game itself only places sprites. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    // The view's shape is picked once at start: fit the HUD to it before anything is painted.
    const view = viewSize(this);
    fitLayout(view.width, view.height, cornerReach(this, view.width, view.height));
    for (let v = 0; v < TREE_VARIANTS; v++) this.bake(`tree-${v}`, bakeTree(v));
    this.bake('bush', bakeBush());
    this.bake('mine', bakeMine());
    this.bake('post', bakePost());
    this.bake('fog-pattern', bakeFogPattern(256));
    this.bake('needle', bakeNeedle());
    for (const faction of FACTION_IDS) {
      for (const def of Object.values(UNITS)) {
        if (def.faction !== faction && def.faction !== 'neutral') continue;
        const { cv, frames } = bakeFigureSheet(def.id, def.role, faction);
        const tex = this.bake(figKey(def.id, faction), cv);
        frames.forEach(([pose, i], k) => tex.add(`${pose}-${i}`, 0, k * FRAME, 0, FRAME, FRAME));
      }
      for (const type of Object.keys(BUILDINGS) as BuildingId[]) this.bake(buildingKey(faction, type), bakeBuilding(type, faction));
      this.bake(`icon-banner-${faction}`, bakeIcon('banner', 20, WOOL[faction].cloth));
      for (const relic of Object.keys(RELICS) as RelicId[]) this.bake(relicKey(relic, faction), bakeRelic(relic, faction));
    }
    for (const def of Object.values(UNITS)) {
      if (def.faction !== 'wild') continue;
      const { cv, frames } = bakeFigureSheet(def.id, def.role, 'wild');
      const tex = this.bake(figKey(def.id, 'ember'), cv);
      frames.forEach(([pose, i], k) => tex.add(`${pose}-${i}`, 0, k * FRAME, 0, FRAME, FRAME));
    }
    for (const relic of Object.keys(RELICS) as RelicId[]) this.bake(relicKey(relic, null), bakeRelic(relic, null));
    for (const res of ['ore', 'food', 'wood'] as const) this.bake(`camp-cache-${res}`, bakeCache(res));
    for (const kind of ['wood', 'food', 'ore', 'pop', 'clock', 'horn', 'wheat', 'sword', 'feather', 'stone', 'drum'] as IconKind[]) this.bake(`icon-${kind}`, bakeIcon(kind));
    this.bake('rally-flag', bakeRallyFlag());
    this.bake('icon-shield', bakeIcon('shield', 22, T.red));
    this.bake('topbar', bakeTopBar());
    this.bake('panel', bakePanel());
    for (const s of ['on', 'off', 'hot'] as const) this.bake(`btn-${s}`, bakeButton(s));
    for (const s of ['on', 'off', 'hot'] as const) this.bake(`opt-${s}`, bakeButton(s, MENU_OPTS.w, MENU_OPTS.h));
    for (const s of ['on', 'off', 'hot'] as const) this.bake(`mode-${s}`, bakeButton(s, MENU_MODE.w, MENU_OPTS.h));
    for (const s of ['on', 'off', 'hot'] as const) this.bake(`scn-${s}`, bakeButton(s, MENU_SCENARIOS.w, MENU_SCENARIOS.h));
    this.bake('card-mission', bakeCard(MISSION_CARD.w, MISSION_CARD.h, { lw: 1.1 }));
    this.bake('card-deeds', bakeCard(DEED_CARD.w, DEED_CARD.h, { lw: 1.1 }));
    this.bake('card-status', bakeCard(STATUS_CARD.w, STATUS_CARD.h, { lw: 1.1 }));
    this.bake('card-status-tall', bakeCard(STATUS_CARD.w, STATUS_CARD.hMonument, { lw: 1.1 }));
    this.bake('card-toast', bakeCard(TOAST.w, TOAST.h, { pill: true }));
    this.bake('card-boon', bakeCard(BOON.w, BOON.h));
    this.bake('card-boon-hot', bakeCard(BOON.w, BOON.h, { fill: '#f3e2b0', lw: 1.4, hot: true }));
    this.bake('card-pop', bakeCard(56, 18, { pill: true }));
    this.bake('card-faction', bakeCard(MENU_CARDS.w, MENU_CARDS.h));
    this.bake('card-faction-hot', bakeCard(MENU_CARDS.w, MENU_CARDS.h, { fill: '#f3e2b0', lw: 1.4, hot: true }));
    this.bake('card-end', bakeCard(420, 170, { lw: 1.4 }));
    this.bake('card-end-tall', bakeCard(440, 250, { lw: 1.4 }));
    this.bake('backdrop', bakeBackdrop());
    // Watch mode (`?watch`) goes straight to a match between two AIs.
    this.scene.start(watching ? 'Game' : 'Menu');
  }

  private bake(key: string, cv: HTMLCanvasElement) {
    if (this.textures.exists(key)) this.textures.remove(key);
    return this.textures.addCanvas(key, cv)!;
  }
}

