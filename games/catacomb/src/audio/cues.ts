import { playMusic, playSting, stopMusic, ui, type Song } from '../../../../shared/audio';
import { isCurse } from '../game/cards';
import type { Fight, GameState, Phase } from '../game/state';
import { t } from '../i18n';
import { FIGHT_SONG, MAP_SONG } from './music';
import { sfx, type SoundName } from './sounds';

/** Game time between two footsteps on the map. */
const STEP_MS = 175;
/** The phases shown on the map, where water drips now and then. */
const DRIPPING: Phase[] = ['hero', 'library', 'map', 'walk'];

/**
 * Listens to the run as `GameScene.update` draws it and plays what happened since the last frame:
 * footsteps, arrivals, the foes' turn, damage, block, statuses, draws, gold, curses, the fight's end,
 * and the music for where the hero is. The sim stays free of sound; the scene's tap handlers play
 * the sounds of the hero's own actions (and the refusal buzz).
 *
 * Several pops in one frame (an attack on every foe) give one sound of each kind.
 */
export class Cues {
  private phase: Phase;
  private lastPop: number;
  private fight: Fight | null;
  private foes: number;
  private drawn: number;
  private draw: number;
  private brewed: number;
  private gold: number;
  private curses: number;
  private walkStep = -1;
  private dripMs = 2500;
  private drips = 0;
  private tune = '';

  constructor(s: GameState) {
    this.phase = s.phase;
    this.lastPop = s.nextId - 1;
    this.fight = s.fight;
    this.foes = s.fight?.enemies.length ?? 0;
    this.drawn = s.fight?.drawn ?? 0;
    this.draw = s.fight?.draw.length ?? 0;
    this.brewed = s.fight?.brewed ?? 0;
    this.gold = s.gold;
    this.curses = s.deck.filter(isCurse).length;
  }

  /** Called once a frame, after `tick`, with the frame's game time. */
  hear(s: GameState, dt: number) {
    const heard = new Set<SoundName>();
    const prev = this.phase;
    this.phase = s.phase;

    if (prev !== s.phase) {
      const kind = s.at === null ? null : s.rooms[s.at]?.kind;
      if (prev === 'walk') {
        if (kind === 'fight' || kind === 'elite' || kind === 'boss') {
          heard.add('fight');
          if (kind !== 'fight') heard.add('stab');
        } else if (kind === 'rest') heard.add('fire');
        else heard.add('door');
      }
      if (s.phase === 'cleared') heard.add('cleared');
      else if (s.phase === 'descend') playSting(FIGHT_SONG, 'triumph');
      else if (s.phase === 'won') playSting(FIGHT_SONG, 'win');
      else if (s.phase === 'over') playSting(FIGHT_SONG, 'lose');
    }

    // Footsteps along the path.
    if (s.phase === 'walk' && s.walk) {
      const step = Math.floor(s.walk.ms / STEP_MS);
      if (step > this.walkStep) {
        this.walkStep = step;
        sfx('step', { pitch: step % 2 ? 0.85 : 1 });
      }
    } else this.walkStep = -1;

    // Draws, reshuffles and fallen foes.
    const f = s.fight;
    if (f) {
      // A new fight starts from nothing drawn, so its opening hand flicks too.
      const same = f === this.fight;
      if (same && f.enemies.length < this.foes) heard.add('die');
      if (f.drawn > (same ? this.drawn : 0)) heard.add('draw');
      if (same && f.draw.length > this.draw) heard.add('shuffle');
      if (f.brewed > (same ? this.brewed : 0)) heard.add('brew');
    }
    this.fight = f;
    this.foes = f?.enemies.length ?? 0;
    this.drawn = f?.drawn ?? 0;
    this.draw = f?.draw.length ?? 0;
    this.brewed = f?.brewed ?? 0;

    const curses = s.deck.filter(isCurse).length;
    const cursed = curses > this.curses;
    if (cursed) heard.add('curse');
    this.curses = curses;

    // The floating numbers say what landed this frame.
    const blocked = t('blocked');
    for (const p of s.pops) {
      if (p.id <= this.lastPop) continue;
      this.lastPop = Math.max(this.lastPop, p.id);
      const hero = p.on === 'hero';
      if (p.kind === 'damage') heard.add(p.text === blocked ? 'clang' : hero ? 'hurt' : 'hit');
      else if (p.kind === 'block') heard.add('shield');
      else if (p.kind === 'heal') {
        if (!hero) heard.add('buff');
        else if (prev !== 'rest') heard.add('heal');
      } else if (p.text.startsWith('-')) heard.add('poison');
      else if (!hero) heard.add('status');
      // On the hero, a status pop is a foe's debuff, a curse (heard above) or a power's name (heard on the tap).
      else if (s.phase === 'enemy' && !cursed) heard.add('hex');
    }

    for (const name of heard) sfx(name);

    if (s.gold > this.gold) ui('coin');
    this.gold = s.gold;

    // Water dripping in the dark, at steady but uneven times (no Math.random, which the test seeds).
    if (DRIPPING.includes(s.phase)) {
      this.dripMs -= dt;
      if (this.dripMs <= 0) {
        this.drips++;
        sfx('drip', { pitch: 0.8 + ((this.drips * 7) % 5) * 0.1, volume: 0.8 });
        this.dripMs = 2600 + ((this.drips * 1777) % 4200);
      }
    }

    this.playTune(s);
  }

  /** The music for where the hero is: the map, a quiet room or a fight, by act; none once the run ends. */
  private playTune(s: GameState) {
    let next: [Song, string] | null;
    const kind = s.at === null ? null : s.rooms[s.at]?.kind;
    if (s.phase === 'over' || s.phase === 'won') next = null;
    else if (s.phase === 'cleared') return;
    else if (s.fight) next = [FIGHT_SONG, kind === 'elite' || kind === 'boss' ? 'boss' : s.act > 1 ? 'depths' : 'battle'];
    else if (s.phase === 'rest' || s.phase === 'shop' || s.phase === 'event') next = [MAP_SONG, 'camp'];
    else next = [MAP_SONG, s.act > 1 ? 'tombs' : 'calm'];
    const key = next ? `${next[0] === MAP_SONG ? 'map' : 'fight'}.${next[1]}` : 'none';
    if (key === this.tune) return;
    this.tune = key;
    if (next) playMusic(next[0], next[1]);
    else stopMusic();
  }
}
