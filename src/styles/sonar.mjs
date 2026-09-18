// Style "sonar" : les 5 jours avec le plus de commits deviennent des
// émetteurs (clignotants, en rouge) qui balaient en continu avec 3 anneaux
// concentriques, comme un vrai sonar. Chaque autre jour actif est "détecté"
// (révélé) au moment précis où le ping le plus proche l'atteint — plus un
// jour est loin de tout émetteur, plus il met de temps à apparaître.

import { gridGeometry } from "../lib/contributions.mjs";

export const meta = {
  id: "sonar",
  label: "Commit Sonar",
  description: "Les 5 plus gros jours de commits balaient en continu (3 anneaux, façon sonar) et détectent tous les autres, de proche en proche.",
};

const TOP_N = 5;
const RINGS_PER_ORIGIN = 3;
const PULSE_DUR = 3.2;   // s, durée d'un aller simple d'anneau — indépendant du CYCLE, boucle en continu
const BLINK_DUR = 0.7;   // s, période du clignotement rouge des émetteurs

export function render(days, opts = {}) {
  const accent = `#${(opts.accent ?? "ff9100").replace(/^#/, "")}`;
  const bg = opts.background ?? "#0d1117";
  const CYCLE = opts.cycle ?? 14;
  const EPS = 0.05;
  const EXPAND_END = 0.72; // fin de la phase où les révélations se propagent

  const g = gridGeometry(days, { top: 8, left: 8, right: 8, bottom: 8 });
  const pct = (frac) => frac * 100;
  const pos = (d) => [g.cellX(d.col) + g.CELL / 2, g.cellY(d.row) + g.CELL / 2];

  const activeDays = days.filter((d) => d.count > 0);
  const sorted = [...activeDays].sort((a, b) => b.count - a.count);
  const origins = sorted.slice(0, TOP_N).map((d) => {
    const [x, y] = pos(d);
    return { x, y };
  });
  const originSet = new Set(sorted.slice(0, TOP_N));

  // Pour chaque jour actif : distance à l'émetteur le plus proche.
  activeDays.forEach((d) => {
    const [x, y] = pos(d);
    d.dist = originSet.has(d)
      ? 0
      : Math.min(...origins.map((o) => Math.hypot(x - o.x, y - o.y)));
  });
  const maxDist = Math.max(1, ...activeDays.map((d) => d.dist));
  // Vitesse commune à tous les pings, calée pour que le point le plus loin
  // soit détecté pile à la fin de la phase d'expansion.
  const speed = maxDist / (EXPAND_END * CYCLE);

  activeDays.forEach((d) => {
    d.revealPct = pct((d.dist / speed) / CYCLE);
  });

  let cellRects = "";
  days.forEach((d) => {
    cellRects += `<rect x="${g.cellX(d.col)}" y="${g.cellY(d.row)}" width="${g.CELL}" height="${g.CELL}" rx="2" fill="#161b22"/>\n`;
  });

  // Blips : un cercle par jour actif, révélé au bon moment. Les émetteurs
  // (top 5) sont rouges, clignotants, visibles dès le début.
  const RED = "#ff3b30";
  let blipEls = "", blipKeyframes = "";
  activeDays.forEach((d, i) => {
    const [x, y] = pos(d);
    const isOrigin = originSet.has(d);
    if (isOrigin) {
      blipEls += `<circle cx="${x}" cy="${y}" r="3.4" fill="${RED}" style="animation: originBlink ${BLINK_DUR}s ease-in-out infinite;"/>\n`;
      return;
    }
    const name = `blip${i}`;
    const revealAt = d.revealPct;
    blipKeyframes += `@keyframes ${name} {\n` +
      `  0% { opacity: 0; }\n` +
      `  ${Math.max(0, revealAt - EPS).toFixed(3)}% { opacity: 0; }\n` +
      `  ${revealAt.toFixed(3)}% { opacity: 1; }\n` +
      `  100% { opacity: 1; }\n` +
      `}\n`;
    blipEls += `<circle cx="${x}" cy="${y}" r="2" fill="${accent}" style="animation: ${name} ${CYCLE}s linear infinite; opacity:0;"/>\n`;
  });
  const blinkKeyframes = `@keyframes originBlink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.25; }
}`;

  // Anneaux : 3 par émetteur, décalés en phase (façon sonar), qui bouclent
  // en continu sur leur propre rythme — indépendant du cycle de révélation,
  // comme un vrai sonar qui continue de balayer une fois les alentours
  // repérés.
  const ringKeyframes = `@keyframes ringPulse {
  0% { r: 0px; opacity: 0.85; }
  100% { r: ${maxDist.toFixed(1)}px; opacity: 0; }
}`;
  let ringEls = "";
  origins.forEach((o) => {
    for (let i = 0; i < RINGS_PER_ORIGIN; i++) {
      const delay = -(i * PULSE_DUR) / RINGS_PER_ORIGIN;
      ringEls += `<circle cx="${o.x}" cy="${o.y}" r="0" fill="none" stroke="${RED}" stroke-width="1.2" style="animation: ringPulse ${PULSE_DUR}s linear ${delay.toFixed(2)}s infinite;"/>\n`;
    }
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${g.width}" height="${g.height}" viewBox="0 0 ${g.width} ${g.height}">
<style>
rect { shape-rendering: crispEdges; }
${blinkKeyframes}
${ringKeyframes}
${blipKeyframes}
</style>
<rect width="${g.width}" height="${g.height}" fill="${bg}"/>
${cellRects}
${ringEls}
${blipEls}
</svg>`;
}
