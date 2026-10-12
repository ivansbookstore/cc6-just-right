# Just Right

A canteen portion simulation for NTU vendors and students, built for the CC0006 Sustainability group project.

**Play:** https://ivansbookstore.github.io/cc6-just-right/ (phone or computer, nothing to install)

## What it is

The same customers, served two ways:

- **Today**: one portion size. Students who speak up can ask for less rice; quiet ones get a Regular plate.
- **Just Right**: Regular and Small on the menu board, with Small priced a little lower, so everyone can pick the size that fits.

Because both settings use exactly the same customers, any difference comes from the menu, not luck.

## Two modes

**Be the vendor.** Serve a 20-customer lunch rush at an economy rice stall. Each customer has a hidden appetite and a line of speech (light eaters, quiet ones, clean-platers, picky eaters, and about 1 in 5 with a big appetite: the Gym Regular, One Meal a Day, the Hall Athlete, the Late Luncher and the Quiet Big Eater, who never asks for more); you choose how to serve them before they lose patience. The closing report compares Today and Just Right for a full day of 80 plates (environment, society, economy), shows what your own play did, and runs a three-day "shortcut" where the vendor quietly shrinks every plate, to show how ratings drop.

**Be the student.** Answer three questions (our survey question on whether the standard portion is too big for you, how often you eat breakfast, your weekly budget), then eat lunch Monday to Friday. Pick a stall, eat bite by bite while a hunger bar fills, and stop when you like. Stopping too early leaves you hungry; finishing a big plate can leave you stuffed in a 2 pm lecture; leaving rice wastes food. Then replay the same week with Just Right canteen-wide (every stall sells a Regular and a Small plate) and compare.

**God Mode.** A top-down canteen: an entrance, five stalls with queues, 24 tables, a food waste bin and an exit. Set each stall's plate size, price, rice cost, serving speed and rating before opening, then watch a lunch of 50 to 400 students walk in, queue, order by hunger, eat and scrape what is left into the bin. A live dashboard counts people, the bin's weight, how full students felt, and each stall's sales and profit. Run the same students under Today and under Just Right to compare waste, profit and margins ([`src/canteen.js`](src/canteen.js), tested by `tests/audit_canteen.js`).

**Where you stand.** From the home screen or the end of your week, answer our real survey questions as yourself and see how you compare with the 97 NTU students who answered it: a bar chart per question with your answer highlighted, and your game week placed on the "how often do you leave food" question. It uses counts only ([`src/survey.js`](src/survey.js)); nothing you tap is saved or sent.

## Where the numbers come from

Every number lives in [`src/config.js`](src/config.js) with its source and a status:

- **survey**: our NTU student survey (97 responses, 1 to 7 October 2026)
- **vendor**: our vendor survey (early answers, to be confirmed)
- **assumption**: no data yet, shown as such in the game

Just Right starts at our best case: a Small of 75% of Regular (150 g) at S$0.30 off. Across the tested range (Small 65% to 85%, discount S$0.20 to S$0.50) it cut the most waste without lowering vendor profit or ratings in both the one-stall and the whole-canteen model. Whether a customer takes the Small depends on the discount, using survey question 10.

Change a value there, or on the in-game "How this works" screen, and both modes follow. Results are a simulation under stated assumptions, not real sales or waste data. All student-mode stall prices, portions, queues and ratings are assumptions for the game.

Every new game draws a fresh queue of customers (names, lines and patience vary too). Add `?seed=123` to the address to replay a particular queue. The build number sits in the bottom-right corner; if it says "refresh", the browser is mixing an old cached copy with the new page.

## Checks

```
node tests/engine.test.js     # core model tests
node tests/audit_vendor.js    # vendor mode: every persona, every setting at its limits, 300 random rushes, direction checks
node tests/audit_canteen.js   # God Mode: timelines, queues, seats, the bin and the books over 72 lunches; direction checks
node tests/audit_student.js   # student mode: every appetite, breakfast habit and budget; simulated players; money, time and waste rules
```

## Project layout

```
index.html              the page
css/style.css           layout for phone and computer, light and dark mode
fonts/                  Geist (SIL Open Font License, see GEIST-OFL.txt)
src/config.js           every number, with source and status
src/engine.js           the model: customers, meals, ratings, profit, the student week (no screen code)
src/canteen.js          God Mode: one canteen lunch, worked out in full (no screen code)
src/god.js              God Mode screen: the map, the live dashboard, the comparison
src/survey.js           student survey answer counts (97 responses, no individual rows)
src/icons.js            Phosphor Icons (MIT)
src/sound.js            sound effects and music, synthesised in the browser
src/ui.js               screens and controls
tests/                  tests and audits
```

## Sound and motion

- Sound effects and a quiet background tune are made live in the browser with the Web Audio API (`src/sound.js`), so there are no audio files and nothing to license.
- The two round buttons at the top right switch sound effects and music on or off. Music starts off; the choice is remembered on that device.
- Animations explain what happened: customers arrive and leave, the rice on a returned plate shrinks to what was left, stars pop in, coins float up. Devices set to reduce motion get no animation.

## Controls

- Phone: tap the buttons.
- Computer: vendor mode, press 1 to 4 to serve and Space for the next customer. Student mode, Space takes a bite and Enter stops eating.

## Licence

Code: MIT, see [LICENSE](LICENSE). Geist font: SIL Open Font License 1.1. Phosphor Icons: MIT.
