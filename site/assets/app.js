// Life Incremental: the page. Reads and writes one save in this browser's localStorage and draws
// everything from it. Nothing is sent anywhere.
import * as core from "./core.js";
import { sceneSVG, cardSVG, tierIcon, badgeSVG } from "./art.js";

const $ = (sel, el = document) => el.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const fmt = (n) => n.toLocaleString("en-US");
const plural = (n, one, many = one + "s") => `${fmt(n)} ${n === 1 ? one : many}`;

const cfg = JSON.parse($("#site-config").textContent);
const IDEAS = core.flattenIdeas(JSON.parse($("#ideas").textContent));
const KEY = "life-incremental:v1";
const PLACEHOLDERS = ["e.g. Walk for 20 minutes on five days this week", "e.g. Finish the first draft, however rough", "e.g. Call one old friend"];
const app = $("#app");
const dlg = $("#dlg");
const dlgBody = $("#dlg-body");
const live = $("#live");

let storage = null;
try {
  localStorage.setItem(KEY + ":probe", "1");
  localStorage.removeItem(KEY + ":probe");
  storage = localStorage;
} catch {
  storage = null;
}

const ui = { editing: new Set(), drafts: ["", "", ""], message: "", warn: false, ideaAt: Math.floor(Math.random() * IDEAS.length), focus: null };
let state = load();

function load() {
  if (!storage) return core.newGame();
  const raw = storage.getItem(KEY);
  if (!raw) return core.newGame();
  try {
    return core.validateState(JSON.parse(raw));
  } catch {
    try { storage.setItem(KEY + ":unreadable", raw); } catch {}
    say("Your saved climb couldn't be read, so a new one was started. The old data is still in this browser, under “life-incremental:v1:unreadable”.", true);
    return core.newGame();
  }
}

function say(message, warn = false) {
  ui.message = message;
  ui.warn = warn;
}

function commit(next) {
  state = next;
  if (storage) {
    try {
      storage.setItem(KEY, JSON.stringify(state));
    } catch {
      say("This browser wouldn't save the change (storage is full or blocked). Export your save to keep it.", true);
    }
  }
  render();
}

const track = (name) => {
  try { window.goatcounter?.count?.({ path: "event/" + name, title: name, event: true }); } catch {}
};

function ago(ms) {
  const days = Math.floor((Date.now() - ms) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${fmt(days)} days ago`;
}
const dateText = (ms) => new Date(ms).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

// ---- drawing ------------------------------------------------------------------------------------

function slotHTML(i) {
  const g = state.goals[i];
  const editing = ui.editing.has(i);
  if (g && !editing) {
    return `<li class="slot filled" data-slot="${i}">
<p class="slot-n">Goal ${i + 1}</p>
<p class="goal-text">${esc(g.text)}</p>
<p class="goal-meta">Set ${ago(g.at)}</p>
<div class="btn-row">
<button class="btn" type="button" data-action="done" data-slot="${i}">Done: I finished it</button>
<button class="btn quiet" type="button" data-action="edit" data-slot="${i}">Edit</button>
<button class="btn quiet" type="button" data-action="drop" data-slot="${i}">Drop</button>
</div></li>`;
  }
  const value = editing ? ui.drafts[i] || g.text : ui.drafts[i];
  return `<li class="slot ${editing ? "filled" : "empty"}" data-slot="${i}"><form data-form="set" data-slot="${i}" novalidate>
<label class="slot-n" for="goal-${i}">${editing ? `Edit goal ${i + 1}` : `Goal ${i + 1}`}</label>
<input id="goal-${i}" name="text" type="text" maxlength="${core.GOAL_MAX}" autocomplete="off" enterkeyhint="done" placeholder="${esc(PLACEHOLDERS[i])}" value="${esc(value)}">
<div class="btn-row"><button class="btn" type="submit">${editing ? "Save" : "Set goal"}</button>
${editing
    ? `<button class="btn quiet" type="button" data-action="cancel-edit" data-slot="${i}">Cancel</button>`
    : `<button class="btn quiet" type="button" data-action="idea" data-slot="${i}">Need an idea?</button>`}
</div></form></li>`;
}

function ladderHTML(tier, per, inTier) {
  const rows = [];
  for (let i = core.TOP; i >= 0; i--) {
    const cls = i < tier ? "reached" : i === tier ? "now" : "ahead";
    const label = i < tier ? "Reached" : i === tier ? "You are here" : "";
    let pips = "";
    if (per > 1 && i === tier && i < core.TOP) {
      pips = `<span class="pips" aria-label="${inTier} of ${per} goals done toward ${esc(core.TIERS[i + 1].name)}">` +
        Array.from({ length: per }, (_, k) => `<span class="pip${k < inTier ? " on" : ""}"></span>`).join("") + "</span>";
    }
    rows.push(`<li class="tier ${cls}"${i === tier ? ' aria-current="step"' : ""}>${tierIcon(i)}
<div class="tier-main"><p class="tier-name">${esc(core.TIERS[i].name)} ${label ? `<span class="tag">${label}</span>` : ""}</p>
<p class="tier-blurb">${esc(core.TIERS[i].blurb)}</p>${pips}</div>
<p class="tier-alt">${fmt(core.altitudeAt(state.peak, i * per))} m</p></li>`);
  }
  return rows.join("");
}

function render() {
  const tier = core.tierOf(state);
  const per = core.stepsPerTier(state.peak);
  const inTier = core.stepInTier(state);
  const summit = core.atSummit(state);
  const life = core.lifetime(state);
  const left = per - inTier;
  const nextLine = summit
    ? `You're on the summit of ${core.peakName(state.peak)}.`
    : `Next: ${core.TIERS[tier + 1].name}. Finish ${left === 1 ? "1 goal" : `${left} goals`} to get there.`;
  const nextPeak = state.peak + 1;
  const nextPer = core.stepsPerTier(nextPeak);
  const prestigeHTML = summit
    ? `<p>You're on top of ${core.peakName(state.peak)}. Stay as long as you like: goals you finish here still count toward your lifetime total. Or prestige: bank the summit badge and start ${core.peakName(nextPeak)}, a taller mountain where every tier takes ${plural(nextPer, "finished goal")}.</p>
<div class="btn-row"><button class="btn" type="button" data-action="prestige">Prestige: start ${core.peakName(nextPeak)}</button></div>`
    : `<p>Optional, and locked until you reach the Summit. Prestige banks a summit badge and sends you back to the Trailhead of ${core.peakName(nextPeak)}, a taller mountain where every tier takes ${plural(nextPer, "finished goal")}. You keep your badges, your log and your lifetime totals.</p>`;
  const badges = state.summits.length
    ? `<ul class="badges">${state.summits.map((b) => `<li class="badge">${badgeSVG(b.peak, core.roman(b.peak))}<p><b>${core.peakName(b.peak)}</b><br>${plural(b.goals, "goal")} in ${plural(b.days, "day")}<br><span class="muted">${dateText(b.at)}</span></p></li>`).join("")}</ul>`
    : '<p class="muted">No summit badges yet. You earn one each time you prestige from a summit.</p>';
  const log = state.log.slice().reverse();
  const shown = log.slice(0, ui.allLog ? log.length : 8);
  const logHTML = log.length
    ? `<ol class="log-list" reversed>${shown.map((e) => `<li><p class="log-text">${esc(e.text)}</p>${e.note ? `<p class="log-note">${esc(e.note)}</p>` : ""}<p class="log-meta">${dateText(e.doneAt)} · ${core.peakName(e.peak)} · ${e.climbed ? esc(core.TIERS[e.tier].name) : "at the summit"}</p></li>`).join("")}</ol>
${log.length > shown.length ? `<button class="btn quiet" type="button" data-action="all-log">Show all ${fmt(log.length)}</button>` : ""}
${core.canUndo(state) ? '<button class="btn quiet" type="button" data-action="undo">Undo the last one</button>' : ""}`
    : '<p class="muted">Nothing here yet. Every goal you finish is written down with its date and the tier it took you to.</p>';

  app.innerHTML = `
${ui.message ? `<p class="msg${ui.warn ? " warn" : ""}" role="status" id="msg">${esc(ui.message)}</p>` : ""}
${storage ? "" : '<p class="msg warn" role="status">This browser is blocking storage (private mode?), so your climb will be lost when you close the tab. Export a save before you leave.</p>'}
<section class="status" aria-label="Where you are">
<div class="stat"><span class="k">Peak</span><span class="v" data-stat="peak">${core.roman(state.peak)} · ${esc(core.paletteFor(state.peak).name)}</span></div>
<div class="stat"><span class="k">Tier</span><span class="v" data-stat="tier">${esc(core.TIERS[tier].name)}</span></div>
<div class="stat"><span class="k">Altitude</span><span class="v" data-stat="altitude">${fmt(core.altitude(state))} m</span></div>
<div class="stat"><span class="k">Day</span><span class="v" data-stat="day">${fmt(core.dayNumber(state))}</span></div>
<div class="stat"><span class="k">Goals done</span><span class="v" data-stat="goals">${fmt(life.goals)}</span></div>
</section>
<figure class="scene-wrap">${sceneSVG({ peak: state.peak, step: state.step, labels: "all", uid: "main" })}
<figcaption data-next>${esc(nextLine)}</figcaption></figure>
<div class="cols">
<section class="panel goals" aria-labelledby="goals-h">
<h2 id="goals-h">Your three goals</h2>
<p class="hint">Pick things you can honestly finish in the next one to four weeks. Finishing a goal is the only way up.</p>
<ol class="slots">${[0, 1, 2].map(slotHTML).join("")}</ol>
</section>
<section class="panel ladder" aria-labelledby="ladder-h">
<h2 id="ladder-h">The ladder</h2>
<p class="hint">${core.peakName(state.peak)}: ${per === 1 ? "one finished goal per tier" : `${per} finished goals per tier`}.</p>
<ol class="tiers">${ladderHTML(tier, per, inTier)}</ol>
</section>
</div>
<section class="panel" aria-labelledby="prestige-h"><h2 id="prestige-h">Prestige</h2>${prestigeHTML}</section>
<section class="panel" aria-labelledby="badges-h"><h2 id="badges-h">Summit badges</h2>${badges}
<p class="lifetime">Lifetime: <b data-stat="life-goals">${plural(life.goals, "goal")}</b> finished, <b data-stat="ascent">${fmt(life.ascent)} m</b> climbed, <b>${plural(life.summits, "summit")}</b>.</p></section>
<section class="panel" aria-labelledby="log-h"><h2 id="log-h">Climb log</h2>${logHTML}</section>
<section class="panel tools" aria-labelledby="tools-h"><h2 id="tools-h">Share and save</h2>
<div class="btn-row">
<button class="btn" type="button" data-action="share">Make a share card</button>
<button class="btn quiet" type="button" data-action="export">Export save</button>
<button class="btn quiet" type="button" data-action="import">Import save</button>
<button class="btn quiet danger" type="button" data-action="reset">Reset everything</button>
</div>
<input type="file" id="import-file" accept="application/json,.json" hidden aria-label="Choose a save file">
<p class="note">Your climb is saved in this browser, on this device, and nowhere else. Export a save to back it up or move it to another device.</p>
</section>`;
  document.documentElement.dataset.ready = "1";
  if (ui.focus) {
    const el = $(ui.focus);
    ui.focus = null;
    if (el) el.focus();
  }
}

// ---- dialogs ------------------------------------------------------------------------------------

// Show a modal. Buttons with data-close="name" close it; buttons with data-do="name" run actions[name]
// and leave it open. Resolves with the closing button's name and the values of the inputs inside.
function openDialog(html, actions = {}, onOpen) {
  return new Promise((resolve) => {
    dlgBody.innerHTML = html;
    const finish = (button) => {
      const values = {};
      for (const el of dlgBody.querySelectorAll("input[id]")) values[el.id] = el.type === "checkbox" ? el.checked : el.value;
      dlg.removeEventListener("click", onClick);
      dlg.removeEventListener("cancel", onCancel);
      dlg.removeEventListener("keydown", onKey);
      dlgBody.removeEventListener("change", onChange);
      if (dlg.open) dlg.close();
      resolve({ button, values });
    };
    const onClick = (e) => {
      const close = e.target.closest("[data-close]");
      if (close) return finish(close.dataset.close);
      const act = e.target.closest("[data-do]");
      if (act && actions[act.dataset.do]) actions[act.dataset.do](act);
    };
    const onCancel = (e) => { e.preventDefault(); finish("cancel"); };
    const onKey = (e) => {
      if (e.key === "Enter" && e.target.matches("input[type=text]")) {
        e.preventDefault();
        const primary = dlgBody.querySelector("[data-close][data-primary]");
        if (primary) finish(primary.dataset.close);
      }
    };
    const onChange = (e) => { if (actions.change) actions.change(e.target); };
    dlg.addEventListener("click", onClick);
    dlg.addEventListener("cancel", onCancel);
    dlg.addEventListener("keydown", onKey);
    dlgBody.addEventListener("change", onChange);
    dlg.showModal();
    (dlgBody.querySelector("[data-focus]") || dlgBody.querySelector("button"))?.focus();
    if (onOpen) onOpen();
  });
}

const firstEmptyInput = () => {
  const i = state.goals.indexOf(null);
  return i === -1 ? null : `#goal-${i}`;
};

async function celebrate(event) {
  const tierName = core.TIERS[event.toTier].name;
  const per = core.stepsPerTier(state.peak);
  let title;
  let text;
  if (event.type === "summit") {
    const goals = state.log.filter((e) => e.peak === state.peak).length;
    title = `Summit of ${core.peakName(state.peak)}!`;
    text = `${plural(goals, "finished goal")} in ${plural(core.dayNumber(state), "day")}. You can stay up here, or prestige and start a taller peak.`;
  } else if (event.type === "tier") {
    title = `You reached ${tierName}`;
    text = `${core.TIERS[event.toTier].blurb} You're at ${fmt(core.altitude(state))} m.`;
  } else if (event.type === "step") {
    title = "One step higher";
    text = `${core.stepInTier(state)} of ${per} goals done toward ${core.TIERS[event.toTier + 1].name}.`;
  } else {
    title = "Logged at the summit";
    text = "It counts toward your lifetime total. Prestige when you want to start climbing again.";
  }
  live.textContent = `${title}. ${text}`;
  const r = await openDialog(`
<div class="celebrate">${sceneSVG({ peak: state.peak, step: state.step, labels: "current", uid: "dlg" })}</div>
<h2 id="dlg-title" data-event="${event.type}">${esc(title)}</h2>
<p>${esc(text)}</p>
<div class="btn-row">
<button class="btn" type="button" data-close="card">${event.type === "summit" ? "Make a summit card" : "Make a tier-up card"}</button>
<button class="btn quiet" type="button" data-close="ok" data-focus>${event.type === "summit" ? "Stay at the top" : "Keep climbing"}</button>
</div>`);
  if (r.button === "card") return shareCard();
  ui.focus = firstEmptyInput();
  render();
}

async function makeCardPng(showGoal) {
  const model = core.cardModel(state, { showGoal, siteLabel: cfg.siteUrl.replace(/^https?:\/\//, "") });
  const url = URL.createObjectURL(new Blob([cardSVG(model)], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1080;
    canvas.getContext("2d").drawImage(img, 0, 0, 1080, 1080);
    const blob = await new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("no image"))), "image/png"));
    return { blob, model };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

async function shareCard() {
  const tier = core.tierOf(state);
  const link = `${cfg.siteUrl}/?${core.challengeQuery({ peak: state.peak, tier, day: core.dayNumber(state) })}`;
  let current = null;
  let previewUrl = null;
  const status = (t) => { const el = $("#card-status"); if (el) el.textContent = t; };
  const draw = async () => {
    try {
      current = await makeCardPng($("#card-goal")?.checked);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = URL.createObjectURL(current.blob);
      const img = $("#card-img");
      img.src = previewUrl;
      img.alt = `Share card: ${current.model.headline}. ${current.model.eyebrow}. ${current.model.facts}.`;
      img.dataset.ready = "1";
      const file = new File([current.blob], "life-incremental-card.png", { type: "image/png" });
      const shareBtn = $("[data-do=native]");
      if (shareBtn) shareBtn.hidden = !(navigator.canShare && navigator.canShare({ files: [file] }));
    } catch {
      status("This browser couldn't draw the card. The challenge link below still works.");
    }
  };
  const hasGoal = state.log.length > 0;
  await openDialog(`
<h2 id="dlg-title">Your share card</h2>
<div class="card-preview"><img id="card-img" alt="" width="1080" height="1080"></div>
${hasGoal ? '<label class="check"><input type="checkbox" id="card-goal"> Show my latest finished goal on the card</label>' : ""}
<div class="btn-row">
<button class="btn" type="button" data-do="download" data-focus>Download image</button>
<button class="btn" type="button" data-do="native" hidden>Share…</button>
<button class="btn quiet" type="button" data-do="copy">Copy challenge link</button>
<button class="btn quiet" type="button" data-close="close">Close</button>
</div>
<label class="link-label" for="card-link">Challenge link</label>
<input class="link" id="card-link" type="text" readonly value="${esc(link)}">
<p class="note" id="card-status" role="status">The card and the link carry your peak, tier, day and totals. Your goals stay private unless you tick the box.</p>`,
  {
    change: (el) => { if (el.id === "card-goal") draw(); },
    download: () => { if (current) { download(current.blob, `life-incremental-day-${current.model.day}.png`); track("card_download"); } },
    native: async () => {
      if (!current) return;
      try {
        await navigator.share({ files: [new File([current.blob], "life-incremental-card.png", { type: "image/png" })], title: current.model.headline, text: `${current.model.headline}. ${current.model.eyebrow}.`, url: link });
        track("card_share");
      } catch {}
    },
    copy: async () => {
      try {
        await navigator.clipboard.writeText(link);
        status("Link copied.");
      } catch {
        $("#card-link").select();
        status("Press Ctrl+C or ⌘C to copy the selected link.");
      }
      track("link_copy");
    },
  }, draw);
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  track("card_open");
}

// ---- actions ------------------------------------------------------------------------------------

const isUntouched = (s) => s.peak === 1 && s.step === 0 && !s.log.length && !s.goals.some(Boolean);

const actions = {
  idea(b) {
    const slot = Number(b.dataset.slot);
    const taken = new Set(state.goals.filter(Boolean).map((g) => g.text));
    let idea;
    for (let n = 0; n < IDEAS.length; n++) {
      ui.ideaAt = (ui.ideaAt + 1) % IDEAS.length;
      idea = IDEAS[ui.ideaAt];
      if (!taken.has(idea.text)) break;
    }
    ui.drafts[slot] = idea.text;
    const input = $(`#goal-${slot}`);
    input.value = idea.text;
    input.focus();
    input.select();
  },
  edit(b) {
    const slot = Number(b.dataset.slot);
    ui.editing.add(slot);
    ui.drafts[slot] = state.goals[slot].text;
    ui.focus = `#goal-${slot}`;
    render();
  },
  "cancel-edit"(b) {
    const slot = Number(b.dataset.slot);
    ui.editing.delete(slot);
    ui.drafts[slot] = "";
    render();
  },
  async drop(b) {
    const slot = Number(b.dataset.slot);
    const r = await openDialog(`<h2 id="dlg-title">Drop this goal?</h2><p class="dlg-goal">${esc(state.goals[slot].text)}</p>
<p>Dropping is fine. It frees the slot and doesn't count as finished.</p>
<div class="btn-row"><button class="btn" type="button" data-close="yes">Drop it</button><button class="btn quiet" type="button" data-close="no" data-focus>Keep it</button></div>`);
    if (r.button !== "yes") return;
    say("Goal dropped. The slot is free.");
    ui.focus = `#goal-${slot}`;
    commit(core.dropGoal(state, slot));
  },
  async done(b) {
    const slot = Number(b.dataset.slot);
    const r = await openDialog(`<h2 id="dlg-title">Did you finish it?</h2><p class="dlg-goal">${esc(state.goals[slot].text)}</p>
<p>The climb only means something if it's real. If it's done, take the step.</p>
<label for="done-note">One line on what you did (optional, stays on this device)</label>
<input id="done-note" type="text" maxlength="${core.NOTE_MAX}" autocomplete="off">
<div class="btn-row"><button class="btn" type="button" data-close="yes" data-primary data-focus>Yes, I finished it</button><button class="btn quiet" type="button" data-close="no">Not yet</button></div>`);
    if (r.button !== "yes") return;
    const { state: next, event } = core.completeGoal(state, slot, Date.now(), r.values["done-note"]);
    say("");
    commit(next);
    track("goal_done");
    await celebrate(event);
  },
  async undo() {
    const last = state.log[state.log.length - 1];
    const r = await openDialog(`<h2 id="dlg-title">Undo the last finished goal?</h2><p class="dlg-goal">${esc(last.text)}</p>
<p>${last.climbed ? "You'll step back down, and the" : "The"} goal goes back into a free slot if there is one.</p>
<div class="btn-row"><button class="btn" type="button" data-close="yes">Undo it</button><button class="btn quiet" type="button" data-close="no" data-focus>Leave it</button></div>`);
    if (r.button !== "yes") return;
    say("Undone.");
    commit(core.undoLast(state));
  },
  async prestige() {
    const nextPeak = state.peak + 1;
    const r = await openDialog(`<h2 id="dlg-title">Prestige: start ${core.peakName(nextPeak)}?</h2>
<p><b>You keep</b> a summit badge for ${core.peakName(state.peak)}, your climb log, your lifetime totals and your current goals.</p>
<p><b>You give up</b> your place on this mountain: you start again at the Trailhead.</p>
<p>${core.peakName(nextPeak)} is ${fmt(core.altitudeAt(nextPeak, core.stepsToSummit(nextPeak)))} m tall, and every tier takes ${plural(core.stepsPerTier(nextPeak), "finished goal")}.</p>
<div class="btn-row"><button class="btn" type="button" data-close="yes">Prestige</button><button class="btn quiet" type="button" data-close="no" data-focus>Not now</button></div>`);
    if (r.button !== "yes") return;
    say(`Badge earned. Welcome to ${core.peakName(nextPeak)}: ${core.paletteFor(nextPeak).name}.`);
    live.textContent = `Prestige done. You are at the Trailhead of ${core.peakName(nextPeak)}.`;
    ui.focus = firstEmptyInput();
    commit(core.prestige(state));
    track("prestige");
    window.scrollTo({ top: 0, behavior: "auto" });
  },
  share() {
    shareCard();
  },
  export() {
    download(new Blob([core.exportSave(state)], { type: "application/json" }), `life-incremental-save-${new Date().toISOString().slice(0, 10)}.json`);
    say("Save exported. Keep the file somewhere safe; import it here or on another device.");
    render();
  },
  import() {
    $("#import-file").click();
  },
  async reset() {
    const r = await openDialog(`<h2 id="dlg-title">Erase everything on this device?</h2>
<p>Your goals, climb log and badges will be deleted from this browser. This can't be undone. Export a save first if you might want them back.</p>
<div class="btn-row"><button class="btn danger" type="button" data-close="yes">Erase everything</button><button class="btn quiet" type="button" data-close="no" data-focus>Cancel</button></div>`);
    if (r.button !== "yes") return;
    if (storage) storage.removeItem(KEY);
    ui.editing.clear();
    ui.drafts = ["", "", ""];
    state = core.newGame();
    say("Everything was erased. You're back at the Trailhead.");
    render();
  },
  "all-log"() {
    ui.allLog = true;
    render();
  },
};

app.addEventListener("click", (e) => {
  const b = e.target.closest("[data-action]");
  if (b && actions[b.dataset.action]) actions[b.dataset.action](b);
});

app.addEventListener("input", (e) => {
  const input = e.target.closest("input[name=text]");
  if (input) ui.drafts[Number(input.closest("[data-slot]").dataset.slot)] = input.value;
});

app.addEventListener("submit", (e) => {
  const form = e.target.closest("form[data-form=set]");
  if (!form) return;
  e.preventDefault();
  const slot = Number(form.dataset.slot);
  const input = form.elements.text;
  if (!core.sanitizeText(input.value, core.GOAL_MAX)) {
    say("Write the goal first: one thing you can finish.", true);
    ui.focus = `#goal-${slot}`;
    return render();
  }
  const wasEditing = ui.editing.has(slot);
  const base = isUntouched(state) ? core.newGame() : state;
  const next = core.setGoal(base, slot, input.value);
  ui.editing.delete(slot);
  ui.drafts[slot] = "";
  say(wasEditing ? "Goal updated." : core.activeGoals(next) === core.SLOTS ? "All three goals are set. Go finish one." : "Goal set. Finish it to climb.");
  ui.focus = wasEditing ? `[data-action=done][data-slot="${slot}"]` : firstEmptyInputFor(next) || `[data-action=done][data-slot="${slot}"]`;
  commit(next);
  if (!wasEditing) track("goal_set");
});

function firstEmptyInputFor(s) {
  const i = s.goals.indexOf(null);
  return i === -1 ? null : `#goal-${i}`;
}

app.addEventListener("change", async (e) => {
  if (e.target.id !== "import-file" || !e.target.files[0]) return;
  let incoming;
  try {
    incoming = core.parseSave(await e.target.files[0].text());
  } catch (err) {
    say(err.message, true);
    return render();
  }
  const life = core.lifetime(incoming);
  const r = await openDialog(`<h2 id="dlg-title">Replace the climb on this device?</h2>
<p>The save you chose: <b>${core.peakName(incoming.peak)}, ${esc(core.TIERS[core.tierOf(incoming)].name)}</b>, ${plural(life.goals, "finished goal")}, ${plural(life.badges, "summit badge")}.</p>
<p>It will replace what's here now${state.log.length || core.activeGoals(state) ? " (export the current climb first if you want to keep it)" : ""}.</p>
<div class="btn-row"><button class="btn" type="button" data-close="yes">Load this save</button><button class="btn quiet" type="button" data-close="no" data-focus>Cancel</button></div>`);
  if (r.button !== "yes") return render();
  ui.editing.clear();
  ui.drafts = ["", "", ""];
  say("Save loaded.");
  commit(incoming);
});

// Another tab changed the save: follow it.
window.addEventListener("storage", (e) => {
  if (e.key === KEY && !dlg.open) {
    state = load();
    render();
  }
});

// ---- links that carry something ------------------------------------------------------------------

function readLink() {
  const challenge = core.readChallenge(location.search);
  if (challenge) {
    const banner = $("#challenge");
    const mine = isUntouched(state)
      ? "Your climb starts at the Trailhead: set a goal below."
      : `You're at ${core.TIERS[core.tierOf(state)].name} on day ${fmt(core.dayNumber(state))} of ${core.peakName(state.peak)}.`;
    const where = challenge.tier === core.TOP ? `the Summit of ${core.peakName(challenge.peak)}` : `${core.TIERS[challenge.tier].name} on ${core.peakName(challenge.peak)}`;
    banner.textContent = `Someone reached ${where} on day ${fmt(challenge.day)}. ${mine}`;
    banner.hidden = false;
    track("challenge_open");
  }
  const ideaId = core.readIdeaId(location.search);
  const idea = ideaId && IDEAS.find((i) => i.id === ideaId);
  if (idea) {
    const slot = state.goals.indexOf(null);
    if (slot === -1) {
      say(`Your three slots are full. Finish or drop a goal to add “${idea.text}”.`, true);
    } else {
      ui.drafts[slot] = idea.text;
      ui.focus = `#goal-${slot}`;
      say(`Idea loaded into goal ${slot + 1}. Make it yours, then press “Set goal”.`);
    }
  }
  if (challenge || ideaId) history.replaceState(null, "", location.pathname);
}

readLink();
render();
