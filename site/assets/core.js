// Life Incremental: the rules of the game. Pure functions with no DOM access, shared by the browser
// (app.js), the build (scripts/build.mjs) and the Node tests.

export const APP_ID = "life-incremental";
export const SAVE_VERSION = 1;
export const SLOTS = 3;
export const GOAL_MAX = 80;
export const NOTE_MAX = 140;
export const BASE_ALTITUDE = 1000; // metres at the Trailhead

// The ladder. Ten stations, nine climbs. Everyone starts at the Trailhead.
export const TIERS = [
  { id: "trailhead", name: "Trailhead", blurb: "Everyone starts here. Boots on, map out." },
  { id: "forest", name: "Forest Path", blurb: "The first stretch is behind you. Keep a steady pace." },
  { id: "meadow", name: "Alpine Meadow", blurb: "The trees thin out and you can see where you're going." },
  { id: "treeline", name: "Treeline", blurb: "Past the last tree. The air is thinner and so is the crowd." },
  { id: "basecamp", name: "Base Camp", blurb: "Nearly halfway. Rest, then go again." },
  { id: "glacier", name: "Glacier", blurb: "Slow, careful ground. Every step is earned." },
  { id: "ridge", name: "The Ridge", blurb: "Exposed and windy. The view is already worth it." },
  { id: "highcamp", name: "High Camp", blurb: "The last tent before the top." },
  { id: "shoulder", name: "The Shoulder", blurb: "Above the clouds. One push left." },
  { id: "summit", name: "Summit", blurb: "Top of the peak. Take it in." },
];
export const TOP = TIERS.length - 1;

// Each peak has its own light. The fourth peak starts the cycle again.
export const PALETTES = [
  { name: "First Light", sky: ["#fbe3c0", "#f4a97f"], sun: "#fff4dc", far: "#e0ab93", mid: "#c18a77", forest: "#2f6b4f", meadow: "#86b86a",
    rock: "#8d8079", snow: "#fcfdff", ice: "#cfe6f2", ground: "#2b2330", trail: "#ffffff", accent: "#d9480f", night: false },
  { name: "Long Shadow", sky: ["#3a2d63", "#e48c6c"], sun: "#ffd7a3", far: "#735d92", mid: "#574672", forest: "#27524a", meadow: "#5c966a",
    rock: "#6d6580", snow: "#f2effb", ice: "#c9cdea", ground: "#1d1730", trail: "#ffe9d1", accent: "#ff9f1c", night: false },
  { name: "Northern Lights", sky: ["#071730", "#12474a"], sun: "#eaf6ff", far: "#1f3a57", mid: "#182f49", forest: "#123a32", meadow: "#2c6753",
    rock: "#4a5772", snow: "#e7f4ff", ice: "#a9d4e8", ground: "#040f1d", trail: "#c2f8e4", accent: "#34d399", night: true },
];

export const paletteFor = (peak) => PALETTES[(Math.max(1, peak) - 1) % PALETTES.length];

// A harder climb after every prestige: Peak I needs one finished goal per tier, Peak II two, Peak III and up three.
export const stepsPerTier = (peak) => Math.min(Math.max(1, peak), 3);
export const stepsToSummit = (peak) => TOP * stepsPerTier(peak);
// Later peaks are taller: 500 m a tier on Peak I, 750 m on Peak II, 1,000 m on Peak III...
export const tierGain = (peak) => 500 + 250 * (Math.min(Math.max(1, peak), 9) - 1);
export const altitudeAt = (peak, step) => BASE_ALTITUDE + Math.round((step * tierGain(peak)) / stepsPerTier(peak));

export function roman(n) {
  const table = [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
  let out = "";
  let left = Math.max(1, Math.min(3999, Math.floor(n)));
  for (const [value, numeral] of table) while (left >= value) { out += numeral; left -= value; }
  return out;
}
export const peakName = (peak) => `Peak ${roman(peak)}`;

export function sanitizeText(s, max) {
  return String(s ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max).trim();
}

export function newGame(now = Date.now()) {
  return { v: SAVE_VERSION, createdAt: now, peak: 1, step: 0, peakStartedAt: now, goals: [null, null, null], log: [], summits: [], nextId: 1 };
}

export const tierOf = (state) => Math.min(TOP, Math.floor(state.step / stepsPerTier(state.peak)));
export const stepInTier = (state) => (tierOf(state) === TOP ? 0 : state.step % stepsPerTier(state.peak));
export const atSummit = (state) => state.step >= stepsToSummit(state.peak);
export const altitude = (state) => altitudeAt(state.peak, state.step);
export const activeGoals = (state) => state.goals.filter(Boolean).length;

function checkSlot(slot) {
  if (!Number.isInteger(slot) || slot < 0 || slot >= SLOTS) throw new Error("There are three goal slots.");
}

export function setGoal(state, slot, text, now = Date.now()) {
  checkSlot(slot);
  const clean = sanitizeText(text, GOAL_MAX);
  if (!clean) throw new Error("Write the goal first.");
  const previous = state.goals[slot];
  const goal = previous ? { ...previous, text: clean } : { id: state.nextId, text: clean, at: now };
  return { ...state, nextId: previous ? state.nextId : state.nextId + 1, goals: state.goals.map((g, i) => (i === slot ? goal : g)) };
}

export function dropGoal(state, slot) {
  checkSlot(slot);
  return { ...state, goals: state.goals.map((g, i) => (i === slot ? null : g)) };
}

// Finishing a goal is the only way up. Returns the new state and what happened:
// "step" (progress inside a tier), "tier" (a new tier), "summit", or "extra" (already at the top).
export function completeGoal(state, slot, now = Date.now(), note = "") {
  checkSlot(slot);
  const goal = state.goals[slot];
  if (!goal) throw new Error("There is no goal in that slot.");
  const fromTier = tierOf(state);
  const climbed = !atSummit(state);
  const next = { ...state, step: state.step + (climbed ? 1 : 0), goals: state.goals.map((g, i) => (i === slot ? null : g)) };
  const toTier = tierOf(next);
  next.log = [...state.log, { id: goal.id, text: goal.text, note: sanitizeText(note, NOTE_MAX), setAt: goal.at, doneAt: now, peak: state.peak, climbed, tier: toTier }];
  const type = !climbed ? "extra" : toTier === TOP ? "summit" : toTier > fromTier ? "tier" : "step";
  return { state: next, event: { type, fromTier, toTier, peak: state.peak, goal: goal.text } };
}

// The last finished goal can be taken back, but not across a prestige.
export function canUndo(state) {
  const last = state.log[state.log.length - 1];
  return !!last && last.peak === state.peak;
}

export function undoLast(state) {
  if (!canUndo(state)) throw new Error("There is nothing to undo on this peak.");
  const last = state.log[state.log.length - 1];
  const goals = state.goals.slice();
  const free = goals.indexOf(null);
  if (free !== -1) goals[free] = { id: last.id, text: last.text, at: last.setAt };
  return { ...state, step: state.step - (last.climbed ? 1 : 0), log: state.log.slice(0, -1), goals };
}

const dayIndex = (ms) => {
  const d = new Date(ms);
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
};
// "Day 1" is the calendar day this peak was started, in the device's own time zone.
export const dayNumber = (state, now = Date.now()) => Math.max(1, dayIndex(now) - dayIndex(state.peakStartedAt) + 1);

export const canPrestige = (state) => atSummit(state);

// Prestige: bank a summit badge, go back to the Trailhead of a taller, harder peak.
export function prestige(state, now = Date.now()) {
  if (!canPrestige(state)) throw new Error("Reach the summit first.");
  const badge = { peak: state.peak, at: now, days: dayNumber(state, now), goals: state.log.filter((e) => e.peak === state.peak).length };
  return { ...state, peak: state.peak + 1, step: 0, peakStartedAt: now, summits: [...state.summits, badge] };
}

export function lifetime(state) {
  let ascent = altitude(state) - BASE_ALTITUDE;
  for (const s of state.summits) ascent += TOP * tierGain(s.peak);
  return { goals: state.log.length, summits: state.summits.length + (atSummit(state) ? 1 : 0), badges: state.summits.length, ascent };
}

// ---- saves -------------------------------------------------------------------------------------

const isInt = (n, min, max) => Number.isInteger(n) && n >= min && n <= max;
const T_MIN = Date.UTC(2020, 0, 1);
const T_MAX = Date.UTC(2200, 0, 1);
const isTime = (n) => isInt(n, T_MIN, T_MAX);

// Check a state that came from storage or a file, and return a clean copy. Throws a readable Error.
export function validateState(raw) {
  const bad = (why) => { throw new Error("That save can't be loaded: " + why + "."); };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) bad("it isn't a save");
  if (raw.v !== SAVE_VERSION) bad(raw.v > SAVE_VERSION ? "it was made by a newer version of the game" : "its version isn't recognised");
  if (!isInt(raw.peak, 1, 3999)) bad("the peak number is wrong");
  if (!isInt(raw.step, 0, stepsToSummit(raw.peak))) bad("the position on the mountain is wrong");
  if (!isTime(raw.createdAt) || !isTime(raw.peakStartedAt)) bad("a date is wrong");
  if (!Array.isArray(raw.goals) || raw.goals.length !== SLOTS) bad("it doesn't have three goal slots");
  if (!Array.isArray(raw.log) || raw.log.length > 20000) bad("the climb log is wrong");
  if (!Array.isArray(raw.summits) || raw.summits.length !== raw.peak - 1) bad("the badges don't match the peak");
  let maxId = 0;
  const goals = raw.goals.map((g) => {
    if (g === null) return null;
    const text = sanitizeText(g?.text, GOAL_MAX);
    if (!text || !isInt(g.id, 1, 1e9) || !isTime(g.at)) bad("a goal is wrong");
    maxId = Math.max(maxId, g.id);
    return { id: g.id, text, at: g.at };
  });
  const log = raw.log.map((e) => {
    const text = sanitizeText(e?.text, GOAL_MAX);
    if (!text || !isInt(e.id, 1, 1e9) || !isTime(e.setAt) || !isTime(e.doneAt) || !isInt(e.peak, 1, raw.peak) || !isInt(e.tier, 0, TOP) || typeof e.climbed !== "boolean") {
      bad("a log entry is wrong");
    }
    maxId = Math.max(maxId, e.id);
    return { id: e.id, text, note: sanitizeText(e.note, NOTE_MAX), setAt: e.setAt, doneAt: e.doneAt, peak: e.peak, climbed: e.climbed, tier: e.tier };
  });
  const summits = raw.summits.map((s, i) => {
    if (!s || s.peak !== i + 1 || !isTime(s.at) || !isInt(s.days, 1, 1e6) || !isInt(s.goals, 0, 1e6)) bad("a badge is wrong");
    return { peak: s.peak, at: s.at, days: s.days, goals: s.goals };
  });
  const climbedHere = log.filter((e) => e.peak === raw.peak && e.climbed).length;
  if (climbedHere !== raw.step) bad("the log and the position on the mountain disagree");
  return { v: SAVE_VERSION, createdAt: raw.createdAt, peak: raw.peak, step: raw.step, peakStartedAt: raw.peakStartedAt, goals, log, summits,
    nextId: Math.max(maxId + 1, isInt(raw.nextId, 1, 1e9) ? raw.nextId : 1) };
}

export function exportSave(state, now = Date.now()) {
  return JSON.stringify({ app: APP_ID, exportedAt: new Date(now).toISOString(), state }, null, 1);
}

export function parseSave(text) {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("That file isn't a Life Incremental save.");
  }
  if (!raw || raw.app !== APP_ID) throw new Error("That file isn't a Life Incremental save.");
  return validateState(raw.state);
}

// ---- sharing -----------------------------------------------------------------------------------

// A challenge link carries three small numbers and nothing else: peak, tier and day.
export const challengeQuery = ({ peak, tier, day }) => `c=${peak}-${tier}-${day}`;

export function readChallenge(search) {
  const m = /^(\d{1,4})-(\d)-(\d{1,5})$/.exec(new URLSearchParams(search || "").get("c") || "");
  if (!m) return null;
  const peak = Number(m[1]);
  const tier = Number(m[2]);
  const day = Number(m[3]);
  if (peak < 1 || peak > 3999 || tier > TOP || day < 1) return null;
  return { peak, tier, day };
}

export function readIdeaId(search) {
  const id = new URLSearchParams(search || "").get("g") || "";
  return /^[a-z0-9-]{1,40}$/.test(id) ? id : null;
}

export const flattenIdeas = (areas) => areas.flatMap((a) => a.ideas.map((i) => ({ ...i, area: a.area })));

// What a share card says. Goal text is left off unless the player asks for it.
export function cardModel(state, { now = Date.now(), showGoal = false, siteLabel = "" } = {}) {
  const tier = tierOf(state);
  const life = lifetime(state);
  const last = state.log[state.log.length - 1];
  const headline = tier === TOP ? `Summit of ${peakName(state.peak)}` : tier === 0 ? "Starting at the Trailhead" : `Reached ${TIERS[tier].name}`;
  const facts = [`${altitude(state).toLocaleString("en-US")} m`, `${life.goals} ${life.goals === 1 ? "goal" : "goals"} done`];
  if (life.badges) facts.push(`${life.badges} summit ${life.badges === 1 ? "badge" : "badges"}`);
  return {
    peak: state.peak, tier, step: state.step, day: dayNumber(state, now), headline,
    eyebrow: `Day ${dayNumber(state, now)} · ${peakName(state.peak)} · ${paletteFor(state.peak).name}`,
    facts: facts.join(" · "), goal: showGoal && last ? last.text : "", siteLabel,
  };
}

export function wrapText(text, maxChars, maxLines) {
  const words = String(text).split(" ");
  const lines = [];
  let line = "";
  for (const w of words) {
    if (!line) line = w;
    else if ((line + " " + w).length <= maxChars) line += " " + w;
    else { lines.push(line); line = w; }
  }
  if (line) lines.push(line);
  const cut = lines.slice(0, maxLines).map((l) => (l.length > maxChars ? l.slice(0, maxChars - 1) + "…" : l));
  if (lines.length > maxLines) cut[maxLines - 1] = cut[maxLines - 1].replace(/.{0,2}$/, "…");
  return cut;
}
