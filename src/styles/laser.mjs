// Style "laser" : un rayon ancré au coin en haut à gauche de la grille
// pivote en continu de l'horizontale (0°, vers la droite) à la verticale
// (90°, vers le bas) — sans jamais s'arrêter sur un commit. Comme l'angle
// depuis ce coin croît avec la colonne, ça revient à balayer les commits du
// plus récent (droite, angle faible) au plus ancien (gauche, angle élevé).
// Dès qu'un jour actif est touché, sa case devient un carré plein et le
// reste jusqu'à la fin du balayage complet ; à ce moment tout se réinitialise
// (carrés vidés, rayon revenu à 0°) et la boucle recommence.

import { LEVEL_COLOR, gridGeometry } from "../lib/contributions.mjs";

export const meta = {
  id: "laser",
  label: "Commit Laser",
  description: "Un rayon ancré en haut à gauche pivote en continu de l'horizontale à la verticale, du commit le plus récent au plus ancien ; chaque jour touché devient un carré plein qui reste rempli jusqu'à la fin du balayage.",
};

export function render(days, opts = {}) {
  const accent = `#${(opts.accent ?? "ff3b3b").replace(/^#/, "")}`;
  const bg = opts.background ?? "#0d1117";
  const CYCLE = opts.cycle ?? 16;

  const SWEEP_END = 0.72; // fin du pivot 0deg -> 90deg, tous les commits touchés
  const HOLD_END = 0.82;  // pause, tout reste rempli
  const RESET_END = 0.94; // rayon et carrés reviennent à l'état de départ

  const g = gridGeometry(days, { top: 8, left: 8, right: 8, bottom: 8 });
  const OX = g.PAD_LEFT, OY = g.PAD_TOP;
  const beamLen = Math.hypot(g.gridWidth, g.gridHeight) + 12;

  let cellRects = "";
  days.forEach((d) => {
    cellRects += `<rect x="${g.cellX(d.col)}" y="${g.cellY(d.row)}" width="${g.CELL}" height="${g.CELL}" rx="2" fill="#161b22"/>\n`;
  });

  const active = days.filter((d) => d.count > 0);
  let fillEls = "", keyframes = "";
  active.forEach((d, i) => {
    const cx = g.cellX(d.col) + g.CELL / 2;
    const cy = g.cellY(d.row) + g.CELL / 2;
    // Angle depuis le coin d'origine : 0° = horizontale (droite), 90° =
    // verticale (bas) — épouse exactement le pivot.
    const angle = Math.atan2(cy - OY, cx - OX) * (180 / Math.PI);
    const touchAt = (angle / 90) * SWEEP_END;
    const name = `fill${i}`;
    const color = LEVEL_COLOR[d.level] ?? accent;
    const pct = (f) => (f * 100).toFixed(3);

    keyframes += `@keyframes ${name} {
  0% { opacity: 0; transform: scale(0.3); }
  ${pct(touchAt)}% { opacity: 0; transform: scale(0.3); animation-timing-function: ease-out; }
  ${pct(Math.min(1, touchAt + 0.01))}% { opacity: 1; transform: scale(1.25); }
  ${pct(Math.min(1, touchAt + 0.02))}% { opacity: 1; transform: scale(1); }
  ${pct(HOLD_END)}% { opacity: 1; transform: scale(1); }
  ${pct(RESET_END)}% { opacity: 0; transform: scale(0.3); animation-timing-function: ease-in; }
  100% { opacity: 0; transform: scale(0.3); }
}\n`;
    fillEls += `<rect x="${(g.cellX(d.col)).toFixed(1)}" y="${(g.cellY(d.row)).toFixed(1)}" width="${g.CELL}" height="${g.CELL}" rx="2" fill="${color}" ` +
      `style="animation: ${name} ${CYCLE}s linear infinite; transform-box: fill-box; transform-origin: center;"/>\n`;
  });

  // Le rayon : pivote de 0° à 90°, tient la pose une fois arrivé (tout est
  // touché), puis revient vite à 0° pendant que les carrés se vident, avant
  // de reboucler. Halo simulé par un trait large translucide derrière le
  // trait fin opaque (pas de filtre SVG).
  const pct = (f) => (f * 100).toFixed(3);
  const beamKf = `0% { transform: rotate(0deg); }
  ${pct(SWEEP_END)}% { transform: rotate(90deg); animation-timing-function: linear; }
  ${pct(HOLD_END)}% { transform: rotate(90deg); animation-timing-function: ease-in-out; }
  ${pct(RESET_END)}% { transform: rotate(0deg); }
  100% { transform: rotate(0deg); }`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${g.width}" height="${g.height}" viewBox="0 0 ${g.width} ${g.height}">
<style>
rect { shape-rendering: crispEdges; }
@keyframes beam { ${beamKf} }
${keyframes}
</style>
<rect width="${g.width}" height="${g.height}" fill="${bg}"/>
${cellRects}
${fillEls}
<g style="animation: beam ${CYCLE}s linear infinite; transform-origin: ${OX}px ${OY}px;">
  <line x1="${OX}" y1="${OY}" x2="${(OX + beamLen).toFixed(1)}" y2="${OY}" stroke="${accent}" stroke-width="3" stroke-opacity="0.18" stroke-linecap="round"/>
  <line x1="${OX}" y1="${OY}" x2="${(OX + beamLen).toFixed(1)}" y2="${OY}" stroke="${accent}" stroke-width="1" stroke-opacity="0.9" stroke-linecap="round"/>
</g>
<circle cx="${OX}" cy="${OY}" r="2.4" fill="${accent}"/>
</svg>`;
}
