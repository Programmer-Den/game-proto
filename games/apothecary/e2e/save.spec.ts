import { expect, test, type Page } from '@playwright/test';

// Loads a save in the old, whole shape and checks it plays on, then that the game writes it back
// thin: upgrades, craftsmen and builds still at their start are left out and filled in on load.
// The hub page stands in between visits, so the game's own save on leaving never overwrites the
// save the test puts in.

const KEY = 'apothecary-save';
type Upgrades = Record<string, { level: number; paid: number }>;
type Saved = { thin?: boolean; upgrades: Upgrades; craftsmen: Upgrades; belts: object; shade: { built: boolean }[] };

async function open(page: Page) {
  await page.goto('/games/apothecary/');
  await expect.poll(() => page.evaluate(() => !!(window as any).game?.scene.getScene('Game')?.player), { timeout: 30_000 }).toBe(true);
}
const upgrades = (page: Page) => page.evaluate(() => (window as any).game.scene.getScene('Game').state.upgrades as Upgrades);
async function putSave(page: Page, save: object) {
  await page.goto('/');
  await page.evaluate(([key, raw]) => localStorage.setItem(key, raw), [KEY, JSON.stringify(save)]);
}
const stored = (page: Page) => page.evaluate((key) => localStorage.getItem(key)!, KEY);

test('loads old saves and saves only what was touched', async ({ page }) => {
  await open(page);
  const old = (await page.evaluate(() => JSON.parse(JSON.stringify((window as any).game.scene.getScene('Game').state)))) as Saved;
  const ids = Object.keys(old.upgrades);
  // An old save from before the study taught recipes, with a shade garden grown and the growth bought.
  delete (old.upgrades as Partial<Upgrades>).research;
  old.upgrades.growth = { level: 1, paid: 0 };
  old.shade[0].built = true;
  await putSave(page, old);

  await open(page);
  const loaded = await upgrades(page);
  expect(Object.keys(loaded).sort(), 'every upgrade is there').toEqual([...ids].sort());
  expect(loaded.research, 'the old save keeps its Shadow Elixirs').toEqual({ level: 2, paid: 0 });
  expect(loaded.growth).toEqual({ level: 1, paid: 0 });
  expect(loaded.replant).toEqual({ level: 0, paid: 0 });

  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  const raw = await stored(page);
  const thin = JSON.parse(raw) as Saved;
  expect(thin.thin).toBe(true);
  expect(Object.keys(thin.upgrades).sort(), 'only the bought upgrades are saved').toEqual(['growth', 'research']);
  expect(thin.craftsmen).toEqual({});
  expect(thin.belts).toEqual({});
  expect(raw.length, 'the thin save is shorter').toBeLessThan(JSON.stringify(old).length - 500);

  // In a thin save a missing upgrade is one never bought, so nothing is granted for it.
  delete (thin.upgrades as Partial<Upgrades>).research;
  await putSave(page, thin);
  await open(page);
  const again = await upgrades(page);
  expect(Object.keys(again).sort()).toEqual([...ids].sort());
  expect(again.research).toEqual({ level: 0, paid: 0 });
  expect(again.growth).toEqual({ level: 1, paid: 0 });
});
