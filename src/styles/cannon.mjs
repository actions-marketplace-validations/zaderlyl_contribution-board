// Style "cannon" : un canon fixe, planté dans le coin bas-gauche, qui pivote
// pour viser chaque case de la grille et tire un carré coloré qui se pose
// dessus au moment chronologique du commit correspondant.

import { LEVEL_COLOR, gridGeometry } from "../lib/contributions.mjs";

export const meta = {
  id: "cannon",
  label: "Commit Cannon",
  description: "Un canon qui tire un obus sur chaque commit, au bon endroit et au bon moment.",
};

export function render(days, opts = {}) {
  const accent = opts.accent ?? "ff9100";
  const bg = opts.background ?? "#0d1117";
  const CYCLE = opts.cycle ?? 12;
  const ACTIVE_SPAN = CYCLE * 0.9;
  const EPS = 0.05;
  const SHOT_LEAD = CYCLE * 0.01;

  const g = gridGeometry(days, { left: 20, bottom: 26 });
  const CANNON_X = g.PAD_LEFT;
  const CANNON_Y = g.PAD_TOP + g.gridHeight + g.PAD_BOTTOM / 2 + 2;

  const activeDays = days.filter((d) => d.count > 0);
  const totalActive = Math.max(activeDays.length, 1);
  activeDays.forEach((d, i) => {
    d.t = (i / totalActive) * ACTIVE_SPAN;
    d.tx = g.cellX(d.col) + g.CELL / 2;
    d.ty = g.cellY(d.row) + g.CELL / 2;
    d.angle = (Math.atan2(d.ty - CANNON_Y, d.tx - CANNON_X) * 180) / Math.PI;
  });
  const pct = (t) => (t / CYCLE) * 100;

  const turretFrames = [];
  if (activeDays.length) {
    turretFrames.push(`0% { transform: rotate(${activeDays[0].angle.toFixed(2)}deg); }`);
    for (let i = 0; i < activeDays.length; i++) {
      const d = activeDays[i];
      const nextT = i + 1 < activeDays.length ? activeDays[i + 1].t : ACTIVE_SPAN;
      turretFrames.push(`${pct(d.t).toFixed(3)}% { transform: rotate(${d.angle.toFixed(2)}deg); }`);
      turretFrames.push(`${Math.max(pct(d.t), pct(nextT) - EPS).toFixed(3)}% { transform: rotate(${d.angle.toFixed(2)}deg); }`);
    }
    turretFrames.push(`100% { transform: rotate(${activeDays.at(-1).angle.toFixed(2)}deg); }`);
  }
  const turretKeyframes = turretFrames.length ? `@keyframes turretAim {\n  ${turretFrames.join("\n  ")}\n}` : "";

  let cellRects = "";
  days.forEach((d) => {
    cellRects += `<rect x="${g.cellX(d.col)}" y="${g.cellY(d.row)}" width="${g.CELL}" height="${g.CELL}" rx="2" fill="${LEVEL_COLOR.NONE}"/>\n`;
  });

  let shotEls = "", shotKeyframes = "";
  activeDays.forEach((d, i) => {
    const name = `shot${i}`;
    const size = g.CELL - 2;
    const startX = CANNON_X - size / 2, startY = CANNON_Y - size / 2;
    const dx = d.tx - CANNON_X, dy = d.ty - CANNON_Y;
    const arrive = pct(d.t);
    const leave = pct(Math.max(0, d.t - SHOT_LEAD));
    shotKeyframes += `@keyframes ${name} {\n` +
      `  0% { opacity: 0; transform: translate(0px,0px) scale(0.4); }\n` +
      `  ${leave.toFixed(3)}% { opacity: 0; transform: translate(0px,0px) scale(0.4); }\n` +
      `  ${Math.min(leave + EPS, arrive).toFixed(3)}% { opacity: 1; transform: translate(0px,0px) scale(0.4); }\n` +
      `  ${arrive.toFixed(3)}% { opacity: 1; transform: translate(${dx.toFixed(2)}px,${dy.toFixed(2)}px) scale(1); }\n` +
      `  100% { opacity: 1; transform: translate(${dx.toFixed(2)}px,${dy.toFixed(2)}px) scale(1); }\n` +
      `}\n`;
    shotEls += `<rect class="shot" x="${startX}" y="${startY}" width="${size}" height="${size}" rx="2" fill="${LEVEL_COLOR[d.level]}" style="animation: ${name} ${CYCLE}s linear infinite; opacity:0; transform-origin: ${CANNON_X}px ${CANNON_Y}px;"/>\n`;
  });

  const cannonSvg = `
<g transform="translate(${CANNON_X},${CANNON_Y})">
  <line x1="-7" y1="4" x2="7" y2="4" stroke="#${accent}" stroke-width="2"/>
  <circle cx="-7" cy="4" r="5.5" fill="${bg}" stroke="#${accent}" stroke-width="1.6"/>
  <circle cx="-7" cy="4" r="1.4" fill="#${accent}"/>
  <circle cx="7" cy="4" r="5.5" fill="${bg}" stroke="#${accent}" stroke-width="1.6"/>
  <circle cx="7" cy="4" r="1.4" fill="#${accent}"/>
  <circle cx="0" cy="0" r="4.4" fill="${bg}" stroke="#${accent}" stroke-width="1.6"/>
  <g class="turret" style="animation: turretAim ${CYCLE}s linear infinite; transform-origin: 0px 0px;">
    <polygon points="-1,-4.5 -1,4.5 15,2.6 17,0 15,-2.6" fill="#${accent}"/>
    <circle cx="-1" cy="0" r="2.6" fill="#ffb84d"/>
  </g>
</g>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${g.width}" height="${g.height}" viewBox="0 0 ${g.width} ${g.height}">
<style>
rect { shape-rendering: crispEdges; }
${turretKeyframes}
${shotKeyframes}
</style>
<rect width="${g.width}" height="${g.height}" fill="${bg}"/>
${cellRects}
${cannonSvg}
${shotEls}
</svg>`;
}
