import { playMusic, playSting, type Song } from '../../../../shared/audio';
import { COLONY, RAID } from '../audio/music';
import { sfx } from '../audio/sfx';
import { BUILDINGS } from '../game/data';
import { PLAYER, visible, type Building, type GameState } from '../game/sim';

interface Seen {
  built: boolean;
  x: number;
  y: number;
}

/** A rectangle of the world in tiles, the part the camera shows. */
export interface TileView {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * Sounds and music for what changed in the sim since the last frame. The sim stays free of audio:
 * each frame `update` compares the state with what it saw before and plays the player's new units,
 * finished buildings, techs, ages, the bell, raids, relics and buildings falling on screen, and
 * keeps the music on the right part (a raid, a standing Monument, or the player's age).
 * Watching, it plays only the raids, Monuments and falls, and keeps the music.
 */
export class SoundCues {
  private units = new Set<number>();
  private buildings = new Map<number, Seen>();
  private techs: number;
  private age: number;
  private bell: boolean;
  private raid: { n: number; mine: boolean } | null;
  private repelled: number;
  private camps: { holder: number | null; claimed: boolean }[];
  private music = '';

  constructor(
    s: GameState,
    private readonly watching: boolean,
  ) {
    for (const u of s.units.values()) if (u.owner === PLAYER) this.units.add(u.id);
    for (const b of s.buildings.values()) this.buildings.set(b.id, this.seen(b));
    const p = s.players[PLAYER];
    this.techs = p.techs.length;
    this.age = p.age;
    this.bell = p.bell;
    this.raid = s.raid && { n: s.raid.n, mine: this.mine(s) };
    this.repelled = s.repelled;
    this.camps = s.camps.map((c) => ({ holder: c.holder, claimed: c.claimed }));
    this.updateMusic(s);
  }

  update(s: GameState, view: TileView) {
    const own = !this.watching;
    const onScreen = (x: number, y: number) => x >= view.x0 && x <= view.x1 && y >= view.y0 && y <= view.y1 && visible(s, Math.floor(x), Math.floor(y));

    // New units of the player's (a villager back from shelter was seen before).
    let trained = false;
    for (const u of s.units.values()) {
      if (u.owner !== PLAYER || this.units.has(u.id)) continue;
      this.units.add(u.id);
      trained = true;
    }
    if (trained && own) sfx('trained');

    // Buildings finished (the player's), Monuments standing (anyone's), and buildings falling on screen.
    const gone = new Set(this.buildings.keys());
    const placed = new Set<string>();
    for (const b of s.buildings.values()) {
      gone.delete(b.id);
      const before = this.buildings.get(b.id);
      if (!before) {
        const at = this.seen(b);
        placed.add(`${at.x},${at.y}`);
        if (b.type === 'wonder') sfx('monument');
      }
      if (before && !before.built && b.built) {
        if (b.type === 'monument') sfx('monument');
        else if (b.owner === PLAYER && own) sfx('built');
      }
      if (!before || before.built !== b.built) this.buildings.set(b.id, this.seen(b));
    }
    let fell = false;
    for (const id of gone) {
      const b = this.buildings.get(id)!;
      // A piece of palisade that a new gate took the place of did not fall.
      if (onScreen(b.x, b.y) && !placed.has(`${b.x},${b.y}`)) fell = true;
      this.buildings.delete(id);
    }
    if (fell) sfx('crumble');

    const p = s.players[PLAYER];
    if (p.techs.length > this.techs && own) sfx('researched');
    this.techs = p.techs.length;
    if (p.age > this.age && own) playSting(COLONY, 'age');
    this.age = p.age;
    if (p.bell !== this.bell && own) sfx(p.bell ? 'bell' : 'bellLow');
    this.bell = p.bell;

    // A raid on the player starts with a war horn and ends, repelled, with a triumphant one.
    const r = s.raid;
    if (r && r.n !== this.raid?.n) {
      if (this.raid?.mine && s.repelled > this.repelled) sfx('repelled');
      this.raid = { n: r.n, mine: this.mine(s) };
      if (this.raid.mine) sfx('raidHorn');
    } else if (!r && this.raid) {
      if (this.raid.mine && s.repelled > this.repelled) sfx('repelled');
      this.raid = null;
    }
    this.repelled = s.repelled;

    // A cache taken, a relic held or lost, by the player.
    s.camps.forEach((c, i) => {
      const before = this.camps[i];
      if (!before) return;
      if (own && c.holder !== before.holder) {
        if (c.kind === 'cache' && c.holder === PLAYER) sfx('cache');
        else if (c.kind === 'relic' && c.holder === PLAYER) sfx('relicGain');
        else if (c.kind === 'relic' && before.holder === PLAYER) sfx('relicLost');
      }
      before.holder = c.holder;
      before.claimed = c.claimed;
    });

    this.updateMusic(s);
  }

  /** Whether the raid under way is one the music and horns are for: on the player, or any when watching. */
  private mine(s: GameState) {
    return !!s.raid && (this.watching || s.raid.target === PLAYER);
  }

  private updateMusic(s: GameState) {
    if (s.winner !== null) return;
    // A standing Monument, or a Wonder going up, plays the solemn part.
    const monument = [...s.buildings.values()].some((b) => b.hp > 0 && ((b.type === 'monument' && b.built) || b.type === 'wonder'));
    const age = s.players[PLAYER].age;
    const [song, part]: [Song, string] = this.raid?.mine ? [RAID, 'battle'] : monument ? [COLONY, 'monument'] : [COLONY, age >= 3 ? 'calm3' : age === 2 ? 'calm2' : 'calm'];
    const key = `${song === RAID ? 'raid' : 'colony'}:${part}`;
    if (key === this.music) return;
    this.music = key;
    playMusic(song, part);
  }

  private seen(b: Building): Seen {
    const def = BUILDINGS[b.type];
    return { built: b.built, x: b.tx + def.w / 2, y: b.ty + def.h / 2 };
  }
}
