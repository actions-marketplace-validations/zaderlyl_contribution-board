// Style "laser" : un rayon ancré au coin en haut à gauche de la grille
// traite les colonnes une par une, de la plus récente (droite) à la plus
// ancienne (gauche). Sur chaque colonne, il oscille seulement entre l'angle
// de son jour actif le plus haut et celui du plus bas — pas un grand
// balayage 0°→90° à chaque fois. Le sens alterne d'une colonne à l'autre
// (aller : haut vers bas : retour : bas vers haut ; etc.), ce qui enchaîne
// naturellement les colonnes sans revenir sur ses pas. Un jour touché
// devient un carré plein qui reste rempli jusqu'à la fin du passage sur
// toutes les colonnes actives ; tout se réinitialise alors et ça reboucle.

import { LEVEL_COLOR, gridGeometry } from "../lib/contributions.mjs";

export const meta = {
  id: "laser",
  label: "Commit Laser",
  description: "Un rayon ancré en haut à gauche traite chaque colonne active une par une (droite à gauche), en oscillant sur sa plage d'angle ; chaque jour touché devient un carré plein qui reste rempli jusqu'à la fin du passage.",
};

const ANG_SPEED = 60;   // deg/s, vitesse de rotation constante (colonne et transition)
const MIN_DWELL = 0.18; // s, temps minimum sur une colonne à un seul jour actif (sinon instantané)
const HOLD = 0.6;       // s, pause une fois toutes les colonnes traitées
const RESET_DUR = 0.35; // s, retour à l'état de départ avant la boucle

export function render(days, opts = {}) {
  const accent = `#${(opts.accent ?? "ff3b3b").replace(/^#/, "")}`;
  const bg = opts.background ?? "#0d1117";

  const g = gridGeometry(days, { top: 8, left: 8, right: 8, bottom: 8 });
  const OX = g.PAD_LEFT, OY = g.PAD_TOP;
  const beamLen = Math.hypot(g.gridWidth, g.gridHeight) + 12;

  let cellRects = "";
  days.forEach((d) => {
    cellRects += `<rect x="${g.cellX(d.col)}" y="${g.cellY(d.row)}" width="${g.CELL}" height="${g.CELL}" rx="2" fill="#161b22"/>\n`;
  });

  const angleOf = (d) => Math.atan2(g.cellY(d.row) + g.CELL / 2 - OY, g.cellX(d.col) + g.CELL / 2 - OX) * (180 / Math.PI);

  // Regroupe les jours actifs par colonne, colonnes triées droite -> gauche.
  const byCol = new Map();
  days.filter((d) => d.count > 0).forEach((d) => {
    if (!byCol.has(d.col)) byCol.set(d.col, []);
    byCol.get(d.col).push(d);
  });
  const cols = [...byCol.keys()].sort((a, b) => b - a);

  if (cols.length === 0) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${g.width}" height="${g.height}" viewBox="0 0 ${g.width} ${g.height}"><rect width="${g.width}" height="${g.height}" fill="${bg}"/>${cellRects}</svg>`;
  }

  // Pour chaque colonne : plage d'angle (min = jour le plus haut, max = le
  // plus bas — l'angle croît avec la ligne, à colonne fixe) et sens de
  // parcours alterné (aller = croissant, retour = décroissant).
  const columns = cols.map((col, i) => {
    const dayAngles = byCol.get(col).map((d) => ({ d, a: angleOf(d) }));
    const minA = Math.min(...dayAngles.map((x) => x.a));
    const maxA = Math.max(...dayAngles.map((x) => x.a));
    const forward = i % 2 === 0; // aller (haut->bas) sur les colonnes paires, retour sinon
    return { col, dayAngles, minA, maxA, start: forward ? minA : maxA, end: forward ? maxA : minA };
  });

  // Timeline absolue (s) : chaque colonne prend son temps proportionnel à
  // sa propre plage d'angle, chaque transition entre deux colonnes prend un
  // temps proportionnel à l'écart réel entre elles — même vitesse angulaire
  // partout, donc rien ne "saute" instantanément (même leçon que le bug de
  // vague de garden).
  let t = 0;
  columns.forEach((c, i) => {
    c.segStart = t;
    const range = Math.abs(c.end - c.start);
    c.dur = Math.max(MIN_DWELL, range / ANG_SPEED);
    t += c.dur;
    if (i < columns.length - 1) {
      const nextStart = columns[i + 1].start;
      c.transDur = Math.abs(nextStart - c.end) / ANG_SPEED;
      t += c.transDur;
    }
  });
  const sweepEnd = t;
  const holdEnd = sweepEnd + HOLD;
  const cycleEnd = holdEnd + RESET_DUR;
  const pct = (s) => ((s / cycleEnd) * 100).toFixed(3);

  // Le rayon : une seule animation qui visite chaque colonne dans l'ordre.
  let beamKf = `0% { transform: rotate(${columns[0].start.toFixed(2)}deg); }\n`;
  columns.forEach((c, i) => {
    beamKf += `${pct(c.segStart)}% { transform: rotate(${c.start.toFixed(2)}deg); animation-timing-function: linear; }\n`;
    beamKf += `${pct(c.segStart + c.dur)}% { transform: rotate(${c.end.toFixed(2)}deg); animation-timing-function: linear; }\n`;
  });
  beamKf += `${pct(holdEnd)}% { transform: rotate(${columns[columns.length - 1].end.toFixed(2)}deg); animation-timing-function: ease-in-out; }\n`;
  beamKf += `100% { transform: rotate(${columns[0].start.toFixed(2)}deg); }\n`;

  // Chaque jour devient un carré plein pile quand le rayon atteint son
  // angle dans le segment de sa colonne, et le reste jusqu'à la remise à
  // zéro finale.
  let fillEls = "", keyframes = "";
  let idx = 0;
  columns.forEach((c) => {
    c.dayAngles.forEach(({ d, a }) => {
      const frac = c.end === c.start ? 0 : (a - c.start) / (c.end - c.start);
      const touchAt = c.segStart + frac * c.dur;
      const name = `fill${idx++}`;
      const color = LEVEL_COLOR[d.level] ?? accent;
      keyframes += `@keyframes ${name} {
  0% { opacity: 0; transform: scale(0.3); }
  ${pct(touchAt)}% { opacity: 0; transform: scale(0.3); animation-timing-function: ease-out; }
  ${pct(Math.min(cycleEnd, touchAt + 0.08))}% { opacity: 1; transform: scale(1.25); }
  ${pct(Math.min(cycleEnd, touchAt + 0.16))}% { opacity: 1; transform: scale(1); }
  ${pct(holdEnd)}% { opacity: 1; transform: scale(1); }
  ${pct(cycleEnd)}% { opacity: 0; transform: scale(0.3); animation-timing-function: ease-in; }
  100% { opacity: 0; transform: scale(0.3); }
}\n`;
      fillEls += `<rect x="${g.cellX(d.col).toFixed(1)}" y="${g.cellY(d.row).toFixed(1)}" width="${g.CELL}" height="${g.CELL}" rx="2" fill="${color}" ` +
        `style="animation: ${name} ${cycleEnd.toFixed(2)}s linear infinite; transform-box: fill-box; transform-origin: center;"/>\n`;
    });
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${g.width}" height="${g.height}" viewBox="0 0 ${g.width} ${g.height}">
<style>
rect { shape-rendering: crispEdges; }
@keyframes beam { ${beamKf} }
${keyframes}
</style>
<rect width="${g.width}" height="${g.height}" fill="${bg}"/>
${cellRects}
${fillEls}
<g style="animation: beam ${cycleEnd.toFixed(2)}s linear infinite; transform-origin: ${OX}px ${OY}px;">
  <line x1="${OX}" y1="${OY}" x2="${(OX + beamLen).toFixed(1)}" y2="${OY}" stroke="${accent}" stroke-width="3" stroke-opacity="0.18" stroke-linecap="round"/>
  <line x1="${OX}" y1="${OY}" x2="${(OX + beamLen).toFixed(1)}" y2="${OY}" stroke="${accent}" stroke-width="1" stroke-opacity="0.9" stroke-linecap="round"/>
</g>
<circle cx="${OX}" cy="${OY}" r="2.4" fill="${accent}"/>
</svg>`;
}
