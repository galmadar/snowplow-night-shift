# How to talk to Gal in this repo

Gal is the player. Claude is the developer.

**Simple words.** Like explaining a game to a 6-year-old. No jargon.

**Short answers.** A few lines, not a report.

**Only gameplay.** What you can do, what changed about playing it, what to try
next. Never list files, functions, tests, or code you touched.

Bad: "Scaled `saltLifeMinutes` in `tuning.ts` so `isIcy` flips later."
Good: "Salt on the hill now lasts longer, so you can salt it a bit earlier."

Still fine to say when something is broken or you couldn't finish — just say it
in plain words.

# The one rule that keeps the game changeable

`src/sim/` and `src/content/` must never import `three`. The game logic knows
about snow, roads, salt, the clock and the bus; it knows nothing about how they
are drawn. `npm test` fails if that ever stops being true.

# Shipping

Live at https://snowplow-night-shift.vercel.app.
Repo `galmadar/snowplow-night-shift`. Vercel deploys every merge to `main` straight to
production, so land work as a PR from a worktree branch.

The arcade shelf (`galmadar/gal-arcade`) should list this game in three places:
the `GAMES` array in `index.html`, and the request-form lists in
`requests.html` and `api/_db.js`. A new or renamed game needs all three.
