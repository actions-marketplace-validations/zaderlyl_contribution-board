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
  const CYCLE = opts.cycle ?? 9;
  const ACTIVE_SPAN = CYCLE * 0.92;
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

  // Étoiles décoratives dispersées derrière la grille, avec un léger
  // scintillement (quelques variantes de keyframes partagées entre toutes
  // les étoiles pour ne pas alourdir le fichier).
  const TWINKLE_VARIANTS = 4;
  let starEls = "", twinkleKeyframes = "";
  for (let v = 0; v < TWINKLE_VARIANTS; v++) {
    const lo = 0.1 + hash(v * 97 + 1) * 0.15;
    const hi = 0.55 + hash(v * 97 + 2) * 0.35;
    const peak = 30 + hash(v * 97 + 3) * 40;
    twinkleKeyframes += `@keyframes twinkle${v} {\n` +
      `  0% { opacity: ${lo.toFixed(1)}; }\n` +
      `  ${peak.toFixed(1)}% { opacity: ${hi.toFixed(1)}; }\n` +
      `  100% { opacity: ${lo.toFixed(1)}; }\n` +
      `}\n`;
  }
  for (let i = 0; i < 28; i++) {
    const sx = hash(i * 17 + 3) * g.width;
    const sy = hash(i * 29 + 11) * (g.PAD_TOP + g.gridHeight);
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

  // Intensité : plus il y a de commits ce jour-là, plus le météore et son
  // cratère sont gros (dans l'esprit des trouvailles de "tide" selon le
  // nombre de commits, mais ici en taille d'impact plutôt qu'en rareté).
  const maxCount = Math.max(1, ...activeDays.map((d) => d.count));
  const sizeFor = (count) => 0.75 + Math.sqrt(count / maxCount) * 0.65;

  let meteorEls = "", craterEls = "", meteorKeyframes = "";

  activeDays.forEach((d, i) => {
    const seed = d.col * 131 + d.row * 7 + i;
    const sizeMul = sizeFor(d.count);
    const fallDistance = d.ty - FALL_START_Y;
    const dxDrift = (hash(seed * 3 + 1) - 0.5) * g.CELL * 3.2;
    const fallFrac = 0.025 + hash(seed * 5 + 2) * 0.03;
    const fallDur = CYCLE * fallFrac;

    const arrive = pct(d.t);
    const startPct = Math.max(0, pct(d.t) - pct(fallDur));
    const gone = Math.min(100, arrive + EPS * 2);

    // Traînée : vecteur de déplacement pendant la chute, queue vers l'arrière.
    const vx = -dxDrift, vy = fallDistance;
    const vlen = Math.max(1, Math.hypot(vx, vy));
    const ux = vx / vlen, uy = vy / vlen;
    const tailLen = 7 + hash(seed * 13 + 4) * 5;
    const tailX = (-ux * tailLen).toFixed(1);
    const tailY = (-uy * tailLen).toFixed(1);

    const mName = `meteor${i}`;
    const cName = `crater${i}`;
    const fName = `flash${i}`;

    meteorKeyframes += `@keyframes ${mName} {\n` +
      `  0% { opacity: 0; transform: translate(${dxDrift.toFixed(1)}px,0px) scale(0.4); }\n` +
      `  ${startPct.toFixed(1)}% { opacity: 0; transform: translate(${dxDrift.toFixed(1)}px,0px) scale(0.4); }\n` +
      `  ${Math.min(startPct + EPS, arrive).toFixed(1)}% { opacity: 1; transform: translate(${dxDrift.toFixed(1)}px,0px) scale(0.6); }\n` +
      `  ${arrive.toFixed(1)}% { opacity: 1; transform: translate(0px,${fallDistance.toFixed(1)}px) scale(1); }\n` +
      `  ${gone.toFixed(1)}% { opacity: 0; transform: translate(0px,${fallDistance.toFixed(1)}px) scale(1); }\n` +
      `  100% { opacity: 0; transform: translate(0px,${fallDistance.toFixed(1)}px) scale(1); }\n` +
      `}\n`;

    const headR = 1.5 + sizeMul * 0.6;
    meteorEls += `<g transform="translate(${d.tx},${FALL_START_Y})">\n` +
      `<g class="meteor" style="animation: ${mName} ${CYCLE}s linear infinite; opacity:0; transform-origin: 0px 0px;">\n` +
      `<line x1="0" y1="0" x2="${tailX}" y2="${tailY}" stroke="url(#cometTrail)" stroke-width="${(1.1 + sizeMul * 0.6).toFixed(1)}" stroke-linecap="round"/>\n` +
      `<circle cx="0" cy="0" r="${(headR * 1.8).toFixed(1)}" fill="url(#cometGlow)"/>\n` +
      `<circle cx="0" cy="0" r="${headR.toFixed(1)}" fill="#fff5e0"/>\n` +
      `<circle cx="0" cy="0" r="${(headR * 0.5).toFixed(1)}" fill="#${accent}"/>\n` +
      `</g>\n</g>\n`;

    // Cratère persistant + flash + onde de choc + éclat de particules qui se dissipent.
    const craterR = g.CELL * 0.42 * sizeMul;
    const popMid = Math.min(100, arrive + EPS);
    const popEnd = Math.min(100, arrive + EPS * 3);
    const flashEnd = Math.min(100, arrive + pct(CYCLE * 0.05));

    meteorKeyframes += `@keyframes ${cName} {\n` +
      `  0% { opacity: 0; transform: scale(0.3); }\n` +
      `  ${arrive.toFixed(1)}% { opacity: 0; transform: scale(0.3); }\n` +
      `  ${popMid.toFixed(1)}% { opacity: 1; transform: scale(1.25); }\n` +
      `  ${popEnd.toFixed(1)}% { opacity: 1; transform: scale(1); }\n` +
      `  100% { opacity: 1; transform: scale(1); }\n` +
      `}\n`;
    meteorKeyframes += `@keyframes ${fName} {\n` +
      `  0% { opacity: 0; transform: scale(0.2); }\n` +
      `  ${arrive.toFixed(1)}% { opacity: 0; transform: scale(0.2); }\n` +
      `  ${popMid.toFixed(1)}% { opacity: 0.9; transform: scale(1.1); }\n` +
      `  ${flashEnd.toFixed(1)}% { opacity: 0; transform: scale(2.4); }\n` +
      `  100% { opacity: 0; transform: scale(2.4); }\n` +
      `}\n`;
    let sparkEls = "";
    const sparkCount = d.count >= maxCount * 0.6 ? 5 : 3;
    for (let s = 0; s < sparkCount; s++) {
      const sSeed = seed * 7 + s * 19 + 31;
      const angle = (s / sparkCount) * Math.PI * 2 + (hash(sSeed) - 0.5) * 0.9;
      const dist = craterR * (1.6 + hash(sSeed * 2) * 1.4);
      const ex = Math.cos(angle) * dist, ey = Math.sin(angle) * dist;
      const sparkEnd = Math.min(100, arrive + pct(CYCLE * (0.04 + hash(sSeed * 3) * 0.03)));
      const sName = `spark${i}_${s}`;
      meteorKeyframes += `@keyframes ${sName} {\n` +
        `  0% { opacity: 0; transform: translate(0px,0px) scale(1); }\n` +
        `  ${arrive.toFixed(1)}% { opacity: 0; transform: translate(0px,0px) scale(1); }\n` +
        `  ${popMid.toFixed(1)}% { opacity: 1; transform: translate(0px,0px) scale(1); }\n` +
        `  ${sparkEnd.toFixed(1)}% { opacity: 0; transform: translate(${ex.toFixed(1)}px,${ey.toFixed(1)}px) scale(0.3); }\n` +
        `  100% { opacity: 0; transform: translate(${ex.toFixed(1)}px,${ey.toFixed(1)}px) scale(0.3); }\n` +
        `}\n`;
      sparkEls += `<line x1="0" y1="0" x2="${(ex * 0.35).toFixed(1)}" y2="${(ey * 0.35).toFixed(1)}" stroke="#${accent}" stroke-width="1" stroke-linecap="round" style="animation: ${sName} ${CYCLE}s linear infinite; opacity:0;"/>\n`;
    }

    craterEls += `<g transform="translate(${d.tx},${d.ty})">\n` +
      `<circle r="${(craterR * 2.2).toFixed(1)}" fill="#fff5e0" style="animation: ${fName} ${CYCLE}s linear infinite; opacity:0;"/>\n` +
      `<circle r="${(craterR * 1.6).toFixed(1)}" fill="none" stroke="#${accent}" stroke-width="0.8" style="animation: ${fName} ${CYCLE}s linear infinite; opacity:0;"/>\n` +
      `<g style="animation: ${cName} ${CYCLE}s linear infinite; opacity:0;">\n` +
      `<circle r="${craterR.toFixed(1)}" fill="${LEVEL_COLOR[d.level]}" stroke="#00000055" stroke-width="0.6"/>\n` +
      `<circle r="${(craterR * 0.45).toFixed(1)}" fill="#00000030"/>\n` +
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
<radialGradient id="cometGlow">
  <stop offset="0%" stop-color="#fff5e0" stop-opacity="0.55"/>
  <stop offset="100%" stop-color="#fff5e0" stop-opacity="0"/>
</radialGradient>
</defs>
<style>
rect { shape-rendering: crispEdges; }
${twinkleKeyframes}
${meteorKeyframes}
</style>
<rect width="${g.width}" height="${g.height}" fill="${bg}"/>
${starEls}
${cellRects}
${craterEls}
${meteorEls}
</svg>`;
}
