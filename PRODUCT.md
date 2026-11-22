# Product: Life Incremental

**User.** People who keep playing incremental and idle games but drop habit apps after a week. Secondary: anyone searching for a gamified goal tracker or a "life RPG" with no sign-up.

**Painful job.** Personal goals have no visible progress. A list of goals looks the same on day 40 as on day 1, so the list gets abandoned.

**Promise.** Every goal you finish moves you one visible step up a mountain. Nothing else moves you. When you reach the top, you can choose a harder climb.

**Wedge.** The prestige reset, borrowed from incremental games, applied to real goals: a reason to keep going after "done". Share cards ("Day 18 · Peak I · Reached Glacier") and challenge links carry it to friends. Search pages answer "gamified goal tracker", "life RPG app", "small goal ideas".

**Why now.** Incremental games are a mainstream genre, habit apps are crowded with streaks and subscriptions, and a browser can now do everything this needs (drawing, saving, sharing images) with no server.

**Activation metric.** A visitor finishes their first goal (`goal_done`). Then: share cards per tier-up, and how many players prestige.

**First revenue event.** Someone buys a cosmetic peak pack (new mountains and palettes) on separate hosting. The slot exists (`PACKS_URL`); the product and payment link are a key (OPERATIONS.md, key 2). Paid accountability groups would need accounts and a server: later.

**What v1 deliberately won't do.**
- Accounts, sync, reminders or notifications.
- Streaks, points, coins, loot or anything to buy inside the game.
- Social feeds or leaderboards (the brief cuts them; challenge links are the only social piece).
- Health, money or legal advice: the goal ideas are plain, countable things to do.
- "Start in the slums": the ladder is a mountain and everyone starts at the Trailhead.
