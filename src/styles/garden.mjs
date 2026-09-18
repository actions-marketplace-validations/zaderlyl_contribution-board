// Style "garden" : un bac en bois rempli d'un lit de terre continu (pas des
// cases isolées) sur lequel chaque jour actif fait pousser une plante selon
// son niveau d'activité (même quartile que GitHub utilise pour colorer sa
// propre grille) — rien pour un jour sans commit, de l'herbe pour "presque
// rien", puis fleur et enfin arbre pour les plus gros jours. Les plantes
// poussent dans l'ordre chronologique (comme sur une vraie saison), ondulent
// doucement une fois écloses, tiennent en pleine floraison, puis se fanent
// d'un coup avant que la boucle recommence.

import { gridGeometry } from "../lib/contributions.mjs";

export const meta = {
  id: "garden",
  label: "Commit Garden",
  description: "Un bac de jardin où chaque jour actif fait pousser une plante différente selon son niveau d'activité — de l'herbe pour presque rien jusqu'à l'arbre pour les plus gros jours.",
};

// Un quartile GitHub -> une plante. Même logique de paliers que la marée,
// mais indexée sur `level` plutôt que sur des seuils de commits arbitraires
// (le quartile est déjà relatif à l'activité réelle de l'utilisateur).
const TIERS = {
  FIRST_QUARTILE: { icon: "🌿", scale: 0.8 },
  SECOND_QUARTILE: { icon: "🌷", scale: 0.95 },
  THIRD_QUARTILE: { icon: "🌻", scale: 1.1 },
  FOURTH_QUARTILE: { icon: "🌳", scale: 1.3 },
};

// Petit hash déterministe (0..1), même recette que le style meteor — sert
// juste à donner une texture (mottes plus claires/sombres) au lit de terre,
// sans dépendre du hasard.
function hash(n) {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967295;
}

export function render(days, opts = {}) {
  const bg = opts.background ?? "#0d1117";
  const CYCLE = opts.cycle ?? 16;
  const GROW_END = 0.6;   // fin de la pousse (toutes les plantes ont poussé)
  const HOLD_END = 0.85;  // jardin en pleine floraison (avec léger balancement)
  const WILT_END = 0.97;  // fané, juste avant que la boucle reparte

  const g = gridGeometry(days, { top: 8, left: 8, right: 8, bottom: 8 });
  const bedX = g.PAD_LEFT - 3, bedY = g.PAD_TOP - 3;
  const bedW = g.gridWidth + 6, bedH = g.gridHeight + 6;

  // Texture du lit de terre : des mottes légèrement plus claires/sombres
  // par-dessus le dégradé de base, pour casser l'aspect "grille" plate sans
  // recréer des cases isolées.
  let clodRects = "";
  days.forEach((d) => {
    const t = hash(d.col * 31 + d.row);
    const lighten = t > 0.5;
    const shade = lighten ? "#fff" : "#000";
    const alpha = 0.05 + Math.abs(t - 0.5) * 0.18;
    clodRects += `<rect x="${g.cellX(d.col)}" y="${g.cellY(d.row)}" width="${g.CELL}" height="${g.CELL}" rx="2.5" fill="${shade}" opacity="${alpha.toFixed(2)}"/>\n`;
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

    // Léger balancement une fois éclos : quelques degrés de rotation, deux
    // allers-retours, avant la fanaison — donne un peu de vie sans ajouter
    // une deuxième animation (tout reste dans le même `transform`).
    const swaySpan = Math.max(0, HOLD_END - growEnd);
    const s1 = growEnd + swaySpan * 0.28;
    const s2 = growEnd + swaySpan * 0.56;
    const s3 = growEnd + swaySpan * 0.82;

    plantKeyframes += `@keyframes ${name} {\n` +
      `  0% { opacity: 0; transform: scale(0.25) rotate(0deg); }\n` +
      `  ${(growStart * 100).toFixed(3)}% { opacity: 0; transform: scale(0.25) rotate(0deg); }\n` +
      `  ${(growEnd * 100).toFixed(3)}% { opacity: 1; transform: scale(1) rotate(0deg); }\n` +
      `  ${(s1 * 100).toFixed(3)}% { transform: scale(1) rotate(5deg); }\n` +
      `  ${(s2 * 100).toFixed(3)}% { transform: scale(1) rotate(-4deg); }\n` +
      `  ${(s3 * 100).toFixed(3)}% { transform: scale(1) rotate(3deg); }\n` +
      `  ${(HOLD_END * 100).toFixed(3)}% { opacity: 1; transform: scale(1) rotate(0deg); }\n` +
      `  ${(WILT_END * 100).toFixed(3)}% { opacity: 0; transform: scale(0.25) rotate(0deg); }\n` +
      `  100% { opacity: 0; transform: scale(0.25) rotate(0deg); }\n` +
      `}\n`;
    plantEls += `<text x="${cx}" y="${cy}" font-size="${(g.CELL * tier.scale).toFixed(1)}" text-anchor="middle" dominant-baseline="central" filter="url(#plantShadow)" style="animation: ${name} ${CYCLE}s linear infinite; opacity:0;">${tier.icon}</text>\n`;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${g.width}" height="${g.height}" viewBox="0 0 ${g.width} ${g.height}">
<defs>
  <linearGradient id="soilBed" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#6b4a2c"/>
    <stop offset="55%" stop-color="#4a3320"/>
    <stop offset="100%" stop-color="#2c1e11"/>
  </linearGradient>
  <filter id="plantShadow" x="-50%" y="-50%" width="200%" height="200%">
    <feDropShadow dx="0" dy="0.6" stdDeviation="0.5" flood-color="#000000" flood-opacity="0.4"/>
  </filter>
</defs>
<style>
rect { shape-rendering: crispEdges; }
text { font-family: -apple-system, "Apple Color Emoji", "Segoe UI Emoji", sans-serif; transform-box: fill-box; transform-origin: 50% 65%; }
${plantKeyframes}
</style>
<rect width="${g.width}" height="${g.height}" fill="${bg}"/>
<rect x="${(bedX - 4).toFixed(1)}" y="${(bedY - 4).toFixed(1)}" width="${(bedW + 8).toFixed(1)}" height="${(bedH + 8).toFixed(1)}" rx="8" fill="none" stroke="#7a5230" stroke-width="3"/>
<rect x="${(bedX - 4).toFixed(1)}" y="${(bedY - 4).toFixed(1)}" width="${(bedW + 8).toFixed(1)}" height="${(bedH + 8).toFixed(1)}" rx="8" fill="none" stroke="#b3835024" stroke-width="1"/>
<rect x="${bedX.toFixed(1)}" y="${bedY.toFixed(1)}" width="${bedW.toFixed(1)}" height="${bedH.toFixed(1)}" rx="5" fill="url(#soilBed)"/>
${clodRects}
${plantEls}
</svg>`;
}
