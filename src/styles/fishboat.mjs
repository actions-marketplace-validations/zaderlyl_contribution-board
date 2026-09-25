// Style "fishboat" : les jours actifs proches dans le temps (moins de
// GAP_THRESHOLD semaines d'écart) sont regroupés en "bancs de poissons" par
// un algorithme de clustering glouton sur la colonne (semaine). Un bateau
// navigue au-dessus de la grille, visite chaque banc dans l'ordre
// chronologique — avec un temps de trajet proportionnel à la vraie
// distance, pas au rang du banc — et descend un vrai filet (corde + maille)
// pour le pêcher à son arrivée. Les bancs déjà pêchés restent vides jusqu'à
// la boucle suivante.
//
// Brouillon exploratoire (cf. discussion) : eau qui ondule en continu, le
// bateau flotte en rythme avec elle (translation + tangage synchronisés
// sur la même période que la vague, pas un rebond indépendant), un poisson
// différent selon le niveau d'activité, et un filet qui descend/se
// referme/remonte plutôt qu'un simple flash.

import { gridGeometry } from "../lib/contributions.mjs";

export const meta = {
  id: "fishboat",
  label: "Commit Fishing",
  description: "Un bateau navigue de banc en banc — les jours actifs proches dans le temps sont regroupés en bancs de poissons — et les pêche au filet dans l'ordre chronologique.",
};

const TIERS = {
  FIRST_QUARTILE: { scale: 0.7, icon: "🐟" },
  SECOND_QUARTILE: { scale: 0.85, icon: "🐠" },
  THIRD_QUARTILE: { scale: 1.0, icon: "🦑" },
  FOURTH_QUARTILE: { scale: 1.25, icon: "🦈" },
};
const GAP_THRESHOLD = 3; // semaines d'écart max pour rester dans le même banc

export function render(days, opts = {}) {
  const bg = opts.background ?? "#0a2233";
  const CYCLE = opts.cycle ?? 18;
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
  schools.forEach((s) => {
    s.centerX = s.reduce((sum, d) => sum + g.cellX(d.col) + g.CELL / 2, 0) / s.length;
    s.minCol = Math.min(...s.map((d) => d.col));
    s.maxCol = Math.max(...s.map((d) => d.col));
    s.minRow = Math.min(...s.map((d) => d.row));
    s.maxRow = Math.max(...s.map((d) => d.row));
    s.centerY = g.cellY((s.minRow + s.maxRow) / 2) + g.CELL / 2;
  });

  // Trajet du bateau : temps de traversée proportionnel à la distance
  // réelle entre arrêts (même leçon que le bug de vague de garden — un
  // rang ne reflète pas une distance spatiale/temporelle réelle).
  const waterY = g.PAD_TOP - WATER_BAND / 2 - 2;
  const xStart = g.PAD_LEFT - 8;
  const xEnd = g.PAD_LEFT + g.gridWidth + 8;
  const stops = [xStart, ...schools.map((s) => s.centerX), xEnd];
  let dist = 0;
  for (let i = 1; i < stops.length; i++) dist += Math.abs(stops[i] - stops[i - 1]);

  const DWELL = 0.07, TAIL = 0.1;
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

  // --- Filet (corde + poche en maille) et poissons aspirés dedans ---------
  let fishEls = "", netEls = "", keyframes = "";
  schools.forEach((school, si) => {
    const d0 = arrival[si];
    const dropDur = 0.012, pullDur = 0.012, holdDur = 0.008, riseDur = 0.012;
    const d1 = d0 + dropDur;   // le filet touche l'eau
    const d2 = d1 + pullDur;   // il se referme, poissons aspirés
    const d3 = d2 + holdDur;   // pause, filet fermé
    const d4 = d3 + riseDur;   // remonté au bateau
    const pct = (f) => (Math.min(1, f) * 100).toFixed(3);

    const depth = school.centerY - waterY;
    // Filet en forme de poche (large en haut, effilée en bas) plutôt qu'un
    // ovale plein — plus proche d'un vrai filet à main, plus compact.
    const netRx = Math.max(4.5, (g.cellX(school.maxCol) - g.cellX(school.minCol) + g.CELL) / 2 + 1.5);
    const netDrop = Math.max(7, (school.maxRow - school.minRow) * g.PITCH + g.CELL + 2);
    const bagPath = `M${-netRx.toFixed(1)},0 C${-netRx.toFixed(1)},${(netDrop * 0.6).toFixed(1)} ${(-netRx * 0.35).toFixed(1)},${netDrop.toFixed(1)} 0,${netDrop.toFixed(1)} ` +
      `C${(netRx * 0.35).toFixed(1)},${netDrop.toFixed(1)} ${netRx.toFixed(1)},${(netDrop * 0.6).toFixed(1)} ${netRx.toFixed(1)},0 Z`;

    // La corde : une fine barre étirée depuis le bateau (transform-origin en
    // haut) jusqu'à la profondeur du banc.
    keyframes += `@keyframes rope${si} {
  0% { transform: scaleY(0); }
  ${pct(d0)}% { transform: scaleY(0); animation-timing-function: ease-out; }
  ${pct(d1)}% { transform: scaleY(1); }
  ${pct(d3)}% { transform: scaleY(1); animation-timing-function: ease-in; }
  ${pct(d4)}% { transform: scaleY(0); }
  100% { transform: scaleY(0); }
}\n`;
    // La poche du filet : descend au bout de la corde, se resserre
    // (scaleX) une fois les poissons aspirés, puis remonte.
    keyframes += `@keyframes netbag${si} {
  0% { opacity: 0; transform: translateY(0px) scaleX(1); }
  ${pct(d0)}% { opacity: 0; transform: translateY(0px) scaleX(1); }
  ${pct(d0 + 0.001)}% { opacity: 1; transform: translateY(0px) scaleX(1); }
  ${pct(d1)}% { opacity: 1; transform: translateY(${depth.toFixed(1)}px) scaleX(1); animation-timing-function: ease-out; }
  ${pct(d2)}% { opacity: 1; transform: translateY(${depth.toFixed(1)}px) scaleX(0.55); }
  ${pct(d3)}% { opacity: 1; transform: translateY(${depth.toFixed(1)}px) scaleX(0.55); }
  ${pct(d4)}% { opacity: 1; transform: translateY(0px) scaleX(1); animation-timing-function: ease-in; }
  ${pct(d4 + 0.002)}% { opacity: 0; transform: translateY(0px) scaleX(1); }
  100% { opacity: 0; transform: translateY(0px) scaleX(1); }
}\n`;
    netEls += `<g style="animation: rope${si} ${CYCLE}s linear infinite; transform-box: fill-box; transform-origin: top;">` +
      `<rect x="${(school.centerX - 0.5).toFixed(1)}" y="${(waterY + 2).toFixed(1)}" width="1" height="${depth.toFixed(1)}" fill="#cfe9f7" opacity="0.5"/>` +
      `</g>\n`;
    // Groupe extérieur statique pour le positionnement (translate en
    // attribut SVG), groupe intérieur pour l'animation CSS (translateY /
    // scaleX) — les deux touchent `transform`, donc ils doivent rester sur
    // deux éléments différents pour ne pas s'écraser l'un l'autre.
    netEls += `<g transform="translate(${school.centerX.toFixed(1)},${waterY.toFixed(1)})">` +
      `<g style="animation: netbag${si} ${CYCLE}s linear infinite; transform-box: fill-box; transform-origin: center;">` +
      `<path d="${bagPath}" fill="url(#netMesh)" stroke="#eaf6ff" stroke-opacity="0.6" stroke-width="0.7"/>` +
      `<ellipse cx="0" cy="0" rx="${netRx.toFixed(1)}" ry="1.4" fill="none" stroke="#eaf6ff" stroke-opacity="0.85" stroke-width="1"/>` +
      `</g></g>\n`;

    // Poissons : figés jusqu'à ce que le filet se referme, puis aspirés
    // vers son centre en rétrécissant.
    school.forEach((d, fi) => {
      const tier = TIERS[d.level];
      const cx = g.cellX(d.col) + g.CELL / 2;
      const cy = g.cellY(d.row) + g.CELL / 2;
      const dx = (school.centerX - cx) * 0.8;
      const dy = (school.centerY - cy) * 0.8;
      const name = `fishcatch${si}_${fi}`;
      keyframes += `@keyframes ${name} {
  0% { opacity: 1; transform: translate(0px,0px) scale(1); }
  ${pct(d1)}% { opacity: 1; transform: translate(0px,0px) scale(1); }
  ${pct(d2)}% { opacity: 0; transform: translate(${dx.toFixed(1)}px,${dy.toFixed(1)}px) scale(0.2); animation-timing-function: ease-in; }
  100% { opacity: 0; transform: translate(${dx.toFixed(1)}px,${dy.toFixed(1)}px) scale(0.2); }
}\n`;
      fishEls += `<text x="${cx.toFixed(1)}" y="${cy.toFixed(1)}" text-anchor="middle" dominant-baseline="central" font-size="${(g.CELL * tier.scale).toFixed(1)}" ` +
        `style="animation: ${name} ${CYCLE}s linear infinite; transform-box: fill-box; transform-origin: center;">${tier.icon}</text>\n`;
    });
  });

  // --- Surface de l'eau : ondulation continue, indépendante du cycle des
  // commits — même principe que le bord de vague du style tide.
  const waveY = waterY + 6;
  const WAVE_LEN = 40, WAVE_AMP = 1.6, WAVE_DUR = 4.5;
  const half = WAVE_LEN / 2;
  let waveD = `M${-WAVE_LEN},${waveY.toFixed(1)}`;
  for (let x = -WAVE_LEN; x < g.width + WAVE_LEN * 2; x += WAVE_LEN) {
    waveD += ` C${(x + half / 2).toFixed(1)},${(waveY - WAVE_AMP).toFixed(1)} ${(x + half).toFixed(1)},${(waveY - WAVE_AMP).toFixed(1)} ${(x + half).toFixed(1)},${waveY.toFixed(1)}`;
    waveD += ` C${(x + half + half / 2).toFixed(1)},${(waveY + WAVE_AMP).toFixed(1)} ${(x + WAVE_LEN).toFixed(1)},${(waveY + WAVE_AMP).toFixed(1)} ${(x + WAVE_LEN).toFixed(1)},${waveY.toFixed(1)}`;
  }

  // Sillage : deux petits ronds qui reprennent le trajet du bateau avec un
  // léger retard, et pulsent en s'estompant comme des remous.
  const wake = [0.12, 0.24].map((delay, i) => (
    `<g style="animation: sail ${CYCLE}s linear infinite; animation-delay: -${delay}s;">` +
    `<circle cx="0" cy="${(waveY - 1).toFixed(1)}" r="2" fill="none" stroke="#eaf6ff" stroke-opacity="${(0.4 - i * 0.15).toFixed(2)}" stroke-width="1" ` +
    `style="animation: ripple 1.6s ease-out infinite; animation-delay: -${(i * 0.5).toFixed(2)}s; transform-box: fill-box; transform-origin: center;"/>` +
    `</g>`
  )).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${g.width}" height="${g.height}" viewBox="0 0 ${g.width} ${g.height}">
<defs>
  <pattern id="netMesh" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
    <line x1="0" y1="0" x2="0" y2="4" stroke="#eaf6ff" stroke-width="0.6" stroke-opacity="0.6"/>
    <line x1="0" y1="0" x2="4" y2="0" stroke="#eaf6ff" stroke-width="0.6" stroke-opacity="0.6"/>
  </pattern>
</defs>
<style>
text { font-family: -apple-system, "Apple Color Emoji", "Segoe UI Emoji", sans-serif; }
@keyframes sail { ${boatKf} }
@keyframes boatFloat {
  0% { transform: translateY(0px) rotate(0deg); }
  25% { transform: translateY(-1.6px) rotate(-3deg); }
  50% { transform: translateY(0px) rotate(0deg); }
  75% { transform: translateY(1.6px) rotate(3deg); }
  100% { transform: translateY(0px) rotate(0deg); }
}
@keyframes wave { 0% { transform: translateX(0px); } 100% { transform: translateX(-${WAVE_LEN}px); } }
@keyframes ripple { 0% { opacity: 0.6; transform: scale(0.4); } 100% { opacity: 0; transform: scale(1.6); } }
${keyframes}
</style>
<rect width="${g.width}" height="${g.height}" fill="${bg}"/>
<g style="animation: wave ${WAVE_DUR}s linear infinite;">
  <path d="${waveD}" fill="none" stroke="#ffffff" stroke-opacity="0.1" stroke-width="1"/>
</g>
${fishEls}
${netEls}
${wake}
<g style="animation: sail ${CYCLE}s linear infinite;">
  <text x="0" y="${waterY.toFixed(1)}" font-size="18" dominant-baseline="central" style="animation: boatFloat ${WAVE_DUR}s ease-in-out infinite;">⛵</text>
</g>
</svg>`;
}
