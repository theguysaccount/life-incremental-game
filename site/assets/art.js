// The mountain, drawn as SVG text. The same drawing is used on the page, on share cards (turned into
// a PNG in the browser) and for the social preview images. No DOM access, so the Node tests can read it.
import { TIERS, TOP, stepsPerTier, paletteFor, wrapText } from "./core.js";

export const SCENE_W = 800;
export const SCENE_H = 500;
// Where each station sits on the switchback trail (x, y in the 800x500 scene).
export const STATIONS = [[222, 450], [545, 410], [272, 368], [510, 326], [307, 284], [475, 242], [342, 200], [441, 160], [378, 118], [400, 68]];

const MOUNTAIN = "40,480 120,400 170,345 230,270 290,200 340,130 375,85 400,52 425,88 462,135 510,205 565,268 630,348 690,410 760,480";
const x = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// A tiny repeatable random source, so the trees and stars land in the same place every time.
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The climber's spot: on a station, or part-way to the next one on peaks that need several goals a tier.
export function climberPosition(peak, step) {
  const per = stepsPerTier(peak);
  const tier = Math.min(TOP, Math.floor(step / per));
  if (tier === TOP) return { tier, at: STATIONS[TOP], between: false };
  const f = (step % per) / per;
  const [ax, ay] = STATIONS[tier];
  const [bx, by] = STATIONS[tier + 1];
  return { tier, at: [ax + (bx - ax) * f, ay + (by - ay) * f], between: f > 0 };
}

function sceneBody({ peak, step, labels, uid }) {
  const p = paletteFor(peak);
  const { tier, at, between } = climberPosition(peak, step);
  const rand = seeded(peak * 7919 + 11);
  const out = [];
  out.push(`<defs><linearGradient id="sky${uid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.sky[0]}"/><stop offset="1" stop-color="${p.sky[1]}"/></linearGradient>` +
    `<clipPath id="mt${uid}"><polygon points="${MOUNTAIN}"/></clipPath></defs>`);
  out.push(`<rect width="${SCENE_W}" height="${SCENE_H}" fill="url(#sky${uid})"/>`);
  if (p.night) {
    for (let i = 0; i < 46; i++) out.push(`<circle cx="${(rand() * 800).toFixed(0)}" cy="${(rand() * 260).toFixed(0)}" r="${(0.6 + rand() * 1.3).toFixed(1)}" fill="#ffffff" opacity="${(0.4 + rand() * 0.6).toFixed(2)}"/>`);
    out.push('<path d="M-20 150 C 140 60, 260 190, 420 110 S 700 60, 830 130" fill="none" stroke="#5eead4" stroke-width="26" opacity="0.22" stroke-linecap="round"/>');
    out.push('<path d="M-20 205 C 160 120, 300 240, 470 160 S 720 120, 830 185" fill="none" stroke="#a78bfa" stroke-width="18" opacity="0.2" stroke-linecap="round"/>');
  }
  out.push(`<circle cx="648" cy="92" r="58" fill="${p.sun}" opacity="0.28"/><circle cx="648" cy="92" r="34" fill="${p.sun}"/>`);
  out.push(`<polygon points="0,500 0,330 70,280 150,330 230,250 310,330 380,300 470,350 560,270 660,340 730,290 800,340 800,500" fill="${p.far}"/>`);
  out.push(`<polygon points="0,500 0,400 90,350 180,410 270,360 360,420 480,380 600,430 700,370 800,420 800,500" fill="${p.mid}"/>`);
  // The mountain: rock, then bands of forest, meadow, ice and snow clipped to its outline.
  out.push(`<polygon points="${MOUNTAIN}" fill="${p.rock}"/>`);
  out.push(`<g clip-path="url(#mt${uid})">` +
    `<rect x="0" y="342" width="800" height="60" fill="${p.meadow}"/>` +
    `<polygon points="0,500 0,398 60,392 130,400 200,390 280,402 360,392 440,400 520,390 600,402 680,392 800,400 800,500" fill="${p.forest}"/>` +
    `<polygon points="430,150 520,150 548,200 522,262 470,276 440,240 452,190" fill="${p.ice}"/>` +
    `<polygon points="0,0 800,0 800,150 520,150 490,172 455,148 425,176 395,150 365,178 335,152 300,170 270,150 0,150" fill="${p.snow}"/>` +
    '<polygon points="400,52 412,140 396,230 422,330 406,480 760,480 690,410 630,348 565,268 510,205 462,135 425,88" fill="#000000" opacity="0.13"/>' +
    "</g>");
  // Meadow flowers, forest trees, crevasses, two camps.
  for (let i = 0; i < 16; i++) {
    const fx = 190 + rand() * 430;
    const fy = 350 + rand() * 38;
    out.push(`<circle cx="${fx.toFixed(0)}" cy="${fy.toFixed(0)}" r="2.6" fill="${i % 3 ? "#ffffff" : "#ffd166"}" opacity="0.9"/>`);
  }
  for (let i = 0; i < 34; i++) {
    const ty = 412 + rand() * 56;
    const half = (ty - 52) * 0.8;
    const tx = 400 + (rand() * 2 - 1) * (half - 26);
    const h = 16 + rand() * 12;
    out.push(`<polygon points="${tx.toFixed(0)},${(ty - h).toFixed(0)} ${(tx - h * 0.42).toFixed(0)},${ty.toFixed(0)} ${(tx + h * 0.42).toFixed(0)},${ty.toFixed(0)}" fill="#000000" opacity="0.28"/>`);
  }
  out.push('<path d="M468 205 l22 9 M474 226 l26 7 M462 250 l24 4" stroke="#6b93a8" stroke-width="2.2" fill="none" stroke-linecap="round" opacity="0.8"/>');
  const tent = ([tx, ty], color) => `<polygon points="${tx + 20},${ty + 4} ${tx + 32},${ty - 16} ${tx + 44},${ty + 4}" fill="${color}"/><polygon points="${tx + 30},${ty + 4} ${tx + 32},${ty - 8} ${tx + 34},${ty + 4}" fill="#2b2330"/>`;
  out.push(tent(STATIONS[4], "#f4a261") + tent(STATIONS[7], "#e9c46a"));
  out.push('<ellipse cx="252" cy="128" rx="74" ry="14" fill="#ffffff" opacity="0.82"/><ellipse cx="300" cy="141" rx="52" ry="11" fill="#ffffff" opacity="0.7"/>' +
    '<ellipse cx="556" cy="122" rx="80" ry="15" fill="#ffffff" opacity="0.82"/><ellipse cx="606" cy="136" rx="50" ry="10" fill="#ffffff" opacity="0.7"/>');
  out.push(`<rect x="0" y="476" width="800" height="24" fill="${p.ground}"/>`);
  // The trail: dotted all the way up, solid as far as the climber has come.
  const pts = STATIONS.map((s) => s.join(",")).join(" ");
  out.push(`<polyline points="${pts}" fill="none" stroke="${p.trail}" stroke-width="4" stroke-dasharray="1 10" stroke-linecap="round" opacity="0.75"/>`);
  const done = STATIONS.slice(0, tier + 1).map((s) => s.join(",")).concat(between ? [at.map((n) => n.toFixed(1)).join(",")] : []).join(" ");
  if (tier > 0 || between) out.push(`<polyline points="${done}" fill="none" stroke="${p.accent}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`);
  STATIONS.forEach(([sx, sy], i) => {
    if (i < tier) {
      out.push(`<circle cx="${sx}" cy="${sy}" r="10" fill="${p.accent}" stroke="#ffffff" stroke-width="2.5"/><path d="M${sx - 4.5} ${sy} l3.2 3.4 l6 -6.6" fill="none" stroke="#ffffff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`);
    } else if (i > tier) {
      out.push(`<circle cx="${sx}" cy="${sy}" r="8" fill="${p.ground}" fill-opacity="0.45" stroke="#ffffff" stroke-width="2.2"/>`);
    }
  });
  // The summit flag is always there to aim at; the climber carries a pennant.
  const [mx, my] = STATIONS[TOP];
  if (tier < TOP) out.push(`<path d="M${mx} ${my - 8} v-30" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round"/><polygon points="${mx},${my - 38} ${mx + 16},${my - 32} ${mx},${my - 26}" fill="#ffffff" opacity="0.9"/>`);
  const [cx, cy] = STATIONS[tier];
  out.push(`<circle cx="${cx}" cy="${cy}" r="13" fill="#ffffff" stroke="${p.accent}" stroke-width="4.5"/>`);
  const [fx, fy] = at;
  out.push(`<g><path d="M${fx.toFixed(1)} ${(fy - 12).toFixed(1)} v-32" stroke="${p.ground}" stroke-width="3" stroke-linecap="round"/>` +
    `<polygon points="${fx.toFixed(1)},${(fy - 45).toFixed(1)} ${(fx + 22).toFixed(1)},${(fy - 37).toFixed(1)} ${fx.toFixed(1)},${(fy - 29).toFixed(1)}" fill="${p.accent}" stroke="#ffffff" stroke-width="1.5" stroke-linejoin="round"/>` +
    (between ? `<circle cx="${fx.toFixed(1)}" cy="${fy.toFixed(1)}" r="7" fill="${p.accent}" stroke="#ffffff" stroke-width="2.5"/>` : "") + "</g>");
  if (labels !== "none") {
    STATIONS.forEach(([sx, sy], i) => {
      if (labels === "current" && i !== tier) return;
      const name = TIERS[i].name;
      const w = name.length * 8.6 + 20;
      const right = i === TOP ? true : i % 2 === 1;
      const lx = right ? sx + 22 : sx - 22 - w;
      const ly = i === TOP ? sy - 6 : sy - 14;
      out.push(`<g class="lbl${i === tier ? " lbl-now" : ""}"><rect x="${lx.toFixed(0)}" y="${ly}" width="${w.toFixed(0)}" height="28" rx="14" fill="${i === tier ? p.accent : p.ground}" fill-opacity="${i === tier ? 1 : 0.62}"/>` +
        `<text x="${(lx + w / 2).toFixed(0)}" y="${ly + 19}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="15" font-weight="700" fill="#ffffff">${x(name)}</text></g>`);
    });
  }
  return out.join("");
}

// The scene for the page. `labels`: "all", "current" or "none".
export function sceneSVG({ peak = 1, step = 0, labels = "all", uid = "a" } = {}) {
  const { tier } = climberPosition(peak, step);
  const title = `A mountain with ten stations on a trail. You are at ${TIERS[tier].name}, tier ${tier} of ${TOP}.`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SCENE_W} ${SCENE_H}" width="${SCENE_W}" height="${SCENE_H}" role="img" aria-label="${x(title)}" class="scene">` +
    `<title>${x(title)}</title>${sceneBody({ peak, step, labels, uid })}</svg>`;
}

// A square 1080x1080 share card. `model` comes from core.cardModel().
export function cardSVG(model) {
  const p = paletteFor(model.peak);
  const goalLines = model.goal ? wrapText(`“${model.goal}”`, 46, 2) : [];
  const t = (s, attrs) => `<text font-family="Helvetica, Arial, sans-serif" ${attrs}>${x(s)}</text>`;
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1080" width="1080" height="1080">`,
    `<rect width="1080" height="1080" fill="${p.ground}"/>`,
    `<g transform="scale(1.35)">${sceneBody({ peak: model.peak, step: model.step, labels: "current", uid: "c" })}</g>`,
    `<rect x="0" y="675" width="1080" height="405" fill="${p.ground}"/>`,
    `<rect x="40" y="40" width="330" height="54" rx="27" fill="${p.ground}" fill-opacity="0.78"/>`,
    t("LIFE INCREMENTAL", 'x="205" y="76" text-anchor="middle" font-size="25" font-weight="700" letter-spacing="3.5" fill="#ffffff"'),
    t(model.eyebrow.toUpperCase(), `x="64" y="752" font-size="30" font-weight="700" letter-spacing="2.5" fill="${p.accent}"`),
    t(model.headline, 'x="64" y="842" font-size="74" font-weight="700" fill="#ffffff"'),
    t(model.facts, 'x="64" y="902" font-size="34" fill="#ffffff" fill-opacity="0.82"'),
    ...goalLines.map((line, i) => t(line, `x="64" y="${958 + i * 42}" font-size="32" font-style="italic" fill="#ffffff" fill-opacity="0.92"`)),
    t(model.siteLabel, 'x="64" y="1046" font-size="26" fill="#ffffff" fill-opacity="0.62"'),
    "</svg>",
  ];
  return parts.join("");
}

// Small line icons for the ladder list, one per tier. They take the text colour.
const ICONS = [
  '<path d="M16 29V6M16 9h10l3 3.5-3 3.5H16M16 17H7l-3 3.5L7 24h9"/>',
  '<path d="M16 3l7 10h-4l6 9H7l6-9H9zM16 22v7"/>',
  '<circle cx="16" cy="12" r="2.6"/><circle cx="16" cy="5.6" r="2.6"/><circle cx="22" cy="10" r="2.6"/><circle cx="19.8" cy="17" r="2.6"/><circle cx="12.2" cy="17" r="2.6"/><circle cx="10" cy="10" r="2.6"/><path d="M16 19.6V29M16 25c-3 0-5-1.6-5.6-4"/>',
  '<path d="M10 4l5 8h-3l4 7H4l4-7H5zM10 19v6M3 25h26M21 25v-4M25 25v-2"/>',
  '<path d="M3 27L16 5l13 22zM16 27l-4-8M16 27l4-8M16 5V2"/>',
  '<path d="M16 3v26M4.7 9.5l22.6 13M27.3 9.5L4.7 22.5M16 8l-3-3M16 8l3-3M16 24l-3 3M16 24l3 3"/>',
  '<path d="M2 26l7-12 4 5 5-11 5 9 3-4 4 13z"/>',
  '<path d="M4 28l10-17 10 17zM14 28l-3-6M14 28l3-6M14 11V3l8 3-8 3"/>',
  '<path d="M9 24a5 5 0 010-10 6.5 6.5 0 0112.6-1.6A5.8 5.8 0 0123 24zM13 6l3-4 3 4"/>',
  '<path d="M3 29L15 9l12 20zM15 9V2l9 3.5-9 3.5"/>',
];
export const tierIcon = (i) =>
  `<svg viewBox="0 0 32 32" width="32" height="32" aria-hidden="true" class="tier-icon" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[i]}</svg>`;

// A summit badge: a pennant with the peak's numeral.
export function badgeSVG(peak, numeral) {
  const p = paletteFor(peak);
  return `<svg viewBox="0 0 64 64" width="64" height="64" aria-hidden="true" class="badge-art"><circle cx="32" cy="32" r="30" fill="${p.sky[1]}"/><circle cx="32" cy="32" r="30" fill="none" stroke="${p.ground}" stroke-width="3"/>` +
    `<polygon points="10,52 26,26 34,36 42,22 56,52" fill="${p.rock}"/><polygon points="42,22 37,30 47,32" fill="${p.snow}"/>` +
    `<path d="M42 22V9" stroke="${p.ground}" stroke-width="2.4" stroke-linecap="round"/><polygon points="42,9 54,13 42,17" fill="${p.accent}"/>` +
    `<text x="32" y="50" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="13" font-weight="700" fill="#ffffff">${x(numeral)}</text></svg>`;
}
