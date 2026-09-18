// Style "constellation" : un point lumineux voyage de commit en commit en
// traçant une ligne fine entre chaque case visitée, jusqu'à former une
// figure façon ciel étoilé. L'ordre de parcours n'est pas chronologique
// (ça zigzaguerait dans tous les sens) mais un plus-proche-voisin glouton
// et déterministe, pour un tracé qui ressemble à un vrai trajet.

import { LEVEL_COLOR, gridGeometry } from "../lib/contributions.mjs";

export const meta = {
  id: "constellation",
  label: "Commit Constellation",
  description: "Un point lumineux relie chaque commit par une ligne fine, dessinant une constellation qui prend forme au fil du temps.",
};

// Petit hash déterministe (0..1) — mêmes données en entrée, même rendu.
function hash(n) {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967295;
}

export function render(days, opts = {}) {
  const accent = opts.accent ?? "ff9100";
  const bg = opts.background ?? "#0d1117";
  const CYCLE = opts.cycle ?? 16;
  const DRAW_END = 0.74;
  const EPS = 0.05;

  const g = gridGeometry(days, { top: 10, left: 10, right: 10, bottom: 10 });
  const pct = (frac) => frac * 100;

  const activeDays = days.filter((d) => d.count > 0);
  activeDays.forEach((d) => {
    d.tx = g.cellX(d.col) + g.CELL / 2;
    d.ty = g.cellY(d.row) + g.CELL / 2;
  });

  // Chemin du point lumineux : plus-proche-voisin glouton en partant du
  // premier commit chronologique, plutôt qu'un parcours ligne par ligne.
  const path = [];
  if (activeDays.length) {
    const remaining = activeDays.slice(1);
    path.push(activeDays[0]);
    while (remaining.length) {
      const last = path[path.length - 1];
      let bestIdx = 0, bestDist = Infinity;
      remaining.forEach((d, idx) => {
        const dx = d.tx - last.tx, dy = d.ty - last.ty;
        const dist = dx * dx + dy * dy;
        if (dist < bestDist) { bestDist = dist; bestIdx = idx; }
      });
      path.push(remaining.splice(bestIdx, 1)[0]);
    }
  }

  // Étoiles de fond scintillantes, pour l'ambiance "ciel étoilé".
  const TWINKLE_VARIANTS = 4;
  let starEls = "", twinkleKeyframes = "";
  for (let v = 0; v < TWINKLE_VARIANTS; v++) {
    const lo = 0.1 + hash(v * 97 + 1) * 0.15;
    const hi = 0.5 + hash(v * 97 + 2) * 0.35;
    const peak = 30 + hash(v * 97 + 3) * 40;
    twinkleKeyframes += `@keyframes twinkle${v} {\n` +
      `  0% { opacity: ${lo.toFixed(1)}; }\n` +
      `  ${peak.toFixed(1)}% { opacity: ${hi.toFixed(1)}; }\n` +
      `  100% { opacity: ${lo.toFixed(1)}; }\n` +
      `}\n`;
  }
  for (let i = 0; i < 28; i++) {
    const sx = hash(i * 17 + 3) * g.width;
    const sy = hash(i * 29 + 11) * g.height;
    const sr = 0.4 + hash(i * 53 + 5) * 0.7;
    const variant = i % TWINKLE_VARIANTS;
    const dur = (CYCLE * (1.4 + hash(i * 61 + 13) * 1.8)).toFixed(1);
    const delay = (-hash(i * 43 + 21) * dur).toFixed(1);
    starEls += `<circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="${sr.toFixed(1)}" fill="#ffffff" style="animation: twinkle${variant} ${dur}s ease-in-out ${delay}s infinite;"/>\n`;
  }

  let cellRects = "";
  days.forEach((d) => {
    cellRects += `<rect x="${g.cellX(d.col)}" y="${g.cellY(d.row)}" width="${g.CELL}" height="${g.CELL}" rx="2" fill="${LEVEL_COLOR.NONE}"/>\n`;
  });

  // Moment d'arrivée de chaque nœud le long du chemin : vitesse ~constante
  // (avec un plancher pour que deux points très proches restent visibles),
  // en fraction de CYCLE.
  const segDist = [];
  for (let i = 1; i < path.length; i++) {
    const dx = path[i].tx - path[i - 1].tx, dy = path[i].ty - path[i - 1].ty;
    segDist.push(Math.max(6, Math.hypot(dx, dy)));
  }
  const totalDist = segDist.reduce((a, b) => a + b, 0) || 1;
  let acc = 0;
  path.forEach((d, i) => {
    if (i === 0) { d.arrive = 0; return; }
    acc += segDist[i - 1];
    d.arrive = (acc / totalDist) * DRAW_END;
  });

  const maxCount = Math.max(1, ...activeDays.map((d) => d.count));
  const nodeSize = (count) => 0.8 + Math.sqrt(count / maxCount) * 0.6;

  let lineEls = "", nodeEls = "", keyframes = "";
  const travelerFrames = [];

  path.forEach((d, i) => {
    const arrivePct = pct(d.arrive);
    const nName = `node${i}`;
    const r = 1.3 * nodeSize(d.count);

    keyframes += `@keyframes ${nName} {\n` +
      `  0% { opacity: 0; transform: scale(0.3); }\n` +
      `  ${arrivePct.toFixed(1)}% { opacity: 0; transform: scale(0.3); }\n` +
      `  ${Math.min(100, arrivePct + EPS).toFixed(1)}% { opacity: 1; transform: scale(1.3); }\n` +
      `  ${Math.min(100, arrivePct + EPS * 3).toFixed(1)}% { opacity: 1; transform: scale(1); }\n` +
      `  100% { opacity: 1; transform: scale(1); }\n` +
      `}\n`;
    nodeEls += `<g transform="translate(${d.tx.toFixed(1)},${d.ty.toFixed(1)})">\n` +
      `<circle r="${(r * 2.4).toFixed(1)}" fill="url(#starGlow)" style="animation: ${nName} ${CYCLE}s linear infinite; opacity:0; transform-origin: 0px 0px;"/>\n` +
      `<circle r="${r.toFixed(1)}" fill="${LEVEL_COLOR[d.level]}" stroke="#fff5e0" stroke-width="0.4" style="animation: ${nName} ${CYCLE}s linear infinite; opacity:0; transform-origin: 0px 0px;"/>\n` +
      `</g>\n`;

    if (i === 0) {
      travelerFrames.push(`0% { opacity: 1; transform: translate(${d.tx.toFixed(1)}px,${d.ty.toFixed(1)}px); }`);
    } else {
      const p0 = path[i - 1];
      const len = Math.hypot(d.tx - p0.tx, d.ty - p0.ty);
      const startPct = pct(p0.arrive);
      const segName = `seg${i}`;
      keyframes += `@keyframes ${segName} {\n` +
        `  0% { stroke-dashoffset: ${len.toFixed(1)}; }\n` +
        `  ${startPct.toFixed(1)}% { stroke-dashoffset: ${len.toFixed(1)}; }\n` +
        `  ${arrivePct.toFixed(1)}% { stroke-dashoffset: 0; }\n` +
        `  100% { stroke-dashoffset: 0; }\n` +
        `}\n`;
      const common = `x1="${p0.tx.toFixed(1)}" y1="${p0.ty.toFixed(1)}" x2="${d.tx.toFixed(1)}" y2="${d.ty.toFixed(1)}" stroke-linecap="round" stroke-dasharray="${len.toFixed(1)}" style="animation: ${segName} ${CYCLE}s linear infinite; stroke-dashoffset:${len.toFixed(1)};"`;
      lineEls += `<line ${common} stroke="#${accent}" stroke-width="2.4" opacity="0.16"/>\n`;
      lineEls += `<line ${common} stroke="#fff5e0" stroke-width="0.8" opacity="0.8"/>\n`;
      travelerFrames.push(`${arrivePct.toFixed(1)}% { opacity: 1; transform: translate(${d.tx.toFixed(1)}px,${d.ty.toFixed(1)}px); }`);
    }
  });

  let travelerEl = "";
  if (path.length > 1) {
    const lastArrive = pct(path.at(-1).arrive);
    const fadeAt = Math.min(100, lastArrive + EPS * 3);
    travelerFrames.push(`${fadeAt.toFixed(1)}% { opacity: 0; transform: translate(${path.at(-1).tx.toFixed(1)}px,${path.at(-1).ty.toFixed(1)}px); }`);
    travelerFrames.push(`100% { opacity: 0; transform: translate(${path.at(-1).tx.toFixed(1)}px,${path.at(-1).ty.toFixed(1)}px); }`);
    keyframes += `@keyframes traveler {\n  ${travelerFrames.join("\n  ")}\n}\n`;
    travelerEl = `<g style="animation: traveler ${CYCLE}s linear infinite; opacity:0;">\n` +
      `<circle r="3.2" fill="url(#starGlow)"/>\n` +
      `<circle r="1.1" fill="#fff5e0"/>\n` +
      `</g>\n`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${g.width}" height="${g.height}" viewBox="0 0 ${g.width} ${g.height}">
<defs>
<radialGradient id="starGlow">
  <stop offset="0%" stop-color="#fff5e0" stop-opacity="0.6"/>
  <stop offset="100%" stop-color="#fff5e0" stop-opacity="0"/>
</radialGradient>
</defs>
<style>
rect { shape-rendering: crispEdges; }
${twinkleKeyframes}
${keyframes}
</style>
<rect width="${g.width}" height="${g.height}" fill="${bg}"/>
${starEls}
${cellRects}
${lineEls}
${nodeEls}
${travelerEl}
</svg>`;
}
