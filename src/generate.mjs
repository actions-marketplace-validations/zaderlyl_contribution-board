#!/usr/bin/env node
// Point d'entrée : récupère les contributions d'un utilisateur puis délègue
// le rendu au style demandé. Aucune dépendance externe (Node 20+, fetch global).
//
// Usage : GITHUB_TOKEN=... node src/generate.mjs <username> [style] [outputPath]

import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { fetchContributionDays } from "./lib/contributions.mjs";

const STYLES = {
  cannon: () => import("./styles/cannon.mjs"),
  tide: () => import("./styles/tide.mjs"),
  sonar: () => import("./styles/sonar.mjs"),
  meteor: () => import("./styles/meteor.mjs"),
  constellation: () => import("./styles/constellation.mjs"),
  garden: () => import("./styles/garden.mjs"),
  laser: () => import("./styles/laser.mjs"),
};

const [, , username, style = "cannon", outputPath = "contribution-board.svg"] = process.argv;
const token = process.env.GITHUB_TOKEN;

if (!token || !username) {
  console.error("Usage: GITHUB_TOKEN=... node src/generate.mjs <username> [style] [outputPath]");
  console.error(`Styles disponibles : ${Object.keys(STYLES).join(", ")}`);
  process.exit(1);
}
if (!STYLES[style]) {
  console.error(`Style inconnu: "${style}". Disponibles : ${Object.keys(STYLES).join(", ")}`);
  process.exit(1);
}

const days = await fetchContributionDays(username, token);
const { render } = await STYLES[style]();
const svg = render(days, {
  accent: (process.env.CB_ACCENT || "ff9100").replace(/^#/, ""),
  background: process.env.CB_BACKGROUND || "#0d1117",
  cycle: process.env.CB_CYCLE ? Number(process.env.CB_CYCLE) : undefined,
});

await mkdir(dirname(outputPath), { recursive: true }).catch(() => {});
await writeFile(outputPath, svg);

const active = days.filter((d) => d.count > 0).length;
console.log(`OK — style "${style}", ${days.length} jours (${active} actifs) -> ${outputPath} (${(svg.length / 1024).toFixed(0)} Ko)`);
