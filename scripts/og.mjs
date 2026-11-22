#!/usr/bin/env node
// Draw the social preview images (1200x630) and the app icons with headless Chrome, into
// site/assets/. Run it by hand when the art or the headlines change, then commit the PNGs.
//
//   node scripts/og.mjs
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { launch } from "./lib/chrome.mjs";
import * as core from "../site/assets/core.js";
import { sceneSVG } from "../site/assets/art.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ideaCount = core.flattenIdeas(JSON.parse(fs.readFileSync(path.join(ROOT, "site", "data", "ideas.json"), "utf8"))).length;

const card = ({ peak, step, headline, sub }) => `<!doctype html><meta charset="utf-8">
<body style="margin:0;width:1200px;height:630px;overflow:hidden;position:relative;font-family:Helvetica,Arial,sans-serif;background:#2b2330">
<div style="position:absolute;right:-70px;top:-40px;width:1070px">${sceneSVG({ peak, step, labels: "current", uid: "og" }).replace('width="800" height="500"', 'width="1070" height="669"')}</div>
<div style="position:absolute;left:0;top:0;bottom:0;width:640px;background:linear-gradient(90deg,#2b2330 66%,rgba(43,35,48,0));padding:58px 0 0 62px;box-sizing:border-box;color:#fff">
<div style="font-size:25px;font-weight:700;letter-spacing:4px;color:#ffb38a">LIFE INCREMENTAL</div>
<div style="font-size:64px;font-weight:800;line-height:1.06;margin-top:40px;max-width:430px;letter-spacing:-1px">${headline}</div>
<div style="font-size:27px;line-height:1.3;margin-top:26px;max-width:400px;color:#eadff0">${sub}</div>
</div></body>`;

const CARDS = {
  home: card({ peak: 1, step: 4, headline: "Turn your goals into a climb.", sub: "Finish a goal, climb a tier. Free, no account." }),
  how: card({ peak: 2, step: 13, headline: "Ten stations. Nine climbs. Then prestige.", sub: "The rules of a goal tracker that plays like an incremental game." }),
  ideas: card({ peak: 1, step: 2, headline: `${ideaCount} goals you can finish in a month.`, sub: "Small, countable goal ideas. Tap one to start climbing." }),
};

const work = fs.mkdtempSync(path.join(os.tmpdir(), "og-"));
const browser = await launch();
try {
  const page = await browser.newPage({ width: 1200, height: 630 });
  for (const [name, html] of Object.entries(CARDS)) {
    const file = path.join(work, `${name}.html`);
    fs.writeFileSync(file, html);
    await page.goto(pathToFileURL(file).href);
    await page.screenshot(path.join(ROOT, "site", "assets", "og", `${name}.png`));
    console.log(`site/assets/og/${name}.png`);
  }
  await page.close();
  const favicon = fs.readFileSync(path.join(ROOT, "site", "favicon.svg"), "utf8");
  for (const size of [180, 192, 512]) {
    const icon = await browser.newPage({ width: size, height: size });
    const file = path.join(work, `icon-${size}.html`);
    fs.writeFileSync(file, `<!doctype html><body style="margin:0;background:#2b2330">${favicon.replace("<svg ", `<svg width="${size}" height="${size}" style="display:block" `)}</body>`);
    await icon.goto(pathToFileURL(file).href);
    await icon.screenshot(path.join(ROOT, "site", "assets", `icon-${size}.png`));
    await icon.close();
    console.log(`site/assets/icon-${size}.png`);
  }
} finally {
  await browser.close();
  fs.rmSync(work, { recursive: true, force: true });
}
