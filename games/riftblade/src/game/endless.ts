/**
 * The endless rift: after a won crusade the run can go on, through the four jumps again and again,
 * each loop tougher than the last. Its score is the worlds cleared after the win
 * (`state.endlessCleared`), and the best is kept in `progress.endless`.
 */

/** Per loop past the first: foe and boss health, and how hard they hit, grow by these shares. */
export const ENDLESS = { hp: 0.4, dmg: 0.25 };

/** Salvage banked per world cleared in the endless rift (credits left are banked at the win). */
export const ENDLESS_SALVAGE = 15;

/** The health and hit multipliers of a loop (1 on the crusade itself). */
export const loopHp = (loop: number) => 1 + ENDLESS.hp * loop;
export const loopDmg = (loop: number) => 1 + ENDLESS.dmg * loop;
