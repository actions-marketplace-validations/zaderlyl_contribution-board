// Style "garden" : un bac en bois rempli d'un lit de terre continu (pas des
// cases isolées) sur lequel chaque jour actif fait pousser une plante selon
// son niveau d'activité (même quartile que GitHub utilise pour colorer sa
// propre grille) — rien pour un jour sans commit, de l'herbe pour "presque
// rien", puis fleur et enfin arbre pour les plus gros jours. Les plantes
// poussent dans l'ordre chronologique (comme sur une vraie saison), ondulent
// doucement une fois écloses, tiennent toutes ensemble en pleine floraison
// un moment, puis se fanent à leur tour dans ce même ordre chronologique —
// une vague de fanaison, de gauche à droite, plutôt qu'un fondu groupé
// instantané.
//
// PAS de filtre SVG (ex: feDropShadow) sur les plantes : testé et confirmé
// cassé en usage réel (rendu invisible par intermittence sur un vrai profil
// GitHub, pas juste un artefact de l'outil de dev) — voir l'historique de ce
// fichier pour le détail.

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
  const GROW_END = 0.55;  // fin de la pousse (toutes les plantes ont poussé)
  const HOLD_END = 0.75;  // jardin entier en pleine floraison jusque-là
  const WILT_END = 0.95;  // fin de la vague de fanaison (gauche à droite)

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
  const maxCol = Math.max(1, g.cols - 1);
  const growDur = 0.03;
  const wiltDur = 0.03;

  let plantEls = "", plantKeyframes = "";
  ordered.forEach((d, i) => {
    const tier = TIERS[d.level];
    const name = `plant${i}`;
    const cx = g.cellX(d.col) + g.CELL / 2;
    const cy = g.cellY(d.row) + g.CELL / 2;
    // Calée sur la position réelle de la colonne (semaine) dans la grille,
    // pas sur le rang parmi les jours actifs — sinon deux jours actifs très
    // éloignés dans le temps (mais proches en rang, si le reste de l'année
    // est vide) poussent presque au même instant alors qu'ils sont à
    // l'autre bout de la grille : la vague "saute" au lieu de balayer.
    const colFrac = d.col / maxCol;
    const growStart = colFrac * GROW_END;
    const growEnd = growStart + growDur;
    // Petit dépassement en poussant (0.25 -> ~1.18 -> 1), pour un "pop"
    // plus organique qu'un arrêt net à la taille finale.
    const growPeak = growStart + (growEnd - growStart) * 0.7;

    // Fanaison en vague, dans le même ordre (gauche à droite, calée sur la
    // colonne) — mais seulement après HOLD_END, une fois que tout le
    // jardin a eu son moment de pleine floraison ensemble.
    const wiltStart = HOLD_END + colFrac * (WILT_END - HOLD_END);
    const wiltEnd = wiltStart + wiltDur;

    // Léger balancement une fois éclose : quelques degrés de rotation, deux
    // allers-retours, avant la fanaison — donne un peu de vie sans ajouter
    // une deuxième animation (tout reste dans le même `transform`).
    const holdSpan = wiltStart - growEnd;
    const s1 = growEnd + holdSpan * 0.28;
    const s2 = growEnd + holdSpan * 0.56;
    const s3 = growEnd + holdSpan * 0.82;

    plantKeyframes += `@keyframes ${name} {\n` +
      `  0% { opacity: 0; transform: scale(0.25) rotate(0deg); }\n` +
      `  ${(growStart * 100).toFixed(3)}% { opacity: 0; transform: scale(0.25) rotate(0deg); animation-timing-function: ease-out; }\n` +
      `  ${(growPeak * 100).toFixed(3)}% { opacity: 1; transform: scale(1.18) rotate(0deg); animation-timing-function: ease-in-out; }\n` +
      `  ${(growEnd * 100).toFixed(3)}% { opacity: 1; transform: scale(1) rotate(0deg); animation-timing-function: ease-in-out; }\n` +
      `  ${(s1 * 100).toFixed(3)}% { transform: scale(1) rotate(5deg); animation-timing-function: ease-in-out; }\n` +
      `  ${(s2 * 100).toFixed(3)}% { transform: scale(1) rotate(-4deg); animation-timing-function: ease-in-out; }\n` +
      `  ${(s3 * 100).toFixed(3)}% { transform: scale(1) rotate(3deg); animation-timing-function: ease-in; }\n` +
      `  ${(wiltStart * 100).toFixed(3)}% { opacity: 1; transform: scale(1) rotate(0deg); animation-timing-function: ease-in; }\n` +
      `  ${(wiltEnd * 100).toFixed(3)}% { opacity: 0; transform: scale(0.25) rotate(0deg); }\n` +
      `  100% { opacity: 0; transform: scale(0.25) rotate(0deg); }\n` +
      `}\n`;
    plantEls += `<text x="${cx}" y="${cy}" font-size="${(g.CELL * tier.scale).toFixed(1)}" text-anchor="middle" dominant-baseline="central" style="animation: ${name} ${CYCLE}s linear infinite; opacity:0;">${tier.icon}</text>\n`;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${g.width}" height="${g.height}" viewBox="0 0 ${g.width} ${g.height}">
<defs>
  <linearGradient id="soilBed" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#6b4a2c"/>
    <stop offset="55%" stop-color="#4a3320"/>
    <stop offset="100%" stop-color="#2c1e11"/>
  </linearGradient>
</defs>
<style>
rect { shape-rendering: crispEdges; }
text { font-family: -apple-system, "Apple Color Emoji", "Segoe UI Emoji", sans-serif; transform-box: fill-box; transform-origin: center; }
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
