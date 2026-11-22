# Operations

Life Incremental runs itself on GitHub: Pages hosts it, Actions runs every recurring job. Nothing needs a person for it to keep working.

**Live:** https://theguysaccount.github.io/life-incremental-game/
**Repo:** https://github.com/theguysaccount/life-incremental-game

The game is static: there is no data to refresh and no server. The only recurring job is the weekly self-test.

## Automated jobs

| Job | Workflow | When | What it does | How it fails safe |
|---|---|---|---|---|
| Deploy | `pages.yml` | every push to `main` that touches the site; on demand | Unit and build tests; builds `dist/`; plays the built game in headless Chrome at desktop and phone sizes and in dark mode (fails on any console error, any request to another site, or sideways scrolling); deploys; waits until the live `build.json` shows the new version and checks every page; plays the live game; pings IndexNow | Any failure before deploy stops the run, so the last good site stays live. IndexNow problems are warnings, never failures. |
| Self-test + keep-alive | `selftest.yml` | Wednesdays 15:43 UTC, and on demand | Tests; rebuilds with the deploy's settings; checks every live page (200, own canonical, share image), robots.txt, the IndexNow key file, the 404 page, and that the live build is the one main produces; plays the live game end to end. Then the keep-alive. | On failure it opens (or comments on) one `ops-alert` issue and GitHub emails the repo owner; the next clean run closes the issue. It never changes the site, except one thing: **staleness check**: if the live build is behind main and no deploy is running, it dispatches `pages.yml`. |
| Keep-alive | `selftest.yml` → `scripts/keepalive.sh` | every self-test run, even a failed one | Re-enables every scheduled workflow through the API (leaves one alone if a person disabled it), and pushes an empty `[skip ci]` commit when the last commit is 45+ days old | GitHub disables scheduled workflows after 60 days without repository activity. |

Every job is safe to re-run and nothing depends on a run firing at an exact time: GitHub often starts this account's scheduled runs hours late, and the self-test only compares the live site with main.

**Schedule proven:** the first schedule-triggered self-test passed on 22 November 2026 ([run](https://github.com/theguysaccount/life-incremental-game/actions/runs/45034844136)): every live page, the live build version, the live run-through and the keep-alive. The temporary every-30-minutes schedule that proved it has been removed.

## What to watch

- **Open `ops-alert` issues** (GitHub emails the account owner when one opens).
- **Actions → Weekly self-test**: a green run every week. A missing week usually means GitHub skipped a scheduled run; the next one catches up.

## Run anything by hand

```bash
~/.local/bin/gh workflow run selftest.yml -R theguysaccount/life-incremental-game
~/.local/bin/gh workflow run pages.yml -R theguysaccount/life-incremental-game
node scripts/check_live.mjs https://theguysaccount.github.io/life-incremental-game   # after `node scripts/build.mjs`
node scripts/e2e.mjs https://theguysaccount.github.io/life-incremental-game/
```

## Keys Jack can turn later

Nothing below is needed for the game to work.

### 1. Custom domain

One setting holds the address: the repository variable `SITE_URL` (default `https://theguysaccount.github.io/life-incremental-game`). Canonical URLs, the sitemap, robots.txt, share cards and IndexNow all follow it.

**Saves are kept per web address.** After the move, the github.io address redirects to the domain, and climbs saved under the old address can't be opened there. If the game has players by then, first set `MOVE_NOTICE_URL` to the new address (for example `https://climb.example.com/`) and run `pages.yml`: the home page then tells players to export their save and import it at the new address. Give it a couple of weeks, then switch.

Steps (replace `climb.example.com`):
1. DNS at the registrar. For a subdomain: `CNAME climb` → `theguysaccount.github.io`. For an apex domain: `A @` → `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`; `AAAA @` → `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153`; and `CNAME www` → `theguysaccount.github.io`. Never change a record that already serves something: if the domain is in use, give the site a new subdomain. Use the apex only if it shows the registrar's parking page, replacing just the parking records (at Namecheap, `ALIAS @` → `theguysaccount.github.io.` with TTL 300 does the job of the A and AAAA records). Look the new host up over DNS-over-HTTPS (`curl -s "https://dns.google/resolve?name=HOST&type=CNAME"`), because a local resolver can hold an old answer.
2. `~/.local/bin/gh api -X PUT repos/theguysaccount/life-incremental-game/pages -f cname=climb.example.com` (or Settings → Pages → Custom domain).
3. When `~/.local/bin/gh api repos/theguysaccount/life-incremental-game/pages --jq .https_certificate.state` says `approved`: `~/.local/bin/gh api -X PUT repos/theguysaccount/life-incremental-game/pages -F https_enforced=true`.
4. `~/.local/bin/gh variable set SITE_URL -R theguysaccount/life-incremental-game -b https://climb.example.com` (no trailing slash), and delete `MOVE_NOTICE_URL` if it was set.
5. `~/.local/bin/gh workflow run pages.yml -R theguysaccount/life-incremental-game`. The deploy checks the new address end to end and pings IndexNow for it. The weekly self-test follows the same variable.

### 2. Money: cosmetic peak packs

GitHub Pages is non-commercial, so the game sells nothing itself. The slot is a footer link (and a short section on About), hidden until a link exists. The brief's optional key: Stripe on other hosting for cosmetic tier packs (new mountains and palettes).

- Build the pack store on other hosting (Stripe Payment Link or a small shop), then `~/.local/bin/gh variable set PACKS_URL -R theguysaccount/life-incremental-game -b https://…` (https only), optionally `PACKS_LABEL`, and run `pages.yml`.
- Delivering packs into the game needs a small change: `PALETTES` in `site/assets/core.js` is where new looks go.

### 3. Analytics (activation metric)

Off by default. Events already in the code: `goal_set`, `goal_done` (**activation**: a first finished goal), `card_open`, `card_download`, `card_share`, `link_copy`, `prestige`, `challenge_open`. No goal text is ever sent.

- Create a free GoatCounter site, then `~/.local/bin/gh variable set GOATCOUNTER_URL -R theguysaccount/life-incremental-game -b https://<code>.goatcounter.com/count` and run `pages.yml`. The privacy text and the Content-Security-Policy update themselves.

### 4. Search Console

Verify the site in Google Search Console (needs a Google account; easiest after the domain move, with a DNS TXT record) and submit `/sitemap.xml`. Bing and other IndexNow engines are pinged on every deploy.

### 5. Content routine (optional)

There is no recurring content: the game is the product. If more goal ideas would help search, a quarterly Claude routine can add them: "In theguysaccount/life-incremental-game, add one new area of 9 finishable goal ideas to site/data/ideas.json (new unique ids, never change or remove existing ids; no health, money or legal advice; each under 80 characters), run `node --test tests/*.test.mjs` and `node scripts/build.mjs && node scripts/e2e.mjs`, then commit and push."

## Safety and privacy rules the code keeps

- No accounts, cookies, analytics (by default) or third-party scripts; the Content-Security-Policy blocks everything but the site's own files.
- Goals stay in one localStorage entry; share cards leave goal text off unless the player asks.
- Goal ideas are plain actions, not health, financial or legal advice; the footer says so.
