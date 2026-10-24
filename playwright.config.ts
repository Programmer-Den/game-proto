import { defineConfig, devices } from '@playwright/test';

// End-to-end tests: run the dev server (which exposes `window.game`) and play in Chromium.
// One project per game, each with its tests in games/<name>/e2e, plus one for the hub page.
export default defineConfig({
  timeout: 10 * 60_000,
  retries: 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    ...devices['Desktop Chrome'],
    viewport: { width: 960, height: 540 },
    // The screen matches the window, so games render at 1x like on a 960x540 display; Desktop
    // Chrome's own 1920x1080 screen would make every game paint at 2x and start slower.
    screen: { width: 960, height: 540 },
    video: { mode: 'on', size: { width: 960, height: 540 } },
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'hub', testDir: 'e2e' },
    { name: 'apothecary', testDir: 'games/apothecary/e2e' },
    // Deadline is a portrait game, played on an upright phone-sized screen.
    {
      name: 'deadline',
      testDir: 'games/deadline/e2e',
      use: { viewport: { width: 540, height: 960 }, screen: { width: 540, height: 960 }, video: { mode: 'on', size: { width: 540, height: 960 } } },
    },
    { name: 'palisade', testDir: 'games/palisade/e2e' },
    { name: 'tiny-kingdom', testDir: 'games/tiny-kingdom/e2e' },
    { name: 'hotfoot', testDir: 'games/hotfoot/e2e' },
    { name: 'anvilheart', testDir: 'games/anvilheart/e2e' },
    { name: 'broadside', testDir: 'games/broadside/e2e' },
    { name: 'tincture-tinker', testDir: 'games/tincture-tinker/e2e' },
    { name: 'catacomb', testDir: 'games/catacomb/e2e' },
    { name: 'golem-garden', testDir: 'games/golem-garden/e2e' },
    { name: 'beehive-baron', testDir: 'games/beehive-baron/e2e' },
    { name: 'wyrmrail', testDir: 'games/wyrmrail/e2e' },
    { name: 'shrine-stack', testDir: 'games/shrine-stack/e2e' },
    { name: 'mapmaker', testDir: 'games/mapmaker/e2e' },
    { name: 'lanternkeep', testDir: 'games/lanternkeep/e2e' },
    { name: 'space-wars', testDir: 'games/space-wars/e2e' },
    { name: 'lane-brawl', testDir: 'games/lane-brawl/e2e' },
    { name: 'colonizer', testDir: 'games/colonizer/e2e' },
    { name: 'riftblade', testDir: 'games/riftblade/e2e' },
    { name: 'scrapyard-titans', testDir: 'games/scrapyard-titans/e2e' },
    { name: 'bramblecrest', testDir: 'games/bramblecrest/e2e' },
    { name: 'ninefold', testDir: 'games/ninefold/e2e' },
    { name: 'augury', testDir: 'games/augury/e2e' },
    { name: 'mazewright', testDir: 'games/mazewright/e2e' },
  ],
  webServer: {
    command: 'npm run dev -- --port 5173 --strictPort',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
});
