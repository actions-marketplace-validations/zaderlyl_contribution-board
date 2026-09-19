// Style "laser" : un rayon ancré au coin en haut à gauche de la grille
// traite les colonnes une par une, de la plus récente (droite) à la plus
// ancienne (gauche). Sur chaque colonne, il glisse sur ses jours actifs
// dans l'ordre (haut vers bas sur les colonnes "aller", bas vers haut sur
// les colonnes "retour" — le sens alterne d'une colonne à l'autre), sans
// jamais s'arrêter — juste le contact suffit. Un jour touché devient un
// carré plein qui reste rempli jusqu'à la fin du passage sur toutes les
// colonnes actives ; tout se réinitialise alors et ça reboucle.

import { LEVEL_COLOR, gridGeometry } from "../lib/contributions.mjs";

export const meta = {
  id: "laser",
  label: "Commit Laser",
  description: "Un rayon ancré en haut à gauche glisse sur chaque colonne active (droite à gauche) sans s'arrêter ; un jour touché au passage devient un carré plein qui reste rempli jusqu'à la fin du passage.",
};

const ANG_SPEED = 12;  // deg/s, vitesse de rotation constante (pas d'arrêt, juste un passage)
const HOLD = 0.6;      // s, pause une fois tous les commits traités
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

  const angleOf = (d) => Math.atan2(g.cellY(d.row) + g.CELL / 2 - OY, g.cellX(d.col) + g.CELL / 2 - OX) * (180 / Math.PI);
  // Distance du coin d'origine au bord proche de la case (pas son centre) :
  // le rayon doit se cogner contre le commit, pas le transpercer jusqu'au milieu.
  const distOf = (d) => Math.hypot(g.cellX(d.col) + g.CELL / 2 - OX, g.cellY(d.row) + g.CELL / 2 - OY) - g.CELL * 0.5;

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

  // Ordre de visite complet : colonne par colonne (droite à gauche), et à
  // l'intérieur de chaque colonne, du haut vers le bas sur les colonnes
  // "aller" (paires), du bas vers le haut sur les "retour" (impaires) — ça
  // enchaîne les colonnes sans jamais revenir sur ses pas.
  const ordered = [];
  cols.forEach((col, i) => {
    const dayAngles = byCol.get(col).map((d) => ({ d, a: angleOf(d) }));
    dayAngles.sort((x, y) => (i % 2 === 0 ? x.a - y.a : y.a - x.a));
    ordered.push(...dayAngles);
  });
  const n = ordered.length;
  const angles = ordered.map((x) => x.a);
  const dists = ordered.map((x) => distOf(x.d));
  const maxDist = Math.max(...dists, 1);

  // Timeline absolue (s) : le rayon glisse d'une cible à la suivante à
  // vitesse angulaire constante, sans jamais s'arrêter — le temps entre
  // deux touches est proportionnel à la vraie distance angulaire (même
  // leçon que le bug de vague de garden : un pas ne doit pas valoir un
  // temps fixe si les écarts réels varient), que la cible suivante soit
  // dans la même colonne ou dans la suivante.
  const arrival = [0];
  for (let i = 1; i < n; i++) {
    const travel = Math.abs(angles[i] - angles[i - 1]) / ANG_SPEED;
    arrival.push(arrival[i - 1] + travel);
  }
  const holdEnd = arrival[n - 1] + HOLD;
  const returnTravel = Math.abs(angles[0] - angles[n - 1]) / ANG_SPEED;
  const cycleEnd = holdEnd + Math.max(RESET_DUR, returnTravel);
  const pct = (s) => ((s / cycleEnd) * 100).toFixed(3);

  // Le rayon : une seule animation qui glisse sur chaque cible dans
  // l'ordre (sa longueur se cale sur la distance réelle à la cible visée,
  // il ne la transperce pas), en douceur (ease-in-out) entre chaque point,
  // puis revient à son point de départ pour reboucler.
  const xf = (i) => `rotate(${angles[i].toFixed(2)}deg) scaleX(${(dists[i] / maxDist).toFixed(4)})`;
  let beamKf = `0% { transform: ${xf(0)}; animation-timing-function: ease-in-out; }\n`;
  for (let i = 0; i < n; i++) {
    beamKf += `${pct(arrival[i])}% { transform: ${xf(i)}; animation-timing-function: ease-in-out; }\n`;
  }
  beamKf += `${pct(holdEnd)}% { transform: ${xf(n - 1)}; animation-timing-function: ease-in-out; }\n`;
  beamKf += `100% { transform: ${xf(0)}; }\n`;

  // Chaque jour devient un carré plein pile quand le rayon s'arrête dessus,
  // et le reste jusqu'à la remise à zéro finale.
  let fillEls = "", keyframes = "";
  ordered.forEach(({ d, a }, i) => {
    const touchAt = arrival[i];
    const name = `fill${i}`;
    const color = LEVEL_COLOR[d.level] ?? accent;
    keyframes += `@keyframes ${name} {
  0% { opacity: 0; transform: scale(0.3); }
  ${pct(touchAt)}% { opacity: 0; transform: scale(0.3); animation-timing-function: ease-out; }
  ${pct(Math.min(cycleEnd, touchAt + 0.08))}% { opacity: 1; transform: scale(1.25); animation-timing-function: ease-in-out; }
  ${pct(Math.min(cycleEnd, touchAt + 0.18))}% { opacity: 1; transform: scale(1); }
  ${pct(holdEnd)}% { opacity: 1; transform: scale(1); }
  ${pct(cycleEnd)}% { opacity: 0; transform: scale(0.3); animation-timing-function: ease-in; }
  100% { opacity: 0; transform: scale(0.3); }
}\n`;
    fillEls += `<rect x="${g.cellX(d.col).toFixed(1)}" y="${g.cellY(d.row).toFixed(1)}" width="${g.CELL}" height="${g.CELL}" rx="2" fill="${color}" ` +
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
