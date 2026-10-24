import type { SharedKey } from './i18n/en';

/**
 * Settings shared by every game, set on the hub's Settings panel and read by each game when it
 * starts. They live under one storage key next to the games' own saves (every game shares the
 * hub's origin), so starting a new game in one of them keeps them.
 *
 * To add a setting: add it to `Settings` and `DEFAULTS`, describe it in `SETTING_FIELDS` so the hub
 * panel shows it, and honour it in the games (in `setupGame` when it can be done for all of them).
 * A setting marked "hub only" changes just the hub page, and no game reads it.
 */

export const DIFFICULTIES = ['easy', 'normal', 'hard'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

/** The frame rates the frame cap offers. */
export const FRAME_RATES = [30, 60, 144, 160, 240, 320] as const;
export type FrameRate = (typeof FRAME_RATES)[number];

/**
 * The languages the hub and the shared screens speak; each game translates its own text
 * (`i18n.ts`). `en` is British English, the source every other language translates; `en-US` only
 * changes the spelling where it differs, and the numbers and dates.
 */
export const LANGUAGES = ['en', 'en-US', 'de'] as const;
export type Language = (typeof LANGUAGES)[number];
/** Each language's own name, the same whatever language is chosen. */
export const LANGUAGE_NAMES: Record<Language, string> = { en: 'English (UK)', 'en-US': 'English (US)', de: 'Deutsch' };

/**
 * When the installed apps download a new version (`install.ts`, `scripts/sw.js`): always, only on
 * WiFi (on mobile data or Data Saver they wait), or never until Update now is pressed.
 */
export const UPDATE_MODES = ['auto', 'wifi', 'off'] as const;
export type UpdateMode = (typeof UPDATE_MODES)[number];
/**
 * Whether this browser tells WiFi from mobile data (`navigator.connection.type`, which only Android
 * browsers built on Chrome have). Elsewhere Wi-Fi only isn't offered, and a saved one reads as Automatic.
 */
export const WIFI_KNOWN =
  typeof navigator !== 'undefined' && 'type' in ((navigator as { connection?: object }).connection ?? {});
const UPDATE_CHOICES = UPDATE_MODES.filter((u) => u !== 'wifi' || WIFI_KNOWN);
const UPDATE_LABELS = { auto: 'updatesAuto', wifi: 'updatesWifi', off: 'off' } as const;

/**
 * What a game does on a phone held the wrong way for it (`scaling.ts`): turns its picture round to
 * fill the screen, or asks the player to turn the phone and waits.
 */
export const TURN_MODES = ['turn', 'ask'] as const;
export type TurnMode = (typeof TURN_MODES)[number];
const TURN_LABELS = { turn: 'turnGame', ask: 'turnAsk' } as const;

export interface Settings {
  /** How hard every game plays; each game decides what that scales. Normal is the game as designed. */
  difficulty: Difficulty;
  /** The most frames per second a game updates and draws. */
  fps: FrameRate;
  /** Shows the frame rate a game reaches in its corner. */
  showFps: boolean;
  /** Turns off camera shake, flashes and blinking hit effects. */
  reduceMotion: boolean;
  /** The language of the hub, the shared screens and every game that has been translated. */
  language: Language;
  /** How loud the music plays, 0 to 100. */
  music: number;
  /** How loud the sound effects play, 0 to 100. */
  effects: number;
  /** Silences every sound; the sound button in each game's corner and the M key switch it. */
  muted: boolean;
  /** Hub only: shows a row of genres above the games to filter the cards by. */
  genreFilter: boolean;
  /** When the installed apps download a new version. */
  updates: UpdateMode;
  /** What a game does on a phone held the wrong way for it. */
  turn: TurnMode;
  /** Lets a game controller move around the hub and the game screens, and steer a cursor in the games (`gamepad.ts`). */
  controller: boolean;
  /** How fast the controller's cursor moves, 1 to 10 (`padCursor.ts`). */
  cursorSpeed: number;
}

export const DEFAULTS: Settings = {
  difficulty: 'normal',
  fps: 60,
  showFps: false,
  reduceMotion: false,
  language: 'en',
  music: 60,
  effects: 80,
  muted: false,
  genreFilter: false,
  updates: WIFI_KNOWN ? 'wifi' : 'auto',
  turn: 'turn',
  controller: true,
  cursorSpeed: 5,
};

/**
 * One row of the hub's Settings panel. Labels and hints are keys of the shared texts
 * (`i18n/en.ts`), so the panel shows them in the chosen language; an option with `text` shows it as is.
 */
export type SettingOption = { value: string | number } & ({ label: SharedKey } | { text: string });
export type SettingField =
  | { key: keyof Settings; label: SharedKey; hint: SharedKey; kind: 'choice'; options: readonly SettingOption[] }
  | { key: keyof Settings; label: SharedKey; hint: SharedKey; kind: 'toggle' }
  | { key: keyof Settings; label: SharedKey; hint: SharedKey; kind: 'range'; min: number; max: number; step: number };

/** The volumes go from silent to full in steps of 5. */
const VOLUME = { kind: 'range', min: 0, max: 100, step: 5 } as const;

export const SETTING_FIELDS: readonly SettingField[] = [
  {
    key: 'language',
    label: 'settingLanguage',
    hint: 'settingLanguageHint',
    kind: 'choice',
    options: LANGUAGES.map((l) => ({ value: l, text: LANGUAGE_NAMES[l] })),
  },
  {
    key: 'difficulty',
    label: 'settingDifficulty',
    hint: 'settingDifficultyHint',
    kind: 'choice',
    options: DIFFICULTIES.map((d) => ({ value: d, label: d })),
  },
  {
    key: 'fps',
    label: 'settingFps',
    hint: 'settingFpsHint',
    kind: 'choice',
    options: FRAME_RATES.map((fps) => ({ value: fps, text: String(fps) })),
  },
  { key: 'showFps', label: 'settingShowFps', hint: 'settingShowFpsHint', kind: 'toggle' },
  { key: 'reduceMotion', label: 'settingReduceMotion', hint: 'settingReduceMotionHint', kind: 'toggle' },
  { key: 'music', label: 'settingMusic', hint: 'settingMusicHint', ...VOLUME },
  { key: 'effects', label: 'settingEffects', hint: 'settingEffectsHint', ...VOLUME },
  { key: 'muted', label: 'settingMuted', hint: 'settingMutedHint', kind: 'toggle' },
  { key: 'genreFilter', label: 'settingGenreFilter', hint: 'settingGenreFilterHint', kind: 'toggle' },
  {
    key: 'updates',
    label: 'settingUpdates',
    hint: WIFI_KNOWN ? 'settingUpdatesWifiHint' : 'settingUpdatesHint',
    kind: 'choice',
    options: UPDATE_CHOICES.map((u) => ({ value: u, label: UPDATE_LABELS[u] })),
  },
  {
    key: 'turn',
    label: 'settingTurn',
    hint: 'settingTurnHint',
    kind: 'choice',
    options: TURN_MODES.map((m) => ({ value: m, label: TURN_LABELS[m] })),
  },
  { key: 'controller', label: 'settingController', hint: 'settingControllerHint', kind: 'toggle' },
  { key: 'cursorSpeed', label: 'settingCursorSpeed', hint: 'settingCursorSpeedHint', kind: 'range', min: 1, max: 10, step: 1 },
];

export const SETTINGS_KEY = 'hub-settings';

/** Reads the settings, keeping only known keys with valid values. */
export function loadSettings(): Settings {
  let saved: Partial<Record<keyof Settings, unknown>> = {};
  try {
    saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') ?? {};
  } catch {
    // Blocked storage (private mode) or a broken value: use the defaults.
  }
  return {
    difficulty: DIFFICULTIES.find((d) => d === saved.difficulty) ?? DEFAULTS.difficulty,
    fps: FRAME_RATES.find((f) => f === saved.fps) ?? DEFAULTS.fps,
    showFps: typeof saved.showFps === 'boolean' ? saved.showFps : DEFAULTS.showFps,
    reduceMotion: typeof saved.reduceMotion === 'boolean' ? saved.reduceMotion : DEFAULTS.reduceMotion,
    language: LANGUAGES.find((l) => l === saved.language) ?? DEFAULTS.language,
    music: volume(saved.music, DEFAULTS.music),
    effects: volume(saved.effects, DEFAULTS.effects),
    muted: typeof saved.muted === 'boolean' ? saved.muted : DEFAULTS.muted,
    genreFilter: typeof saved.genreFilter === 'boolean' ? saved.genreFilter : DEFAULTS.genreFilter,
    updates:
      saved.updates === 'wifi' && !WIFI_KNOWN
        ? 'auto'
        : (UPDATE_CHOICES.find((u) => u === saved.updates) ?? DEFAULTS.updates),
    turn: TURN_MODES.find((m) => m === saved.turn) ?? DEFAULTS.turn,
    controller: typeof saved.controller === 'boolean' ? saved.controller : DEFAULTS.controller,
    cursorSpeed:
      typeof saved.cursorSpeed === 'number' && saved.cursorSpeed >= 1 && saved.cursorSpeed <= 10
        ? Math.round(saved.cursorSpeed)
        : DEFAULTS.cursorSpeed,
  };
}

function volume(value: unknown, fallback: number) {
  return typeof value === 'number' && value >= 0 && value <= 100 ? Math.round(value) : fallback;
}

/** Saves a change made inside a game (the sound button, the pause screen's volumes) on top of what is stored. */
export function updateSettings(patch: Partial<Settings>) {
  saveSettings({ ...loadSettings(), ...patch });
}

export function saveSettings(settings: Settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Storage can be blocked (private mode); the settings last until the page closes.
  }
}

/** The settings as they were when the page loaded; games read these. */
export const settings: Readonly<Settings> = loadSettings();

/** Picks the value for the chosen difficulty, e.g. `byDifficulty(1.4, 1, 0.75)`. */
export function byDifficulty<T>(easy: T, normal: T, hard: T): T {
  return { easy, normal, hard }[settings.difficulty];
}
