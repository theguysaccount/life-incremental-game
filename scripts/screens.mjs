#!/usr/bin/env node
// Screenshots of the key screens at desktop (1280px) and phone (390px) widths, into docs/screens/.
//
//   node scripts/screens.mjs            # from dist/, served locally
//   node scripts/screens.mjs https://host/x/
import path from "node:path";
import { fileURLToPath } from "node:url";
import cfg from "../site.config.mjs";
import { launch } from "./lib/chrome.mjs";
import { serve } from "./lib/serve.mjs";
import * as core from "../site/assets/core.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "docs", "screens");
const siteUrl = (process.env.SITE_URL || cfg.defaultSiteUrl).replace(/\/+$/, "");
const server = process.argv[2] ? null : await serve(path.join(ROOT, "dist"), { prefix: new URL(siteUrl + "/").pathname });
const base = process.argv[2] ? process.argv[2].replace(/\/+$/, "") + "/" : server.url;
const READY = "document.documentElement.dataset.ready === '1'";
const DAY = 86400000;

// A believable climb: `done` goals finished over the last days, two goals in progress.
function sample(peak, done, now = Date.now()) {
  const texts = ["Walk for 20 minutes on five days", "Finish the first draft", "Call one old friend", "Sort the paper pile", "Send three job applications",
    "Cook three new recipes", "Clear my desk", "Read for 15 minutes before bed for a week", "Ship version one", "Write three thank-you notes"];
  let s = core.newGame(now - (done * 3 + 2) * DAY);
  for (let p = 1; p < peak; p++) {
    for (let i = 0; i < core.stepsToSummit(p); i++) {
      s = core.setGoal(s, 0, texts[i % texts.length], s.createdAt + i * DAY);
      s = core.completeGoal(s, 0, s.createdAt + i * DAY + 3600000).state;
    }
    s = core.prestige(s, now - (done * 3 + 1) * DAY);
  }
  for (let i = 0; i < done; i++) {
    const t = now - (done - i) * 3 * DAY;
    s = core.setGoal(s, 0, texts[i % texts.length], t - 2 * DAY);
    s = core.completeGoal(s, 0, t, i === done - 1 ? "Done before breakfast, twice in the rain" : "").state;
  }
  s = core.setGoal(s, 0, "Finish the first draft, however rough", now - 2 * DAY);
  s = core.setGoal(s, 1, "Walk for 20 minutes on five days this week", now - DAY);
  return s;
}

const browser = await launch();
try {
  for (const [label, width, height, mobile] of [["desktop", 1280, 900, false], ["phone", 390, 844, true]]) {
    const page = await browser.newPage({ width, height, mobile, reducedMotion: true });
    const shot = (name, opts) => page.screenshot(path.join(OUT, `${name}-${label}.png`), opts).then(() => console.log(`docs/screens/${name}-${label}.png`));
    const load = async (state, query = "") => {
      await page.goto(base, { ready: READY });
      await page.eval(state ? `localStorage.setItem("life-incremental:v1", ${JSON.stringify(JSON.stringify(state))})` : "localStorage.clear()");
      await page.goto(base + query, { ready: READY });
    };
    await load(null);
    await shot("home-new", { fullPage: true });
    await load(sample(1, 5));
    await shot("climb", { fullPage: true });
    await page.click('[data-action=done][data-slot="0"]');
    await page.click("#dlg [data-close=yes]");
    await page.waitFor("!!document.querySelector('#dlg-title')?.dataset.event");
    await shot("tier-up");
    await page.click("#dlg [data-close=card]");
    await page.waitFor("document.querySelector('#card-img')?.dataset.ready === '1'");
    await shot("share-card");
    await load(sample(2, 7), "?c=1-7-12");
    await shot("peak-two", { fullPage: true });
    for (const p of ["how-it-works", "goal-ideas"]) {
      await page.goto(`${base}${p}/`);
      await shot(p, { fullPage: true });
    }
    await page.close();
  }
  const dark = await browser.newPage({ width: 1280, height: 900, dark: true, reducedMotion: true });
  await dark.goto(base, { ready: READY });
  await dark.eval(`localStorage.setItem("life-incremental:v1", ${JSON.stringify(JSON.stringify(sample(3, 20)))})`);
  await dark.goto(base, { ready: READY });
  await dark.screenshot(path.join(OUT, "peak-three-dark-desktop.png"), { fullPage: true });
  console.log("docs/screens/peak-three-dark-desktop.png");
  await dark.close();
} finally {
  await browser.close();
  if (server) await server.close();
}
