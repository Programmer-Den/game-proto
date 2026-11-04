import { playMusic, playSting, stopMusic } from '../../../../shared/audio';
import { key } from '../game/map';
import { FESTIVAL_ROUND, type GameState } from '../game/state';
import { SONG, sfx } from './sounds';

/** What the scene remembers of the state between frames, to hear what `tick` changed. */
interface Snapshot {
  phase: GameState['phase'];
  round: number;
  hearts: number;
  totalDelivered: number;
  charterOffer: boolean;
  hazard: GameState['hazard'];
  moods: number[];
  orders: Map<number, GameState['orders'][number]['status']>;
  wyrms: { eating: boolean; switching: boolean; visiting: boolean }[];
  towns: number;
  rivalTaken: number;
  rivalClaim: number | null;
}

const snapshot = (s: GameState): Snapshot => ({
  phase: s.phase,
  round: s.round,
  hearts: s.hearts,
  totalDelivered: s.totalDelivered,
  // A moult's cards wait like the charter's.
  charterOffer: !!(s.charterOffer || s.moultOffer),
  hazard: s.hazard,
  moods: [...s.moods],
  orders: new Map(s.orders.map((o) => [o.id, o.status])),
  wyrms: s.wyrms.map((w) => ({ eating: w.eatMs > 0, switching: w.switchMs > 0, visiting: w.job?.leg === 'visit' })),
  towns: s.towns.length,
  rivalTaken: s.rival?.taken ?? 0,
  rivalClaim: s.rival?.claim?.order ?? null,
});

/** The part of the song the game calls for now. */
function partFor(s: GameState) {
  if (s.charterOffer || s.moultOffer) return 'charter';
  if (s.round === FESTIVAL_ROUND) return 'festival';
  if (s.hazard || s.orders.some((o) => o.timeLeftMs < o.totalMs * 0.25)) return 'busy';
  return s.charter ? 'travel' : 'calm';
}

/**
 * The sounds of what the sim did on its own in a frame (`tick`): compares the state with the last
 * frame's and plays what changed, and picks the music's part. The player's own actions are played
 * by the scene where it calls the sim. The sim stays free of audio.
 */
export class GameSounds {
  private last: Snapshot;
  private part = '';

  constructor(s: GameState) {
    this.last = snapshot(s);
    stopMusic();
    this.music(s);
  }

  /** Call once a frame after `tick`. */
  update(s: GameState) {
    const was = this.last;
    const now = (this.last = snapshot(s));
    if (was.phase === 'play' && now.phase !== 'play') return this.end(s);
    if (now.phase !== 'play') return;

    let late = 0;
    for (const o of s.orders) {
      const before = was.orders.get(o.id);
      if (before === undefined) sfx(o.made ? 'workshop' : 'order');
      else if (o.status === 'carrying' && before !== 'carrying') sfx('load');
    }
    const delivered = now.totalDelivered - was.totalDelivered;
    for (const id of was.orders.keys()) if (!now.orders.has(id)) late++;
    // An order the rival took is gone too, but not late.
    const taken = now.rivalTaken - was.rivalTaken;
    late -= delivered + taken;
    if (taken > 0) sfx('rival');
    else if (was.rivalClaim !== null && now.rivalClaim === null && now.orders.has(was.rivalClaim)) sfx('beatRival');
    if (now.towns > was.towns) sfx('grow');
    if (delivered > 0) sfx('deliver');
    if (late > 0) sfx('late');
    if (was.hearts - now.hearts > Math.max(0, late)) sfx('faith');
    else if (late <= 0 && now.moods.some((m, i) => m < was.moods[i])) sfx('sour');

    now.wyrms.forEach((w, i) => {
      const before = was.wyrms[i];
      if (!before) return;
      if (w.eating && !before.eating) sfx('munch');
      if (w.switching && !before.switching) sfx('switchStop');
    });

    if (now.hazard && !was.hazard) sfx('warn');
    // A hazard that blew over (a wyrm stranded on its tile) took no track: no splash or rumble.
    if (!now.hazard && was.hazard && !s.track.includes(key(was.hazard.tile))) sfx(was.hazard.kind === 'washout' || was.hazard.kind === 'sinkhole' ? 'splash' : 'rumble');
    // The gifts: a courier's visit ended, and not because a hazard dropped it.
    else if (now.wyrms.some((w, i) => was.wyrms[i]?.visiting && !w.visiting)) sfx('gifts');

    if (now.round > was.round) sfx('round');
    if (now.charterOffer && !was.charterOffer) sfx('charter');
    this.music(s);
  }

  private music(s: GameState) {
    const part = partFor(s);
    if (part === this.part) return;
    this.part = part;
    playMusic(SONG, part);
  }

  /** The game over or the festival won: the music stops for a sting. */
  private end(s: GameState) {
    stopMusic();
    this.part = '';
    playSting(SONG, s.phase === 'won' ? (s.medal ?? 'bronze') : 'lose');
  }
}
