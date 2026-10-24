import { expect, test, type Browser, type Page } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';

// Every game that uses `shared/scaling.ts` is opened on a range of screens, from an upright phone
// to a 4K monitor, and must be sharp and fill the screen on each. On a phone held the wrong way it
// is turned a quarter round to fill the screen anyway (unless it plays either way round), with taps
// turned to match, or asks to turn the phone when the hub's setting says so. A game is picked up on its own once its `src/main.ts` calls `setupScaling`.
// `SCREENS_GAME` checks just that game, as the Screens workflow does with one job per changed game.
const ONLY = process.env.SCREENS_GAME;
const main = (name: string) => {
  try {
    return readFileSync(`games/${name}/src/main.ts`, 'utf8');
  } catch {
    return '';
  }
};
const GAMES = readdirSync('games').filter((name) => (!ONLY || name === ONLY) && main(name).includes('setupScaling(game'));
// A game that takes the screen's shape (`setupScaling(game, { fill: true })`) must leave no bars.
const FILLS = new Set(GAMES.filter((name) => main(name).includes('fill: true')));
// A game that plays either way round (`bothWays: true`) never asks to turn, and turns with the screen.
const TURNS = new Set(GAMES.filter((name) => main(name).includes('bothWays: true')));

/** The screens checked: CSS size, device pixels per CSS pixel, and whether it is a touch device. */
const SCREENS = [
  { name: 'phone-upright', width: 390, height: 844, dpr: 3, touch: true },
  { name: 'phone-sideways', width: 844, height: 390, dpr: 3, touch: true },
  { name: 'tablet', width: 1024, height: 768, dpr: 2, touch: true },
  { name: 'laptop', width: 1440, height: 900, dpr: 2, touch: false },
  { name: '4k', width: 3840, height: 2160, dpr: 1, touch: false },
];

async function open(browser: Browser, game: string, screen: (typeof SCREENS)[number], askToTurn = false) {
  const size = { width: screen.width, height: screen.height };
  const context = await browser.newContext({
    viewport: size,
    screen: size,
    deviceScaleFactor: screen.dpr,
    isMobile: screen.touch,
    hasTouch: screen.touch,
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // The hub's Phone held the wrong way setting, set to Ask me to turn it.
  if (askToTurn) await page.addInitScript(() => localStorage.setItem('hub-settings', JSON.stringify({ turn: 'ask' })));
  await page.goto(`/games/${game}/`);
  // The game is up once Phaser has booted.
  await page.waitForFunction(() => (window as any).game?.isBooted);
  return { context, page, errors };
}

/** Whether a wide game (960x540) or a tall one (540x960) is held the wrong way on this screen. */
const heldWrong = async (page: Page, game: string, screen: (typeof SCREENS)[number]) => {
  const wide = await page.evaluate(() => (window as any).game.config.width >= (window as any).game.config.height);
  return !TURNS.has(game) && screen.touch && screen.height > screen.width === wide;
};

for (const game of GAMES) {
  for (const screen of SCREENS) {
    test(`${game} on ${screen.name}`, async ({ browser }, testInfo) => {
      const { context, page, errors } = await open(browser, game, screen);
      const wrongWay = await heldWrong(page, game, screen);
      await expect(page.locator('.turn-hint'), 'turn hint').toHaveCount(0);
      // Held the wrong way, the page is turned a quarter round: clockwise for a wide game.
      const angle = await page.evaluate(() => Number(document.body.dataset.turned ?? 0));
      expect(Math.abs(angle), 'page turned').toBe(wrongWay ? 90 : 0);
      // Let a few frames draw, so the first scene is on screen for the screenshot.
      await page.waitForFunction(() => (window as any).game.scene.getScenes(true).length > 0);
      await page.waitForTimeout(500);
      expect(await page.evaluate(() => (window as any).game.isPaused), 'paused').toBe(false);
      const measure = () => page.evaluate(() => {
        const canvas = (window as any).game.canvas as HTMLCanvasElement;
        const box = canvas.getBoundingClientRect();
        // A turned canvas shows its width down the screen.
        const turned = document.body.dataset.turned !== undefined;
        const [across, down] = turned ? [box.height, box.width] : [box.width, box.height];
        return {
          backing: { width: canvas.width, height: canvas.height },
          shown: { width: across * devicePixelRatio, height: down * devicePixelRatio },
          filled: Math.max(box.width / innerWidth, box.height / innerHeight),
          covered: Math.min(box.width / innerWidth, box.height / innerHeight),
          scrolls: document.scrollingElement!.scrollHeight > innerHeight || document.scrollingElement!.scrollWidth > innerWidth,
          onScreen: box.left > -1 && box.top > -1 && box.right < innerWidth + 1 && box.bottom < innerHeight + 1,
        };
      });
      const fit = await measure();
      expect(fit.onScreen, 'whole view on the screen').toBe(true);
      // Sharp: the canvas has at least as many pixels as the screen area it is shown on.
      expect(fit.backing.width, `canvas pixels across for ${Math.round(fit.shown.width)} on screen`).toBeGreaterThanOrEqual(0.99 * fit.shown.width);
      expect(fit.backing.height, `canvas pixels down for ${Math.round(fit.shown.height)} on screen`).toBeGreaterThanOrEqual(0.99 * fit.shown.height);
      // As big as it fits: the view reaches two opposite edges of the screen.
      expect(fit.filled, 'share of the screen the view spans').toBeGreaterThan(0.99);
      // A filling game spans the whole screen both ways (every screen here is between 4:3 and 2.4:1)
      // when the screen is the game's way round, or turned to be; a desktop screen turned the other
      // way (an upright game on a laptop) keeps the designed size, as `fillView` in shared/scaling.ts says.
      const wide = await page.evaluate(() => (window as any).game.config.width >= (window as any).game.config.height);
      const gameWayRound = TURNS.has(game) || wrongWay || screen.width >= screen.height === wide;
      if (FILLS.has(game) && gameWayRound) expect(fit.covered, 'share of the screen the view covers').toBeGreaterThan(0.98);
      expect(fit.scrolls, 'page scrolls').toBe(false);
      if (wrongWay) {
        // A tap on the turned screen lands where it shows in the game: a point 80% across the
        // screen and 30% down is, on a wide game turned clockwise, 30% across the game and 20% down.
        const box = await page.evaluate(() => (window as any).game.canvas.getBoundingClientRect().toJSON());
        await page.touchscreen.tap(box.x + 0.8 * box.width, box.y + 0.3 * box.height);
        const tap = await page.evaluate(() => {
          const g = (window as any).game;
          const p = g.input.activePointer;
          return { across: p.x / g.scale.width, down: p.y / g.scale.height };
        });
        const expected = angle > 0 ? { across: 0.3, down: 0.2 } : { across: 0.7, down: 0.8 };
        expect(tap.across, 'tap across the turned game').toBeCloseTo(expected.across, 2);
        expect(tap.down, 'tap down the turned game').toBeCloseTo(expected.down, 2);
      }
      if (TURNS.has(game) && screen.touch) {
        // Turned the other way round while it runs, it takes the new shape and still fills it.
        await page.setViewportSize({ width: screen.height, height: screen.width });
        await page.waitForTimeout(500);
        const turned = await measure();
        expect(turned.covered, 'share of the turned screen the view covers').toBeGreaterThan(FILLS.has(game) ? 0.98 : 0);
        expect(turned.filled, 'share of the turned screen the view spans').toBeGreaterThan(0.99);
        expect(turned.scrolls, 'page scrolls once turned').toBe(false);
      }
      expect(errors, 'page errors').toEqual([]);
      await testInfo.attach(`${game}-${screen.name}`, { body: await page.screenshot(), contentType: 'image/png' });
      await context.close();
    });
  }

  // With Phone held the wrong way set to Ask me to turn it, a phone held the wrong way gets the
  // hint and the game waits.
  if (!TURNS.has(game)) test(`${game} asks to turn the phone`, async ({ browser }) => {
    const { context, page, errors } = await open(browser, game, SCREENS[0], true);
    // A tall game is held the wrong way on a sideways phone.
    if (!(await heldWrong(page, game, SCREENS[0]))) await page.setViewportSize({ width: SCREENS[1].width, height: SCREENS[1].height });
    await expect(page.locator('.turn-hint'), 'turn hint').toBeVisible();
    expect(await page.evaluate(() => document.body.dataset.turned), 'page turned').toBeUndefined();
    expect(await page.evaluate(() => (window as any).game.isPaused), 'paused while turned away').toBe(true);
    expect(errors, 'page errors').toEqual([]);
    await context.close();
  });
}
