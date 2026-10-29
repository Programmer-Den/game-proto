import { loadSettings, type Settings } from './settings';

/**
 * Sound for every game, made in code: no audio files. Sound effects are short synthesized sounds
 * in a retro style, described by a few numbers each (`SoundDef`) and rendered once into buffers.
 * Music is chiptune written as note text (`Song`), played by four chip voices: a pulse lead, a
 * square harmony, a triangle bass and noise drums.
 *
 * - `sounds(defs)` gives a game a `play(name)` for its own sound table; `ui` has the shared ones
 *   (a click, the refusal buzz every game plays for an action it can't do, and the trophy fanfare).
 * - `playMusic(song, part)` starts a song, or switches to another part of it at the next bar;
 *   `playSting(song, part)` plays a part once over the music, which ducks; `stopMusic()` stops it.
 * - The volumes and mute come from the hub's settings (`music`, `effects`, `muted`); the sound
 *   button and the pause screen change them while a game runs (`setVolumes`).
 *
 * Browsers only let sound start after a tap or key press, so nothing is created until
 * `unlockAudio()` is called from one (the start screen's Start button, the first tap on the page).
 * A song asked for before that starts then. The start and pause screens call `suspendAudio()` and
 * `resumeAudio()`. Under browser automation (`navigator.webdriver`) nothing plays at all, so the
 * playthroughs run exactly as without sound; a test that wants sound sets `window.playSound`.
 */

export type Wave = 'square' | 'pulse25' | 'pulse12' | 'triangle' | 'sawtooth' | 'sine' | 'noise';

export interface SoundDef {
  wave: Wave;
  /** Pitch at the start, in Hz. For noise, how often it changes: low is a rumble, high a hiss. */
  freq: number;
  /** Pitch at the end, sliding from `freq`; the same as `freq` when left out. */
  to?: number;
  /** Seconds the sound lasts, fading out after `attack`. */
  length: number;
  /** Seconds to fade in; 0.005 when left out, a click-free start. */
  attack?: number;
  /** Semitone steps played one after another (`[0, 4, 7]` is a major arpeggio), `arpStep` seconds apart. */
  arp?: number[];
  arpStep?: number;
  /** 0 to 1; 0.5 when left out. */
  volume?: number;
  /** The shortest time between two plays of this sound, in ms (40 when left out); plays sooner are dropped. */
  gap?: number;
  /** A random change of pitch on each play, as a fraction: 0.05 is up to 5% higher or lower. */
  vary?: number;
}

export interface PlayOptions {
  /** Times the pitch, e.g. 1.25 for a cascade's next step. */
  pitch?: number;
  /** Times the volume. */
  volume?: number;
}

/** A chip voice of a song. */
export type Channel = 'lead' | 'harmony' | 'bass' | 'drums';

/**
 * One part of a song (calm, battle, boss, a sting): a line of note text per voice. Steps are
 * separated by spaces (`|` between bars is ignored): a note like `c4`, `f#3` or `bb2`, `.` to hold
 * the note before for another step, or `-` for a rest. Drums take `k` (kick), `s` (snare), `h`
 * (hat) and `-`. A voice shorter than the part repeats, so a one-bar bass can run under a
 * four-bar tune.
 */
export type Part = Partial<Record<Channel, string>>;

export interface Song {
  bpm: number;
  /** Steps per beat; 4 (sixteenth notes) when left out. */
  steps?: number;
  /** Loudness of each voice, 0 to 1, over the defaults. */
  mix?: Partial<Record<Channel, number>>;
  /** Waves for the melodic voices over the defaults (pulse25 lead, square harmony, triangle bass). */
  waves?: Partial<Record<Exclude<Channel, 'drums'>, Wave>>;
  parts: Record<string, Part>;
}

/** At most this many sound effects at once; more are dropped, so a battle never turns into noise. */
const MAX_VOICES = 12;
/** How far ahead the music is scheduled, in seconds; the timer that does it runs every 25ms. */
const LOOKAHEAD = 0.12;
const DEFAULT_MIX: Record<Channel, number> = { lead: 0.16, harmony: 0.08, bass: 0.26, drums: 0.3 };
const DEFAULT_WAVES = { lead: 'pulse25', harmony: 'square', bass: 'triangle' } as const;
/** How low the music goes while a sting plays. */
const DUCK = 0.3;

const enabled = () => !navigator.webdriver || (window as { playSound?: boolean }).playSound === true;

let ctx: AudioContext | null = null;
let master: GainNode;
let musicBus: GainNode;
let effectsBus: GainNode;
let volumes: Pick<Settings, 'music' | 'effects' | 'muted'> = loadSettings();

/** Makes the audio context on the first tap or key press; call it from one. */
export function unlockAudio() {
  if (!enabled()) return;
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.connect(ctx.destination);
    musicBus = ctx.createGain();
    musicBus.connect(master);
    effectsBus = ctx.createGain();
    effectsBus.connect(master);
    applyVolumes();
    if (wanted) startMusic(wanted.song, wanted.part);
  }
  if (ctx.state === 'suspended' && !suspended) void ctx.resume();
}

let suspended = false;
/**
 * Whether sounds may play: a context just made still reads `suspended` in some browsers until it starts a moment
 * later, and what is played meanwhile starts with it; only the pause's suspend holds sounds back.
 */
const playable = (c: AudioContext | null): c is AudioContext => !!c && c.state !== 'closed' && !suspended;
/** Stops every sound in place while a game is paused. */
export function suspendAudio() {
  suspended = true;
  void ctx?.suspend();
}
export function resumeAudio() {
  suspended = false;
  void ctx?.resume();
}

/** Changes the volumes or mute while a game runs. */
export function setVolumes(patch: Partial<typeof volumes>) {
  volumes = { ...volumes, ...patch };
  applyVolumes();
}

function applyVolumes() {
  if (!ctx) return;
  const now = ctx.currentTime;
  // Squared, so the slider's middle sounds like half as loud rather than nearly full.
  master.gain.setTargetAtTime(volumes.muted ? 0 : 1, now, 0.02);
  musicBus.gain.setTargetAtTime((volumes.music / 100) ** 2, now, 0.02);
  effectsBus.gain.setTargetAtTime((volumes.effects / 100) ** 2, now, 0.02);
}

// ---------------------------------------------------------------------------------------------
// Sound effects

/**
 * A game's sound table: `const sfx = sounds({ coin: {...}, hit: {...} })`, then `sfx('coin')`.
 * Each sound is rendered the first time it plays.
 */
export function sounds<K extends string>(defs: Record<K, SoundDef>) {
  const buffers = new Map<K, AudioBuffer>();
  const last = new Map<K, number>();
  return (name: K, options: PlayOptions = {}) => {
    if (!playable(ctx) || volumes.muted || volumes.effects === 0) return;
    const def = defs[name];
    const now = ctx.currentTime;
    if (now - (last.get(name) ?? -Infinity) < (def.gap ?? 40) / 1000 || active >= MAX_VOICES) return;
    last.set(name, now);
    let buffer = buffers.get(name);
    if (!buffer) buffers.set(name, (buffer = render(ctx, def)));
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const vary = def.vary ?? 0;
    source.playbackRate.value = (options.pitch ?? 1) * (1 + (Math.random() * 2 - 1) * vary);
    let out: AudioNode = source;
    if (options.volume !== undefined && options.volume !== 1) {
      const gain = ctx.createGain();
      gain.gain.value = options.volume;
      source.connect(gain);
      out = gain;
    }
    out.connect(effectsBus);
    active++;
    source.onended = () => active--;
    source.start();
  };
}
let active = 0;

/** Draws a sound into a buffer, sample by sample. */
function render(context: BaseAudioContext, def: SoundDef): AudioBuffer {
  const rate = context.sampleRate;
  const length = Math.max(1, Math.round(def.length * rate));
  const buffer = context.createBuffer(1, length, rate);
  const data = buffer.getChannelData(0);
  const attack = Math.max(1, (def.attack ?? 0.005) * rate);
  const volume = def.volume ?? 0.5;
  const arpStep = (def.arpStep ?? 0.06) * rate;
  // A seeded generator, so a sound is the same every time it is rendered.
  let seed = 12345;
  const random = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * 2 - 1;
  let phase = 0;
  let held = random();
  for (let i = 0; i < length; i++) {
    const t = i / length;
    let freq = def.freq * ((def.to ?? def.freq) / def.freq) ** t;
    if (def.arp?.length) freq *= 2 ** (def.arp[Math.min(def.arp.length - 1, Math.floor(i / arpStep))] / 12);
    const before = phase;
    phase = (phase + freq / rate) % 1;
    let sample: number;
    if (def.wave === 'noise') {
      if (phase < before) held = random();
      sample = held;
    } else sample = wave(def.wave, phase);
    const envelope = i < attack ? i / attack : (1 - (i - attack) / (length - attack)) ** 2;
    data[i] = sample * envelope * volume;
  }
  return buffer;
}

function wave(kind: Exclude<Wave, 'noise'>, phase: number) {
  switch (kind) {
    case 'square':
      return phase < 0.5 ? 1 : -1;
    case 'pulse25':
      return phase < 0.25 ? 1 : -1;
    case 'pulse12':
      return phase < 0.125 ? 1 : -1;
    case 'triangle':
      return 1 - 4 * Math.abs(phase - 0.5);
    case 'sawtooth':
      return 2 * phase - 1;
    case 'sine':
      return Math.sin(phase * 2 * Math.PI);
  }
}

/** The sounds every game shares, so the same action sounds the same everywhere. */
export const ui = sounds({
  /** A button or a choice. */
  click: { wave: 'square', freq: 880, to: 660, length: 0.05, volume: 0.25 },
  /** An action the game refuses: can't afford it, can't place it there. */
  refuse: { wave: 'square', freq: 150, to: 110, length: 0.16, volume: 0.3, gap: 120 },
  /** Coins gained. */
  coin: { wave: 'square', freq: 988, arp: [0, 5], arpStep: 0.05, length: 0.18, volume: 0.3 },
  /** A trophy earned (`trophies.ts`): a rising fanfare. */
  trophy: { wave: 'pulse25', freq: 523, arp: [0, 4, 7, 12], arpStep: 0.09, length: 0.5, volume: 0.3, gap: 400 },
});

// ---------------------------------------------------------------------------------------------
// Music

interface Note {
  /** Step the note starts on. */
  at: number;
  /** Steps it lasts. */
  steps: number;
  /** Hz, or the drum. */
  pitch: number | 'k' | 's' | 'h';
}
interface Track {
  notes: Note[];
  length: number;
}

const NOTE_INDEX: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };

/** Reads one voice's note text. */
function parse(text: string, drums: boolean): Track {
  const tokens = text.split(/\s+/).filter((token) => token && token !== '|');
  const notes: Note[] = [];
  tokens.forEach((token, at) => {
    if (token === '-') return;
    if (token === '.') {
      const lastNote = notes[notes.length - 1];
      if (lastNote && lastNote.at + lastNote.steps === at) lastNote.steps++;
      return;
    }
    if (drums) {
      if (token === 'k' || token === 's' || token === 'h') notes.push({ at, steps: 1, pitch: token });
      return;
    }
    const match = /^([a-g])(#|b)?(-?\d)$/.exec(token.toLowerCase());
    if (!match) throw new Error(`Unknown note "${token}"`);
    const semitone = NOTE_INDEX[match[1]] + (match[2] === '#' ? 1 : match[2] === 'b' ? -1 : 0);
    const midi = 12 * (Number(match[3]) + 1) + semitone;
    notes.push({ at, steps: 1, pitch: 440 * 2 ** ((midi - 69) / 12) });
  });
  return { notes, length: tokens.length };
}

const parsed = new WeakMap<Part, Partial<Record<Channel, Track>>>();
function tracks(part: Part) {
  let result = parsed.get(part);
  if (!result) {
    result = {};
    for (const channel of Object.keys(part) as Channel[]) result[channel] = parse(part[channel]!, channel === 'drums');
    parsed.set(part, result);
  }
  return result;
}

/** Plays one song's parts, looping or once, on the audio clock. */
class Player {
  private readonly out: GainNode;
  private part: Part;
  private next: Part | null = null;
  private step = 0;
  private time: number;
  private timer: number;
  private readonly stepTime: number;
  private readonly bar: number;

  constructor(
    private readonly context: AudioContext,
    private readonly song: Song,
    partName: string,
    private readonly loop: boolean,
    private readonly onEnd?: () => void,
  ) {
    this.part = partOf(song, partName);
    this.stepTime = 60 / song.bpm / (song.steps ?? 4);
    this.bar = 4 * (song.steps ?? 4);
    this.out = context.createGain();
    this.out.connect(musicBus);
    this.time = context.currentTime + 0.05;
    this.timer = window.setInterval(() => this.schedule(), 25);
    this.schedule();
  }

  /** Switches to another part at the start of the next bar. */
  switchTo(partName: string) {
    const part = partOf(this.song, partName);
    this.next = part === this.part ? null : part;
  }

  duck(on: boolean) {
    this.out.gain.setTargetAtTime(on ? DUCK : 1, this.context.currentTime, 0.05);
  }

  /** The length of the current part, in steps: its longest voice. */
  private get length() {
    return Math.max(1, ...Object.values(tracks(this.part)).map((track) => track!.length));
  }

  stop(fade = 0.3) {
    window.clearInterval(this.timer);
    const now = this.context.currentTime;
    this.out.gain.setTargetAtTime(0, now, fade / 3);
    window.setTimeout(() => this.out.disconnect(), (fade + 0.5) * 1000);
  }

  private schedule() {
    while (this.time < this.context.currentTime + LOOKAHEAD) {
      if (this.next && this.step % this.bar === 0) {
        this.part = this.next;
        this.next = null;
        this.step = 0;
      }
      if (!this.loop && this.step >= this.length) {
        window.clearInterval(this.timer);
        window.setTimeout(() => this.onEnd?.(), Math.max(0, (this.time - this.context.currentTime) * 1000));
        return;
      }
      const all = tracks(this.part);
      for (const channel of Object.keys(all) as Channel[]) {
        const track = all[channel]!;
        const at = this.step % track.length;
        for (const note of track.notes) if (note.at === at) this.voice(channel, note);
      }
      this.step++;
      this.time += this.stepTime;
    }
  }

  private voice(channel: Channel, note: Note) {
    const level = this.song.mix?.[channel] ?? DEFAULT_MIX[channel];
    if (typeof note.pitch === 'number') {
      const kind = this.song.waves?.[channel as Exclude<Channel, 'drums'>] ?? DEFAULT_WAVES[channel as Exclude<Channel, 'drums'>];
      tone(this.context, this.out, kind, note.pitch, this.time, note.steps * this.stepTime, level);
    } else drum(this.context, this.out, note.pitch, this.time, level);
  }
}

function partOf(song: Song, name: string) {
  const part = song.parts[name];
  if (!part) throw new Error(`The song has no part "${name}"`);
  return part;
}

const periodicWaves = new Map<string, PeriodicWave>();
/** A pulse wave of the given duty as Fourier terms, since an oscillator's own square is 50% only. */
function pulse(context: AudioContext, duty: number) {
  const id = String(duty);
  let result = periodicWaves.get(id);
  if (!result) {
    const n = 32;
    const real = new Float32Array(n);
    const imag = new Float32Array(n);
    for (let k = 1; k < n; k++) {
      real[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty * 2) / 2;
      imag[k] = (2 / (k * Math.PI)) * (1 - Math.cos(k * Math.PI * duty * 2)) / 2;
    }
    result = context.createPeriodicWave(real, imag);
    periodicWaves.set(id, result);
  }
  return result;
}

function tone(context: AudioContext, out: AudioNode, kind: Wave, freq: number, at: number, length: number, level: number) {
  const osc = context.createOscillator();
  if (kind === 'pulse25' || kind === 'pulse12') osc.setPeriodicWave(pulse(context, kind === 'pulse25' ? 0.25 : 0.125));
  else if (kind !== 'noise') osc.type = kind;
  osc.frequency.value = freq;
  const gain = context.createGain();
  const end = at + Math.max(0.03, length * 0.92);
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(level, at + 0.005);
  gain.gain.setTargetAtTime(level * 0.7, at + 0.01, 0.08);
  gain.gain.setTargetAtTime(0, end - 0.02, 0.01);
  osc.connect(gain).connect(out);
  osc.start(at);
  osc.stop(end + 0.05);
}

let noise: AudioBuffer | null = null;
function drum(context: AudioContext, out: AudioNode, kind: 'k' | 's' | 'h', at: number, level: number) {
  const gain = context.createGain();
  gain.connect(out);
  if (kind === 'k') {
    const osc = context.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, at);
    osc.frequency.exponentialRampToValueAtTime(45, at + 0.12);
    gain.gain.setValueAtTime(level * 1.6, at);
    gain.gain.exponentialRampToValueAtTime(0.001, at + 0.15);
    osc.connect(gain);
    osc.start(at);
    osc.stop(at + 0.16);
    return;
  }
  if (!noise) {
    noise = context.createBuffer(1, context.sampleRate / 2, context.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  const source = context.createBufferSource();
  source.buffer = noise;
  const filter = context.createBiquadFilter();
  filter.type = kind === 'h' ? 'highpass' : 'bandpass';
  filter.frequency.value = kind === 'h' ? 7000 : 1800;
  const length = kind === 'h' ? 0.04 : 0.14;
  gain.gain.setValueAtTime(level * (kind === 'h' ? 0.5 : 1), at);
  gain.gain.exponentialRampToValueAtTime(0.001, at + length);
  source.connect(filter).connect(gain);
  source.start(at);
  source.stop(at + length + 0.01);
}

let current: { song: Song; player: Player } | null = null;
let wanted: { song: Song; part: string } | null = null;
/** How many stings are playing; the music stays lowered until the last one ends. */
let stings = 0;

/**
 * Plays `song` from its `part`, looping. Called again with the same song, it switches to the new
 * part at the next bar; with another song, the old one fades out.
 */
export function playMusic(song: Song, part: string) {
  wanted = { song, part };
  if (ctx) startMusic(song, part);
}

function startMusic(song: Song, part: string) {
  if (!ctx) return;
  if (current?.song === song) return current.player.switchTo(part);
  current?.player.stop();
  current = { song, player: new Player(ctx, song, part, true) };
  if (stings > 0) current.player.duck(true);
}

/** Plays a part once (a win, a game over), with the music lowered under it. */
export function playSting(song: Song, part: string) {
  if (!playable(ctx) || volumes.muted) return;
  stings++;
  current?.player.duck(true);
  new Player(ctx, song, part, false, () => {
    stings--;
    if (stings === 0) current?.player.duck(false);
  });
}

export function stopMusic() {
  wanted = null;
  current?.player.stop();
  current = null;
}

/** A short tune the hub plays when the music volume is set, so it can be heard. */
const PREVIEW: Song = {
  bpm: 132,
  parts: {
    tune: {
      lead: 'c5 . e5 . g5 . e5 . | f5 . a5 . c6 . . .',
      bass: 'c3 . . . c3 . . . | f2 . . . f2 . . .',
      drums: 'k - h - s - h - | k - h - s - h -',
    },
  },
};

/** Lets the hub's Settings panel play a sample at a volume just set. */
export function previewVolume(key: keyof Settings, settings: Settings) {
  unlockAudio();
  setVolumes(settings);
  if (key === 'music') playSting(PREVIEW, 'tune');
  else if (key === 'effects') ui('coin');
}
