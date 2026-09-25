// Style "breakout" : une plaque verticale à gauche, mobile (elle poursuit
// la balle, avec une vitesse plafonnée — elle "voit" la balle arriver, pas
// de risque réel de la rater), une balle qui rebondit sur les murs
// (haut/bas/droite) et sur la plaque, et des briques (les jours actifs)
// qui se cassent au premier impact — comme un vrai casse-brique, en
// horizontal. La simulation physique tourne une fois à la génération
// (rebonds élastiques, vitesse constante entre deux événements), puis est
// convertie en animation CSS : entre deux événements, la trajectoire est
// une ligne droite à vitesse constante, donc l'interpolation `linear` de
// CSS reproduit exactement la physique, sans approximation.

import { LEVEL_COLOR, gridGeometry } from "../lib/contributions.mjs";

export const meta = {
  id: "breakout",
  label: "Commit Breakout",
  description: "Une plaque verticale à gauche poursuit une balle qui rebondit sur les murs et casse chaque jour actif qu'elle percute, comme un casse-brique.",
};

const BALL_R = 1.6;
const BALL_SPEED = 320;   // px/s
const PADDLE_SPEED = 260; // px/s
const DT = 0.008;         // pas de simulation, s
const MAX_SIM_T = 30;     // s, garde-fou (une brique isolée peut ne jamais être touchée)
const HOLD = 0.8;         // s, pause avant la remise à zéro
const RESET_DUR = 0.6;    // s, la balle et la plaque reviennent au départ

function simulate(days, g) {
  const FIELD_L = g.PAD_LEFT, FIELD_R = g.PAD_LEFT + g.gridWidth;
  const FIELD_T = g.PAD_TOP, FIELD_B = g.PAD_TOP + g.gridHeight;
  const PADDLE_H = g.PITCH * 2.2;

  const bricks = days.filter((d) => d.count > 0).map((d) => ({
    x0: g.cellX(d.col), y0: g.cellY(d.row), x1: g.cellX(d.col) + g.CELL, y1: g.cellY(d.row) + g.CELL,
    day: d, alive: true,
  }));

  let bx = FIELD_L + 10, by = FIELD_T + g.gridHeight / 2;
  const startX = bx, startY = by;
  let angle = Math.PI * 0.2; // vers la droite (dans le champ), légèrement en biais
  let vx = Math.cos(angle) * BALL_SPEED, vy = Math.sin(angle) * BALL_SPEED;
  let paddleY = by - PADDLE_H / 2;
  const startPaddleY = paddleY;

  const ballEvents = [{ t: 0, x: bx, y: by }];
  const paddleSamples = [{ t: 0, y: paddleY }];
  const breaks = []; // { t, brick }
  const paddleHits = []; // { t, y }
  let t = 0, lastSample = 0;
  const SAMPLE_DT = 0.12;

  while (t < MAX_SIM_T && breaks.length < bricks.length) {
    t += DT;
    const targetY = by - PADDLE_H / 2;
    const dy = targetY - paddleY;
    const step = Math.max(-PADDLE_SPEED * DT, Math.min(PADDLE_SPEED * DT, dy));
    paddleY = Math.max(FIELD_T, Math.min(FIELD_B - PADDLE_H, paddleY + step));

    const nx = bx + vx * DT, ny = by + vy * DT;
    let bounced = false;

    if (ny - BALL_R < FIELD_T || ny + BALL_R > FIELD_B) { vy = -vy; bounced = true; }
    if (nx + BALL_R > FIELD_R) { vx = -vx; bounced = true; }
    if (nx - BALL_R < FIELD_L) {
      if (ny >= paddleY - BALL_R && ny <= paddleY + PADDLE_H + BALL_R) {
        vx = Math.abs(vx);
        const hit = (ny - (paddleY + PADDLE_H / 2)) / (PADDLE_H / 2);
        vy = vy * 0.7 + hit * BALL_SPEED * 0.5;
        const sp = Math.hypot(vx, vy);
        vx = (vx / sp) * BALL_SPEED; vy = (vy / sp) * BALL_SPEED;
        bounced = true;
        paddleHits.push({ t, y: ny });
      }
    }
    for (const b of bricks) {
      if (!b.alive) continue;
      if (nx + BALL_R > b.x0 && nx - BALL_R < b.x1 && ny + BALL_R > b.y0 && ny - BALL_R < b.y1) {
        b.alive = false;
        const overlapX = Math.min(nx + BALL_R - b.x0, b.x1 - (nx - BALL_R));
        const overlapY = Math.min(ny + BALL_R - b.y0, b.y1 - (ny - BALL_R));
        if (overlapX < overlapY) vx = -vx; else vy = -vy;
        breaks.push({ t, day: b.day, x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2 });
        bounced = true;
        break;
      }
    }

    if (bounced) ballEvents.push({ t, x: bx, y: by });
    bx += vx * DT; by += vy * DT;
    if (t - lastSample >= SAMPLE_DT) { paddleSamples.push({ t, y: paddleY }); lastSample = t; }
  }
  ballEvents.push({ t, x: bx, y: by });
  paddleSamples.push({ t, y: paddleY });

  return { ballEvents, paddleSamples, breaks, paddleHits, endT: t, startX, startY, startPaddleY, PADDLE_H, FIELD_L };
}

export function render(days, opts = {}) {
  const accent = `#${(opts.accent ?? "ff9100").replace(/^#/, "")}`;
  const bg = opts.background ?? "#0d1117";

  const g = gridGeometry(days, { top: 8, left: 8, right: 8, bottom: 8 });
  const { ballEvents, paddleSamples, breaks, paddleHits, endT, startX, startY, startPaddleY, PADDLE_H, FIELD_L } = simulate(days, g);

  const holdEnd = endT + HOLD;
  const cycleEnd = holdEnd + RESET_DUR;
  const pct = (s) => ((s / cycleEnd) * 100).toFixed(3);

  let cellRects = "";
  days.forEach((d) => {
    cellRects += `<rect x="${g.cellX(d.col)}" y="${g.cellY(d.row)}" width="${g.CELL}" height="${g.CELL}" rx="2" fill="#161b22"/>\n`;
  });

  // Briques : un carré plein par jour actif, qui disparaît (petit éclat)
  // au moment où la balle le casse, et reste absent jusqu'à la boucle
  // suivante.
  let brickEls = "", keyframes = "";
  const activeDays = days.filter((d) => d.count > 0);
  activeDays.forEach((d, i) => {
    const brk = breaks.find((b) => b.day === d);
    const color = LEVEL_COLOR[d.level] ?? accent;
    const x = g.cellX(d.col), y = g.cellY(d.row);
    if (!brk) {
      // Jamais touchée dans cette simulation : reste affichée telle quelle.
      brickEls += `<rect x="${x}" y="${y}" width="${g.CELL}" height="${g.CELL}" rx="2" fill="${color}"/>\n`;
      return;
    }
    const name = `brick${i}`;
    const breakAt = brk.t;
    keyframes += `@keyframes ${name} {
  0% { opacity: 1; transform: scale(1); }
  ${pct(breakAt)}% { opacity: 1; transform: scale(1); animation-timing-function: ease-out; }
  ${pct(Math.min(cycleEnd, breakAt + 0.1))}% { opacity: 0; transform: scale(1.6); }
  ${pct(cycleEnd)}% { opacity: 0; transform: scale(1.6); }
  100% { opacity: 0; transform: scale(1.6); }
}\n`;
    brickEls += `<rect x="${x}" y="${y}" width="${g.CELL}" height="${g.CELL}" rx="2" fill="${color}" ` +
      `style="animation: ${name} ${cycleEnd.toFixed(2)}s linear infinite; transform-box: fill-box; transform-origin: center;"/>\n`;

    // Éclat au moment de l'impact.
    const flashName = `flash${i}`;
    keyframes += `@keyframes ${flashName} {
  0% { opacity: 0; r: 0.5px; }
  ${pct(breakAt)}% { opacity: 0; r: 0.5px; }
  ${pct(Math.min(cycleEnd, breakAt + 0.05))}% { opacity: 0.9; r: ${(g.CELL * 0.9).toFixed(1)}px; animation-timing-function: ease-out; }
  ${pct(Math.min(cycleEnd, breakAt + 0.22))}% { opacity: 0; r: ${(g.CELL * 1.6).toFixed(1)}px; }
  100% { opacity: 0; r: ${(g.CELL * 1.6).toFixed(1)}px; }
}\n`;
    brickEls += `<circle cx="${x + g.CELL / 2}" cy="${y + g.CELL / 2}" r="0.5" fill="${color}" style="animation: ${flashName} ${cycleEnd.toFixed(2)}s linear infinite;"/>\n`;
  });

  // Flash sur la plaque à chaque interception réussie — même principe que
  // l'éclat des briques, pour donner un vrai retour visuel à l'élément
  // qu'on "contrôle", qui sinon ne fait que glisser sans réaction.
  let paddleFlashEls = "";
  paddleHits.forEach((hit, i) => {
    const name = `phit${i}`;
    keyframes += `@keyframes ${name} {
  0% { opacity: 0; r: 0.5px; }
  ${pct(hit.t)}% { opacity: 0; r: 0.5px; }
  ${pct(Math.min(cycleEnd, hit.t + 0.05))}% { opacity: 0.9; r: ${(PADDLE_H * 0.55).toFixed(1)}px; animation-timing-function: ease-out; }
  ${pct(Math.min(cycleEnd, hit.t + 0.2))}% { opacity: 0; r: ${(PADDLE_H * 0.9).toFixed(1)}px; }
  100% { opacity: 0; r: ${(PADDLE_H * 0.9).toFixed(1)}px; }
}\n`;
    paddleFlashEls += `<circle cx="${FIELD_L.toFixed(1)}" cy="${hit.y.toFixed(1)}" r="0.5" fill="${accent}" style="animation: ${name} ${cycleEnd.toFixed(2)}s linear infinite;"/>\n`;
  });

  // Balle : ligne droite à vitesse constante entre deux événements, donc
  // interpolation linéaire exacte (pas d'approximation de la physique).
  let ballKf = `0% { transform: translate(${startX.toFixed(1)}px,${startY.toFixed(1)}px); }\n`;
  ballEvents.forEach((e) => {
    ballKf += `${pct(e.t)}% { transform: translate(${e.x.toFixed(1)}px,${e.y.toFixed(1)}px); }\n`;
  });
  ballKf += `${pct(holdEnd)}% { transform: translate(${ballEvents[ballEvents.length - 1].x.toFixed(1)}px,${ballEvents[ballEvents.length - 1].y.toFixed(1)}px); animation-timing-function: ease-in-out; }\n`;
  ballKf += `100% { transform: translate(${startX.toFixed(1)}px,${startY.toFixed(1)}px); }\n`;

  // Plaque : échantillonnée à intervalle régulier (elle bouge en continu,
  // pas seulement aux événements de la balle).
  let paddleKf = `0% { transform: translateY(${startPaddleY.toFixed(1)}px); }\n`;
  paddleSamples.forEach((s) => {
    paddleKf += `${pct(s.t)}% { transform: translateY(${s.y.toFixed(1)}px); }\n`;
  });
  paddleKf += `${pct(holdEnd)}% { transform: translateY(${paddleSamples[paddleSamples.length - 1].y.toFixed(1)}px); animation-timing-function: ease-in-out; }\n`;
  paddleKf += `100% { transform: translateY(${startPaddleY.toFixed(1)}px); }\n`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${g.width}" height="${g.height}" viewBox="0 0 ${g.width} ${g.height}">
<style>
rect { shape-rendering: crispEdges; }
@keyframes ball { ${ballKf} }
@keyframes paddle { ${paddleKf} }
${keyframes}
</style>
<rect width="${g.width}" height="${g.height}" fill="${bg}"/>
${cellRects}
${brickEls}
${paddleFlashEls}
<rect x="${FIELD_L.toFixed(1)}" y="0" width="2.2" height="${PADDLE_H.toFixed(1)}" rx="1" fill="${accent}" style="animation: paddle ${cycleEnd.toFixed(2)}s linear infinite;"/>
<circle cx="0" cy="0" r="${BALL_R}" fill="#eaf6ff" style="animation: ball ${cycleEnd.toFixed(2)}s linear infinite;"/>
</svg>`;
}
