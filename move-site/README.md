# Redirect site for the old address

The hub moved from `chriszly.github.io/game-proto/` to `programmer-den.github.io/game-proto/` when
the repo moved to the Programmer-Den organisation. GitHub Pages doesn't forward a moved site, and the
players' saves live in their browsers under the old address, so this redirect site takes the old
address's place. It is kept here and published from the `Chriszly/game-proto` repo, which was made
new and empty after the transfer.

## What it does

- **Every old address forwards to the same page at the new one.** `index.html` and `404.html` are
  the same page, so `…/game-proto/games/apothecary/?install` lands on
  `…/game-proto/games/apothecary/?install` at the new address, hash and all.
- **Saves come along.** The page reads the hub's and the games' storage keys at the old address
  (never another site's) and opens the new address's `move.html` with them sealed in its
  `#move=` part. `shared/move.ts` takes them in without overwriting anything newer there: a game takes
  the old saves only when it has nothing saved at the new address, and hub lists and maps
  (favourites, recently played, time played) only gain what they lack. Saved replays and runs under
  way stay behind if they would make the link too long.
- **Installed apps switch over.** `sw.js` replaces the hub's service worker. Browsers check that file
  for a change whenever a page of the site opens, so it installs at once, even where the hub's
  Updates setting held updates back (that check was in the old worker's code). It deletes the old
  offline copies, reloads the open pages onto the redirect page and serves that page offline.
  Inside an installed app (the hub's or a game's) the page doesn't forward on its own, since on
  iPhones the app keeps saves apart from the browser. It says the app moved, and its button opens
  the new address in the browser with that app's saves, where the player installs the app again.
- **Old saves stay put.** Nothing is deleted at the old address, so opening an old link again later
  still works, and fills in only games never played at the new one.

## Make and publish it

The transfer is done: this repo is `Programmer-Den/game-proto`, and `Chriszly/game-proto` holds only
the redirect site. To publish it again, for example after a game is added:

1. Check that Pages is on for `Chriszly/game-proto` (deploy from the `main` branch, root).
2. Check `newHome` in `config.json` (the hub's new address, ending in a slash) and `oldHome` (the
   old site's path).
3. Run `node scripts/move-site.mjs`. It writes `dist-move/` with `index.html`, `404.html`, `sw.js`
   and `favicon.svg`, with the list of games filled in.
4. Push the contents of `dist-move/` to the `Chriszly/game-proto` repo's `main` branch.

`e2e/hub.spec.ts` ("the old address forwards with its saves") checks the page and `move.html`
together, with a made-up old address.
