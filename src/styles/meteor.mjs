// Style "meteor" : une pluie de météores tombe du haut de l'écran à
// intervalles irréguliers et s'écrase sur chaque case active, laissant un
// cratère coloré (couleur = niveau de contribution GitHub) et un éclat de
// particules qui se dissipe. Même esprit "impact" que le canon, en plus
// chaotique et spatial.

import { LEVEL_COLOR, gridGeometry } from "../lib/contributions.mjs";

export const meta = {
  id: "meteor",
  label: "Commit Meteor Shower",
  description: "Des météores tombent à intervalles aléatoires et s'écrasent sur chaque commit, laissant un cratère et un éclat de particules.",
};

// Petit hash déterministe (0..1) pour dériver un "aléatoire" stable à partir
// d'un entier — le SVG doit rester reproductible pour les mêmes données.
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
  const CYCLE = opts.cycle ?? 13;
  const ACTIVE_SPAN = CYCLE * 0.88;
  const EPS = 0.05;
  const FALL_START_Y = -10;

  const g = gridGeometry(days, { top: 16, left: 8, right: 8, bottom: 8 });
  const pct = (t) => (t / CYCLE) * 100;

  const activeDays = days.filter((d) => d.count > 0);

  // Intervalles irréguliers mais déterministes : un poids pseudo-aléatoire
  // par jour, normalisé pour couvrir tout ACTIVE_SPAN en gardant l'ordre
  // chronologique des commits.
  const weights = activeDays.map((d, i) => 0.35 + hash(d.col * 131 + d.row * 7 + i) * 1.3);
  const totalWeight = weights.reduce((a, b) => a + b, 0) || 1;
  let acc = 0;
  activeDays.forEach((d, i) => {
    acc += weights[i];
    d.t = (acc / totalWeight) * ACTIVE_SPAN;
    d.tx = g.cellX(d.col) + g.CELL / 2;
    d.ty = g.cellY(d.row) + g.CELL / 2;
  });

  // Étoiles décoratives, fixes, dispersées derrière la grille.
  let starEls = "";
  for (let i = 0; i < 36; i++) {
    const sx = hash(i * 17 + 3) * g.width;
    const sy = hash(i * 29 + 11) * (g.PAD_TOP + g.gridHeight);
    const sr = 0.4 + hash(i * 53 + 5) * 0.6;
    const so = 0.15 + hash(i * 71 + 9) * 0.35;
    starEls += `<circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="${sr.toFixed(2)}" fill="#ffffff" opacity="${so.toFixed(2)}"/>\n`;
  }

  let cellRects = "";
  days.forEach((d) => {
    cellRects += `<rect x="${g.cellX(d.col)}" y="${g.cellY(d.row)}" width="${g.CELL}" height="${g.CELL}" rx="2" fill="${LEVEL_COLOR.NONE}"/>\n`;
  });

  let meteorEls = "", craterEls = "", meteorKeyframes = "";

  activeDays.forEach((d, i) => {
    const seed = d.col * 131 + d.row * 7 + i;
    const fallDistance = d.ty - FALL_START_Y;
    const dxDrift = (hash(seed * 3 + 1) - 0.5) * g.CELL * 3.2;
    const fallFrac = 0.045 + hash(seed * 5 + 2) * 0.05;
    const fallDur = CYCLE * fallFrac;

    const arrive = pct(d.t);
    const startPct = Math.max(0, pct(d.t) - pct(fallDur));
    const gone = Math.min(100, arrive + EPS * 2);

    // Traînée : vecteur de déplacement pendant la chute, queue vers l'arrière.
    const vx = -dxDrift, vy = fallDistance;
    const vlen = Math.max(1, Math.hypot(vx, vy));
    const ux = vx / vlen, uy = vy / vlen;
    const tailLen = 7 + hash(seed * 13 + 4) * 5;
    const tailX = (-ux * tailLen).toFixed(2);
    const tailY = (-uy * tailLen).toFixed(2);

    const mName = `meteor${i}`;
    const cName = `crater${i}`;
    const fName = `flash${i}`;

    meteorKeyframes += `@keyframes ${mName} {\n` +
      `  0% { opacity: 0; transform: translate(${dxDrift.toFixed(2)}px,0px) scale(0.4); }\n` +
      `  ${startPct.toFixed(3)}% { opacity: 0; transform: translate(${dxDrift.toFixed(2)}px,0px) scale(0.4); }\n` +
      `  ${Math.min(startPct + EPS, arrive).toFixed(3)}% { opacity: 1; transform: translate(${dxDrift.toFixed(2)}px,0px) scale(0.6); }\n` +
      `  ${arrive.toFixed(3)}% { opacity: 1; transform: translate(0px,${fallDistance.toFixed(2)}px) scale(1); }\n` +
      `  ${gone.toFixed(3)}% { opacity: 0; transform: translate(0px,${fallDistance.toFixed(2)}px) scale(1); }\n` +
      `  100% { opacity: 0; transform: translate(0px,${fallDistance.toFixed(2)}px) scale(1); }\n` +
      `}\n`;

    meteorEls += `<g transform="translate(${d.tx},${FALL_START_Y})">\n` +
      `<g class="meteor" style="animation: ${mName} ${CYCLE}s linear infinite; opacity:0; transform-origin: 0px 0px;">\n` +
      `<line x1="0" y1="0" x2="${tailX}" y2="${tailY}" stroke="url(#cometTrail)" stroke-width="1.4" stroke-linecap="round"/>\n` +
      `<circle cx="0" cy="0" r="1.7" fill="#fff5e0"/>\n` +
      `<circle cx="0" cy="0" r="0.8" fill="#${accent}"/>\n` +
      `</g>\n</g>\n`;

    // Cratère persistant + flash + éclat de particules qui se dissipent.
    const craterR = g.CELL * 0.42;
    const popMid = Math.min(100, arrive + EPS);
    const popEnd = Math.min(100, arrive + EPS * 3);
    const flashEnd = Math.min(100, arrive + pct(CYCLE * 0.05));

    meteorKeyframes += `@keyframes ${cName} {\n` +
      `  0% { opacity: 0; transform: scale(0.3); }\n` +
      `  ${arrive.toFixed(3)}% { opacity: 0; transform: scale(0.3); }\n` +
      `  ${popMid.toFixed(3)}% { opacity: 1; transform: scale(1.25); }\n` +
      `  ${popEnd.toFixed(3)}% { opacity: 1; transform: scale(1); }\n` +
      `  100% { opacity: 1; transform: scale(1); }\n` +
      `}\n`;
    meteorKeyframes += `@keyframes ${fName} {\n` +
      `  0% { opacity: 0; transform: scale(0.2); }\n` +
      `  ${arrive.toFixed(3)}% { opacity: 0; transform: scale(0.2); }\n` +
      `  ${popMid.toFixed(3)}% { opacity: 0.9; transform: scale(1.1); }\n` +
      `  ${flashEnd.toFixed(3)}% { opacity: 0; transform: scale(2.4); }\n` +
      `  100% { opacity: 0; transform: scale(2.4); }\n` +
      `}\n`;

    let sparkEls = "";
    const sparkCount = 4;
    for (let s = 0; s < sparkCount; s++) {
      const sSeed = seed * 7 + s * 19 + 31;
      const angle = (s / sparkCount) * Math.PI * 2 + (hash(sSeed) - 0.5) * 0.9;
      const dist = craterR * (1.6 + hash(sSeed * 2) * 1.4);
      const ex = Math.cos(angle) * dist, ey = Math.sin(angle) * dist;
      const sparkEnd = Math.min(100, arrive + pct(CYCLE * (0.04 + hash(sSeed * 3) * 0.03)));
      const sName = `spark${i}_${s}`;
      meteorKeyframes += `@keyframes ${sName} {\n` +
        `  0% { opacity: 0; transform: translate(0px,0px) scale(1); }\n` +
        `  ${arrive.toFixed(3)}% { opacity: 0; transform: translate(0px,0px) scale(1); }\n` +
        `  ${popMid.toFixed(3)}% { opacity: 1; transform: translate(0px,0px) scale(1); }\n` +
        `  ${sparkEnd.toFixed(3)}% { opacity: 0; transform: translate(${ex.toFixed(2)}px,${ey.toFixed(2)}px) scale(0.3); }\n` +
        `  100% { opacity: 0; transform: translate(${ex.toFixed(2)}px,${ey.toFixed(2)}px) scale(0.3); }\n` +
        `}\n`;
      sparkEls += `<line x1="0" y1="0" x2="${(ex * 0.35).toFixed(2)}" y2="${(ey * 0.35).toFixed(2)}" stroke="#${accent}" stroke-width="1" stroke-linecap="round" style="animation: ${sName} ${CYCLE}s linear infinite; opacity:0;"/>\n`;
    }

    craterEls += `<g transform="translate(${d.tx},${d.ty})">\n` +
      `<circle r="${(craterR * 2.2).toFixed(2)}" fill="#fff5e0" style="animation: ${fName} ${CYCLE}s linear infinite; opacity:0;"/>\n` +
      `<g style="animation: ${cName} ${CYCLE}s linear infinite; opacity:0;">\n` +
      `<circle r="${craterR.toFixed(2)}" fill="${LEVEL_COLOR[d.level]}" stroke="#00000055" stroke-width="0.6"/>\n` +
      `<circle r="${(craterR * 0.45).toFixed(2)}" fill="#00000030"/>\n` +
      `</g>\n` +
      sparkEls +
      `</g>\n`;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${g.width}" height="${g.height}" viewBox="0 0 ${g.width} ${g.height}">
<defs>
<linearGradient id="cometTrail" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0%" stop-color="#fff5e0"/>
  <stop offset="100%" stop-color="#fff5e0" stop-opacity="0"/>
</linearGradient>
</defs>
<style>
rect { shape-rendering: crispEdges; }
${meteorKeyframes}
</style>
<rect width="${g.width}" height="${g.height}" fill="${bg}"/>
${starEls}
${cellRects}
${craterEls}
${meteorEls}
</svg>`;
}
