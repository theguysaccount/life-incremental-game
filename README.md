# Life Incremental

**Live:** https://theguysaccount.github.io/life-incremental-game/ · **Screens:** [docs/screens](docs/screens/) · **Operations:** [OPERATIONS.md](OPERATIONS.md)

A goal tracker that plays like an incremental game. Set three real goals. Every goal you finish moves you up one tier of an illustrated mountain, from the Trailhead to the Summit. At the Summit you can prestige: bank a badge and start a taller peak where every tier takes more finished goals. Free, no account, saved in your own browser.

- **Three goal slots.** Set, edit, drop. A goal idea button and a page of 72 finishable ideas.
- **Ten-station ladder** drawn as a mountain that fills in as you climb; three palettes cycle as you prestige.
- **Prestige** at the Summit only: Peak II needs two finished goals per tier, Peak III and later three.
- **Climb log** with dates, optional one-line notes and undo.
- **Share cards** (1080×1080 PNG drawn in the browser) and challenge links that carry three numbers: peak, tier and day.
- **Local saves** with export and import. No accounts, no cookies, no third-party scripts, nothing sent anywhere.

## How it runs

| What | Where | When |
|---|---|---|
| Unit and build tests, build, headless-Chrome play-through, deploy, live check, IndexNow | `.github/workflows/pages.yml` | every push to `main` that touches the site; on demand |
| Tests, live page checks, live play-through, redeploy if stale, keep-alive | `.github/workflows/selftest.yml` | weekly (Wednesdays 15:43 UTC) |

Failure handling, what to watch and the keys (custom domain, money, analytics): [OPERATIONS.md](OPERATIONS.md).

## Layout

```
site/assets/core.js      the rules: goals, tiers, prestige, saves, challenge links (no DOM; shared with tests and build)
site/assets/art.js       the mountain, the share card, tier icons and badges as SVG strings
site/assets/app.js       the page: renders from one save in localStorage
site/data/ideas.json     goal ideas by area (ids are stable: links use them)
site.config.mjs          repo name, default address, IndexNow key
scripts/build.mjs        static site generator (no dependencies) -> dist/
scripts/e2e.mjs          plays the game in headless Chrome at desktop and phone sizes, local or live
scripts/check_live.mjs   live health check (pages, canonicals, robots, key file, images, build version)
scripts/screens.mjs      screenshots into docs/screens/; scripts/og.mjs draws the share previews and icons
scripts/lib/             a tiny Chrome DevTools driver, a static server and build helpers
tests/                   node:test suites for the rules, the art and the built site
```

## Run, test, deploy

Node 22 or newer and Google Chrome (or Chromium). No `npm install`: there are no dependencies.

```bash
node scripts/build.mjs                                     # build dist/
node scripts/lib/serve.mjs dist /life-incremental-game/ 8080   # http://127.0.0.1:8080/life-incremental-game/
node --test tests/*.test.mjs                               # rules, art and build tests
node scripts/e2e.mjs                                       # play dist/ in headless Chrome
node scripts/e2e.mjs --live                                # play the live site
node scripts/check_live.mjs                                # check the live site against a local build
```

Deploy is a push to `main`. Set `CHROME=/path/to/chrome` if Chrome isn't found.

## Privacy

The game keeps one entry in the browser's localStorage (`life-incremental:v1`) and never sends it anywhere. The page's Content-Security-Policy only allows its own files. Share cards leave goal text off unless the player ticks a box.

## License

MIT. See [LICENSE](LICENSE).
