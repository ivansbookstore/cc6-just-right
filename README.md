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

Just Right defaults: a Small of 75% of Regular (150 g at The Standard). Each stall sets its own Small discount; by default it is the biggest survey price step (S$0.20 or S$0.30, from question 10) that the rice saved on one Small still covers, so a Small never earns a stall less than a Regular. A stall can choose S$0: same price, less rice. Of the Small sizes we tested (140 g to 170 g), 150 g is the only one where both the one-stall and the whole-canteen model cut waste without lowering profit or ratings. Whether a customer takes the Small depends on the discount, using survey question 10.

Change a value there, or on the in-game "How this works" screen, and both modes follow. Results are a simulation under stated assumptions, not real sales or waste data. All student-mode stall prices, portions, queues and ratings are assumptions for the game.

Every new game draws a fresh queue of customers (names, lines and patience vary too). Add `?seed=123` to the address to replay a particular queue. The build number sits in the bottom-right corner; if it says "refresh", the browser is mixing an old cached copy with the new page.

## Research behind the kiosk

NTU stalls already take orders on a kiosk. Under Just Right the kiosk shows each size (Small, Regular, Add rice or noodles) in grams, with calories, carbs, protein and fat. What the research says, and how the game uses it (each source opened and checked against its original page on 16 October 2026):

- **The size choice is what cuts waste.** Offering smaller servings cut plate waste 20% in two university canteens, while information alone did not ([Visschers et al. 2020](https://irf.fhnw.ch/handle/11654/31672)). When customers are simply asked, 14% to 33% take a smaller portion, with or without a discount ([Schwartz et al. 2012](https://pubmed.ncbi.nlm.nih.gov/22323171/)). The game models the choice; its waste cut (about 8% at one stall) sits below these figures.
- **The nutrition panel helps people choose, a little.** Calorie labels cut calories selected by 1.8% ([Clarke et al. 2025, Cochrane](https://pubmed.ncbi.nlm.nih.gov/39820897/)), but did not change portion-size orders ([Schwartz et al. 2012](https://pubmed.ncbi.nlm.nih.gov/22323171/)) and information alone did not cut plate waste ([Visschers et al. 2020](https://irf.fhnw.ch/handle/11654/31672)). So the panel is shown everywhere but given no extra power by default; God Mode has a switch to apply the 1.8% to dish choice.
- **Grams do not change appetite.** Telling people portion sizes did not change how much they ate ([Ueland et al. 2009](https://pubmed.ncbi.nlm.nih.gov/19103332/)). Grams matter because students can pick the right size before they pay.
- **Vendors gain from measuring.** Restaurants that measured their waste cut kitchen waste 26% in a year and saved $7 for every $1 invested ([Champions 12.3, 2019](https://champions123.org/publication/business-case-reducing-food-loss-and-waste-restaurants)). The kiosk records orders in grams, so under Just Right the game trims the extra rice cooked by 26% (an informed assumption).

| Source | Finding | How the game uses it |
|---|---|---|
| [Visschers, Gundlach & Beretta (2020)](https://irf.fhnw.ch/handle/11654/31672) | In two university canteens, offering smaller servings (plus information) cut plate waste by 20%. Information alone did not reduce plate waste. | Our main evidence that a size choice cuts plate waste, and the yardstick for our model's waste cut. Limits: Information alone (like a nutrition panel on its own) did not work. Short study, two canteens, Switzerland. |
| [Schwartz, Riis, Elbel & Ariely (2012)](https://pubmed.ncbi.nlm.nih.gov/22323171/) | When asked if they wanted a smaller starchy side, 14% to 33% of customers said yes, with or without a 25-cent discount. Calorie labels had no measurable effect on ordering. | A kiosk asks every customer, so it works like this invitation. Supports "same price, less rice" for low-margin stalls. Yardstick for how many choose the Small. Limits: Accepting the smaller portion did not change the amount left uneaten in that study: the gain was fewer calories, not less plate waste. Chinese fast-food restaurant, United States. |
| [Vermeer et al. (2011)](https://pubmed.ncbi.nlm.nih.gov/21224829/) | Small meals sold at 10.2% of large-meal sales when added beside the existing size. Proportional (cheaper) pricing had no extra effect. | Lower yardstick for Small uptake. Like Schwartz, says the discount matters less than offering the size. Limits: Some small-meal buyers bought extra items. Our survey (Q10) says the discount does matter to students; the game uses our survey here and flags the conflict. |
| [Freedman & Brochado (2010)](https://pubmed.ncbi.nlm.nih.gov/20035274/) | In a university dining hall, smaller portions of fries cut both intake per diner and plate waste; plate waste rose with portion size (r = 0.85). | Supports the model rule that people leave what they do not need: bigger plates, more waste. Limits: One food (fries), all-you-can-eat setting. |
| [Kallbekken & Sælen (2013)](https://ideas.repec.org/a/eee/ecolet/v119y2013i3p325-327.html) | Smaller plates and social cues cut hotel restaurant food waste by about 20%, with no change in guest satisfaction; restaurants buy less food. | Second yardstick (about 20%) for waste cuts, and evidence that less food served need not upset diners. Limits: Hotel buffets, not ordered plates. |
| [Whitehair, Shanklin & Brannon (2013)](https://pubmed.ncbi.nlm.nih.gov/23260724/) | Simple prompt messages cut edible food waste by 15% in a university dining hall; on average students left more than 57 g of edible food per tray. | Shows information can help in some settings (unlike Visschers). Benchmark for plate waste per student. Limits: All-you-care-to-eat dining; mixed evidence with Visschers 2020. |
| [Lorenz, Hartmann & Langen (2017)](https://pubmed.ncbi.nlm.nih.gov/28434893/) | In a university canteen (343 students), portion size and how good the food tastes drive plate leftovers, and their effect depends on time pressure. | Backs the game's three reasons for waste: too much on the plate, taste, and running out of time. Limits: Germany; structural model, not an intervention. |
| [Hollands et al. (2015), Cochrane](https://pubmed.ncbi.nlm.nih.gov/26368271/) | People consistently eat more when offered larger portions (SMD 0.38; moderate-quality evidence), and adults select more from larger sizes. | Backs the "Clean-Plater" who finishes a big plate and overeats, and the "stuffed" outcome. Limits: Mostly lab studies in high-income countries. |
| [Clarke et al. (2025), Cochrane](https://pubmed.ncbi.nlm.nih.gov/39820897/) | Calorie labels led people to select 1.8% fewer calories (high-certainty evidence) and perhaps eat 5.9% fewer (low certainty), about 11 kcal and 35 kcal on a 600 kcal meal. | God Mode switch: lets the nutrition panel sway which dish students pick, set to this 1.8%. Limits: A small effect, mostly from choosing different items. It does not show less plate waste. |
| [Crockett et al. (2018), Cochrane](https://www.cochrane.org/CD009315/PUBHLTH_nutritional-labelling-promote-healthier-consumption-and-purchasing-food-or-drinks) | Energy labels on restaurant menus cut energy purchased by about 47 kcal per meal (median meal 746 kcal), from three low-quality studies. | Earlier, larger estimate; we use the newer, more certain 2025 review instead. Limits: Low-quality evidence, superseded. |
| [Ueland et al. (2009)](https://pubmed.ncbi.nlm.nih.gov/19103332/) | Telling people how many "portions" they had eaten did not change how full they felt or how much they ate. | Why the game does not let the grams on the kiosk change how much anyone eats: the value of grams is that students can pick the right size, not that the number changes appetite. Limits: Small lab study (33 adults). |
| [Champions 12.3 (2019)](https://champions123.org/publication/business-case-reducing-food-loss-and-waste-restaurants) | 114 restaurants in 12 countries: average saving of $7 for every $1 invested; kitchen food waste cut 26% within a year by measuring it, engaging staff and reducing overproduction. | Under Just Right the kiosk records every order in grams, so a stall can measure demand. The game trims the extra rice cooked beyond what is served by 26%. Limits: Kitchen waste programmes, not kiosks; our 26% is an informed assumption, editable in config. |
| [National Environment Agency (2025 figures)](https://www.nea.gov.sg/our-services/waste-management/3r-programmes-and-resources/food-waste-management) | Singapore generated 790,000 tonnes of food waste in 2025, about 11% of all waste; 18% was recycled. | Context for the Showcase; not a game parameter. |
| [USDA FoodData Central](https://fdc.nal.usda.gov/food-details/168878/nutrients) | Per 100 g: rice 130 kcal, 28.2 g carbs, 2.7 g protein, 0.3 g fat; egg noodles 138 kcal, 25.2 g carbs, 4.5 g protein, 2.1 g fat. | How the kiosk scales calories and macros with the grams of rice or noodles chosen. Limits: US reference values; local rice and noodles vary. |
| [HealthXchange (SingHealth) with KKH dietitians](https://www.healthxchange.sg/food-nutrition/food-tips/best-worst-singapore-hawker-chinese-food-duck-rice-fishball-noodle) | Whole-plate values, e.g. roasted chicken rice (382 g) 607 kcal; char siew rice (327 g) 605 kcal; roast duck rice (410 g) 673 kcal; laksa lemak (540 g) 591 kcal; minced pork noodles, dry (311 g) 511 kcal. | The dish on each stall's kiosk. We treat the listed plate as the stall's Regular and scale only the rice or noodles. Limits: The pages do not split out the rice or noodle weight; our scaling is an assumption. |

Full citations are in [src/research.js](src/research.js) and on the in-game How this works screen.

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
src/research.js         every research source, what it found and how the game uses it
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
