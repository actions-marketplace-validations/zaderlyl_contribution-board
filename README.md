# Contribution Board

Des animations SVG originales pour ta grille de contributions GitHub — pas juste un graphique statique. Aucune dépendance externe (Node 20+, `fetch` global), utilisable comme GitHub Action sur n'importe quel profil.

## Styles disponibles

| Style | Aperçu |
|---|---|
| `cannon` | Un canon fixe, planté dans un coin, qui pivote pour viser et tire un carré coloré sur chaque commit, au bon endroit et au bon moment. |
| `tide` | Une marée qui avance, recouvre la grille, puis se retire en laissant un coquillage sur chaque commit. |
| `meteor` | Une pluie de météores tombe à intervalles irréguliers et s'écrase sur chaque commit, laissant un cratère coloré et un éclat de particules qui se dissipe. |

D'autres styles sont prévus (voir [Issues](../../issues)) — l'architecture (`src/lib/` pour les données et la géométrie, `src/styles/*.mjs` pour le rendu) est faite pour en accueillir facilement.

## Utilisation

Dans le README de ton profil (`ton-pseudo/ton-pseudo`), ajoute un workflow qui génère le SVG et le commite :

```yaml
name: Contribution Board
on:
  schedule: [{ cron: "0 3 * * *" }]
  workflow_dispatch:
permissions:
  contents: write
jobs:
  board:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: zaderlyl/contribution-board@main
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          username: ${{ github.repository_owner }}
          output: assets/contribution-board.svg
      - run: |
          if [[ -n "$(git status --porcelain assets/contribution-board.svg)" ]]; then
            git config user.name "github-actions[bot]"
            git config user.email "github-actions[bot]@users.noreply.github.com"
            git add assets/contribution-board.svg
            git commit -m "chore: mise à jour du contribution board"
            git pull --rebase origin main
            git push
          fi
```

Puis dans le `README.md` :

```markdown
<img src="assets/contribution-board.svg" alt="Ma grille de contributions">
```

### Options

| Input | Défaut | Description |
|---|---|---|
| `username` | — | Compte GitHub (obligatoire) |
| `github_token` | — | `secrets.GITHUB_TOKEN` suffit pour un profil public (obligatoire) |
| `style` | `cannon` | Style de rendu |
| `output` | `contribution-board.svg` | Chemin du SVG généré |
| `accent` | `ff9100` | Couleur d'accent (hex, sans `#`) |
| `background` | `#0d1117` | Couleur de fond |

## Développement local

```bash
GITHUB_TOKEN=$(gh auth token) node src/generate.mjs <pseudo> cannon out.svg
```

Sers le fichier généré (`python3 -m http.server`) et ouvre-le dans un navigateur pour vérifier l'animation avant de committer — un SVG animé en CSS ne s'anime pas dans un aperçu de fichier statique.

## Licence

MIT
