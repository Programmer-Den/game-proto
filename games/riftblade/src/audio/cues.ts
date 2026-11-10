import { playMusic, playSting, stopMusic, ui, type Song } from '../../../../shared/audio';
import { HEROES, isKnight, type HeroId } from '../game/heroes';
import { HURT_GRACE_MS } from '../game/sim';
import type { BoltColor, Bomb, GameState, Hazard } from '../game/state';
import { SCREEN } from '../scenes/layout';
import { MENU_SONG, PLANET_SONGS, STINGS } from './music';
import { sfx, type SfxName } from './sfx';

/** Each hero's signature sound. */
const SIGNATURE: Record<HeroId, SfxName> = {
  rook: 'sigHorn', tr9: 'sigPulse', bram: 'sigToss', kael: 'sigSlam', vharn: 'sigForce', oom: 'sigDash',
  corvin: 'sigRing', veyl: 'sigStorm', kresh: 'sigDash', joren: 'sigSlam', elara: 'sigFlare', triad: 'sigShift',
  dax: 'sigHorn', grunda: 'sigForce', kettle: 'sigStorm', cassia: 'sigShift',
  vesk: 'sigFlare', rena: 'sigDash', thessa: 'sigHorn', wikka: 'sigToss',
  gorbul: 'sigHorn', sable: 'sigForce', krull: 'sigRing', ysolde: 'sigStorm',
};

/** The sound of a hero-side bolt, by its colour (a hero's own colour is that hero's weapon). */
function boltSound(color: BoltColor, spin: boolean): SfxName {
  if (spin) return 'boomerang';
  switch (color) {
    case 'heavy': return 'heavy';
    case 'rocket': return 'rocket';
    case 'drone': case 'triad': return 'botShot';
    case 'fallen': return 'saber';
    case 'tr9': return 'carbine';
    case 'bram': return 'spread';
    case 'elara': return 'blaster';
    case 'grunda': return 'heavy';
    case 'cassia': return 'carbine';
    case 'rena': return 'blaster';
    case 'gorbul': return 'spread';
    default: return 'pistol';
  }
}

const BOMB_SOUND: Partial<Record<Bomb['kind'], SfxName>> = {
  grenade: 'toss', frag: 'toss', charge: 'charge', crate: 'whistle', orbital: 'whistle', carpet: 'whistle',
};
const HAZARD_SOUND: Partial<Record<Hazard['kind'], SfxName>> = {
  vent: 'warn', shell: 'warn', stomp: 'stomp', ring: 'fireRing', bog: 'glob', strike: 'warn',
};

/** How long after a ring wave the music stays tense, ms. */
const TENSE_MS = 25_000;

/**
 * Riftblade's sound, played by watching the run: the sim has no event list and stays free of
 * audio, so after each frame this compares the state with the frame before (new bolts, blasts and
 * hazards by id, counts that went up, the phase) and plays what changed, at most one of each sound
 * per frame. It also picks the music for the phase. Sound is a no-op under browser automation.
 */
export class SoundCues {
  private lastId = 0;
  private phase: GameState['phase'] = 'select';
  private planet = 0;
  private arena = false;
  private kills = 0;
  private elites = 0;
  private chests = 0;
  private powerUps = 0;
  private objectivesDone = 0;
  private objective = false;
  private signatures = 0;
  private damage = 0;
  private hurtMs = 0;
  private barrier = 0;
  private hp = 0;
  private xp = 0;
  private level = 1;
  private credits = 0;
  private capstones = 0;
  private crossovers = 0;
  private waves = 0;
  private nextElite = 0;
  private boss = false;
  private bossFlash = 0;
  private warned = new Set<number>();
  private landed = new Set<number>();
  private tide = false;
  private flurries = 0;
  /** When Kresh's staff may whir again (run ms). */
  private whirAt = 0;
  /** The shard combo: how many in a row, and when the last one came (run ms). */
  private combo = 0;
  private comboAt = -Infinity;
  private tenseUntil = 0;
  private music: { song: Song; part: string } | null = null;

  /** Called after each frame with the state the scene shows. */
  update(s: GameState) {
    if (s.nextId < this.lastId || (s.phase === 'run' && this.phase === 'select')) this.rebase(s);
    const played = new Set<SfxName>();
    const play = (name: SfxName, pitch?: number, volume?: number) => {
      if (played.has(name)) return;
      played.add(name);
      sfx(name, { pitch, volume });
    };
    if (s.phase === 'run' || this.phase === 'run') this.field(s, play);
    this.counts(s, play);
    this.phases(s, play);
    this.lastId = s.nextId;
    this.pickMusic(s);
  }

  /** A saved run picked up again: count from where it stands, with no sound for getting there. */
  resume(s: GameState) {
    this.rebase(s);
    this.phase = s.phase;
    this.planet = s.planet;
    this.arena = s.arena;
  }

  /** A new run: start counting from it. */
  private rebase(s: GameState) {
    this.lastId = s.nextId;
    this.kills = s.kills;
    this.elites = s.elitesKilled;
    this.chests = s.chests;
    this.powerUps = s.powerUps;
    this.objectivesDone = s.objectivesDone;
    this.objective = !!s.objective;
    this.signatures = s.signatures;
    this.damage = s.damageTaken;
    this.xp = s.xp;
    this.level = s.level;
    this.credits = s.credits;
    this.capstones = s.capstones.length;
    this.crossovers = s.crossovers.length;
    this.waves = s.waves.length;
    this.nextElite = s.nextElite;
    const boss = s.enemies.find((e) => e.kind === 'boss' && e.hp > 0);
    this.boss = !!boss;
    this.bossFlash = boss?.flashMs ?? 0;
    this.warned.clear();
    this.landed = new Set(s.pillars.filter((pl) => pl.warnMs <= 0).map((pl) => pl.id));
    this.tide = !!s.tide;
    this.hp = s.player.hp;
    this.hurtMs = s.player.hurtMs;
    this.barrier = s.player.barrier;
    this.flurries = 0;
    this.whirAt = 0;
    this.combo = 0;
    this.tenseUntil = 0;
  }

  /** Things new on the field this frame: bolts, swings, bombs, blasts and hazards. */
  private field(s: GameState, play: (name: SfxName, pitch?: number, volume?: number) => void) {
    const p = s.player;
    const fresh = (id: number) => id >= this.lastId;
    const seen = (x: number, y: number) => Math.abs(x - p.x) < SCREEN.w / 2 + 40 && Math.abs(y - p.y) < SCREEN.h / 2 + 40;
    for (const b of s.bullets) {
      if (!fresh(b.id)) continue;
      if (!b.hostile) play(boltSound(b.color, b.spin));
      else if (seen(b.x, b.y)) play(b.color === 'glob' || b.color === 'spore' || b.color === 'ink' ? 'glob' : b.color === 'volley' || b.color === 'slug' || b.color === 'splinter' ? 'enemyVolley' : 'enemyShot');
    }
    const hero = s.hero ? HEROES[s.hero] : null;
    if (s.slashes.some((f) => fresh(f.id))) {
      const aim = hero?.aim;
      if (aim === 'ripple') play('ripple');
      else if (aim === 'spin') play('spinHum');
      else if (aim === 'flurry') {
        this.flurries += 1;
        play('flurry');
        if (this.flurries % 10 === 0) play('ping');
      } else play('saber');
    }
    if (s.zaps.some((f) => fresh(f.id))) play('crackle');
    if (s.hero === 'kresh' && s.phase === 'run') {
      // The staff is always turning: a soft whir while there is something in its reach.
      const reach = HEROES.kresh.range * 1.6;
      if (s.runMs >= this.whirAt && s.enemies.some((e) => e.hp > 0 && Math.hypot(e.x - p.x, e.y - p.y) < reach)) {
        play('whir');
        this.whirAt = s.runMs + 700;
      }
    }
    for (const b of s.bombs) {
      const sound = BOMB_SOUND[b.kind];
      if (sound && fresh(b.id)) play(sound);
    }
    let blast = 0;
    for (const b of s.blasts) if (fresh(b.id) && seen(b.x, b.y)) blast = Math.max(blast, b.r);
    if (blast >= 90) play('boom', 1, Math.min(1.2, blast / 130));
    else if (blast > 0) play('pop');
    for (const h of s.hazards) {
      if (!fresh(h.id) || !seen(h.x, h.y)) continue;
      const sound = HAZARD_SOUND[h.kind];
      if (sound) play(sound);
    }
    // The Ruin world's pillars: a warning as one starts to fall, a stomp as it lands.
    for (const pl of s.pillars) {
      if (fresh(pl.id)) play('warn');
      else if (pl.warnMs <= 0 && !this.landed.has(pl.id)) play('stomp');
    }
    this.landed = new Set(s.pillars.filter((pl) => pl.warnMs <= 0).map((pl) => pl.id));
    // The Ocean world's tide: the siren as it starts to come in.
    if (s.tide && !this.tide) play('siren');
    this.tide = !!s.tide;
    // The boss: a dull tick when it is hit.
    const boss = s.enemies.find((e) => e.kind === 'boss' && e.hp > 0);
    if (boss && boss.flashMs > this.bossFlash && seen(boss.x, boss.y)) play('bossHit');
    this.bossFlash = boss?.flashMs ?? 0;
  }

  /** Counts that went up: kills, hits taken, shards, chests, credits, unlocks. */
  private counts(s: GameState, play: (name: SfxName, pitch?: number, volume?: number) => void) {
    const p = s.player;
    if (s.kills > this.kills) play('kill', 0.9 + Math.min(4, s.kills - this.kills) * 0.08);
    if (s.elitesKilled > this.elites) play('eliteKill');
    if (s.chests > this.chests || s.powerUps > this.powerUps) play('chest');
    // Side objectives: a new one, and one done.
    if (s.objective && !this.objective) play('node');
    if (s.objectivesDone > this.objectivesDone) play('capstone');
    if (s.signatures > this.signatures && s.hero) play(SIGNATURE[s.hero]);
    if (s.damageTaken > this.damage + 0.01) play('hurt');
    // Foresight sets half the grace; the Barrier Emitter and a Shield power-up set it all (`pop`).
    else if (s.phase === 'run' && s.hero && isKnight(s.hero) && p.hurtMs > this.hurtMs + 1 && p.hurtMs <= HURT_GRACE_MS / 2) play('dodge');
    if (p.barrier < this.barrier - 0.01 && s.damageTaken <= this.damage + 0.01) play('barrier');
    if (p.hp > this.hp + 8 && s.phase !== 'select' && this.phase !== 'select') play('heal');
    if (s.xp > this.xp || s.level > this.level) {
      this.combo = s.runMs - this.comboAt < 450 ? this.combo + 1 : 0;
      this.comboAt = s.runMs;
      play('shard', 1 + Math.min(12, this.combo) * 0.05);
    }
    if (s.credits > this.credits) ui('coin');
    if (s.capstones.length > this.capstones) play('capstone');
    else if (s.crossovers.length > this.crossovers) play('crossover');
    if (s.waves.length < this.waves) {
      play('siren');
      this.tenseUntil = s.time + TENSE_MS;
    }
    if (s.nextElite > this.nextElite && s.phase === 'run') play('eliteHorn');
    const boss = s.enemies.some((e) => e.kind === 'boss' && e.hp > 0);
    if (boss && !this.boss) play('bossStab');
    if (!boss && this.boss && this.phase === 'run' && s.phase !== 'lost') play('bossDown');

    this.kills = s.kills;
    this.elites = s.elitesKilled;
    this.chests = s.chests;
    this.powerUps = s.powerUps;
    this.objectivesDone = s.objectivesDone;
    this.objective = !!s.objective;
    this.signatures = s.signatures;
    this.damage = s.damageTaken;
    this.hurtMs = p.hurtMs;
    this.barrier = p.barrier;
    this.hp = p.hp;
    this.xp = s.xp;
    this.level = s.level;
    this.credits = s.credits;
    this.capstones = s.capstones.length;
    this.crossovers = s.crossovers.length;
    this.waves = s.waves.length;
    this.nextElite = s.nextElite;
    this.boss = boss;
  }

  /** The phase changed: level-ups, the end of a fight, a new planet, the end of the run. */
  private phases(s: GameState, play: (name: SfxName) => void) {
    const was = this.phase;
    if (s.phase !== was) {
      if (s.phase === 'levelup' && was === 'run' && s.pendingLevels > 0) play('levelUp');
      if (s.phase === 'won') playSting(STINGS, 'win');
      else if (s.phase === 'lost') playSting(STINGS, 'lose');
      else if (was === 'run' && s.phase !== 'run' && (this.arena ? s.arenaWon : s.after === 'chart' || s.phase === 'chart')) {
        playSting(STINGS, 'cleared');
      }
    }
    if (s.phase === 'run' && was !== 'run' && was !== 'select' && was !== 'levelup') play('warp');
    else if (s.phase === 'run' && s.planet !== this.planet) play('warp');
    // The clock restarts on each planet, so a wave's tense music from the last one ends here.
    if (s.planet !== this.planet) this.tenseUntil = 0;
    this.phase = s.phase;
    this.planet = s.planet;
    this.arena = s.arena;
  }

  /** The music for where the run is. */
  private pickMusic(s: GameState) {
    let song: Song | null = null;
    let part = '';
    const world = PLANET_SONGS[s.planet] ?? PLANET_SONGS[0];
    switch (s.phase) {
      case 'select':
        [song, part] = [MENU_SONG, 'select'];
        break;
      case 'chart':
      case 'map':
      case 'event':
        [song, part] = [MENU_SONG, 'map'];
        break;
      case 'trader':
        [song, part] = [MENU_SONG, 'shop'];
        break;
      case 'levelup':
        [song, part] = [s.after === 'run' ? world : MENU_SONG, s.after === 'run' ? 'pad' : 'map'];
        break;
      case 'run':
      case 'cleared':
      case 'travel':
        song = world;
        part = this.boss ? 'boss' : s.arena || s.time < this.tenseUntil ? 'tense' : 'calm';
        break;
      default:
        break;
    }
    if (!song) {
      if (this.music) stopMusic();
      this.music = null;
      return;
    }
    if (this.music?.song === song && this.music.part === part) return;
    this.music = { song, part };
    playMusic(song, part);
  }

  /** A new hero unlocked mid-run. */
  unlock() {
    playSting(STINGS, 'unlock');
  }
}
