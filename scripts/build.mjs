#!/usr/bin/env node
// Build the Life Incremental static site into dist/. Node 22+, no dependencies.
//
//   node scripts/build.mjs [--out dist]
//
// Optional environment (GitHub repository variables in CI; see OPERATIONS.md):
//   SITE_URL         canonical origin + path, no trailing slash (default: the GitHub Pages URL)
//   GOATCOUNTER_URL  e.g. https://example.goatcounter.com/count -> cookieless visit counts on
//   PACKS_URL        link for the "more peaks" slot (with PACKS_LABEL); hidden when empty
//   MOVE_NOTICE_URL  the new address, a few weeks before a domain move: tells players to export their saves
//   BUILD_DATE       YYYY-MM-DD, to reproduce a build
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import cfg from "../site.config.mjs";
import { Site, esc, attr, copyDir, versionModuleImports } from "./lib/build-lib.mjs";
import * as core from "../site/assets/core.js";
import { sceneSVG, tierIcon } from "../site/assets/art.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fmt = (n) => n.toLocaleString("en-US");
const LOGO = '<svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="14" fill="#2b2330"/><polygon points="6,54 26,20 34,32 42,14 58,54" fill="#f4a97f"/><polygon points="42,14 36,24 48,27" fill="#ffffff"/><path d="M42 14V5" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/><polygon points="42,5 54,9 42,13" fill="#ff7a45"/></svg>';
const NAV = [["", "Play"], ["how-it-works/", "How it works"], ["goal-ideas/", "Goal ideas"], ["about/", "About"]];

function httpsUrl(value, name) {
  if (!value) return "";
  let u;
  try { u = new URL(value); } catch { throw new Error(`${name} is not a URL: ${value}`); }
  if (u.protocol !== "https:") throw new Error(`${name} must start with https://`);
  return u.href;
}

export function build({ out = path.join(ROOT, "dist"), env = process.env } = {}) {
  const settings = {
    goatcounterUrl: httpsUrl((env.GOATCOUNTER_URL || "").trim(), "GOATCOUNTER_URL"),
    packsUrl: httpsUrl((env.PACKS_URL || "").trim(), "PACKS_URL"),
    packsLabel: (env.PACKS_LABEL || "").trim() || "Get more peaks",
    moveNoticeUrl: httpsUrl((env.MOVE_NOTICE_URL || "").trim(), "MOVE_NOTICE_URL"),
  };
  const site = new Site({ root: ROOT, out, cfg, env, settings, inputs: ["site", "site.config.mjs", "scripts/build.mjs", "scripts/lib/build-lib.mjs"] });
  const areas = JSON.parse(fs.readFileSync(path.join(ROOT, "site", "data", "ideas.json"), "utf8"));
  const ideaCount = core.flattenIdeas(areas).length;

  fs.rmSync(out, { recursive: true, force: true });
  copyDir(path.join(ROOT, "site", "assets"), path.join(out, "assets"));
  versionModuleImports(path.join(out, "assets"), site.version);
  fs.copyFileSync(path.join(ROOT, "site", "favicon.svg"), path.join(out, "favicon.svg"));
  site.write("site.webmanifest", JSON.stringify({
    name: cfg.brand, short_name: cfg.brand, description: "Turn your goals into a climb.", start_url: "./", scope: "./", display: "standalone",
    background_color: "#fbf5ec", theme_color: cfg.themeColor,
    icons: [{ src: "assets/icon-192.png", sizes: "192x192", type: "image/png" }, { src: "assets/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "favicon.svg", sizes: "any", type: "image/svg+xml" }],
  }, null, 1));

  const privacy = "Your goals stay in this browser: no account, no cookies, nothing sent to a server." +
    (settings.goatcounterUrl ? " Visits are counted with GoatCounter, which uses no cookies and collects no personal data." : "");
  const packsLink = settings.packsUrl ? `<a href="${attr(settings.packsUrl)}" rel="noopener sponsored">${esc(settings.packsLabel)}</a>` : "";

  const layout = (page, body) => `<!doctype html>
<html lang="en">
<head>
${site.head(page)}
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="site-head"><div class="wrap">
<a class="logo" href="${page.root}">${LOGO}Life Incremental</a>
<nav class="nav" aria-label="Main">${NAV.map(([p, t]) => `<a href="${page.root}${p}"${p === page.path ? ' aria-current="page"' : ""}>${t}</a>`).join("")}</nav>
</div></header>
<main id="main" class="wrap${page.narrow ? " narrow" : ""}">
${body}
</main>
<footer class="site-foot"><div class="wrap">
<nav aria-label="Footer">${NAV.map(([p, t]) => `<a href="${page.root}${p}">${t}</a>`).join("")}<a href="${cfg.repoUrl}">Source code</a>${packsLink}</nav>
<p>${privacy}</p>
<p>A game about your own goals. It gives no medical, financial or legal advice.</p>
</div></footer>
</body>
</html>
`;

  // ---- home: the game ----------------------------------------------------------------------------
  site.page({
    path: "", og: "home",
    title: "Life Incremental: turn your goals into a climb (free goal game, no account)",
    ogTitle: "Turn your goals into a climb",
    description: "A goal tracker that plays like an incremental game. Set three real goals; each one you finish moves you up a tier of the mountain. Summit, then prestige. Free, no account.",
    modules: ["app.js"],
    data: { "site-config": { siteUrl: site.siteUrl }, ideas: areas.map((a) => ({ area: a.area, ideas: a.ideas })) },
    jsonld: [{
      "@context": "https://schema.org", "@type": "WebApplication", name: cfg.brand, url: site.url(""), applicationCategory: "LifestyleApplication",
      operatingSystem: "Any", browserRequirements: "Requires JavaScript", isAccessibleForFree: true, inLanguage: "en",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      description: "A goal tracker that plays like an incremental game: finish real goals to climb a ten-station mountain, then prestige to a harder peak.",
    }],
  }, (page) => layout(page, `
<section class="hero">
<p class="eyebrow">A goal tracker that plays like an incremental game</p>
<h1>Turn your goals into a climb.</h1>
<p class="lede">Set three real goals. Every one you finish moves you up a tier of the mountain. Reach the Summit, then prestige, if you want to, and start a taller peak. Free, no account, saved on this device.</p>
</section>
${settings.moveNoticeUrl ? `<p class="banner" id="move-notice">Life Incremental is moving to <a href="${attr(settings.moveNoticeUrl)}">${esc(new URL(settings.moveNoticeUrl).host)}</a>. Climbs are saved per web address, so press “Export save” below, then “Import save” at the new address.</p>` : ""}
<p id="challenge" class="banner" role="status" hidden></p>
<p id="live" class="sr-only" aria-live="polite"></p>
<div id="app">
<figure class="scene-wrap">${sceneSVG({ peak: 1, step: 0, labels: "all", uid: "static" })}
<figcaption>Everyone starts at the Trailhead. Finish a goal to reach the Forest Path.</figcaption></figure>
<noscript><p class="msg warn">The game needs JavaScript to save your goals in this browser. You can still read <a href="how-it-works/">how it works</a>.</p></noscript>
</div>
<dialog id="dlg" aria-labelledby="dlg-title"><div id="dlg-body"></div></dialog>
<section aria-labelledby="how-h">
<h2 id="how-h">How it works</h2>
<ol class="steps">
<li><b>Set three goals</b>Real ones, sized so you can finish each in one to four weeks.</li>
<li><b>Finish one, climb a tier</b>Ten stations from the Trailhead to the Summit. Nothing else moves you: no points, no streaks, no coins.</li>
<li><b>Prestige, if you want</b>At the Summit you can bank a badge and start a taller peak where every tier takes more.</li>
</ol>
<p><a href="how-it-works/">The full rules and the ladder</a> · <a href="goal-ideas/">${ideaCount} goal ideas you can finish this month</a></p>
</section>
<section aria-labelledby="why-h" class="narrow">
<h2 id="why-h">Why make it a game?</h2>
<p>Incremental games are hard to put down because progress is always visible and the next step is always small. Life Incremental borrows that and leaves out the grind: the only way to move up is to finish something in real life. There are no streaks to break, no currency to farm and nothing to buy.</p>
<p>When you reach a new tier you can make a share card with your day count on it. It shows where you are on the mountain, not what your goals are, unless you choose to add one.</p>
</section>`));

  // ---- how it works -----------------------------------------------------------------------------
  const ladderRows = core.TIERS.map((t, i) => `<tr><td>${tierIcon(i)}</td><td><b>${esc(t.name)}</b><br><span class="muted">${esc(t.blurb)}</span></td><td class="num">${i}</td><td class="num">${fmt(core.altitudeAt(1, i))} m</td></tr>`).reverse().join("");
  const peakRows = [1, 2, 3, 4].map((p) => `<tr><td><b>${core.peakName(p)}</b></td><td>${esc(core.paletteFor(p).name)}</td><td class="num">${core.stepsPerTier(p)}</td><td class="num">${core.stepsToSummit(p)}</td><td class="num">${fmt(core.altitudeAt(p, core.stepsToSummit(p)))} m</td></tr>`).join("");
  const faq = [
    ["Is it free? Do I need an account?", "It's free and there is no account. You open the page and start."],
    ["Where are my goals stored?", "In your browser's storage on the device you're using, under one entry. They are never sent to a server, so nobody else can read them, and clearing your browser data erases them. Use “Export save” to keep a backup."],
    ["Can I use it on my phone and my laptop?", "Yes, but each device keeps its own save. To move a climb, press “Export save” on one device and “Import save” on the other."],
    ["What is prestige?", "A term from incremental games: you give up your current progress in exchange for a permanent reward and a harder run. Here, prestige is only offered at the Summit. You bank a summit badge, go back to the Trailhead of a taller peak, and every tier takes more finished goals. It's optional."],
    ["What counts as a finished goal?", "Whatever you honestly finished. Nobody checks. The game asks once, “Did you finish it?”, and takes your word for it."],
    ["What if I tap “Done” by mistake?", "Use “Undo the last one” in the climb log. It works until your next prestige."],
    ["Are there streaks, points or coins?", "No. The only number that moves is your place on the mountain, and only a finished goal moves it."],
  ];
  site.page({
    path: "how-it-works/", og: "how", narrow: true,
    title: "How Life Incremental works: the ladder, the rules and prestige",
    description: "The rules in a minute: three goals at a time, one tier per finished goal, ten stations from Trailhead to Summit, and an optional prestige to a taller, harder peak.",
    jsonld: [{ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) }],
  }, (page) => layout(page, `
<article class="prose">
<h1>How it works</h1>
<p class="lede">Life Incremental is a goal tracker built on the mechanics of incremental games: visible tiers, small next steps, and a prestige reset for a harder second run. The difference is that nothing happens while you wait. Only a finished goal moves you.</p>
<h2>The rules in a minute</h2>
<ol>
<li><b>You hold up to three goals at a time.</b> Write each one so that you'll know, without arguing with yourself, when it's done.</li>
<li><b>Finishing a goal moves you up.</b> On your first peak, one finished goal is one tier.</li>
<li><b>A finished goal frees its slot.</b> Set the next one and keep going. You can drop or edit a goal at any time; dropped goals don't count.</li>
<li><b>Nine climbs take you from the Trailhead to the Summit.</b></li>
<li><b>At the Summit you can prestige</b> to a taller peak, or stay. Goals finished at the Summit still count toward your lifetime total.</li>
</ol>
<p><a class="btn" href="../">Start at the Trailhead</a></p>
<h2>The ladder</h2>
<p>Everyone starts at the Trailhead. It's a starting line, not a ranking of people.</p>
<div class="table-wrap"><table class="ladder-table">
<thead><tr><th></th><th>Station</th><th class="num">Tier</th><th class="num">Altitude on Peak I</th></tr></thead>
<tbody>${ladderRows}</tbody></table></div>
<h2>Prestige: a taller, harder peak</h2>
<p>Prestige is optional and only available on a summit. You keep your summit badges, your climb log, your lifetime totals and your current goals. You give up your place on the mountain and start again at the Trailhead of the next peak, which is taller and asks more of you for every tier.</p>
<div class="table-wrap"><table>
<thead><tr><th>Peak</th><th>Light</th><th class="num">Goals per tier</th><th class="num">Goals to summit</th><th class="num">Summit height</th></tr></thead>
<tbody>${peakRows}</tbody></table></div>
<p>From Peak III on, every tier takes three finished goals. The mountains keep getting taller and the light keeps changing.</p>
<h2>What makes a good goal here</h2>
<ul>
<li><b>Finishable.</b> “Run three times this week” can be ticked off. “Get fit” can't.</li>
<li><b>Yours.</b> Pick things you want done, not things that would look good on a card.</li>
<li><b>One to four weeks.</b> Short enough to stay real, long enough to matter. Break anything bigger into the next step.</li>
</ul>
<p>Stuck? There are <a href="../goal-ideas/">${ideaCount} goal ideas</a> you can load into a slot with one tap.</p>
<h2>Share cards and challenge links</h2>
<p>At any time you can make a square picture of where you are: your tier, your day count and your totals. It leaves your goals off unless you tick the box to add the latest one. The challenge link next to it carries three numbers (peak, tier, day) so a friend can see how far you've come and start their own climb.</p>
<h2>Questions</h2>
<dl class="faq">${faq.map(([q, a]) => `<dt>${esc(q)}</dt><dd>${esc(a)}</dd>`).join("")}</dl>
</article>`));

  // ---- goal ideas ------------------------------------------------------------------------------
  site.page({
    path: "goal-ideas/", og: "ideas",
    title: `${ideaCount} small goal ideas you can finish in a month | Life Incremental`,
    description: `${ideaCount} short-term goal examples across ${areas.length} areas of life, each small enough to finish in one to four weeks. Tap one to load it into the game.`,
    jsonld: [{
      "@context": "https://schema.org", "@type": "ItemList", name: "Small goal ideas you can finish in a month", numberOfItems: ideaCount,
      itemListElement: core.flattenIdeas(areas).map((idea, i) => ({ "@type": "ListItem", position: i + 1, name: idea.text })),
    }],
  }, (page) => layout(page, `
<section class="hero">
<h1>${ideaCount} goal ideas you can finish in a month</h1>
<p class="lede">The hardest part of a goal is writing one small enough to finish. These are sized for one to four weeks and worded so you'll know when they're done. Tap “Use this” to load one into the game, then change the numbers to fit your life.</p>
</section>
<div class="idea-areas">
${areas.map((a) => `<section class="idea-area" aria-labelledby="area-${attr(a.ideas[0].id.split("-")[0])}">
<h2 id="area-${attr(a.ideas[0].id.split("-")[0])}">${esc(a.area)}</h2>
<p class="hint">${esc(a.intro)}</p>
<ul class="idea-list">${a.ideas.map((i) => `<li><span>${esc(i.text)}</span><a href="../?g=${attr(i.id)}" aria-label="Use this goal: ${attr(i.text)}">Use this</a></li>`).join("")}</ul>
</section>`).join("\n")}
</div>
<section class="narrow">
<h2>How to shrink a big goal</h2>
<p>If a goal would take longer than a month, it's a direction, not a goal. Ask what the first finishable piece is, and write that down instead. “Write a book” becomes “finish the first draft of chapter one”. “Get organised” becomes “sort the paper pile”. Each finished piece is one step up the mountain.</p>
<p><a class="btn" href="../">Set your three goals</a></p>
</section>`));

  // ---- about -----------------------------------------------------------------------------------
  site.page({
    path: "about/", og: "home", narrow: true,
    title: "About Life Incremental: what it stores, and what it doesn't",
    description: "Life Incremental is a free, open-source goal game. It keeps one save in your browser and sends nothing to a server. Here is exactly what it stores and how to erase it.",
  }, (page) => layout(page, `
<article class="prose">
<h1>About</h1>
<p class="lede">Life Incremental is a free goal tracker that treats your goals like an incremental game: finish one, climb a tier; reach the top, prestige and climb a harder peak.</p>
<h2>What it stores</h2>
<ul>
<li><b>One entry in this browser's storage</b>, named <code>life-incremental:v1</code>: your current goals, your climb log, your badges and your place on the mountain.</li>
<li><b>Nothing on a server.</b> There is no account, no sign-in and no cookie. The page is a set of static files; your goals never leave your device.</li>
<li><b>Share cards are drawn in your browser.</b> A card or a challenge link carries your peak, tier, day count and totals. Goal text is left off unless you tick the box.</li>
<li>${settings.goatcounterUrl ? "<b>Visit counts.</b> Page visits are counted with GoatCounter, which uses no cookies and collects no personal data. Your goals are never part of it." : "<b>No analytics.</b> The page loads no trackers and no third-party scripts."}</li>
</ul>
<p>To erase everything, press “Reset everything” in the game, or clear this site's data in your browser. To keep a backup or move to another device, use “Export save” and “Import save”.</p>
<h2>What it isn't</h2>
<p>It isn't a habit tracker with streaks, and it isn't a coach. It gives no medical, financial or legal advice; the goal ideas are plain things to do, not recommendations for your situation.</p>
<h2>Open source</h2>
<p>The code is on <a href="${cfg.repoUrl}">GitHub</a> under the MIT license. Found a problem or have an idea? <a href="${cfg.repoUrl}/issues">Open an issue</a>.</p>
${settings.packsUrl ? `<h2>More peaks</h2><p class="sponsor">The game is free and stays free. Extra peak packs help pay for it: <a href="${attr(settings.packsUrl)}" rel="noopener sponsored">${esc(settings.packsLabel)}</a>.</p>` : ""}
</article>`));

  // ---- 404 -------------------------------------------------------------------------------------
  site.page({
    path: "404.html", root: site.basePath, noindex: true, narrow: true,
    title: "Page not found | Life Incremental",
    description: "That page doesn't exist. The mountain is still here: go back to the Trailhead and set your three goals.",
  }, (page) => layout(page, `
<h1>Off the trail</h1>
<p class="lede">That page doesn't exist. The mountain is still here.</p>
<p><a class="btn" href="${site.basePath}">Back to the Trailhead</a></p>`));

  const urls = site.finish();
  return { site, urls, ideaCount };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const i = process.argv.indexOf("--out");
  const out = i === -1 ? path.join(ROOT, "dist") : path.resolve(process.argv[i + 1]);
  const { site, urls } = build({ out });
  console.log(`built ${urls.length} pages into ${path.relative(process.cwd(), out) || "."} (version ${site.version}, ${site.siteUrl})`);
}
