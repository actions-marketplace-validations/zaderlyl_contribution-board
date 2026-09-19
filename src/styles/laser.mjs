// Style "laser" : un rayon ancré au coin en haut à gauche de la grille
// traite les colonnes une par une, de la plus récente (droite) à la plus
// ancienne (gauche). Sur chaque colonne, il balaie vraiment les 7 lignes en
// continu (haut vers bas sur les colonnes "aller", bas vers haut sur les
// "retour" — le sens alterne d'une colonne à l'autre), pas seulement les
// lignes actives. Comme un vrai laser : pleine longueur tant qu'il ne
// touche rien, et il se raccourcit pile sur un jour actif (sans le
// transpercer) avant de reprendre sa pleine longueur juste après. Un jour
// touché devient un carré plein qui reste rempli jusqu'à la fin du passage
// sur toutes les colonnes actives ; tout se réinitialise alors et ça
// reboucle.

import { LEVEL_COLOR, gridGeometry } from "../lib/contributions.mjs";

export const meta = {
  id: "laser",
  label: "Commit Laser",
  description: "Un rayon ancré en haut à gauche balaie chaque colonne active ligne par ligne (droite à gauche), pleine longueur tant qu'il ne touche rien, raccourci pile sur les jours actifs qui deviennent alors des carrés pleins.",
};

const ANG_SPEED = 12;   // deg/s, vitesse de rotation constante
const HOLD = 0.6;       // s, pause une fois tous les commits traités
const RESET_DUR = 0.35; // s, retour à l'état de départ avant la boucle

export function render(days, opts = {}) {
  const accent = `#${(opts.accent ?? "ff3b3b").replace(/^#/, "")}`;
  const bg = opts.background ?? "#0d1117";

  const g = gridGeometry(days, { top: 8, left: 8, right: 8, bottom: 8 });
  const OX = g.PAD_LEFT, OY = g.PAD_TOP;

  let cellRects = "";
  days.forEach((d) => {
    cellRects += `<rect x="${g.cellX(d.col)}" y="${g.cellY(d.row)}" width="${g.CELL}" height="${g.CELL}" rx="2" fill="#161b22"/>\n`;
  });

  const angleAt = (x, y) => Math.atan2(y - OY, x - OX) * (180 / Math.PI);

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

  const maxDist = Math.hypot(g.gridWidth, g.gridHeight);
  // Distance de l'origine au bord proche d'une case (pas son centre) : le
  // rayon doit se cogner contre le commit, pas le transpercer.
  const distTo = (cx, cy) => Math.hypot(cx - OX, cy - OY) - g.CELL * 0.5;
  // Distance jusqu'au bord de la grille dans une direction donnée (sort par
  // la droite ou par le bas, selon l'angle) : quand rien ne l'arrête, le
  // rayon s'étire jusqu'au mur, pas jusqu'à une longueur arbitraire.
  const cornerAngle = Math.atan2(g.gridHeight, g.gridWidth) * (180 / Math.PI);
  const boundaryDist = (angleDeg) => {
    const rad = (angleDeg * Math.PI) / 180;
    return angleDeg <= cornerAngle ? g.gridWidth / Math.cos(rad) : g.gridHeight / Math.sin(rad);
  };

  // Empreinte angulaire (depuis l'origine) de chaque jour actif de toute la
  // grille — pas seulement de la colonne en cours : un rayon qui, à un
  // angle donné, ne touche rien dans SA colonne peut quand même être
  // bloqué par un commit d'une colonne plus proche de l'origine qui se
  // trouve pile sur le même angle. Un vrai laser se cogne sur le premier
  // obstacle rencontré, peu importe sa colonne.
  const active = days.filter((d) => d.count > 0);
  const obstacles = active.map((d) => {
    const x0 = g.cellX(d.col), y0 = g.cellY(d.row);
    const corners = [[x0, y0], [x0 + g.CELL, y0], [x0, y0 + g.CELL], [x0 + g.CELL, y0 + g.CELL]];
    const cornerAngles = corners.map(([x, y]) => angleAt(x, y));
    return {
      minA: Math.min(...cornerAngles),
      maxA: Math.max(...cornerAngles),
      dist: distTo(x0 + g.CELL / 2, y0 + g.CELL / 2),
    };
  });
  // Plus proche obstacle (de n'importe quelle colonne) dont l'empreinte
  // couvre cet angle, sinon la distance de repli donnée (le mur, ou le
  // commit de la colonne en cours si elle en a un à cette ligne).
  const nearestBlocker = (angleDeg, fallback) => {
    let best = fallback;
    for (const o of obstacles) {
      if (angleDeg >= o.minA - 1e-6 && angleDeg <= o.maxA + 1e-6 && o.dist < best) best = o.dist;
    }
    return best;
  };

  // Pour chaque colonne active, un point par ligne (0..6), dans l'ordre de
  // balayage de cette colonne (aller = haut->bas, retour = bas->haut). Une
  // ligne sans commit garde la pleine longueur, sauf si un commit d'une
  // colonne plus proche de l'origine se trouve pile sur le même angle (il
  // bloque la vue avant le mur). Une ligne avec un commit vise toujours
  // pile ce commit-là — c'est le point dédié de sa visite, pas la peine de
  // le laisser bloquer par un autre pour cet instant précis.
  const points = []; // { angle, dist, day? }
  cols.forEach((col, ci) => {
    const cx = g.cellX(col) + g.CELL / 2;
    const dayByRow = new Map(byCol.get(col).map((d) => [d.row, d]));
    const rows = ci % 2 === 0 ? [0, 1, 2, 3, 4, 5, 6] : [6, 5, 4, 3, 2, 1, 0];
    rows.forEach((row) => {
      const cy = g.cellY(row) + g.CELL / 2;
      const day = dayByRow.get(row);
      const angle = angleAt(cx, cy);
      const dist = day ? distTo(cx, cy) : nearestBlocker(angle, boundaryDist(angle));
      points.push({ angle, dist, day });
    });
  });
  const n = points.length;

  // Timeline absolue (s) : vitesse angulaire constante entre deux points
  // consécutifs (même leçon que le bug de vague de garden — proportionnel
  // à l'écart réel, pas au rang).
  const arrival = [0];
  for (let i = 1; i < n; i++) {
    const travel = Math.abs(points[i].angle - points[i - 1].angle) / ANG_SPEED;
    arrival.push(arrival[i - 1] + travel);
  }
  const holdEnd = arrival[n - 1] + HOLD;
  const returnTravel = Math.abs(points[0].angle - points[n - 1].angle) / ANG_SPEED;
  const cycleEnd = holdEnd + Math.max(RESET_DUR, returnTravel);
  const pct = (s) => ((s / cycleEnd) * 100).toFixed(3);

  // Le rayon : une seule animation qui balaie chaque ligne de chaque
  // colonne dans l'ordre, sans s'arrêter, puis revient à son point de
  // départ pour reboucler.
  const xf = (i) => `rotate(${points[i].angle.toFixed(2)}deg) scaleX(${(points[i].dist / maxDist).toFixed(4)})`;
  let beamKf = `0% { transform: ${xf(0)}; animation-timing-function: linear; }\n`;
  for (let i = 0; i < n; i++) {
    beamKf += `${pct(arrival[i])}% { transform: ${xf(i)}; animation-timing-function: linear; }\n`;
  }
  beamKf += `${pct(holdEnd)}% { transform: ${xf(n - 1)}; animation-timing-function: ease-in-out; }\n`;
  beamKf += `100% { transform: ${xf(0)}; }\n`;

  // Chaque jour devient un carré plein pile quand le rayon le touche (donc
  // se raccourcit dessus), et le reste jusqu'à la remise à zéro finale.
  let fillEls = "", keyframes = "";
  let idx = 0;
  points.forEach(({ day }, i) => {
    if (!day) return;
    const touchAt = arrival[i];
    const name = `fill${idx++}`;
    const color = LEVEL_COLOR[day.level] ?? accent;
    keyframes += `@keyframes ${name} {
  0% { opacity: 0; transform: scale(0.3); }
  ${pct(touchAt)}% { opacity: 0; transform: scale(0.3); animation-timing-function: ease-out; }
  ${pct(Math.min(cycleEnd, touchAt + 0.08))}% { opacity: 1; transform: scale(1.25); animation-timing-function: ease-in-out; }
  ${pct(Math.min(cycleEnd, touchAt + 0.18))}% { opacity: 1; transform: scale(1); }
  ${pct(holdEnd)}% { opacity: 1; transform: scale(1); }
  ${pct(cycleEnd)}% { opacity: 0; transform: scale(0.3); animation-timing-function: ease-in; }
  100% { opacity: 0; transform: scale(0.3); }
}\n`;
    fillEls += `<rect x="${g.cellX(day.col).toFixed(1)}" y="${g.cellY(day.row).toFixed(1)}" width="${g.CELL}" height="${g.CELL}" rx="2" fill="${color}" ` +
      `style="animation: ${name} ${cycleEnd.toFixed(2)}s linear infinite; transform-box: fill-box; transform-origin: center;"/>\n`;
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
  <line x1="${OX}" y1="${OY}" x2="${(OX + maxDist).toFixed(1)}" y2="${OY}" stroke="${accent}" stroke-width="3" stroke-opacity="0.18" stroke-linecap="round"/>
  <line x1="${OX}" y1="${OY}" x2="${(OX + maxDist).toFixed(1)}" y2="${OY}" stroke="${accent}" stroke-width="1" stroke-opacity="0.9" stroke-linecap="round"/>
</g>
<circle cx="${OX}" cy="${OY}" r="2.4" fill="${accent}"/>
</svg>`;
}
