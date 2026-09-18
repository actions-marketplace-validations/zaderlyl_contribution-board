// Récupère la vraie grille de contributions GitHub d'un utilisateur (API
// GraphQL) et l'aplatit en une liste de jours exploitable par n'importe quel
// style de rendu. Partagé par tous les styles — c'est la seule partie qui
// parle au réseau.

export const LEVEL_COLOR = {
  NONE: "#161b22",
  FIRST_QUARTILE: "#4a2e0f",
  SECOND_QUARTILE: "#8a4d0d",
  THIRD_QUARTILE: "#ff9100",
  FOURTH_QUARTILE: "#ffb84d",
};

const QUERY = `
query($login: String!) {
  user(login: $login) {
    contributionsCollection {
      contributionCalendar {
        weeks { contributionDays { date contributionCount contributionLevel } }
      }
    }
  }
}`;

/** @returns {Promise<{col:number,row:number,count:number,level:string}[]>}
 *  Jours dans l'ordre chronologique, avec leur position (colonne = semaine,
 *  ligne = jour de la semaine, 0=dimanche) dans la grille. */
export async function fetchContributionDays(username, token) {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "contribution-board",
    },
    body: JSON.stringify({ query: QUERY, variables: { login: username } }),
  });
  if (!res.ok) throw new Error(`GraphQL HTTP ${res.status}: ${await res.text()}`);
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  const weeks = json.data.user.contributionsCollection.contributionCalendar.weeks;

  const days = [];
  weeks.forEach((w, col) => {
    w.contributionDays.forEach((d) => {
      const row = new Date(`${d.date}T00:00:00Z`).getUTCDay();
      days.push({ col, row, count: d.contributionCount, level: d.contributionLevel });
    });
  });
  return days;
}

/** Géométrie standard de la grille (mêmes proportions que la vraie grille
 *  GitHub), commune à tous les styles. `extra` ajoute de la place autour
 *  (ex: un canon qui dépasse en bas). */
export function gridGeometry(days, extra = {}) {
  const CELL = 10, GAP = 3, PITCH = CELL + GAP;
  const PAD_TOP = extra.top ?? 8;
  const PAD_LEFT = extra.left ?? 8;
  const PAD_RIGHT = extra.right ?? 8;
  const PAD_BOTTOM = extra.bottom ?? 8;
  const cols = Math.max(...days.map((d) => d.col)) + 1;
  const gridWidth = cols * PITCH - GAP;
  const gridHeight = 7 * PITCH - GAP;
  return {
    CELL, GAP, PITCH, PAD_TOP, PAD_LEFT, PAD_RIGHT, PAD_BOTTOM, cols,
    gridWidth, gridHeight,
    width: PAD_LEFT + gridWidth + PAD_RIGHT,
    height: PAD_TOP + gridHeight + PAD_BOTTOM,
    cellX: (col) => PAD_LEFT + col * PITCH,
    cellY: (row) => PAD_TOP + row * PITCH,
  };
}
