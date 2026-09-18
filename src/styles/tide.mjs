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

function foamPath(height, amp = 3, period = 16) {
  let d = `M0,0`;
  let y = 0, side = 1;
  while (y < height) {
    const ny = Math.min(height, y + period / 2);
    d += ` Q${side * amp},${(y + ny) / 2} 0,${ny}`;
    y = ny;
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

  // Eau : dégradé (plus clair en surface) + bord d'écume ondulé qui suit
  // exactement le même déplacement que le corps de l'eau (translateX avec
  // les mêmes paliers horaires), plutôt qu'un simple aplat à bord droit.
  const waterKeyframes = `@keyframes tideWidth {
  0% { width: 0px; }
  ${pct(ADVANCE_END).toFixed(2)}% { width: ${g.gridWidth}px; }
  ${pct(HOLD_END).toFixed(2)}% { width: ${g.gridWidth}px; }
  ${pct(RECEDE_END).toFixed(2)}% { width: 0px; }
  100% { width: 0px; }
}
@keyframes foamMove {
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
</defs>
<rect x="${g.PAD_LEFT}" y="${g.PAD_TOP}" width="0" height="${g.gridHeight}" fill="url(#waterGrad)" opacity="0.68" style="animation: tideWidth ${CYCLE}s linear infinite;"/>
<g transform="translate(${g.PAD_LEFT},${g.PAD_TOP})" style="animation: foamMove ${CYCLE}s linear infinite;">
  <path d="${foamPath(g.gridHeight)}" fill="none" stroke="#dff3fa" stroke-width="1.6" opacity="0.75"/>
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
