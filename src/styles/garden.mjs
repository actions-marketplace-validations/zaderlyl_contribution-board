// Style "garden" : toute la grille devient un carré de terre. Chaque jour
// pousse une plante différente selon son niveau d'activité (le même
// quartile que GitHub utilise pour colorer sa propre grille) — rien pour un
// jour sans commit (juste de la terre), de l'herbe pour "presque rien",
// puis fleur et enfin arbre pour les plus gros jours. Les plantes poussent
// dans l'ordre chronologique (comme un vrai jardin sur la saison), tiennent
// en pleine floraison, puis se fanent d'un coup avant que la boucle
// recommence.

import { gridGeometry } from "../lib/contributions.mjs";

export const meta = {
  id: "garden",
  label: "Commit Garden",
  description: "Un jardin où chaque jour actif fait pousser une plante différente selon son niveau d'activité — de l'herbe pour presque rien jusqu'à l'arbre pour les plus gros jours, sur un lit de terre.",
};

// Un quartile GitHub -> une plante. Même logique de paliers que la marée,
// mais indexée sur `level` plutôt que sur des seuils de commits arbitraires
// (le quartile est déjà relatif à l'activité réelle de l'utilisateur).
const TIERS = {
  FIRST_QUARTILE: { icon: "🌿", scale: 0.75 },
  SECOND_QUARTILE: { icon: "🌷", scale: 0.9 },
  THIRD_QUARTILE: { icon: "🌻", scale: 1.05 },
  FOURTH_QUARTILE: { icon: "🌳", scale: 1.2 },
};

// Petit hash déterministe (0..1), même recette que le style meteor — sert
// juste à varier la teinte de terre case par case, sans dépendre du hasard.
function hash(n) {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967295;
}
const DIRT_COLORS = ["#4a3420", "#42301d", "#3a2a19"];

export function render(days, opts = {}) {
  const bg = opts.background ?? "#0d1117";
  const CYCLE = opts.cycle ?? 16;
  const GROW_END = 0.62;  // fin de la pousse (toutes les plantes ont poussé)
  const HOLD_END = 0.85;  // jardin en pleine floraison
  const WILT_END = 0.97;  // fané, juste avant que la boucle reparte

  const g = gridGeometry(days, { top: 8, left: 8, right: 8, bottom: 8 });

  // Terre : toute la grille, pas seulement les jours actifs — c'est le lit
  // du jardin sur lequel les plantes poussent.
  let soilRects = "";
  days.forEach((d) => {
    const color = DIRT_COLORS[Math.floor(hash(d.col * 31 + d.row) * DIRT_COLORS.length)];
    soilRects += `<rect x="${g.cellX(d.col)}" y="${g.cellY(d.row)}" width="${g.CELL}" height="${g.CELL}" rx="2" fill="${color}"/>\n`;
  });

  // Ordre chronologique (semaine puis jour) : le jardin pousse comme sur
  // une vraie saison, de la plus vieille à la plus récente contribution.
  const ordered = days
    .filter((d) => TIERS[d.level])
    .sort((a, b) => a.col - b.col || a.row - b.row);
  const n = ordered.length;
  const growSpan = GROW_END / Math.max(n, 1);
  const growDur = Math.min(0.03, Math.max(0.006, growSpan * 0.8));

  let plantEls = "", plantKeyframes = "";
  ordered.forEach((d, i) => {
    const tier = TIERS[d.level];
    const name = `plant${i}`;
    const cx = g.cellX(d.col) + g.CELL / 2;
    const cy = g.cellY(d.row) + g.CELL / 2;
    const growStart = (i / n) * GROW_END;
    const growEnd = growStart + growDur;
    plantKeyframes += `@keyframes ${name} {\n` +
      `  0% { opacity: 0; transform: scale(0.25); }\n` +
      `  ${(growStart * 100).toFixed(3)}% { opacity: 0; transform: scale(0.25); }\n` +
      `  ${(growEnd * 100).toFixed(3)}% { opacity: 1; transform: scale(1); }\n` +
      `  ${(HOLD_END * 100).toFixed(3)}% { opacity: 1; transform: scale(1); }\n` +
      `  ${(WILT_END * 100).toFixed(3)}% { opacity: 0; transform: scale(0.25); }\n` +
      `  100% { opacity: 0; transform: scale(0.25); }\n` +
      `}\n`;
    plantEls += `<text x="${cx}" y="${cy}" font-size="${(g.CELL * tier.scale).toFixed(1)}" text-anchor="middle" dominant-baseline="central" style="animation: ${name} ${CYCLE}s linear infinite; opacity:0;">${tier.icon}</text>\n`;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${g.width}" height="${g.height}" viewBox="0 0 ${g.width} ${g.height}">
<style>
rect { shape-rendering: crispEdges; }
text { font-family: -apple-system, "Apple Color Emoji", "Segoe UI Emoji", sans-serif; transform-box: fill-box; transform-origin: center; }
${plantKeyframes}
</style>
<rect width="${g.width}" height="${g.height}" fill="${bg}"/>
${soilRects}
${plantEls}
</svg>`;
}
