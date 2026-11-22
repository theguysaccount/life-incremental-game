// The rules of the game (site/assets/core.js) and the drawings (site/assets/art.js).
import test from "node:test";
import assert from "node:assert/strict";
import * as core from "../site/assets/core.js";
import { sceneSVG, cardSVG, climberPosition, tierIcon, badgeSVG, STATIONS } from "../site/assets/art.js";

const T0 = Date.UTC(2026, 10, 2, 12); // noon UTC, so day counting is safe in every time zone near UTC
const HOUR = 3600000;

// Play `n` goals through slot 0, one an hour.
function climb(state, n, start = T0) {
  let s = state;
  const events = [];
  for (let i = 0; i < n; i++) {
    s = core.setGoal(s, 0, `goal ${s.nextId}`, start + i * HOUR);
    const r = core.completeGoal(s, 0, start + i * HOUR + 1000);
    s = r.state;
    events.push(r.event.type);
  }
  return { state: s, events };
}

test("a new game starts at the Trailhead of Peak I with three empty slots", () => {
  const s = core.newGame(T0);
  assert.equal(s.peak, 1);
  assert.equal(core.tierOf(s), 0);
  assert.equal(core.TIERS[core.tierOf(s)].name, "Trailhead");
  assert.deepEqual(s.goals, [null, null, null]);
  assert.equal(core.altitude(s), core.BASE_ALTITUDE);
  assert.equal(core.TIERS.length, 10);
  assert.equal(new Set(core.TIERS.map((t) => t.id)).size, core.TIERS.length);
  assert.ok(!core.TIERS.some((t) => /slum/i.test(t.name + t.blurb)), "the ladder never mocks poverty");
});

test("goals are cleaned, capped and required", () => {
  const s = core.newGame(T0);
  assert.throws(() => core.setGoal(s, 0, "   "), /Write the goal/);
  assert.throws(() => core.setGoal(s, 3, "x"), /three goal slots/);
  const t = core.setGoal(s, 1, "  Run\n\tthree   times \u0007 ", T0);
  assert.equal(t.goals[1].text, "Run three times");
  assert.equal(core.setGoal(s, 0, "x".repeat(500)).goals[0].text.length, core.GOAL_MAX);
  const edited = core.setGoal(t, 1, "Run four times");
  assert.equal(edited.goals[1].id, t.goals[1].id, "editing keeps the goal's id");
  assert.equal(edited.nextId, t.nextId);
  assert.equal(core.activeGoals(core.dropGoal(edited, 1)), 0);
  assert.throws(() => core.completeGoal(s, 0), /no goal/);
});

test("Peak I: one finished goal per tier, nine to the Summit, then extras don't climb", () => {
  const { state, events } = climb(core.newGame(T0), core.TOP + 1);
  assert.deepEqual(events, [...Array(core.TOP - 1).fill("tier"), "summit", "extra"]);
  assert.equal(core.tierOf(state), core.TOP);
  assert.ok(core.atSummit(state));
  assert.equal(core.altitude(state), core.altitudeAt(1, core.TOP));
  assert.equal(state.log.length, core.TOP + 1);
  assert.equal(state.log.at(-1).climbed, false);
});

test("prestige needs the Summit, banks a badge and makes every tier harder", () => {
  const start = core.newGame(T0);
  assert.throws(() => core.prestige(start), /summit/i);
  const top = climb(start, core.TOP).state;
  const p2 = core.prestige(top, T0 + 48 * HOUR);
  assert.equal(p2.peak, 2);
  assert.equal(p2.step, 0);
  assert.equal(p2.summits.length, 1);
  assert.deepEqual(p2.summits[0], { peak: 1, at: T0 + 48 * HOUR, days: 3, goals: core.TOP });
  assert.equal(core.stepsPerTier(2), 2);
  const { state, events } = climb(p2, 4, T0 + 49 * HOUR);
  assert.deepEqual(events, ["step", "tier", "step", "tier"]);
  assert.equal(core.tierOf(state), 2);
  assert.ok(core.tierGain(2) > core.tierGain(1), "later peaks are taller");
  for (let peak = 3; peak < 8; peak++) assert.equal(core.stepsPerTier(peak), 3);
  assert.ok(core.paletteFor(4) === core.paletteFor(1), "the light cycles every three peaks");
});

test("lifetime totals add banked summits to the current climb", () => {
  const p2 = core.prestige(climb(core.newGame(T0), core.TOP).state, T0 + 20 * HOUR);
  const s = climb(p2, 3, T0 + 21 * HOUR).state;
  const life = core.lifetime(s);
  assert.equal(life.goals, core.TOP + 3);
  assert.equal(life.badges, 1);
  assert.equal(life.ascent, core.TOP * core.tierGain(1) + (core.altitude(s) - core.BASE_ALTITUDE));
});

test("undo takes back the last goal, but never across a prestige", () => {
  const s = core.setGoal(climb(core.newGame(T0), 2).state, 1, "keep me");
  const u = core.undoLast(s);
  assert.equal(u.step, 1);
  assert.equal(u.log.length, 1);
  assert.ok(u.goals.some((g) => g && g.text === "goal 2"), "the goal goes back into a free slot");
  assert.ok(u.goals.some((g) => g && g.text === "keep me"));
  const p2 = core.prestige(climb(core.newGame(T0), core.TOP).state);
  assert.equal(core.canUndo(p2), false);
  assert.throws(() => core.undoLast(p2), /nothing to undo/);
});

test("day numbers count calendar days from the start of the peak", () => {
  const s = core.newGame(T0);
  assert.equal(core.dayNumber(s, T0 + HOUR), 1);
  assert.equal(core.dayNumber(s, T0 + 24 * HOUR), 2);
  assert.equal(core.dayNumber(s, T0 + 24 * 30 * HOUR), 31);
  assert.equal(core.dayNumber(s, T0 - 48 * HOUR), 1, "a clock set backwards never gives day 0");
});

test("saves round-trip, and damaged or foreign saves are refused", () => {
  const p2 = core.prestige(climb(core.newGame(T0), core.TOP).state, T0 + 20 * HOUR);
  const s = core.setGoal(climb(p2, 3, T0 + 21 * HOUR).state, 2, "Half-way there");
  const back = core.parseSave(core.exportSave(s, T0 + 30 * HOUR));
  assert.deepEqual(back, s);
  assert.deepEqual(core.validateState(JSON.parse(JSON.stringify(s))), s);
  const bad = (mutate, why) => {
    const copy = JSON.parse(JSON.stringify(s));
    mutate(copy);
    assert.throws(() => core.validateState(copy), why);
  };
  bad((c) => { c.v = 99; }, /newer version/);
  bad((c) => { c.step = c.step + 1; }, /disagree/);
  bad((c) => { c.peak = 5; }, /badges|position/);
  bad((c) => { c.goals.pop(); }, /three goal slots/);
  bad((c) => { c.log[0].tier = 42; }, /log entry/);
  bad((c) => { c.summits[0].peak = 3; }, /badge/);
  bad((c) => { c.createdAt = "yesterday"; }, /date/);
  assert.throws(() => core.parseSave("not json"), /isn't a Life Incremental save/);
  assert.throws(() => core.parseSave(JSON.stringify({ app: "something-else", state: s })), /isn't a Life Incremental save/);
  const sneaky = JSON.parse(JSON.stringify(s));
  sneaky.goals[2].text = "<img src=x onerror=alert(1)>" + "x".repeat(300);
  assert.equal(core.validateState(sneaky).goals[2].text.length, core.GOAL_MAX, "long text is cut, not trusted");
});

test("challenge links carry three small numbers and reject anything else", () => {
  assert.equal(core.challengeQuery({ peak: 2, tier: 5, day: 40 }), "c=2-5-40");
  assert.deepEqual(core.readChallenge("?c=2-5-40"), { peak: 2, tier: 5, day: 40 });
  for (const q of ["", "?c=0-1-1", "?c=1-10-1", "?c=1-1-0", "?c=1-1-1x", "?c=<b>", "?c=1-1", "?x=1-1-1"]) assert.equal(core.readChallenge(q), null, q);
  assert.equal(core.readIdeaId("?g=body-walk-5x20"), "body-walk-5x20");
  assert.equal(core.readIdeaId("?g=../../etc"), null);
});

test("share cards leave goal text off unless asked", () => {
  const s = climb(core.newGame(T0), 3).state;
  const quiet = core.cardModel(s, { now: T0 + 5 * HOUR });
  assert.equal(quiet.goal, "");
  assert.equal(quiet.headline, `Reached ${core.TIERS[3].name}`);
  assert.match(quiet.eyebrow, /^Day 1 · Peak I · /);
  assert.match(quiet.facts, /3 goals done/);
  const loud = core.cardModel(s, { now: T0 + 5 * HOUR, showGoal: true });
  assert.equal(loud.goal, "goal 3");
  assert.equal(core.cardModel(core.newGame(T0), { now: T0 }).headline, "Starting at the Trailhead");
});

test("text wraps into lines and is cut with an ellipsis", () => {
  assert.deepEqual(core.wrapText("one two three four", 9, 3), ["one two", "three", "four"]);
  const lines = core.wrapText("a".repeat(10) + " " + "b".repeat(10) + " " + "c".repeat(10), 12, 2);
  assert.equal(lines.length, 2);
  assert.ok(lines[1].endsWith("…"));
  assert.equal(core.roman(1), "I");
  assert.equal(core.roman(14), "XIV");
  assert.equal(core.roman(2026), "MMXXVI");
});

test("the mountain marks every station and puts the climber where the save says", () => {
  assert.equal(STATIONS.length, core.TIERS.length);
  const svg = sceneSVG({ peak: 1, step: 4 });
  assert.match(svg, /^<svg [^>]*viewBox="0 0 800 500"/);
  assert.match(svg, /You are at Base Camp, tier 4 of 9/);
  assert.equal((svg.match(/class="lbl/g) || []).length, core.TIERS.length);
  assert.equal((sceneSVG({ peak: 1, step: 4, labels: "current" }).match(/class="lbl/g) || []).length, 1);
  assert.deepEqual(climberPosition(1, 3).at, STATIONS[3]);
  const half = climberPosition(2, 3);
  assert.equal(half.tier, 1);
  assert.ok(half.between);
  assert.deepEqual(half.at, [(STATIONS[1][0] + STATIONS[2][0]) / 2, (STATIONS[1][1] + STATIONS[2][1]) / 2]);
  assert.match(sceneSVG({ peak: 3, step: 0 }), /<circle [^>]*fill="#ffffff" opacity/, "Peak III has stars");
  for (let i = 0; i < core.TIERS.length; i++) assert.match(tierIcon(i), /^<svg[^>]*>.+<\/svg>$/);
  assert.match(badgeSVG(2, "II"), />II<\/text>/);
});

test("share cards escape everything they print", () => {
  let s = core.setGoal(core.newGame(T0), 0, `Fix the "<script>" & tidy up`, T0);
  s = core.completeGoal(s, 0, T0 + HOUR).state;
  const svg = cardSVG(core.cardModel(s, { now: T0 + 2 * HOUR, showGoal: true, siteLabel: "example.org/<x>" }));
  assert.ok(!svg.includes("<script>"));
  assert.ok(svg.includes("&lt;script&gt;"));
  assert.ok(svg.includes("example.org/&lt;x&gt;"));
  assert.match(svg, /viewBox="0 0 1080 1080"/);
});
