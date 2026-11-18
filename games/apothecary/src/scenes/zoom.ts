import Phaser from 'phaser';
import { renderScale, viewSize } from '../../../../shared/scaling';

// The player's zoom of a yard's main camera, the same in the apothecary and every town shop: the
// mouse wheel, the + and - keys or a two-finger pinch zoom between the same levels, and the zoom
// is stored once, so walking into another yard keeps it.

/**
 * Closest and farthest the view zooms: out until the whole yard is tall enough to fit, but never past
 * the world's width or height (see `setZoom`), in to double size.
 */
export const MIN_ZOOM = 0.62;
export const MAX_ZOOM = 2;
/** How much one mouse wheel notch or key press zooms. */
const ZOOM_STEP = 1.1;
/** Where the zoom is kept between visits; it's a view preference, so "New game" keeps it. */
const ZOOM_KEY = 'apothecary-zoom';

/**
 * Lets the player zoom `scene`'s main camera over a world of `world.w` x `world.h`, starting from the
 * stored zoom. `hud` is the band at the top of the screen the HUD covers (`hud.band` screen pixels)
 * and how much of the world's top is meant to lie under it (`hud.under` world pixels): the camera may
 * scroll above the world, over the game's background, so nothing below `hud.under` hides under the HUD.
 */
export function setupZoom(scene: Phaser.Scene, world: { w: number; h: number }, hud = { band: 0, under: 0 }) {
  const camera = scene.cameras.main;
  /** The player's zoom; the main camera's own zoom also includes the screen's `renderScale`. */
  const zoom = () => camera.zoom / renderScale;
  const setZoom = (wanted: number) => {
    // Never out past the world's width or height, so the map always fills the view (a 4:3 view is taller than 540).
    const view = viewSize(scene);
    const clamped = Phaser.Math.Clamp(wanted, Math.max(MIN_ZOOM, view.width / world.w, (view.height - hud.band) / (world.h - hud.under)), MAX_ZOOM);
    // A view wider than the world even at the closest zoom (never at 960x540) widens the bounds evenly on both sides.
    const w = Math.max(world.w, view.width / clamped);
    const above = Math.max(0, hud.band / clamped - hud.under);
    camera.setZoom(clamped * renderScale).setBounds((world.w - w) / 2, -above, w, world.h + above);
    writeZoom(clamped);
  };

  setZoom(Number(readZoom()) || 1);
  scene.input.on('wheel', (_p: Phaser.Input.Pointer, _over: unknown, _dx: number, dy: number) => {
    if (dy !== 0) setZoom(zoom() * (dy < 0 ? ZOOM_STEP : 1 / ZOOM_STEP));
  });
  scene.input.keyboard!.on('keydown', (e: KeyboardEvent) => {
    if (e.key === '+' || e.key === '=') setZoom(zoom() * ZOOM_STEP);
    if (e.key === '-' || e.key === '_') setZoom(zoom() / ZOOM_STEP);
  });
  // A second touch pointer, so two fingers can pinch.
  if (scene.input.manager.pointersTotal < 3) scene.input.addPointer(1);
  /** The finger spread and zoom when a two-finger pinch began, or null while there is no pinch. */
  let pinch: { spread: number; zoom: number } | null = null;
  scene.input.on('pointermove', () => {
    const [a, b] = [scene.input.pointer1, scene.input.pointer2];
    if (!a.isDown || !b.isDown) return;
    const spread = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
    if (!pinch) pinch = { spread, zoom: zoom() };
    else if (pinch.spread > 0) setZoom((pinch.zoom * spread) / pinch.spread);
  });
  for (const event of ['pointerup', 'pointerupoutside'])
    scene.input.on(event, () => {
      if (!scene.input.pointer1.isDown || !scene.input.pointer2.isDown) pinch = null;
    });
}

function readZoom() {
  try {
    return localStorage.getItem(ZOOM_KEY);
  } catch {
    return null;
  }
}

function writeZoom(zoom: number) {
  try {
    localStorage.setItem(ZOOM_KEY, String(zoom));
  } catch {
    // Without storage the zoom just isn't remembered.
  }
}
