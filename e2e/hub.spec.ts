import { expect, test, type Page } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';

// The hub lists every game and each card opens its game.
const GAMES = [
  { name: 'Apothecary', path: '/games/apothecary/' },
  { name: 'Deadline', path: '/games/deadline/' },
  { name: 'Palisade', path: '/games/palisade/' },
  { name: 'Tiny Kingdom', path: '/games/tiny-kingdom/' },
  { name: 'Hotfoot', path: '/games/hotfoot/' },
  { name: 'Anvilheart', path: '/games/anvilheart/' },
  { name: 'Broadside', path: '/games/broadside/' },
  { name: 'TinctureTinker', path: '/games/tincture-tinker/' },
  { name: 'Catacomb', path: '/games/catacomb/' },
  { name: 'Golem Garden', path: '/games/golem-garden/' },
  { name: 'Beehive Baron', path: '/games/beehive-baron/' },
  { name: 'Wyrmrail', path: '/games/wyrmrail/' },
  { name: 'Shrine Stack', path: '/games/shrine-stack/' },
  { name: 'Mapmaker', path: '/games/mapmaker/' },
  { name: 'Lanternkeep', path: '/games/lanternkeep/' },
  { name: 'Space Wars', path: '/games/space-wars/' },
  { name: 'Lane Brawl', path: '/games/lane-brawl/' },
  { name: 'Scrapyard Titans', path: '/games/scrapyard-titans/' },
  { name: 'Colonizer', path: '/games/colonizer/' },
  { name: 'Riftblade', path: '/games/riftblade/' },
  { name: 'Bramblecrest', path: '/games/bramblecrest/' },
  { name: 'Ninefold', path: '/games/ninefold/' },
  { name: 'Augury', path: '/games/augury/' },
  { name: 'Mazewright', path: '/games/mazewright/' },
];

// The games with a Watch AI mode (`?watch`, see shared/watch.ts); there is no hub link to it.
const WATCH = ['/games/colonizer/', '/games/space-wars/', '/games/lane-brawl/', '/games/scrapyard-titans/'];

// Every page links a favicon that loads.
async function expectFavicon(page: Page) {
  const href = await page.locator('link[rel="icon"]').getAttribute('href');
  expect(href, 'favicon link').toBeTruthy();
  const icon = await page.request.get(new URL(href!, page.url()).href);
  expect(icon.ok(), `favicon ${href}`).toBe(true);
  // The dev server answers a missing file with the page itself, so check it is an image.
  expect(icon.headers()['content-type'], `favicon ${href}`).toContain('image/svg+xml');
}

test('hub lists every game', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page.locator('.game')).toHaveCount(GAMES.length);
  await expectFavicon(page);
  // The cards are in alphabetical order.
  const names = (await page.locator('.game h2').allTextContents()).map((n) => n.trim());
  expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'en')));
  // Every card's cover loads, once it scrolls into view.
  const covers = page.locator('.game .cover');
  await expect(covers).toHaveCount(GAMES.length);
  for (const cover of await covers.all()) {
    await cover.scrollIntoViewIfNeeded();
    await expect.poll(() => cover.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  }
  // Each card shows its game's favicon next to the name.
  const icons = page.locator('.game h2 .icon');
  await expect(icons).toHaveCount(GAMES.length);
  for (const icon of await icons.all()) {
    await expect.poll(() => icon.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  }
  testInfo.attach('hub', { body: await page.screenshot({ path: testInfo.outputPath('hub.png') }), contentType: 'image/png' });
});

// Each card opens its game, one test per game. `HUB_GAME` (a game's folder name) checks just that
// game, as the Hub workflow does with one job per changed game.
const ONLY = process.env.HUB_GAME;
for (const { name, path } of GAMES.filter((g) => !ONLY || g.path === `/games/${ONLY}/`)) {
  test(`hub opens ${name}`, async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name }).click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    // The game's own canvas; a page may also paint a decorative backdrop canvas, marked data-backdrop.
    await expect(page.locator('canvas:not([data-backdrop])')).toBeVisible();
    await expectFavicon(page);
    // Every game has a How to play behind its start and pause screens.
    await expect(page.locator('.game-help h2')).toHaveText(`How to play ${name}`);
    await expect(page.locator('.game-help li').first()).not.toBeEmpty();
    // A game with a watch mode shows the watch panel when opened with ?watch.
    if (!WATCH.includes(path)) return;
    await page.goto(`${path}?watch`);
    await expect(page.getByRole('region', { name: 'Watch AI' })).toBeVisible();
  });
}

// The hub's Settings panel saves the shared settings, and a game opened afterwards honours them.
test('hub settings reach the games', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Settings' });
  await expect(dialog).toBeVisible();
  const choice = (setting: string, option: string) => dialog.getByRole('group', { name: setting }).getByRole('button', { name: option, exact: true });
  await expect(choice('Difficulty', 'Normal')).toHaveAttribute('aria-pressed', 'true');
  await expect(choice('Frame rate (FPS)', '60')).toHaveAttribute('aria-pressed', 'true');

  await choice('Difficulty', 'Hard').click();
  await choice('Frame rate (FPS)', '30').click();
  await choice('Show FPS', 'On').click();
  await dialog.getByRole('slider', { name: 'Music' }).fill('35');
  await expect(choice('Difficulty', 'Hard')).toHaveAttribute('aria-pressed', 'true');
  testInfo.attach('settings', { body: await page.screenshot({ path: testInfo.outputPath('settings.png') }), contentType: 'image/png' });
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(dialog).toBeHidden();

  // The choices are kept across visits.
  await page.reload();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(choice('Difficulty', 'Hard')).toHaveAttribute('aria-pressed', 'true');
  await expect(choice('Show FPS', 'On')).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('hub-settings')!))).toEqual({
    difficulty: 'hard',
    fps: 30,
    showFps: true,
    reduceMotion: false,
    // British English is the default, whatever language the browser speaks.
    language: 'en',
    music: 35,
    effects: 80,
    muted: false,
    genreFilter: false,
    // Desktop Chromium can't tell WiFi from mobile data, so Wi-Fi only isn't offered.
    updates: 'auto',
    turn: 'turn',
    controller: true,
    cursorSpeed: 5,
  });
  await expect(dialog.getByRole('slider', { name: 'Music' })).toHaveValue('35');

  // A game opened now shows the FPS readout.
  await page.goto('/games/apothecary/');
  await expect(page.locator('.fps-readout')).toHaveText(/^\d+ FPS$/);

  // Every game has full screen: F toggles it, and so does the button, which then lets Enter and Space
  // through to the game instead of clicking itself again.
  const fullscreen = () => page.evaluate(() => document.fullscreenElement !== null);
  await page.keyboard.press('f');
  await expect.poll(fullscreen).toBe(true);
  await page.keyboard.press('f');
  await expect.poll(fullscreen).toBe(false);
  await page.locator('.fullscreen-button').click();
  await expect.poll(fullscreen).toBe(true);
  await page.keyboard.press('Enter');
  await expect.poll(fullscreen).toBe(true);

  // Delete all progress clears the games' saves and Continue playing, keeps the settings, and leaves
  // other sites' keys on the same origin alone.
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem('apothecary-save', '{}');
    localStorage.setItem('other-site-data', '1');
  });
  await page.reload();
  const recent = page.getByRole('navigation', { name: 'Continue playing' });
  await expect(recent.getByRole('link')).toHaveText(['Apothecary']);
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await dialog.getByRole('button', { name: 'Delete all progress' }).click();
  // The games each card last saw opened (shared/gameDates.ts) aren't progress, so they stay with the settings.
  expect((await page.evaluate(() => Object.keys(localStorage))).sort()).toEqual(['hub-seen', 'hub-settings', 'other-site-data']);
  await expect(recent).toBeHidden();

  await dialog.getByRole('button', { name: 'Restore defaults' }).click();
  await expect(choice('Difficulty', 'Normal')).toHaveAttribute('aria-pressed', 'true');
  await expect(choice('Show FPS', 'Off')).toHaveAttribute('aria-pressed', 'true');
  await dialog.getByRole('button', { name: 'Done' }).click();
  await expect(dialog).toBeHidden();
});

// A card's ⚙ deletes just that game's progress, a game played shows under Continue playing, and the
// genre filter (off by default) lists one genre's games.
test('hub game settings, continue playing and genre filter', async ({ page }, testInfo) => {
  await page.goto('/games/apothecary/');
  await expect(page.locator('canvas:not([data-backdrop])')).toBeVisible();
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem('apothecary-save', '{}');
    localStorage.setItem('apothecary-zoom', '2');
    localStorage.setItem('deadline-best', '3');
  });
  await page.reload();
  const recent = page.getByRole('navigation', { name: 'Continue playing' });
  await expect(recent.getByRole('link')).toHaveText(['Apothecary']);

  await page.getByRole('button', { name: 'Settings for Apothecary' }).click();
  const dialog = page.getByRole('dialog', { name: 'Apothecary' });
  await expect(dialog).toContainText('This game has progress saved on this device');
  await expect(dialog.getByRole('link', { name: 'Play' })).toHaveAttribute('href', 'games/apothecary/');
  await expect(dialog.getByRole('link', { name: 'Install' })).toHaveAttribute('href', 'games/apothecary/?install');
  testInfo.attach('game settings', { body: await dialog.screenshot({ path: testInfo.outputPath('game-settings.png') }), contentType: 'image/png' });
  page.once('dialog', (d) => d.accept());
  await dialog.getByRole('button', { name: "Delete this game's progress" }).click();
  await expect(dialog).toContainText('Nothing is saved for this game yet.');
  await expect(dialog.getByRole('button', { name: "Delete this game's progress" })).toBeDisabled();
  expect((await page.evaluate(() => Object.keys(localStorage))).sort()).toEqual(['deadline-best', 'hub-recent', 'hub-seen']);
  await expect(recent).toBeHidden();
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(dialog).toBeHidden();

  // The genre filter shows once its setting is on.
  const genres = page.getByRole('group', { name: 'Genres' });
  await expect(genres).toBeHidden();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('group', { name: 'Genre filter' }).getByRole('button', { name: 'On' }).click();
  await page.getByRole('dialog', { name: 'Settings' }).getByRole('button', { name: 'Close' }).click();
  await genres.getByRole('button', { name: 'Puzzle' }).click();
  await expect(genres.getByRole('button', { name: 'Puzzle' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.game:visible h2')).toContainText(['Augury', 'Lanternkeep', 'Mapmaker', 'Ninefold', 'Shrine Stack', 'TinctureTinker', 'Tiny Kingdom', 'Wyrmrail']);
  await expect(page.locator('.game:visible')).toHaveCount(8);
  testInfo.attach('genre filter', { body: await page.screenshot({ path: testInfo.outputPath('genre-filter.png') }), contentType: 'image/png' });
  await genres.getByRole('button', { name: 'All' }).click();
  await expect(page.locator('.game:visible')).toHaveCount(GAMES.length);
});

// Every game has a sound button beside full screen and pause. It opens the sound menu, with the music
// and effects volumes and a Mute button; the M key mutes too, and the next game keeps the settings.
// The pause screen sets the same volumes. The corner buttons keep clear of the screen's edges, for
// phones with rounded corners.
test('games have a sound menu and volumes', async ({ page }, testInfo) => {
  await page.addInitScript(() => Object.assign(window, { showStartScreen: true }));
  await page.goto('/games/apothecary/');
  const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('hub-settings') ?? '{}'));
  const sound = page.locator('.sound-button');
  const menu = page.locator('.sound-menu');
  const mute = menu.locator('.sound-mute');
  await expect(sound).toHaveAttribute('aria-label', 'Sound');
  // Full screen, sound and pause sit in one row, in that order, 12px from the edges.
  const corner = await page.locator('.game-corner').boundingBox();
  const view = page.viewportSize()!;
  expect(corner!.x).toBe(12);
  expect(view.height - corner!.y - corner!.height).toBe(12);
  await page.locator('.game-start-button').click();
  const order = await page.locator('.game-corner > button').evaluateAll((buttons) => buttons.map((b) => b.className.split(' ')[0]));
  expect(order).toEqual(['fullscreen-button', 'sound-button', 'pause-button']);

  // The button opens the menu above the corner row, with a slider each for music and effects.
  await expect(menu).toBeHidden();
  await sound.click();
  await expect(menu).toBeVisible();
  await expect(sound).toHaveAttribute('aria-expanded', 'true');
  const menuBox = (await menu.boundingBox())!;
  expect(menuBox.y + menuBox.height).toBeLessThanOrEqual(corner!.y);
  testInfo.attach('sound menu', { body: await page.screenshot({ path: testInfo.outputPath('sound-menu.png') }), contentType: 'image/png' });
  const music = menu.getByRole('slider', { name: 'Music' });
  await music.fill('30');
  await music.dispatchEvent('change');
  expect(await saved()).toMatchObject({ music: 30 });

  // Mute switches the shared setting, and so does M.
  await expect(mute).toHaveText('Mute (M)');
  await mute.click();
  await expect(mute).toHaveAttribute('aria-pressed', 'true');
  await expect(mute).toHaveText('Sound on (M)');
  expect((await saved()).muted).toBe(true);
  await page.keyboard.press('m');
  await expect(mute).toHaveAttribute('aria-pressed', 'false');
  expect((await saved()).muted).toBe(false);
  // Escape, or a tap anywhere else, closes the menu.
  await music.focus();
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await sound.click();
  await page.mouse.click(view.width / 2, view.height / 2);
  await expect(menu).toBeHidden();
  await page.keyboard.press('m');

  // The pause screen shows the same volumes; moving one saves it, turns the sound back on and moves the menu's too.
  await page.locator('.pause-button').click();
  await expect(page.locator('.game-overlay').getByRole('slider', { name: 'Music' })).toHaveValue('30');
  const effects = page.locator('.game-overlay').getByRole('slider', { name: 'Effects' });
  await expect(effects).toBeVisible();
  await effects.fill('40');
  await effects.dispatchEvent('change');
  expect(await saved()).toMatchObject({ effects: 40, muted: false });
  await expect(mute).toHaveAttribute('aria-pressed', 'false');
  await expect(menu.getByRole('slider', { name: 'Effects', includeHidden: true })).toHaveValue('40');

  // Another game opens with the same settings.
  await page.keyboard.press('m');
  await page.goto('/games/hotfoot/');
  await expect(page.locator('.sound-mute')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.sound-menu').getByRole('slider', { name: 'Effects', includeHidden: true })).toHaveValue('40');
});

// The first card shows a QR code of the hub's own address, drawn on load, so it fits wherever the hub is hosted.
test('hub shares its link as a QR code', async ({ page, context }, testInfo) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/index.html?from=test#top');
  const card = page.locator('.games > li').first();
  await expect(card.getByRole('heading')).toHaveText('Share the hub');
  // The link drops the query, the hash and index.html.
  await expect(card.locator('.share-link')).toHaveText('http://localhost:5173/');
  const qr = card.getByRole('img', { name: "QR code of the hub's link" });
  await expect(qr.locator('svg path')).toHaveCount(1);
  // Version 2 holds this link: 25 modules plus the 4-module margin on each side.
  await expect(qr.locator('svg')).toHaveAttribute('viewBox', '0 0 33 33');
  const box = (await qr.boundingBox())!;
  expect(box.width).toBeGreaterThan(120);
  testInfo.attach('share', { body: await page.screenshot({ path: testInfo.outputPath('share.png') }), contentType: 'image/png' });
  await card.getByRole('button', { name: 'Copy link' }).click();
  await expect(card.getByRole('button', { name: 'Link copied' })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('http://localhost:5173/');
});

// The game grid fills the width: wide screens get more than three columns, a phone gets one and nothing scrolls sideways.
test('hub grid fills the screen width', async ({ page }) => {
  const columns = () => page.locator('.games').evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/');
  expect(await columns()).toBeGreaterThan(3);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await columns()).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
});

// Every game loads behind a loading screen, waits on a start screen, and pauses with its button or P.
test('games have start and pause screens', async ({ page }, testInfo) => {
  // Under automation the start screen is skipped unless a test asks for it.
  await page.addInitScript(() => Object.assign(window, { showStartScreen: true }));
  await page.goto('/games/apothecary/');
  const overlay = page.locator('.game-overlay');
  const running = () => page.evaluate(() => (window as any).game.scene.getScene('Game')?.sys.isActive() === true);
  await expect(page.locator('.game-start-button')).toBeVisible();
  await expect(page.locator('.game-overlay-title')).toHaveText('Apothecary');
  expect(await running(), 'paused on the start screen').toBe(false);
  // Install shows only where the browser can install the page, which a test browser can't.
  await expect(page.getByRole('button', { name: 'Install as an app' })).toBeHidden();
  testInfo.attach('start', { body: await page.screenshot({ path: testInfo.outputPath('start.png') }), contentType: 'image/png' });

  // How to play opens from the start screen, keeps the game paused, and Esc goes back.
  await page.getByRole('button', { name: 'How to play' }).click();
  await expect(page.getByRole('heading', { name: 'How to play Apothecary' })).toBeVisible();
  await expect(page.locator('.game-start-button')).toBeHidden();
  expect(await running(), 'paused while reading How to play').toBe(false);
  testInfo.attach('how to play', { body: await page.screenshot({ path: testInfo.outputPath('how-to-play.png') }), contentType: 'image/png' });
  await page.keyboard.press('Escape');
  await expect(page.locator('.game-start-button')).toBeVisible();

  await page.locator('.game-start-button').click();
  await expect(overlay).toBeHidden();
  expect(await running(), 'playing after Start').toBe(true);

  await page.locator('.pause-button').click();
  await expect(page.locator('.game-resume-button')).toBeVisible();
  expect(await running(), 'paused by the button').toBe(false);
  testInfo.attach('paused', { body: await page.screenshot({ path: testInfo.outputPath('paused.png') }), contentType: 'image/png' });
  await page.keyboard.press(' ');
  await expect(overlay).toBeHidden();
  expect(await running(), 'playing after Space').toBe(true);

  await page.keyboard.press('p');
  await expect(page.locator('.game-resume-button')).toBeVisible();
  await page.keyboard.press('p');
  await expect(overlay).toBeHidden();
  expect(await running(), 'playing after P twice').toBe(true);
});

// Trophies (shared/trophies.ts): a stored trophy shows in its card's count, on the hub's trophy shelf
// and in the game's Trophies list on the start and pause screens.
test('hub and games show trophies', async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    localStorage.setItem('apothecary-trophies', JSON.stringify({ firstSale: Date.UTC(2026, 9, 24) }));
    Object.assign(window, { showStartScreen: true });
  });
  await page.goto('/');
  const card = page.locator('.game', { has: page.locator('a[href="games/apothecary/"]') });
  await expect(card.locator('.trophy-count')).toHaveText('🏆 1/10');
  await expect(card.locator('.trophy-count')).toHaveAttribute('aria-label', '1 of 10 trophies');
  await page.getByRole('button', { name: 'Trophies' }).click();
  const shelf = page.locator('#trophies');
  await expect(shelf).toBeVisible();
  await expect(shelf.locator('.trophy-game h3')).toHaveText(/Apothecary/);
  await expect(shelf.locator('.trophy-chip')).toHaveText(['🧪First customer']);
  await expect(shelf.locator('.trophy-total').first()).toHaveText('🏆Bronze 1');
  testInfo.attach('trophy shelf', { body: await shelf.screenshot({ path: testInfo.outputPath('trophy-shelf.png') }), contentType: 'image/png' });
  await shelf.locator('.close').click();

  await page.goto('/games/apothecary/');
  await page.getByRole('button', { name: 'Trophies 🏆 1/10' }).click();
  await expect(page.getByRole('heading', { name: 'Trophies of Apothecary' })).toBeVisible();
  const rows = page.locator('.trophy-row');
  await expect(rows).toHaveCount(10);
  await expect(rows.first()).toHaveClass(/earned/);
  await expect(rows.first()).toContainText('First customer');
  // A hidden trophy keeps its name until it is earned.
  await expect(rows.last()).toContainText('Hidden trophy');
  testInfo.attach('trophy list', { body: await page.screenshot({ path: testInfo.outputPath('trophy-list.png') }), contentType: 'image/png' });
  await page.keyboard.press('Escape');
  await expect(page.locator('.game-start-button')).toBeVisible();
});

// A game adds up its time played on this device (shared/playTime.ts) only while it runs: not on its
// start or pause screen. The test owns the clock, so the time counted is exact; `countPlayTime` lets
// it count under automation, which never counts otherwise.
test('games count time played', async ({ page }) => {
  await page.addInitScript(() => Object.assign(window, { showStartScreen: true, countPlayTime: true }));
  await page.clock.install();
  await page.goto('/games/apothecary/');
  const start = page.locator('.game-start-button');
  await expect.poll(async () => (await page.clock.runFor(100), start.isVisible()), { message: 'start screen' }).toBe(true);
  await page.clock.runFor(5000);
  await start.click();
  await page.clock.runFor(3000);
  await page.locator('.pause-button').click();
  await page.clock.runFor(5000);
  // Leaving the page saves what was played.
  await page.goto('/');
  const seconds = await page.evaluate(() => JSON.parse(localStorage.getItem('hub-playtime') ?? '{}').apothecary);
  expect(seconds, 'seconds counted between Start and pause').toBeGreaterThanOrEqual(2);
  expect(seconds, 'seconds counted between Start and pause').toBeLessThanOrEqual(3);
});

// Each card shows the time played on this device and the Settings panel the total; Sort lists the
// cards by name, last played or most played, and starred games come first, with a Favourites chip in
// the genre filter. Deleting a game's progress forgets its time played but keeps its star.
test('hub favourites, time played and sort', async ({ page }, testInfo) => {
  await page.goto('/');
  // No game played yet: no Sort row.
  await expect(page.getByRole('group', { name: 'Sort' })).toBeHidden();
  await page.evaluate(() => {
    localStorage.setItem('hub-playtime', JSON.stringify({ apothecary: 12_000, deadline: 150, palisade: 30 }));
    localStorage.setItem('hub-recent', JSON.stringify(['palisade', 'deadline', 'apothecary']));
  });
  await page.reload();
  const card = (path: string) => page.locator('.game').filter({ has: page.locator(`a[href="${path}"]`) });
  await expect(card('games/apothecary/').locator('.playtime')).toHaveText('3 h 20 min played');
  await expect(card('games/deadline/').locator('.playtime')).toHaveText('2 min played');
  // Under a minute shows nothing.
  await expect(card('games/palisade/').locator('.playtime')).toHaveCount(0);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const settings = page.getByRole('dialog', { name: 'Settings' });
  await expect(settings.locator('.total-play-time')).toHaveText('Time played on this device: 3 h 23 min');
  await settings.getByRole('button', { name: 'Close' }).click();

  const names = () => page.locator('.game h2').allTextContents();
  const sort = page.getByRole('group', { name: 'Sort' });
  await expect(sort.getByRole('button', { name: 'Name' })).toHaveAttribute('aria-pressed', 'true');
  await sort.getByRole('button', { name: 'Most played' }).click();
  expect((await names()).slice(0, 3)).toEqual(['Apothecary', 'Deadline', 'Palisade']);
  await sort.getByRole('button', { name: 'Last played' }).click();
  expect((await names()).slice(0, 3)).toEqual(['Palisade', 'Deadline', 'Apothecary']);
  // The order is kept across visits.
  await page.reload();
  await expect(sort.getByRole('button', { name: 'Last played' })).toHaveAttribute('aria-pressed', 'true');
  expect((await names())[0]).toBe('Palisade');
  await sort.getByRole('button', { name: 'Name' }).click();
  expect((await names())[0]).toBe('Anvilheart');

  // A starred game moves to the front and stays there.
  const star = page.getByRole('button', { name: 'Favourite Wyrmrail' });
  await expect(star).toHaveAttribute('aria-pressed', 'false');
  await star.click();
  await expect(star).toHaveAttribute('aria-pressed', 'true');
  expect((await names()).slice(0, 2)).toEqual(['Wyrmrail', 'Anvilheart']);
  testInfo.attach('favourites', { body: await page.screenshot({ path: testInfo.outputPath('favourites.png') }), contentType: 'image/png' });
  await page.reload();
  expect((await names())[0]).toBe('Wyrmrail');
  expect(await page.evaluate(() => localStorage.getItem('hub-favourites'))).toBe('["wyrmrail"]');

  // The genre filter gets a Favourites chip.
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('group', { name: 'Genre filter' }).getByRole('button', { name: 'On' }).click();
  await settings.getByRole('button', { name: 'Close' }).click();
  const genres = page.getByRole('group', { name: 'Genres' });
  await genres.getByRole('button', { name: 'Favourites' }).click();
  await expect(page.locator('.game:visible h2')).toHaveText(['Wyrmrail']);
  await genres.getByRole('button', { name: 'All' }).click();

  // Deleting Apothecary's progress forgets its time played, and none of it goes into its export.
  await page.getByRole('button', { name: 'Settings for Apothecary' }).click();
  const dialog = page.getByRole('dialog', { name: 'Apothecary' });
  await page.evaluate(() => localStorage.setItem('apothecary-save', '{}'));
  await dialog.getByRole('button', { name: 'Close' }).click();
  await page.getByRole('button', { name: 'Settings for Apothecary' }).click();
  page.once('dialog', (d) => d.accept());
  await dialog.getByRole('button', { name: "Delete this game's progress" }).click();
  await expect(card('games/apothecary/').locator('.playtime')).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('hub-playtime')!))).toEqual({ deadline: 150, palisade: 30 });
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(star).toHaveAttribute('aria-pressed', 'true');
});

// A stand-in controller (shared/gamepad.ts reads it through navigator.getGamepads), with its
// buttons pressed and its stick tilted by the test, since a test browser has no real one. A press
// lasts exactly one read of the pad, so a slow frame never makes a held direction repeat.
async function fakePad(page: Page) {
  await page.addInitScript(() => {
    const pad = {
      id: 'Test pad',
      index: 0,
      connected: true,
      mapping: 'standard',
      timestamp: 0,
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })),
    };
    /** Called once the pad has been read and that frame's presses handled. */
    let afterRead: (() => void)[] = [];
    navigator.getGamepads = () => {
      const waiting = afterRead;
      afterRead = [];
      queueMicrotask(() => waiting.forEach((f) => f()));
      return [pad as unknown as Gamepad];
    };
    const nextRead = () => new Promise<void>((done) => afterRead.push(done));
    Object.assign(window, { testPad: { pad, nextRead } });
  });
  const BUTTONS = { a: 0, b: 1, x: 2, select: 8, start: 9, up: 12, down: 13, left: 14, right: 15 };
  return {
    press: (button: keyof typeof BUTTONS) =>
      page.evaluate(async (i) => {
        const { pad, nextRead } = (window as any).testPad;
        Object.assign(pad.buttons[i], { pressed: true, value: 1 });
        await nextRead();
        Object.assign(pad.buttons[i], { pressed: false, value: 0 });
        await nextRead();
      }, BUTTONS[button]),
    stick: (x: number, y: number) =>
      page.evaluate(async ([ax, ay]) => {
        const { pad, nextRead } = (window as any).testPad;
        pad.axes = [ax, ay, 0, 0];
        await nextRead();
      }, [x, y]),
  };
}

// A controller walks the hub: the D-pad moves the focus between cards, X opens a card's ⚙, B closes
// the dialog, and Start opens Settings, where A picks a choice and left and right move a slider.
test('hub works with a controller', async ({ page }, testInfo) => {
  const pad = await fakePad(page);
  await page.goto('/');
  const cards = page.locator('.game > a');
  await cards.first().focus();
  await pad.press('down');
  // The card below the first one, in a grid of several columns.
  const columns = await page.locator('.games').evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
  const below = await page.evaluate(() => document.activeElement?.closest('.game')?.querySelector('h2')?.textContent?.trim());
  const names = (await page.locator('.game h2').allTextContents()).map((n) => n.trim());
  expect(below).toBe(names[columns]);
  await expect(page.locator('html')).toHaveClass(/pad-focus/);
  testInfo.attach('focus', { body: await page.screenshot({ path: testInfo.outputPath('pad-focus.png') }), contentType: 'image/png' });
  await pad.press('up');
  await expect(cards.first()).toBeFocused();
  await pad.press('x');
  const gameDialog = page.getByRole('dialog', { name: names[0] });
  await expect(gameDialog).toBeVisible();
  await pad.press('b');
  await expect(gameDialog).toBeHidden();

  await pad.press('start');
  const settings = page.getByRole('dialog', { name: 'Settings' });
  await expect(settings).toBeVisible();
  // A pick in Settings draws the row again, and the focus stays on it.
  const hard = settings.getByRole('group', { name: 'Difficulty' }).getByRole('button', { name: 'Hard', exact: true });
  await hard.focus();
  await pad.press('a');
  await expect(hard).toHaveAttribute('aria-pressed', 'true');
  await expect(hard).toBeFocused();
  const speed = settings.getByRole('slider', { name: 'Cursor speed' });
  await speed.focus();
  await pad.press('right');
  await expect(speed).toHaveValue('6');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('hub-settings')!).cursorSpeed)).toBe(6);
  await pad.press('start');
  await expect(settings).toBeHidden();
});

// In a game the controller moves around the start and pause screens, and steers a cursor that taps
// the game like a mouse: here the cursor sends the doctor walking.
test('games work with a controller', async ({ page }, testInfo) => {
  await page.addInitScript(() => Object.assign(window, { showStartScreen: true }));
  const pad = await fakePad(page);
  await page.goto('/games/apothecary/');
  const running = () => page.evaluate(() => (window as any).game.scene.getScene('Game')?.sys.isActive() === true);
  await expect(page.locator('.game-start-button')).toBeFocused();
  // Down goes to How to play, A opens it and B goes back.
  await pad.press('down');
  await expect(page.getByRole('button', { name: 'How to play' })).toBeFocused();
  await pad.press('a');
  await expect(page.getByRole('heading', { name: 'How to play Apothecary' })).toBeVisible();
  await expect(page.getByRole('rowheader', { name: 'Controller: left stick, A, B' })).toBeVisible();
  await pad.press('b');
  await expect(page.locator('.game-start-button')).toBeVisible();
  await pad.press('start');
  await expect(page.locator('.game-overlay')).toBeHidden();
  expect(await running(), 'playing after Start').toBe(true);

  // Start pauses; on the pause screen left and right move a focused volume, and B resumes.
  await pad.press('start');
  await expect(page.locator('.game-resume-button')).toBeFocused();
  expect(await running(), 'paused by Start').toBe(false);
  const music = page.locator('.game-overlay .volume-music');
  await music.focus();
  await pad.press('left');
  await expect(music).toHaveValue('55');
  await pad.press('b');
  await expect(page.locator('.game-overlay')).toBeHidden();

  // Select opens the sound menu, where the D-pad moves, and B closes it.
  await pad.press('select');
  await expect(page.locator('.sound-menu')).toBeVisible();
  await pad.press('down');
  await expect(page.locator('.sound-menu .volume-music')).toBeFocused();
  await pad.press('b');
  await expect(page.locator('.sound-menu')).toBeHidden();

  // The stick brings up the cursor and moves it left; A taps there, and the doctor sets off.
  const cursor = page.locator('.pad-cursor');
  const left = () => cursor.evaluate((el) => el.getBoundingClientRect().left);
  await expect(cursor).toBeHidden();
  const middle = await page.evaluate(() => innerWidth / 2);
  await pad.stick(-1, 0);
  await expect(cursor).toBeVisible();
  await expect.poll(left).toBeLessThan(middle - 150);
  await pad.stick(0, 0);
  const pointerTarget = () => page.evaluate(() => (window as any).game.scene.getScene('Game').pointerTarget);
  expect(await pointerTarget(), 'standing before the tap').toBeNull();
  await pad.press('a');
  await expect.poll(pointerTarget).not.toBeNull();
  testInfo.attach('cursor', { body: await page.screenshot({ path: testInfo.outputPath('pad-cursor.png') }), contentType: 'image/png' });
  // A real mouse move hides it again.
  await page.mouse.move(100, 100);
  await expect(cursor).toBeHidden();
});

// The hub shows each game's play count from its counter (shared/playCount.ts), here answered by a
// stand-in so the test never reaches the real service. A game never played, or a counter that fails,
// shows no line.
test('hub shows play counts', async ({ page }, testInfo) => {
  await page.addInitScript(() => Object.assign(window, { showPlayCounts: true }));
  await page.route('https://abacus.jasoncameron.dev/get/**', (route) => {
    const game = new URL(route.request().url()).pathname.split('/').pop();
    if (game === 'deadline') return route.fulfill({ status: 404, json: { error: 'Key not found' } });
    if (game === 'palisade') return route.abort();
    return route.fulfill({ json: { value: game === 'apothecary' ? 1234 : 1 } });
  });
  await page.goto('/');
  const plays = (path: string) => page.locator(`.game a[href="${path.slice(1)}"] .plays`);
  await expect(plays('/games/apothecary/')).toHaveText('1,234 plays');
  await expect(plays('/games/tiny-kingdom/')).toHaveText('1 play');
  await expect(page.locator('.game .plays')).toHaveCount(GAMES.length - 2);
  await expect(plays('/games/deadline/')).toHaveCount(0);
  await expect(plays('/games/palisade/')).toHaveCount(0);
  testInfo.attach('play counts', {
    body: await page.locator('.game').first().screenshot({ path: testInfo.outputPath('play-counts.png') }),
    contentType: 'image/png',
  });
});

// The Language setting switches the hub at once, reaches the shared screens of a game opened
// afterwards, and formats numbers and dates to match (shared/i18n.ts).
test('hub switches language', async ({ page }, testInfo) => {
  await page.addInitScript(() => Object.assign(window, { showPlayCounts: true, showStartScreen: true }));
  await page.route('https://abacus.jasoncameron.dev/get/**', (route) => route.fulfill({ json: { value: 1234 } }));
  await page.goto('/');
  await expect(page.locator('h1')).toHaveText('Game hub');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Settings' });
  // A first visit is in British English, though the browser under test speaks US English.
  await expect(dialog.getByRole('group', { name: 'Language' }).getByRole('button', { name: 'English (UK)' })).toHaveAttribute('aria-pressed', 'true');
  await dialog.getByRole('group', { name: 'Language' }).getByRole('button', { name: 'Deutsch' }).click();

  // The hub switches without a reload: the page, the panel, the cards and the play counts.
  const einstellungen = page.getByRole('dialog', { name: 'Einstellungen' });
  await expect(einstellungen.getByRole('group', { name: 'Sprache' }).getByRole('button', { name: 'Deutsch' })).toHaveAttribute('aria-pressed', 'true');
  await expect(einstellungen.getByRole('group', { name: 'Schwierigkeit' }).getByRole('button', { name: 'Leicht' })).toBeVisible();
  await expect(page.locator('h1')).toHaveText('Spielesammlung');
  await expect(page.locator('html')).toHaveAttribute('lang', 'de-DE');
  await expect(page.locator('.game a[href="games/apothecary/"] p').first()).toHaveText(/^Führe als Pestdoktor/);
  await expect(page.locator('.game a[href="games/apothecary/"] .plays')).toHaveText('1.234-mal gespielt');
  testInfo.attach('german settings', { body: await page.screenshot({ path: testInfo.outputPath('german-settings.png') }), contentType: 'image/png' });
  await einstellungen.getByRole('button', { name: 'Schließen' }).click();

  // It is kept, and a game opened now shows its start, pause and How to play screens in German.
  await page.reload();
  await expect(page.getByRole('button', { name: 'Einstellungen', exact: true })).toBeVisible();
  await page.goto('/games/apothecary/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'de-DE');
  await expect(page.locator('.game-overlay-hint')).toHaveText('P drücken zum Pausieren \u00b7 H für die Spielanleitung');
  await page.getByRole('button', { name: 'Spielanleitung' }).click();
  await expect(page.getByRole('heading', { name: 'Spielanleitung: Apothecary' })).toBeVisible();
  await expect(page.locator('.game-help h3').first()).toHaveText('Steuerung');
  testInfo.attach('german how to play', { body: await page.screenshot({ path: testInfo.outputPath('german-how-to-play.png') }), contentType: 'image/png' });

  // ?lang= shows another language without changing the setting.
  await page.goto('/?lang=en');
  await expect(page.locator('h1')).toHaveText('Game hub');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('hub-settings')!).language)).toBe('de');

  // Numbers and dates: British English, US English and German.
  const formats = async (lang: string) => {
    await page.goto(`/?lang=${lang}`);
    return page.evaluate(async () => {
      const i18n = await import('/shared/i18n.ts' as string);
      return [i18n.formatNumber(1234.5), i18n.formatDate(new Date(2026, 9, 17))];
    });
  };
  expect(await formats('en')).toEqual(['1,234.5', '17/10/2026']);
  expect(await formats('en-US')).toEqual(['1,234.5', '10/17/2026']);
  expect(await formats('de')).toEqual(['1.234,5', '17.10.2026']);
});

// Progress files: a game's ⚙ exports just its progress to an encrypted file ending in .gh and the
// game's code, and imports it back; another game's file or an edited one is refused. Settings
// exports every game's progress and the settings to a .gh file and imports it back.
test('hub progress files', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem('apothecary-save', '{"coins":42}');
    localStorage.setItem('palisade-best', '7');
    localStorage.setItem('other-site-data', '1');
  });
  await page.reload();
  const alerts: string[] = [];
  page.on('dialog', (d) => {
    if (d.type() === 'alert') alerts.push(d.message());
    d.accept();
  });
  const save = async (button: ReturnType<Page['getByRole']>) => {
    const download = page.waitForEvent('download');
    await button.click();
    const file = await download;
    return { name: file.suggestedFilename(), path: (await file.path())! };
  };
  const load = async (button: ReturnType<Page['getByRole']>, path: string) => {
    const chooser = page.waitForEvent('filechooser');
    await button.click();
    await (await chooser).setFiles(path);
  };
  const stored = (key: string) => page.evaluate((k) => localStorage.getItem(k), key);

  // One game's file holds its progress, encrypted.
  await page.getByRole('button', { name: 'Settings for Palisade' }).click();
  const palisade = page.getByRole('dialog', { name: 'Palisade' });
  const palisadeFile = await save(palisade.getByRole('button', { name: 'Export progress' }));
  expect(palisadeFile.name).toMatch(/^palisade-\d{4}-\d\d-\d\d\.ghpa$/);
  await palisade.getByRole('button', { name: 'Close' }).click();

  await page.getByRole('button', { name: 'Settings for Apothecary' }).click();
  const dialog = page.getByRole('dialog', { name: 'Apothecary' });
  testInfo.attach('game progress file', { body: await dialog.screenshot({ path: testInfo.outputPath('game-progress-file.png') }), contentType: 'image/png' });
  const file = await save(dialog.getByRole('button', { name: 'Export progress' }));
  expect(file.name).toMatch(/^apothecary-\d{4}-\d\d-\d\d\.ghap$/);
  const bytes = readFileSync(file.path);
  expect(bytes.toString('latin1')).not.toContain('coins');

  // Importing it brings the progress back, and leaves the other games alone.
  await page.evaluate(() => {
    localStorage.setItem('apothecary-save', '{"coins":1}');
    localStorage.setItem('apothecary-extra', '1');
  });
  await load(dialog.getByRole('button', { name: 'Import progress' }), file.path);
  await expect.poll(() => stored('apothecary-save')).toBe('{"coins":42}');
  expect(await stored('apothecary-extra')).toBeNull();
  expect(await stored('palisade-best')).toBe('7');
  expect(alerts).toEqual([]);

  // Another game's file and an edited file are refused.
  await load(dialog.getByRole('button', { name: 'Import progress' }), palisadeFile.path);
  await expect.poll(() => alerts).toEqual(['This is not a progress file for Apothecary, or it was changed.']);
  const edited = testInfo.outputPath('edited.ghap');
  bytes[bytes.length - 1] ^= 1;
  writeFileSync(edited, bytes);
  await load(dialog.getByRole('button', { name: 'Import progress' }), edited);
  await expect.poll(() => alerts.length).toBe(2);
  expect(await stored('apothecary-save')).toBe('{"coins":42}');
  await dialog.getByRole('button', { name: 'Close' }).click();

  // Export all and Import all carry every game and the settings, and nothing of other sites.
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const settings = page.getByRole('dialog', { name: 'Settings' });
  await settings.getByRole('group', { name: 'Difficulty' }).getByRole('button', { name: 'Hard' }).click();
  const progressRow = settings.locator('.setting').filter({ has: page.locator('#export-progress') });
  testInfo.attach('progress files', { body: await progressRow.screenshot({ path: testInfo.outputPath('progress-files.png') }), contentType: 'image/png' });
  const all = await save(settings.getByRole('button', { name: 'Export all' }));
  expect(all.name).toMatch(/^game-hub-progress-\d{4}-\d\d-\d\d\.gh$/);
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('other-site-data', '2');
  });
  // It reloads the hub, since the settings may have changed.
  const reloaded = page.waitForEvent('load');
  await load(settings.getByRole('button', { name: 'Import all' }), all.path);
  await reloaded;
  expect(await stored('palisade-best')).toBe('7');
  expect(await stored('apothecary-save')).toBe('{"coins":42}');
  expect(await stored('other-site-data')).toBe('2');
  expect(JSON.parse((await stored('hub-settings'))!).difficulty).toBe('hard');
  // A game's file is not a hub file.
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await load(settings.getByRole('button', { name: 'Import all' }), file.path);
  await expect.poll(() => alerts.at(-1)).toBe('This is not a .gh progress file, or it was changed.');
});

const FORMAT_1_CODE =
  '00388611549979848084000525607965281983195443244506320428338445169006717417534230605292484273504822650227669183668994907657951656785173122606117826985689453211870339720797120018516295156754428079842309044543633554217027338667290099186711230786375732923460201123341995943232019404586200549';

// A game's progress, or every game's, also moves as a QR code of a link that opens the hub and
// imports it (shared/progressCode.ts), or as that link copied and pasted.
test('hub progress codes', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem('apothecary-save', '{"coins":42}');
    localStorage.setItem('palisade-best', '7');
    // Codes keep six significant digits of a number.
    localStorage.setItem('palisade-pos', '{"x":815.0696658242933,"kind":"wall"}');
    // Saved replays and a run under way are too big for a code, so only files carry them.
    localStorage.setItem('mazewright-replays', '{"meadow":{}}');
    localStorage.setItem('riftblade-run', '{"phase":"run"}');
  });
  await page.reload();
  const messages: string[] = [];
  let paste = '';
  page.on('dialog', (d) => {
    messages.push(d.message());
    d.accept(d.type() === 'prompt' ? paste : undefined);
  });
  const stored = (key: string) => page.evaluate((k) => localStorage.getItem(k), key);

  // One game's code: a QR code of a link with the sealed progress in its digits.
  await page.getByRole('button', { name: 'Settings for Apothecary' }).click();
  await page.getByRole('dialog', { name: 'Apothecary' }).getByRole('button', { name: 'QR code' }).click();
  const codeDialog = page.getByRole('dialog', { name: 'Apothecary: progress code' });
  await expect(codeDialog.getByRole('img', { name: 'QR code of the progress' }).locator('svg')).toBeVisible();
  testInfo.attach('progress code', { body: await codeDialog.screenshot({ path: testInfo.outputPath('progress-code.png') }), contentType: 'image/png' });
  const link = await codeDialog.getByRole('textbox', { name: 'Progress code' }).inputValue();
  expect(link).toMatch(/^http:\/\/localhost:5173\/#p=\d+$/);
  await codeDialog.getByRole('button', { name: 'Done' }).click();

  // Opening the link, as a phone camera does, asks and then brings that game's progress back.
  await page.evaluate(() => localStorage.setItem('apothecary-save', '{"coins":1}'));
  await page.goto('about:blank');
  await page.goto(link);
  await expect.poll(() => stored('apothecary-save')).toBe('{"coins":42}');
  expect(messages.at(-1)).toMatch(/^Replace the progress of Apothecary on this device with the one in the code, saved .+\?$/);
  expect(page.url()).toBe('http://localhost:5173/');

  // A pasted code that was changed is refused and changes nothing.
  const digits = link.split('#p=')[1];
  paste = digits.slice(0, -1) + ((Number(digits.at(-1)) + 1) % 10);
  await page.getByRole('button', { name: 'Settings for Apothecary' }).click();
  await page.getByRole('dialog', { name: 'Apothecary' }).getByRole('button', { name: 'Paste code' }).click();
  await expect.poll(() => messages.at(-1)).toBe('This is not a progress code, or it was changed or cut short.');
  expect(await stored('apothecary-save')).toBe('{"coins":42}');
  await page.getByRole('dialog', { name: 'Apothecary' }).getByRole('button', { name: 'Close' }).click();

  // Every game's code, pasted, brings every game and the settings back.
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const settings = page.getByRole('dialog', { name: 'Settings' });
  await settings.getByRole('group', { name: 'Difficulty' }).getByRole('button', { name: 'Hard' }).click();
  await settings.getByRole('button', { name: 'QR code' }).click();
  const allDialog = page.getByRole('dialog', { name: 'Progress code of every game' });
  paste = await allDialog.getByRole('textbox', { name: 'Progress code' }).inputValue();
  await allDialog.getByRole('button', { name: 'Done' }).click();
  // The code carries no replays or run under way, and keeps this device's own.
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('mazewright-replays', '{"local":{}}');
    localStorage.setItem('riftblade-run', '{"phase":"local"}');
  });
  const reloaded = page.waitForEvent('load');
  await settings.getByRole('button', { name: 'Paste code' }).click();
  await reloaded;
  expect(await stored('apothecary-save')).toBe('{"coins":42}');
  expect(await stored('palisade-best')).toBe('7');
  expect(await stored('palisade-pos')).toBe('{"x":815.07,"kind":"wall"}');
  expect(await stored('mazewright-replays')).toBe('{"local":{}}');
  expect(await stored('riftblade-run')).toBe('{"phase":"local"}');
  expect(JSON.parse((await stored('hub-settings'))!).difficulty).toBe('hard');

  // A code made before codes were packed (format 1, Apothecary at 42 coins) still imports.
  await page.evaluate(() => localStorage.setItem('apothecary-save', '{"coins":1}'));
  paste = FORMAT_1_CODE;
  await page.getByRole('button', { name: 'Settings for Apothecary' }).click();
  await page.getByRole('dialog', { name: 'Apothecary' }).getByRole('button', { name: 'Paste code' }).click();
  await expect.poll(() => stored('apothecary-save')).toBe('{"coins":42}');
});

// Scan code reads a progress code's QR code with the camera inside the hub (shared/scanner.ts). The
// camera here is a canvas showing the code, and the browser's own detector is taken away, so the
// bundled one (barcode-detector) reads it, as on an iPhone.
test('hub scans a progress code', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('palisade-best', '7'));
  await page.reload();
  await page.getByRole('button', { name: 'Settings for Palisade' }).click();
  await page.getByRole('dialog', { name: 'Palisade' }).getByRole('button', { name: 'QR code' }).click();
  const svg = await page.locator('#progress-code .qr').innerHTML();

  await page.addInitScript((svg) => {
    delete (window as { BarcodeDetector?: unknown }).BarcodeDetector;
    navigator.mediaDevices.getUserMedia = async () => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 480;
      const g = canvas.getContext('2d')!;
      const image = new Image();
      image.src = `data:image/svg+xml,${encodeURIComponent(svg)}`;
      await image.decode();
      const draw = () => {
        g.fillStyle = '#888';
        g.fillRect(0, 0, 480, 480);
        g.drawImage(image, 60, 60, 360, 360);
        requestAnimationFrame(draw);
      };
      draw();
      return canvas.captureStream(15);
    };
  }, svg);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  const messages: string[] = [];
  page.on('dialog', (d) => {
    messages.push(d.message());
    d.accept();
  });
  await page.getByRole('button', { name: 'Settings for Palisade' }).click();
  await page.getByRole('dialog', { name: 'Palisade' }).getByRole('button', { name: 'Scan code' }).click();
  // The code can be read before a check of the open scanner would run, so only its result is checked.
  const scanner = page.getByRole('dialog', { name: 'Scan a progress code' });
  await expect.poll(() => page.evaluate(() => localStorage.getItem('palisade-best')), { timeout: 20_000 }).toBe('7');
  expect(messages.at(-1)).toMatch(/^Replace the progress of Palisade on this device with the one in the code/);
  await expect(scanner).toBeHidden();
  testInfo.attach('scanned', { body: await page.screenshot(), contentType: 'image/png' });
});

// Progress too big for one QR code shows as a loop of codes, which Scan code collects.
test('hub scans a loop of progress codes', async ({ page }, testInfo) => {
  await page.goto('/');
  // Random text barely compresses, so this takes several codes.
  const big = await page.evaluate(() => {
    const text = Array.from(crypto.getRandomValues(new Uint8Array(3000)), (b) => b.toString(36)).join('');
    localStorage.setItem('riftblade-progress', text);
    return text;
  });
  await page.reload();
  await page.getByRole('button', { name: 'Settings for Riftblade' }).click();
  await page.getByRole('dialog', { name: 'Riftblade' }).getByRole('button', { name: 'QR code' }).click();
  const codeDialog = page.getByRole('dialog', { name: 'Riftblade: progress code' });
  await expect(codeDialog.locator('.lede')).toContainText('QR codes, shown in turn');
  const count = Number((await codeDialog.locator('.frame-count').textContent())!.split(' of ')[1]);
  expect(count).toBeGreaterThan(1);
  testInfo.attach('progress loop', { body: await codeDialog.screenshot({ path: testInfo.outputPath('progress-loop.png') }), contentType: 'image/png' });
  // Every frame as it is shown.
  const svgs = new Map<string, string>();
  await expect
    .poll(async () => {
      const [n, svg] = await page.evaluate(() => [
        document.querySelector('#progress-code .frame-count')!.textContent!,
        document.querySelector('#progress-code .qr')!.innerHTML,
      ]);
      svgs.set(n, svg);
      return svgs.size;
    }, { intervals: [50] })
    .toBe(count);

  // The camera here is a canvas that shows the frames in turn, as the other device would.
  await page.addInitScript((svgs) => {
    delete (window as { BarcodeDetector?: unknown }).BarcodeDetector;
    navigator.mediaDevices.getUserMedia = async () => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 640;
      const g = canvas.getContext('2d')!;
      const images = await Promise.all(
        svgs.map(async (svg) => {
          const image = new Image();
          image.src = `data:image/svg+xml,${encodeURIComponent(svg)}`;
          await image.decode();
          return image;
        }),
      );
      const start = performance.now();
      const draw = () => {
        g.fillStyle = '#888';
        g.fillRect(0, 0, 640, 640);
        g.drawImage(images[Math.floor((performance.now() - start) / 400) % images.length], 40, 40, 560, 560);
        requestAnimationFrame(draw);
      };
      draw();
      return canvas.captureStream(15);
    };
  }, [...svgs.values()]);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  page.on('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('dialog', { name: 'Settings' }).getByRole('button', { name: 'Scan code' }).click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('riftblade-progress')), { timeout: 30_000 }).toBe(big);
});

// The hub and every game link their own web app manifest, so each installs as an app of its own.
test('hub and games install as apps', async ({ page, request }) => {
  for (const [path, name] of [['/', 'Game hub'], ...GAMES.map((g) => [g.path, g.name])]) {
    await page.goto(path);
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    const url = new URL(href!, page.url()).href;
    const manifest = await (await request.get(url)).json();
    expect(manifest.name).toBe(name);
    expect(new URL(manifest.start_url, url).pathname).toBe(path);
    // An id resolves against the origin, so a relative id would make every app the same one;
    // without an id the app's id is its start_url, which differs for each app.
    const id = manifest.id === undefined ? new URL(manifest.start_url, url) : new URL(manifest.id, new URL(url).origin);
    expect(id.pathname).toBe(path);
    for (const icon of manifest.icons) expect((await request.get(new URL(icon.src, url).href)).ok()).toBe(true);
  }
});

// The Install on a game's hub card opens the game with ?install: its start screen shows Install as
// the main button in every browser, and where the browser has no install prompt it says how.
test('a game installs from its start screen', async ({ page }, testInfo) => {
  await page.addInitScript(() => Object.assign(window, { showStartScreen: true }));
  await page.goto('/games/apothecary/?install');
  const install = page.getByRole('button', { name: 'Install as an app' });
  await expect(install).toBeVisible();
  await expect(install).toHaveClass(/game-overlay-button/);
  testInfo.attach('install', { body: await page.screenshot({ path: testInfo.outputPath('install.png') }), contentType: 'image/png' });
  let hint = '';
  page.once('dialog', (d) => {
    hint = d.message();
    d.accept();
  });
  await install.click();
  await expect.poll(() => hint).toBe("To install, pick Install app or Add to Home Screen in your browser's menu.");
  await page.locator('.game-start-button').click();
  await expect(install).toBeHidden();
});

// The Updates setting says when the installed apps download a new version, and Update now checks
// at once; the dev server has no service worker, so it says there is no app to update.
test('hub update settings', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const updates = page.getByRole('dialog', { name: 'Settings' }).getByRole('group', { name: 'Updates' });
  // Desktop Chromium can't tell WiFi from mobile data, so it isn't offered Wi-Fi only.
  await expect(updates.getByRole('button', { name: 'Automatic' })).toHaveAttribute('aria-pressed', 'true');
  await expect(updates.getByRole('button', { name: 'Wi-Fi only' })).toHaveCount(0);
  await updates.getByRole('button', { name: 'Off' }).click();
  await expect(updates.getByRole('button', { name: 'Off' })).toHaveAttribute('aria-pressed', 'true');
  const row = updates.locator('xpath=..');
  testInfo.attach('updates', { body: await row.screenshot({ path: testInfo.outputPath('updates.png') }), contentType: 'image/png' });
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('hub-settings')!).updates)).toBe('off');
  let message = '';
  page.once('dialog', (d) => {
    message = d.message();
    d.accept();
  });
  await updates.getByRole('button', { name: 'Update now' }).click();
  await expect.poll(() => message).toBe('This browser has no app installed to update. Open the site online once to set up updates and offline play.');
});

// A browser that tells WiFi from mobile data, like Chrome on Android, offers Wi-Fi only and picks it first.
test('hub offers Wi-Fi only updates where the connection type is known', async ({ page }) => {
  await page.addInitScript(() => {
    const connection = (navigator as { connection?: object }).connection!;
    Object.defineProperty(Object.getPrototypeOf(connection), 'type', { get: () => 'wifi', configurable: true });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const updates = page.getByRole('dialog', { name: 'Settings' }).getByRole('group', { name: 'Updates' });
  await expect(updates.getByRole('button', { name: 'Wi-Fi only' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Wi-Fi only waits while you are on mobile data.', { exact: false })).toBeVisible();
});

// Each game's settings say when it was last updated, and its card shows Updated (or New) until the
// game is opened on this device (shared/gameDates.ts).
test('hub marks updated games until they are opened', async ({ page }, testInfo) => {
  await page.goto('/');
  // A first visit counts every game that isn't new as seen, so nothing shows Updated.
  const seen = await page.evaluate(() => JSON.parse(localStorage.getItem('hub-seen') ?? '{}'));
  await expect(page.locator('.game .badge.updated')).toHaveCount(0);
  // Apothecary was last opened long ago, before its latest update.
  await page.evaluate((list) => localStorage.setItem('hub-seen', JSON.stringify({ ...list, apothecary: '2000-01-01' })), seen);
  await page.reload();
  const card = page.locator('.game').filter({ has: page.getByRole('heading', { name: 'Apothecary' }) });
  await expect(card.locator('.badge')).toHaveText('Updated');
  await expect(card.locator('.badge')).toHaveAttribute('title', /^Updated \d{1,2} \w+ \d{4}$/);
  testInfo.attach('badge', { body: await card.screenshot({ path: testInfo.outputPath('badge.png') }), contentType: 'image/png' });

  await card.getByRole('button', { name: 'Settings for Apothecary' }).click();
  const dialog = page.getByRole('dialog', { name: 'Apothecary' });
  await expect(dialog.getByText(/^Last updated \d{1,2} \w+ \d{4}$/)).toBeVisible();
  testInfo.attach('last-updated', { body: await dialog.screenshot({ path: testInfo.outputPath('last-updated.png') }), contentType: 'image/png' });
  await dialog.getByRole('button', { name: 'Close' }).click();

  // Opening the game clears its badge.
  await card.getByRole('link').click();
  await expect(page).toHaveURL(/\/games\/apothecary\/$/);
  await expect(page.locator('canvas')).toBeVisible();
  await page.goto('/');
  await expect(card).toBeVisible();
  await expect(card.locator('.badge')).toHaveCount(0);
});
