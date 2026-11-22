#!/usr/bin/env node
// End-to-end test: plays the real game in headless Chrome, on a desktop and a phone-sized screen.
//
//   node scripts/e2e.mjs                 # build output in dist/, served locally under /life-incremental-game/
//   node scripts/e2e.mjs https://host/x/ # a live site
//   node scripts/e2e.mjs --live          # the live site from SITE_URL or site.config.mjs
//
// It fails on any console error, any request to another origin, any sideways scrolling, and any
// step of the game that doesn't behave: goals, climbing, saving, cards, prestige, undo, import, reset.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cfg from "../site.config.mjs";
import { launch } from "./lib/chrome.mjs";
import { serve } from "./lib/serve.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const arg = process.argv[2];
const siteUrl = (process.env.SITE_URL || cfg.defaultSiteUrl).replace(/\/+$/, "");
let server = null;
let base;
if (arg === "--live") base = siteUrl + "/";
else if (arg) base = arg.replace(/\/+$/, "") + "/";
else {
  // Serve under the same path the site will have, so a build for a custom domain is tested at "/".
  server = await serve(path.join(ROOT, "dist"), { prefix: new URL(siteUrl + "/").pathname });
  base = server.url;
}
const origin = new URL(base).origin;
const READY = "document.documentElement.dataset.ready === '1'";
let failures = 0;

async function step(name, fn) {
  try {
    await fn();
    console.log(`  ok    ${name}`);
  } catch (e) {
    failures++;
    console.log(`  FAIL  ${name}\n        ${e.message.split("\n").join("\n        ")}`);
  }
}
const expect = (cond, what) => { if (!cond) throw new Error(what); };
const equal = (got, want, what) => { if (got !== want) throw new Error(`${what}: expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`); };

const stat = (page, name) => page.text(`[data-stat="${name}"]`);
const dialogOpen = "document.querySelector('#dlg').open";

async function setGoal(page, slot, text) {
  await page.type(`#goal-${slot}`, text);
  await page.click(`form[data-slot="${slot}"] button[type=submit]`);
  await page.waitFor(`document.querySelector('.slot.filled[data-slot="${slot}"] .goal-text')?.textContent === ${JSON.stringify(text)}`, { what: `goal ${slot} to be set` });
}

// Press Done, confirm, and return what the celebration says happened: step, tier, summit or extra.
async function finish(page, slot, note = "") {
  await page.click(`[data-action=done][data-slot="${slot}"]`);
  await page.waitFor(`${dialogOpen} && !!document.querySelector('#done-note')`, { what: "the confirm dialog" });
  if (note) await page.type("#done-note", note);
  await page.click("#dlg [data-close=yes]");
  const type = await page.waitFor(`${dialogOpen} && document.querySelector('#dlg-title')?.dataset.event`, { what: "the celebration" });
  await page.click("#dlg [data-close=ok]");
  await page.waitFor(`!${dialogOpen}`);
  return type;
}

async function confirm(page, action, button = "yes") {
  await page.click(`[data-action=${action}]`);
  await page.waitFor(dialogOpen, { what: `the ${action} dialog` });
  await page.click(`#dlg [data-close=${button}]`);
  await page.waitFor(`!${dialogOpen}`);
}

function checkClean(page, label) {
  expect(page.errors.length === 0, `${label}: console errors:\n${page.errors.join("\n")}`);
  const foreign = page.requests.filter((u) => !u.startsWith(origin) && !u.startsWith("data:") && !u.startsWith("blob:"));
  expect(foreign.length === 0, `${label}: requests to other origins:\n${foreign.join("\n")}`);
}

async function fullGame(browser) {
  const page = await browser.newPage({ width: 1280, height: 900 });
  let saved = null;
  await step("home opens at the Trailhead with three empty slots", async () => {
    await page.goto(base, { ready: READY });
    await page.eval("localStorage.clear()");
    await page.reload({ ready: READY });
    equal(await page.eval("document.querySelectorAll('h1').length"), 1, "h1 count");
    equal(await stat(page, "tier"), "Trailhead", "tier");
    equal(await page.eval("document.querySelectorAll('.slot.empty').length"), 3, "empty slots");
    equal(await page.eval("document.querySelectorAll('.tiers .tier').length"), 10, "ladder rows");
    expect(await page.eval("!!document.querySelector('.scene-wrap svg.scene polyline')"), "the mountain is drawn");
  });
  await step("an empty goal is refused; three goals can be set, one from the idea button", async () => {
    await page.click('form[data-slot="0"] button[type=submit]');
    expect((await page.text("#msg")).includes("Write the goal first"), "empty goal message");
    await setGoal(page, 0, "Finish the first draft");
    await page.click('[data-action=idea][data-slot="1"]');
    const idea = await page.eval("document.querySelector('#goal-1').value");
    expect(idea.length > 8, "idea button fills the input");
    await page.click('form[data-slot="1"] button[type=submit]');
    await page.waitFor(`!!document.querySelector('.slot.filled[data-slot="1"]')`);
    await setGoal(page, 2, "Call <b>Sam</b> & say thanks");
    equal(await page.eval("document.querySelectorAll('.slot.filled').length"), 3, "filled slots");
    equal(await page.eval("document.querySelectorAll('.goal-text b').length"), 0, "goal text is escaped");
  });
  await step("finishing a goal climbs one tier and writes the log", async () => {
    equal(await finish(page, 0, "Sent it to two readers"), "tier", "event");
    equal(await stat(page, "tier"), "Forest Path", "tier");
    equal(await stat(page, "goals"), "1", "goals done");
    expect((await page.text(".log-list")).includes("Sent it to two readers"), "note in the log");
    expect((await page.text("[data-next]")).includes("Alpine Meadow"), "next tier line");
  });
  await step("the climb survives a reload", async () => {
    await page.reload({ ready: READY });
    equal(await stat(page, "tier"), "Forest Path", "tier after reload");
    equal(await page.eval("document.querySelectorAll('.slot.filled').length"), 2, "goals after reload");
  });
  await step("the share card is a 1080px PNG, and the challenge link carries three numbers", async () => {
    await page.click("[data-action=share]");
    await page.waitFor("document.querySelector('#card-img')?.dataset.ready === '1' && document.querySelector('#card-img').naturalWidth === 1080", { what: "the card image" });
    expect(/\?c=1-1-\d+$/.test(await page.eval("document.querySelector('#card-link').value")), "challenge link");
    const first = await page.eval("document.querySelector('#card-img').src");
    await page.click("#card-goal");
    await page.waitFor(`document.querySelector('#card-img').src !== ${JSON.stringify(first)}`, { what: "the card to redraw with the goal" });
    const file = await page.download(() => page.click("[data-do=download]"));
    expect(file.bytes.subarray(1, 4).toString() === "PNG" && file.bytes.length > 20000, `card download (${file.name}, ${file.bytes.length} bytes)`);
    expect(file.bytes.readUInt32BE(16) === 1080 && file.bytes.readUInt32BE(20) === 1080, "card is 1080 x 1080");
    await page.click("#dlg [data-close=close]");
  });
  await step("export gives a save file", async () => {
    const file = await page.download(() => page.click("[data-action=export]"));
    saved = JSON.parse(file.text);
    equal(saved.app, "life-incremental", "save marker");
    equal(saved.state.step, 1, "saved step");
    expect(/^life-incremental-save-\d{4}-\d\d-\d\d\.json$/.test(file.name), "file name " + file.name);
  });
  await step("eight more goals reach the Summit", async () => {
    let last;
    for (let n = 0; n < 8; n++) {
      let slot = await page.eval("[...document.querySelectorAll('.slot.filled')].map((s) => Number(s.dataset.slot))[0] ?? -1");
      if (slot === -1) { slot = 0; await setGoal(page, 0, `Climb goal ${n}`); }
      last = await finish(page, slot);
    }
    equal(last, "summit", "last event");
    equal(await stat(page, "tier"), "Summit", "tier");
    expect(await page.exists("[data-action=prestige]"), "prestige is offered");
  });
  await step("a goal finished at the Summit is logged but doesn't climb", async () => {
    const altitude = await stat(page, "altitude");
    await setGoal(page, 0, "One more at the top");
    equal(await finish(page, 0), "extra", "event");
    equal(await stat(page, "altitude"), altitude, "altitude");
    equal(await stat(page, "goals"), "10", "goals done");
  });
  await step("prestige banks a badge and starts a harder Peak II", async () => {
    await confirm(page, "prestige");
    expect((await stat(page, "peak")).startsWith("II"), "peak");
    equal(await stat(page, "tier"), "Trailhead", "tier");
    equal(await page.eval("document.querySelectorAll('.badges .badge').length"), 1, "badges");
    await setGoal(page, 0, "First of two");
    equal(await finish(page, 0), "step", "first goal on Peak II");
    equal(await stat(page, "tier"), "Trailhead", "still at the Trailhead");
    equal(await page.eval("document.querySelectorAll('.pip.on').length"), 1, "pips");
    await setGoal(page, 0, "Second of two");
    equal(await finish(page, 0), "tier", "second goal on Peak II");
    equal(await stat(page, "tier"), "Forest Path", "tier");
  });
  await step("undo steps back down and returns the goal to a slot", async () => {
    await confirm(page, "undo");
    equal(await stat(page, "tier"), "Trailhead", "tier");
    expect((await page.text(".slots")).includes("Second of two"), "goal is back in a slot");
  });
  await step("importing the earlier save restores it", async () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "li-save-")), "save.json");
    fs.writeFileSync(file, JSON.stringify(saved));
    await page.setFiles("#import-file", [file]);
    await page.waitFor(dialogOpen, { what: "the import dialog" });
    await page.click("#dlg [data-close=yes]");
    await page.waitFor(`!${dialogOpen}`);
    expect((await stat(page, "peak")).startsWith("I ·"), "peak");
    equal(await stat(page, "tier"), "Forest Path", "tier");
    fs.rmSync(path.dirname(file), { recursive: true, force: true });
  });
  await step("a broken save file is refused with a readable message", async () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "li-save-")), "bad.json");
    fs.writeFileSync(file, '{"app":"life-incremental","state":{"v":1,"peak":1,"step":99}}');
    await page.setFiles("#import-file", [file]);
    await page.waitFor("document.querySelector('#msg')?.textContent.includes(\"can't be loaded\")", { what: "the refusal" });
    equal(await stat(page, "tier"), "Forest Path", "tier unchanged");
    fs.rmSync(path.dirname(file), { recursive: true, force: true });
  });
  await step("reset erases the save", async () => {
    await confirm(page, "reset");
    equal(await stat(page, "tier"), "Trailhead", "tier");
    equal(await page.eval("localStorage.getItem('life-incremental:v1')"), null, "storage entry");
  });
  await step("desktop run: no console errors, no other origins, no sideways scroll", async () => {
    checkClean(page, "game");
    equal(await page.overflow(), 0, "overflow");
  });
  await page.close();
}

async function links(browser) {
  const page = await browser.newPage({ width: 1280, height: 900 });
  await step("a challenge link shows where the sender is, then cleans the address", async () => {
    await page.goto(base + "?c=1-7-12", { ready: READY });
    const banner = await page.eval("document.querySelector('#challenge').hidden ? '' : document.querySelector('#challenge').textContent");
    expect(banner.includes("High Camp") && banner.includes("day 12"), "banner: " + banner);
    equal(await page.eval("location.search"), "", "query string");
  });
  await step("a malformed challenge link is ignored", async () => {
    await page.goto(base + "?c=1-7-12%3Cscript%3E", { ready: READY });
    equal(await page.eval("document.querySelector('#challenge').hidden"), true, "banner hidden");
  });
  await step("the other pages open cleanly and the first goal idea loads into the game", async () => {
    for (const p of ["how-it-works/", "about/", "goal-ideas/"]) {
      await page.goto(base + p);
      equal(await page.eval("document.querySelectorAll('h1').length"), 1, `${p} h1 count`);
      equal(await page.overflow(), 0, `${p} overflow`);
    }
    const text = await page.eval("document.querySelector('.idea-list li span').textContent");
    await page.eval("document.querySelector('.idea-list a').click()");
    await page.waitFor(`location.pathname.endsWith('/${new URL(base).pathname.split("/").filter(Boolean).pop() || ""}/') || location.pathname === '/'`, { what: "the game page" });
    await page.waitFor(READY);
    equal(await page.eval("document.querySelector('#goal-0').value"), text, "idea prefilled");
  });
  await step("a missing page gets the 404 page with a way back", async () => {
    await page.goto(base + "no-such-page/");
    expect((await page.text("h1")).length > 0 && (await page.eval("!!document.querySelector('main a.btn')")), "404 content");
    page.errors = page.errors.filter((e) => !/404/.test(e));
  });
  await step("link pages: no console errors, no other origins", async () => checkClean(page, "links"));
  await page.close();
}

async function phone(browser) {
  const page = await browser.newPage({ width: 390, height: 844, mobile: true });
  await step("phone: the game fits a 390px screen at every stage", async () => {
    await page.goto(base, { ready: READY });
    await page.eval("localStorage.clear()");
    await page.reload({ ready: READY });
    equal(await page.overflow(), 0, "overflow on a fresh game");
    await setGoal(page, 0, "A goal with a deliberately long name to see how it wraps on a phone screen");
    await page.click('[data-action=done][data-slot="0"]');
    await page.waitFor(`${dialogOpen} && !!document.querySelector('#done-note')`);
    equal(await page.overflow(), 0, "overflow with the dialog open");
    const fits = await page.eval("(() => { const r = document.querySelector('#dlg').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 0.5; })()");
    expect(fits, "dialog fits the screen");
    await page.click("#dlg [data-close=yes]");
    await page.waitFor(`${dialogOpen} && !!document.querySelector('#dlg-title')?.dataset.event`);
    await page.click("#dlg [data-close=ok]");
    equal(await stat(page, "tier"), "Forest Path", "tier");
    equal(await page.overflow(), 0, "overflow after climbing");
    const small = await page.eval("[...document.querySelectorAll('#app .btn')].filter((b) => b.offsetParent && b.getBoundingClientRect().height < 44).length");
    equal(small, 0, "buttons shorter than 44px");
    for (const p of ["how-it-works/", "goal-ideas/", "about/"]) {
      await page.goto(base + p);
      equal(await page.overflow(), 0, `${p} overflow`);
    }
    checkClean(page, "phone");
  });
  await page.close();
}

async function dark(browser) {
  const page = await browser.newPage({ width: 1280, height: 900, dark: true });
  await step("dark mode: the page follows the system setting", async () => {
    await page.goto(base, { ready: READY });
    const bg = await page.eval("getComputedStyle(document.body).backgroundColor");
    expect(bg !== "rgb(251, 245, 236)", "dark background, got " + bg);
    checkClean(page, "dark");
  });
  await page.close();
}

console.log(`end-to-end: ${base}`);
const browser = await launch();
try {
  await fullGame(browser);
  await links(browser);
  await phone(browser);
  await dark(browser);
} finally {
  await browser.close();
  if (server) await server.close();
}
console.log(failures ? `${failures} step(s) failed` : "all steps passed");
process.exit(failures ? 1 : 0);
