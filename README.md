# TeniPuri Top9

A photo-only "pick the face you like best" sorter for The Prince of Tennis. Compare two photos at a time and finish with a Top 9 grid, with #1 in the center, that you can save as an image.
<br>
Link: https://ube-pancake.github.io/Tnpr-FaceCard-Top-9/

## Run locally

```bash
npm install
npm run dev
```

Create a production build with `npm run build`. The repository deploys to GitHub Pages after each push to `main`.

## Characters

The roster lives in `src/data.js`. `ACTIVE_TEAMS` limits which teams are included (currently the nine school teams; U-17, foreign teams and others come later). Set it to `null` to use every team. On the start screen, players can sort all included teams or pick a single team.

## Character portraits

Put portraits in `public/players/<team-id>/<character-slug>.webp` (`.png` and `.jpg` also work), for example `public/players/seigaku/ryoma-echizen.webp`. Slugs come from `src/data.js`.

Use a 4:5 crop (800 × 1000 px) with the face in the upper half. [docs/portrait-template.png](docs/portrait-template.png) shows the safe areas. Characters without a photo show a team-colored monogram.
