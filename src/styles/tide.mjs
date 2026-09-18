// Style "tide" : une nappe d'eau ancrée à gauche avance vers la droite,
// couvre toute la grille, puis se retire vers la gauche. En se retirant,
// elle révèle un coquillage sur chaque case où un commit a eu lieu ce
// jour-là (les colonnes de droite — les plus récentes — se découvrent en
// premier, comme une vraie marée qui descend).

import { LEVEL_COLOR, gridGeometry } from "../lib/contributions.mjs";

export const meta = {
  id: "tide",
  label: "Commit Tide",
  description: "Une marée qui avance, recouvre la grille, puis se retire en laissant un coquillage sur chaque commit.",
};

export function render(days, opts = {}) {
  const bg = opts.background ?? "#0d1117";
  const CYCLE = opts.cycle ?? 14;
  const EPS = 0.05;

  // Phases, en fraction du cycle.
  const ADVANCE_END = 0.30;
  const HOLD_END = 0.38;
  const RECEDE_END = 0.92;
  const RECEDE_DUR = (RECEDE_END - HOLD_END) * CYCLE;

  const g = gridGeometry(days, { top: 8, left: 8, right: 8, bottom: 8 });
  const pct = (frac) => frac * 100;

  const activeDays = days.filter((d) => d.count > 0);
  activeDays.forEach((d) => {
    const cx = g.cellX(d.col) + g.CELL / 2;
    const w = cx - g.PAD_LEFT; // largeur d'eau à laquelle le bord découvre cette colonne
    const revealFrac = HOLD_END + (RECEDE_DUR / CYCLE) * (1 - w / g.gridWidth);
    d.revealPct = pct(revealFrac);
  });

  const waterKeyframes = `@keyframes tideWidth {
  0% { width: 0px; }
  ${pct(ADVANCE_END).toFixed(2)}% { width: ${g.gridWidth}px; }
  ${pct(HOLD_END).toFixed(2)}% { width: ${g.gridWidth}px; }
  ${pct(RECEDE_END).toFixed(2)}% { width: 0px; }
  100% { width: 0px; }
}`;

  let cellRects = "";
  days.forEach((d) => {
    cellRects += `<rect x="${g.cellX(d.col)}" y="${g.cellY(d.row)}" width="${g.CELL}" height="${g.CELL}" rx="2" fill="${LEVEL_COLOR.NONE}"/>\n`;
  });

  let shellEls = "", shellKeyframes = "";
  activeDays.forEach((d, i) => {
    const name = `shell${i}`;
    const cx = g.cellX(d.col) + g.CELL / 2;
    const cy = g.cellY(d.row) + g.CELL / 2;
    const revealAt = d.revealPct;
    // Taille/opacité de base légèrement variables selon l'intensité du jour.
    const scale = { NONE: 0.7, FIRST_QUARTILE: 0.8, SECOND_QUARTILE: 0.9, THIRD_QUARTILE: 1, FOURTH_QUARTILE: 1.1 }[d.level] ?? 1;
    shellKeyframes += `@keyframes ${name} {\n` +
      `  0% { opacity: 0; }\n` +
      `  ${Math.max(0, revealAt - EPS).toFixed(3)}% { opacity: 0; }\n` +
      `  ${revealAt.toFixed(3)}% { opacity: 1; }\n` +
      `  100% { opacity: 1; }\n` +
      `}\n`;
    shellEls += `<text x="${cx}" y="${cy}" font-size="${(g.CELL * scale).toFixed(1)}" text-anchor="middle" dominant-baseline="central" style="animation: ${name} ${CYCLE}s linear infinite; opacity:0;">🐚</text>\n`;
  });

  const waterSvg = `<rect x="${g.PAD_LEFT}" y="${g.PAD_TOP}" width="0" height="${g.gridHeight}" fill="#2d6a8f" opacity="0.55" style="animation: tideWidth ${CYCLE}s linear infinite;"/>`;

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
