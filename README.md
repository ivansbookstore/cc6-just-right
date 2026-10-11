# Just Right

A canteen portion simulation for NTU vendors and students — CC0006 Sustainability group project.

**Play:** https://ivansbookstore.github.io/cc6-just-right/ (phone or computer, nothing to install)

## What it is

Same customers, two ways of serving them:

- **Today** — one portion size. Students who speak up can ask for less rice; quiet ones get a Regular plate.
- **Just Right** — Regular and Small on the menu board, Small priced a little lower, so everyone can pick the size that fits.

Because both settings use exactly the same customers, any difference comes from the menu, not luck.

## Status

| Part | Status |
|---|---|
| Vendor mode: lunch rush, Today / Just Right switch, end-of-day report | Playable (v0.1) |
| Shortcut challenge — how ratings drop when every plate is quietly shrunk | In the end-of-day report |
| "How this works" screen — every number, its source, adjustable | Playable |
| Student mode — a week of lunches with a hunger bar | Coming next |

## How it works

Every customer has a hidden appetite. They eat what they want and leave the rest — unless they are a Clean-Plater, who finishes everything and overeats instead. Taste letdowns and rushing make people leave food whatever the plate size, so the game also shows what a smaller plate does **not** fix.

- Profit = takings − rice cost − everything else on the plate.
- A Small plate breaks even when the discount ≤ rice cost of a Regular plate × (1 − Small share) × (1 + cooking buffer).
- Customers rate each meal 1–5 stars. In the shortcut challenge, tomorrow's customers rise or fall with today's rating.

## Where the numbers come from

Every number lives in [`src/config.js`](src/config.js) with its source and a status:

- **survey** — our NTU student survey (wave 1, 22 responses)
- **vendor** — our vendor survey (to be confirmed)
- **assumption** — no data yet; shown as such in the game

Change a value there (or on the in-game "How this works" screen) and the whole game follows. Results are a simulation under stated assumptions — not real sales or waste data.

## Project layout

```
index.html          the page
css/style.css       layout for phone and computer, light and dark mode
src/config.js       every number, with source and status
src/engine.js       the model — customers, meals, ratings, profit (no screen code)
src/ui.js           screens and controls
tests/engine.test.js  checks the model (run: node tests/engine.test.js)
```

## Controls

- Phone: tap the buttons.
- Computer: click, or press **1–4** to serve and **Space** for the next customer.

## Licence

MIT — see [LICENSE](LICENSE).
