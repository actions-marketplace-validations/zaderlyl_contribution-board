// Style "laser" : un rayon ancré au coin en haut à gauche de la grille vise
// chaque jour actif un par un, dans l'ordre du plus récent au plus ancien
// (droite à gauche) — pas un balayage libre. Il pivote à vitesse angulaire
// constante vers chaque cible, se colle dessus un instant (elle s'illumine
// pendant ce temps), puis repart vers la suivante. Une fois le plus ancien
// commit touché, il pivote (sans s'arrêter sur rien) pour revenir à son
// point de départ et recommence.

import { LEVEL_COLOR, gridGeometry } from "../lib/contributions.mjs";

export const meta = {
  id: "laser",
  label: "Commit Laser",
  description: "Un rayon ancré en haut à gauche vise chaque jour actif un par un, du plus récent au plus ancien, se colle dessus un instant avant de pivoter vers le suivant.",
};

const STICK = 0.4;     // s, temps où le rayon reste collé sur une cible
const ANG_SPEED = 70;  // deg/s, vitesse de rotation constante entre deux cibles

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

  // Ordre de visite : droite à gauche (colonne décroissante), donc du plus
  // récent au plus ancien.
  const ordered = days.filter((d) => d.count > 0).sort((a, b) => b.col - a.col || b.row - a.row);
  const n = ordered.length;

  if (n === 0) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${g.width}" height="${g.height}" viewBox="0 0 ${g.width} ${g.height}"><rect width="${g.width}" height="${g.height}" fill="${bg}"/>${cellRects}</svg>`;
  }

  const angle = (d) => Math.atan2(g.cellY(d.row) + g.CELL / 2 - OY, g.cellX(d.col) + g.CELL / 2 - OX) * (180 / Math.PI);
  const angles = ordered.map(angle);

  // Timeline absolue (en secondes) : arrivée sur la cible i, temps collé,
  // puis trajet vers i+1 à vitesse angulaire constante — donc proportionnel
  // à la vraie distance angulaire, pas au rang (même leçon que le bug de
  // vague de garden : une étape ne doit pas valoir un temps fixe si les
  // écarts réels varient).
  const arrival = [0];
  for (let i = 1; i < n; i++) {
    const travel = Math.abs(angles[i] - angles[i - 1]) / ANG_SPEED;
    arrival.push(arrival[i - 1] + STICK + travel);
  }
  const lastStickEnd = arrival[n - 1] + STICK;
  const returnTravel = Math.abs(angles[0] - angles[n - 1]) / ANG_SPEED;
  const CYCLE_DUR = lastStickEnd + returnTravel;
  const pct = (s) => ((s / CYCLE_DUR) * 100).toFixed(3);

  // Le rayon : une seule animation qui visite chaque angle dans l'ordre,
  // avec un petit ease en entrée/sortie de chaque arrêt pour un effet
  // "accroche" plutôt qu'un pivot parfaitement mécanique.
  let beamKf = `0% { transform: rotate(${angles[0].toFixed(2)}deg); }\n`;
  for (let i = 0; i < n; i++) {
    const stickEnd = arrival[i] + STICK;
    beamKf += `${pct(arrival[i])}% { transform: rotate(${angles[i].toFixed(2)}deg); animation-timing-function: ease-in-out; }\n`;
    beamKf += `${pct(stickEnd)}% { transform: rotate(${angles[i].toFixed(2)}deg); }\n`;
  }
  beamKf += `100% { transform: rotate(${angles[0].toFixed(2)}deg); animation-timing-function: ease-in-out; }\n`;

  // Chaque jour s'illumine pile pendant que le rayon est collé dessus.
  let blipEls = "", keyframes = "";
  ordered.forEach((d, i) => {
    const cx = g.cellX(d.col) + g.CELL / 2;
    const cy = g.cellY(d.row) + g.CELL / 2;
    const stickEnd = arrival[i] + STICK;
    const name = `blip${i}`;
    const color = LEVEL_COLOR[d.level] ?? accent;
    keyframes += `@keyframes ${name} {
  0% { opacity: 0.18; transform: scale(1); }
  ${pct(arrival[i])}% { opacity: 0.18; transform: scale(1); animation-timing-function: ease-out; }
  ${pct(arrival[i] + STICK * 0.3)}% { opacity: 1; transform: scale(1.7); }
  ${pct(stickEnd)}% { opacity: 1; transform: scale(1.7); animation-timing-function: ease-in; }
  ${pct(stickEnd + STICK * 0.2)}% { opacity: 0.18; transform: scale(1); }
  100% { opacity: 0.18; transform: scale(1); }
}\n`;
    blipEls += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="2.1" fill="${color}" style="animation: ${name} ${CYCLE_DUR.toFixed(2)}s linear infinite; transform-box: fill-box; transform-origin: center;"/>\n`;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${g.width}" height="${g.height}" viewBox="0 0 ${g.width} ${g.height}">
<style>
rect { shape-rendering: crispEdges; }
@keyframes beam { ${beamKf} }
${keyframes}
</style>
<rect width="${g.width}" height="${g.height}" fill="${bg}"/>
${cellRects}
${blipEls}
<g style="animation: beam ${CYCLE_DUR.toFixed(2)}s linear infinite; transform-origin: ${OX}px ${OY}px;">
  <line x1="${OX}" y1="${OY}" x2="${(OX + beamLen).toFixed(1)}" y2="${OY}" stroke="${accent}" stroke-width="3" stroke-opacity="0.18" stroke-linecap="round"/>
  <line x1="${OX}" y1="${OY}" x2="${(OX + beamLen).toFixed(1)}" y2="${OY}" stroke="${accent}" stroke-width="1" stroke-opacity="0.9" stroke-linecap="round"/>
</g>
<circle cx="${OX}" cy="${OY}" r="2.4" fill="${accent}"/>
</svg>`;
}
