// Style "tide" : une nappe d'eau ancrée à gauche avance vers la droite,
// couvre toute la grille, puis se retire vers la gauche. En se retirant,
// elle révèle une trouvaille de plage sur chaque case où un commit a eu
// lieu ce jour-là (les colonnes de droite — les plus récentes — se
// découvrent en premier, comme une vraie marée qui descend). La trouvaille
// dépend du nombre de commits ce jour-là : plus il y en a, plus rare.

import { gridGeometry } from "../lib/contributions.mjs";

export const meta = {
  id: "tide",
  label: "Commit Tide",
  description: "Une marée qui avance, recouvre la grille, puis se retire en laissant une trouvaille de plage sur chaque commit.",
};

// Paliers : nombre de commits ce jour-là -> { icône, taille relative }.
// Échelle de rareté d'une vraie trouvaille de plage plutôt que juste des
// coquillages différents (l'emoji Unicode n'a qu'un seul coquillage).
const TIERS = [
  { max: 10, icon: "🐚", scale: 0.85 },
  { max: 25, icon: "🦪", scale: 0.95 },
  { max: 50, icon: "🦀", scale: 1.05 },
  { max: Infinity, icon: "🐙", scale: 1.2 },
];
function tierFor(count) {
  return TIERS.find((t) => count < t.max) ?? TIERS.at(-1);
}

// Grandes courbes douces (S-curves) plutôt qu'un zigzag mécanique — c'est
// ce qui fait vraiment "vague" plutôt que "dents de scie". `segments` de
// grandes ondulations sur toute la hauteur, `amp` leur amplitude.
function waveCommands(height, segments = 3, amp = 6) {
  const step = height / segments;
  let d = "";
  let side = -1;
  for (let i = 0; i < segments; i++) {
    const y0 = i * step, y1 = (i + 1) * step;
    const cx = side * amp;
    d += ` C ${cx.toFixed(1)},${(y0 + step * 0.25).toFixed(1)} ${(-cx).toFixed(1)},${(y0 + step * 0.75).toFixed(1)} 0,${y1.toFixed(1)}`;
    side *= -1;
  }
  return d;
}

export function render(days, opts = {}) {
  const bg = opts.background ?? "#0d1117";
  const CYCLE = opts.cycle ?? 14;
  const EPS = 0.05;

  const ADVANCE_END = 0.30;
  const HOLD_END = 0.38;
  const RECEDE_END = 0.92;
  const RECEDE_DUR = (RECEDE_END - HOLD_END) * CYCLE;

  const g = gridGeometry(days, { top: 8, left: 8, right: 8, bottom: 8 });
  const pct = (frac) => frac * 100;

  const activeDays = days.filter((d) => d.count > 0);
  activeDays.forEach((d) => {
    const cx = g.cellX(d.col) + g.CELL / 2;
    const w = cx - g.PAD_LEFT;
    const revealFrac = HOLD_END + (RECEDE_DUR / CYCLE) * (1 - w / g.gridWidth);
    d.revealPct = pct(revealFrac);
    d.tier = tierFor(d.count);
  });

  // Fond (case vide, "sable") — inchangé.
  let cellRects = "";
  days.forEach((d) => {
    cellRects += `<rect x="${g.cellX(d.col)}" y="${g.cellY(d.row)}" width="${g.CELL}" height="${g.CELL}" rx="2" fill="#161b22"/>\n`;
  });

  let shellEls = "", shellKeyframes = "";
  activeDays.forEach((d, i) => {
    const name = `shell${i}`;
    const cx = g.cellX(d.col) + g.CELL / 2;
    const cy = g.cellY(d.row) + g.CELL / 2;
    const revealAt = d.revealPct;
    shellKeyframes += `@keyframes ${name} {\n` +
      `  0% { opacity: 0; }\n` +
      `  ${Math.max(0, revealAt - EPS).toFixed(3)}% { opacity: 0; }\n` +
      `  ${revealAt.toFixed(3)}% { opacity: 1; }\n` +
      `  100% { opacity: 1; }\n` +
      `}\n`;
    shellEls += `<text x="${cx}" y="${cy}" font-size="${(g.CELL * d.tier.scale).toFixed(1)}" text-anchor="middle" dominant-baseline="central" style="animation: ${name} ${CYCLE}s linear infinite; opacity:0;">${d.tier.icon}</text>\n`;
  });

  // Eau : dégradé + un vrai bord de vague (grandes courbes) porté par un
  // seul <g> translaté en X. Le corps de l'eau est un pavé qui déborde très
  // largement à gauche (BULK) pour rester toujours plein derrière le bord,
  // quelle que soit la position du groupe — évite d'avoir à recalculer un
  // path différent à chaque image, un seul déplacement suffit.
  const BULK = 3000;
  const WAVE_AMP = 6;
  const waveCmds = waveCommands(g.gridHeight, 3, WAVE_AMP);
  const bodyPath = `M${-BULK},0 L0,0 ${waveCmds} L${-BULK},${g.gridHeight} Z`;
  const edgePath = `M0,0 ${waveCmds}`;

  const waterKeyframes = `@keyframes tideMove {
  0% { transform: translateX(0px); }
  ${pct(ADVANCE_END).toFixed(2)}% { transform: translateX(${g.gridWidth}px); }
  ${pct(HOLD_END).toFixed(2)}% { transform: translateX(${g.gridWidth}px); }
  ${pct(RECEDE_END).toFixed(2)}% { transform: translateX(0px); }
  100% { transform: translateX(0px); }
}`;

  const waterSvg = `
<defs>
  <linearGradient id="waterGrad" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#5aa9c9"/>
    <stop offset="55%" stop-color="#2d6a8f"/>
    <stop offset="100%" stop-color="#173c52"/>
  </linearGradient>
  <clipPath id="gridClip"><rect x="${g.PAD_LEFT}" y="${g.PAD_TOP - WAVE_AMP}" width="${g.gridWidth + WAVE_AMP}" height="${g.gridHeight + WAVE_AMP * 2}"/></clipPath>
</defs>
<g clip-path="url(#gridClip)">
  <g transform="translate(${g.PAD_LEFT},${g.PAD_TOP})" style="animation: tideMove ${CYCLE}s linear infinite;">
    <path d="${bodyPath}" fill="url(#waterGrad)" opacity="0.75"/>
    <path d="${edgePath}" fill="none" stroke="#eaf7ff" stroke-width="4" stroke-linecap="round" opacity="0.55"/>
    <path d="${edgePath}" fill="none" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round" opacity="0.8"/>
  </g>
</g>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${g.width}" height="${g.height}" viewBox="0 0 ${g.width} ${g.height}">
<style>
rect { shape-rendering: crispEdges; }
text { font-family: -apple-system, "Apple Color Emoji", "Segoe UI Emoji", sans-serif; }
${waterKeyframes}
${shellKeyframes}
</style>
<rect width="${g.width}" height="${g.height}" fill="${bg}"/>
${cellRects}
${shellEls}
${waterSvg}
</svg>`;
}
