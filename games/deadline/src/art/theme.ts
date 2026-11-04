import type { CrateKind, OperationKind, OutpostKind, Role, UpgradeKind } from '../game/rules';
import type { ArtStyle } from '../game/save';

// The colours and type of each art style's HUD, labels and overlays. System font stacks only: no
// web fonts to load.

/** Each upgrade's colour: the crate's band in the comic, its chemlight in night vision. */
export const UPGRADE_COLORS: Record<UpgradeKind, string> = {
  rate: '#ffd23f',
  damage: '#ff6a3a',
  companion: '#4ab0ff',
  pierce: '#6ae06a',
};
/** Every crate's colour: the upgrades', and sandbag tan for a sandbag crate. */
export const CRATE_COLORS: Record<CrateKind, string> = { ...UPGRADE_COLORS, sandbag: '#e0c088' };
/** The acid of spitters and bosses, and the riot shield's bar. */
export const ACID_COLOR = '#a6e03a';
export const SHIELD_COLOR = '#7ab8e8';
/** A survivor's health bar and label, and the burn of fire rounds. */
export const SURVIVOR_COLOR = '#ffd9a8';
export const BURN_COLOR = '#ff8a2a';
/** The squad roles' colours (badges and cards in the comic), the outpost upgrades' and the operations' bands. */
export const ROLE_COLORS: Record<Role, string> = { gunner: '#4ab0ff', grenadier: '#ff9a3a', marksman: '#b48aff' };
export const OUTPOST_COLORS: Record<OutpostKind, string> = { barricade: '#e0c088', medic: '#5ad07a', depot: '#ff8a2a', veteran: '#4ab0ff' };
export const OPERATION_COLORS: Record<OperationKind, string> = {
  road: '#ffd23f', hospital: '#5ad07a', lightsout: '#8a8ae8', fogbank: '#a8b8c4', bridges: '#e8a04a', evac: '#e8709a', daily: '#4ac0e8',
};

export interface Theme {
  /** Font family for Phaser text, and its style ('italic bold' or 'bold'). */
  font: string;
  fontStyle: string;
  /** The same family for painting on canvases. */
  canvasFont: string;
  ink: string;
  /** Main text, numbers that matter, quieter text. */
  text: string;
  value: string;
  muted: string;
  /** The highlight: frenzy, the drum's ring, the best wave chip. */
  accent: string;
  /** Warnings: the boss coming, game over. */
  warn: string;
  /** The fill of an enemy's health bar and the boss bar. */
  hp: string;
}

const COMIC_FONT = '"Arial Black", "Helvetica Neue", Helvetica, Arial, system-ui, sans-serif';
const MONO_FONT = 'ui-monospace, "DejaVu Sans Mono", Menlo, Consolas, "Courier New", monospace';

export const COMIC: Theme = {
  font: COMIC_FONT,
  fontStyle: 'italic bold',
  canvasFont: COMIC_FONT,
  ink: '#15121a',
  text: '#15121a',
  value: '#ffe04a',
  muted: '#d8d0e8',
  accent: '#ff8a2a',
  warn: '#c03a1a',
  hp: '#e2593f',
};

export const NV: Theme = {
  font: MONO_FONT,
  fontStyle: 'bold',
  canvasFont: MONO_FONT,
  ink: '#020a05',
  text: '#d8ffd0',
  value: '#d8ffd0',
  muted: '#8fc896',
  accent: '#ffb43a',
  warn: '#ff8a5a',
  hp: '#ffb43a',
};

export const THEMES: Record<ArtStyle, Theme> = { comic: COMIC, nv: NV };
