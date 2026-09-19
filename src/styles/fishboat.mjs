// Style "fishboat" : les jours actifs proches dans le temps (moins de
// GAP_THRESHOLD semaines d'écart) sont regroupés en "bancs de poissons" par
// un algorithme de clustering glouton sur la colonne (semaine). Un bateau
// navigue au-dessus de la grille, visite chaque banc dans l'ordre
// chronologique — avec un temps de trajet proportionnel à la vraie
// distance, pas au rang du banc — et le pêche d'un coup (splash) à son
// arrivée. Les bancs déjà pêchés restent vides jusqu'à la boucle suivante.
//
// Brouillon exploratoire (cf. discussion) : eau qui ondule doucement, léger
// tangage du bateau et sillage derrière lui, poissons avec un flottement
// partagé (pas de délai aléatoire par poisson, pour rester simple) — un
// cran au-dessus du tout premier jet sans repartir sur des éléments plus
// complexes (le filet-rectangle a été laissé de côté).

import { gridGeometry } from "../lib/contributions.mjs";

export const meta = {
  id: "fishboat",
  label: "Commit Fishing",
  description: "Un bateau navigue de banc en banc — les jours actifs proches dans le temps sont regroupés en bancs de poissons — et les pêche au filet dans l'ordre chronologique.",
};

const TIERS = {
  FIRST_QUARTILE: { scale: 0.7 },
  SECOND_QUARTILE: { scale: 0.85 },
  THIRD_QUARTILE: { scale: 1.0 },
  FOURTH_QUARTILE: { scale: 1.2 },
};
const GAP_THRESHOLD = 3; // semaines d'écart max pour rester dans le même banc

export function render(days, opts = {}) {
  const bg = opts.background ?? "#0a2233";
  const CYCLE = opts.cycle ?? 16;
  const WATER_BAND = 22;

  const g = gridGeometry(days, { top: 8 + WATER_BAND, left: 12, right: 12, bottom: 8 });

  // Regroupement en bancs : glouton sur la colonne, triés chronologiquement.
  const active = days.filter((d) => TIERS[d.level]).sort((a, b) => a.col - b.col || a.row - b.row);
  const schools = [];
  let current = [];
  let lastCol = null;
  for (const d of active) {
    if (lastCol !== null && d.col - lastCol > GAP_THRESHOLD) { schools.push(current); current = []; }
    current.push(d);
    lastCol = d.col;
  }
  if (current.length) schools.push(current);
  schools.forEach((s) => { s.centerX = s.reduce((sum, d) => sum + g.cellX(d.col) + g.CELL / 2, 0) / s.length; });

  // Trajet du bateau : temps de traversée proportionnel à la distance
  // réelle entre arrêts (même leçon que le bug de vague de garden — un
  // rang ne reflète pas une distance spatiale/temporelle réelle).
  const waterY = g.PAD_TOP - WATER_BAND / 2 - 2;
  const xStart = g.PAD_LEFT - 8;
  const xEnd = g.PAD_LEFT + g.gridWidth + 8;
  const stops = [xStart, ...schools.map((s) => s.centerX), xEnd];
  let dist = 0;
  for (let i = 1; i < stops.length; i++) dist += Math.abs(stops[i] - stops[i - 1]);

  const DWELL = 0.05, TAIL = 0.1;
  const travelBudget = 1 - DWELL * schools.length - TAIL;
  let t = 0;
  const arrival = [];
  for (let i = 1; i < stops.length; i++) {
    t += (Math.abs(stops[i] - stops[i - 1]) / Math.max(dist, 1)) * travelBudget;
    if (i <= schools.length) { arrival.push(t); t += DWELL; }
  }

  let boatKf = `0% { transform: translateX(${xStart.toFixed(1)}px); }\n`;
  schools.forEach((s, i) => {
    boatKf += `${(arrival[i] * 100).toFixed(2)}% { transform: translateX(${s.centerX.toFixed(1)}px); animation-timing-function: ease-in-out; }\n`;
    boatKf += `${((arrival[i] + DWELL) * 100).toFixed(2)}% { transform: translateX(${s.centerX.toFixed(1)}px); }\n`;
  });
  boatKf += `${((1 - TAIL) * 100).toFixed(2)}% { transform: translateX(${xEnd.toFixed(1)}px); animation-timing-function: ease-in; }\n100% { transform: translateX(${xEnd.toFixed(1)}px); }\n`;

  // Poissons : immobiles, disparaissent d'un coup à l'arrivée du bateau,
  // avec un splash rond au même instant.
  let fishEls = "", splashEls = "", keyframes = "";
  schools.forEach((school, si) => {
    const catchAt = arrival[si] + DWELL * 0.4;
    const pct = (f) => (f * 100).toFixed(2);
    keyframes += `@keyframes catch${si} {
  0% { opacity: 1; }
  ${pct(catchAt)}% { opacity: 1; }
  ${pct(Math.min(1, catchAt + 0.02))}% { opacity: 0; }
  100% { opacity: 0; }
}\n`;
    school.forEach((d) => {
      const tier = TIERS[d.level];
      const cx = g.cellX(d.col) + g.CELL / 2;
      const cy = g.cellY(d.row) + g.CELL / 2;
      fishEls += `<text x="${cx.toFixed(1)}" y="${cy.toFixed(1)}" text-anchor="middle" dominant-baseline="central" font-size="${(g.CELL * tier.scale).toFixed(1)}" style="animation: catch${si} ${CYCLE}s linear infinite, fishBob 2.4s ease-in-out infinite; transform-box: fill-box; transform-origin: center;">🐟</text>\n`;
    });
    keyframes += `@keyframes splash${si} {
  0% { opacity: 0; r: 1px; }
  ${pct(catchAt)}% { opacity: 0.7; r: 1px; animation-timing-function: ease-out; }
  ${pct(Math.min(1, catchAt + 0.03))}% { opacity: 0; r: ${(g.CELL * 1.6).toFixed(1)}px; }
  100% { opacity: 0; r: ${(g.CELL * 1.6).toFixed(1)}px; }
}\n`;
    splashEls += `<circle cx="${school.centerX.toFixed(1)}" cy="${g.PAD_TOP + g.gridHeight / 2}" r="1" fill="none" stroke="#eaf6ff" stroke-width="1.2" style="animation: splash${si} ${CYCLE}s linear infinite;"/>\n`;
  });

  // Surface de l'eau : une ondulation douce (grandes courbes en S) qui
  // défile en boucle continue, indépendante du cycle des commits — même
  // principe que le bord de vague du style tide, en plus discret.
  const waveY = waterY + 6;
  const WAVE_LEN = 40, WAVE_AMP = 1.6, WAVE_DUR = 4.5;
  const half = WAVE_LEN / 2;
  let waveD = `M${-WAVE_LEN},${waveY.toFixed(1)}`;
  for (let x = -WAVE_LEN; x < g.width + WAVE_LEN * 2; x += WAVE_LEN) {
    waveD += ` C${(x + half / 2).toFixed(1)},${(waveY - WAVE_AMP).toFixed(1)} ${(x + half).toFixed(1)},${(waveY - WAVE_AMP).toFixed(1)} ${(x + half).toFixed(1)},${waveY.toFixed(1)}`;
    waveD += ` C${(x + half + half / 2).toFixed(1)},${(waveY + WAVE_AMP).toFixed(1)} ${(x + WAVE_LEN).toFixed(1)},${(waveY + WAVE_AMP).toFixed(1)} ${(x + WAVE_LEN).toFixed(1)},${waveY.toFixed(1)}`;
  }

  // Sillage : deux petits ronds qui reprennent le trajet du bateau avec un
  // léger retard (delay négatif sur la même animation), et qui pulsent en
  // s'estompant comme des remous.
  // Chaque rond de sillage est dans son propre groupe : le décalage (translateX,
  // via `sail` retardé) et le ricochet (scale/opacity, via `ripple`) touchent
  // tous les deux `transform`, donc ils doivent être sur deux éléments
  // différents pour ne pas s'écraser l'un l'autre.
  const wake = [0.12, 0.24].map((delay, i) => (
    `<g style="animation: sail ${CYCLE}s linear infinite; animation-delay: -${delay}s;">` +
    `<circle cx="0" cy="${(waveY - 1).toFixed(1)}" r="2" fill="none" stroke="#eaf6ff" stroke-opacity="${(0.4 - i * 0.15).toFixed(2)}" stroke-width="1" ` +
    `style="animation: ripple 1.6s ease-out infinite; animation-delay: -${(i * 0.5).toFixed(2)}s; transform-box: fill-box; transform-origin: center;"/>` +
    `</g>`
  )).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${g.width}" height="${g.height}" viewBox="0 0 ${g.width} ${g.height}">
<style>
text { font-family: -apple-system, "Apple Color Emoji", "Segoe UI Emoji", sans-serif; }
@keyframes sail { ${boatKf} }
@keyframes bob { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-1.4px); } }
@keyframes fishBob { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(1px); } }
@keyframes wave { 0% { transform: translateX(0px); } 100% { transform: translateX(-${WAVE_LEN}px); } }
@keyframes ripple { 0% { opacity: 0.6; transform: scale(0.4); } 100% { opacity: 0; transform: scale(1.6); } }
${keyframes}
</style>
<rect width="${g.width}" height="${g.height}" fill="${bg}"/>
<g style="animation: wave ${WAVE_DUR}s linear infinite;">
  <path d="${waveD}" fill="none" stroke="#ffffff" stroke-opacity="0.1" stroke-width="1"/>
</g>
${splashEls}
${fishEls}
${wake}
<g style="animation: sail ${CYCLE}s linear infinite;">
  <text x="0" y="${waterY.toFixed(1)}" font-size="18" dominant-baseline="central" style="animation: bob 2.1s ease-in-out infinite;">⛵</text>
</g>
</svg>`;
}
