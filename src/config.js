/* Just Right: every number the game uses, with where it came from.
   status: "survey"     = from our student survey (97 responses, 1 to 7 October 2026)
           "vendor"     = from our vendor survey: confirm before quoting
           "assumption" = no data yet; flagged in the game
   Change values here (or on the "How this works" screen): nothing else needs editing. */
(function (root) {
  const CONFIG = {
    version: '0.1 (MVP)',
    build: '0.10',                       // shown bottom-right; bump with every push so a stale cache is easy to spot
    params: {
      regularRiceG:   { label: 'Rice/noodles in a Regular plate', value: 200, unit: 'g', min: 150, max: 260, step: 10, source: 'Vendor survey, portion question (answers ~150-250 g)', status: 'vendor' },
      smallShare:     { label: 'Small plate as a share of Regular', value: 0.75, unit: '%', min: 0.5, max: 0.9, step: 0.05, source: 'Group decision (150 g on a 200 g Regular), to test in the pilot. Of 140 g to 170 g, the only size where both the one-stall and the whole-canteen model cut waste without lowering profit or ratings', status: 'assumption', editable: true },
      regularPrice:   { label: 'Price of a Regular plate', value: 5.00, unit: 'S$', min: 4, max: 9, step: 0.1, source: 'Vendor survey, price question (S$4.50-8.00)', status: 'vendor', editable: true },
      discount:       { label: 'Small plate discount at this stall', value: 0.30, unit: 'S$', min: 0, max: 1.5, step: 0.05, source: 'Our rule: the biggest survey price step (Q10: S$0.20 or S$0.30, the most common answer) that the rice saved on one Small still covers. Here a 150 g Small saves about S$0.39 of rice, so S$0.30. S$0 means same price, less rice. Vendors suggested S$0.50 to S$1', status: 'assumption', editable: true },
      riceCostRegular:{ label: 'Rice/noodle cost in a Regular plate', value: 1.50, unit: 'S$', min: 0.3, max: 3, step: 0.1, source: 'Vendor survey, cost question. Answers unclear (rice only, or whole plate?). Confirm.', status: 'vendor', editable: true },
      toppingCost:    { label: 'Cost of everything else on the plate', value: 2.00, unit: 'S$', min: 1, max: 4, step: 0.1, source: 'No data. Does not change the Today vs Just Right difference', status: 'assumption' },
      extraVegCost:   { label: 'Cost of the extra vegetables a vendor adds instead of a discount', value: 0.30, unit: 'S$', min: 0, max: 1, step: 0.05, source: 'No data. Vendors said they add vegetables or meat instead of charging less', status: 'assumption' },
      // a "less rice" scoop is always the same size as the Small plate (smallShare), in every mode
      addRiceShare:   { label: '"Add rice" plate, as a share of Regular', value: 1.25, unit: '%', min: 1.1, max: 1.5, step: 0.05, source: 'No data', status: 'assumption' },
      cookBuffer:     { label: 'Extra rice cooked beyond what is served', value: 0.05, unit: '%', min: 0, max: 0.2, step: 0.01, source: 'No data. Vendors report under 1 kg to 3 kg unsold at closing', status: 'assumption' },
      todayLessResponse: { label: 'What a vendor does today when asked for less rice', value: 'lessVeg', unit: 'choice', options: [['lessVeg', 'Less rice, adds vegetables'], ['lessSame', 'Less rice, same price']], source: 'Vendor survey, most vendors said they add other food instead of charging less', status: 'vendor', editable: true },
      leftThresholdG: { label: 'Leftover that counts as "left food"', value: 10, unit: 'g', source: 'Group choice. A few grains do not count', status: 'assumption' },
      platesPerDay:   { label: 'Plates sold in a day', value: 80, unit: '', min: 40, max: 200, step: 10, source: 'Vendor survey, plates-per-day question (50-200)', status: 'vendor' },
      rushCustomers:  { label: 'Customers you serve in the lunch rush', value: 20, unit: '', min: 10, max: 30, step: 1, source: 'Game length, not data', status: 'assumption' },
      patienceSec:    { label: 'Seconds a customer waits before walking away', value: 12, unit: 's', min: 6, max: 30, step: 1, source: 'Game difficulty, not data', status: 'assumption' },
      chooseRightSize:{ label: 'Customers near the line who pick the size that fits them', value: 0.80, unit: '%', min: 0.5, max: 1, step: 0.05, source: 'No data. The pilot will measure this', status: 'assumption', editable: true },
      shareLight:     { label: 'Light eaters (leave food: portion too large / not hungry)', value: 65 / 97, unit: '%', source: 'Student survey (97 responses), Q2 + Q4: 65 of 97', status: 'survey' },
      shareNeverLeave:{ label: 'Never leave food', value: 23 / 97, unit: '%', source: 'Student survey (97 responses), Q2: 23 of 97', status: 'survey' },
      sharePicky:     { label: 'Leave food mainly over taste', value: 9 / 97, unit: '%', source: 'Student survey (97 responses), Q2 + Q4: 9 of 97', status: 'survey' },
      shareBig:       { label: 'Big appetites (gym, one meal a day, athletes, late lunch, quiet big eaters), added on top, others scaled down', value: 0.20, unit: '%', min: 0, max: 0.4, step: 0.05, source: 'No survey question asks who wants more than a Regular plate. Closest: 11 of 97 say the portion is never too big; 15 of 97 prefer a small plate with a free top-up; vendors worry students will not be full', status: 'assumption', editable: true },
      lightSpeakUp:   { label: 'Light eaters who ask for less rice', value: 0.50, unit: '%', min: 0, max: 1, step: 0.05, source: 'No data. 21 of 97 say they cannot choose their portion', status: 'assumption', editable: true },
      neverLeaveCleanPlater: { label: 'Of those who never leave food, share who finish even when full', value: 0.50, unit: '%', source: 'No data', status: 'assumption' },
      rusherShare:    { label: 'Chance a customer is rushing at this meal', value: 0.10, unit: '%', source: 'No data. 10 of 97 name time as one reason they leave food (not every meal)', status: 'assumption' },
      rushEatCap:     { label: 'Most a rusher can eat, as a share of Regular', value: 0.70, unit: '%', source: 'No data', status: 'assumption' },
      budgetShare:    { label: 'Budget-minded customers', value: 0.30, unit: '%', source: 'No data', status: 'assumption' },
      tasteLetdownPicky: { label: 'Chance the food disappoints a picky eater', value: 0.40, unit: '%', source: 'No data', status: 'assumption' },
      tasteLetdownOther: { label: 'Chance the food disappoints anyone else', value: 0.05, unit: '%', source: 'No data. 46 of 97 name taste as one reason they leave food', status: 'assumption' },
      ratingSensitivity: { label: 'Change in tomorrow\'s customers per star of rating difference', value: 0.30, unit: '%', source: 'No data. Illustrates how ratings drive customers', status: 'assumption' },
    },
    calibration: 'Check against the survey: in the model about 35% of Today meals leave food (over 40 simulated days). Our survey of 97 students (23 Never, 23 Rarely, 41 Sometimes, 10 Often, 0 Always) gives about 28% if Rarely means about 15% of meals, Sometimes 40% and Often 70%. That conversion is our assumption, and it suggests the model overstates today\'s waste, and so the waste Just Right saves. The plate-waste photo audit should replace these appetite ranges.',
    personas: {
      light:  { name: 'The Light Eater', icon: 'feather', appetite: [0.80, 1.15], line: ['Auntie, less rice can?', 'Less rice please, cannot finish one.', 'Small bit of rice only, thanks.'], jrLine: ['One Small, please.', 'Small one, thanks.', 'Can I get the Small?'] },
      quiet:  { name: 'The Quiet One', icon: 'hand-pointing', appetite: [0.80, 1.15], line: ['(points at the dish, says nothing)', '(points, nods, looks at phone)', '(taps the glass at the dish)'], jrLine: ['(points at Small on the board)', '(taps Small on the board)', '(points at the Small price)'] },
      usual:  { name: 'The Usual', icon: 'repeat', appetite: [0.95, 1.20], line: ['Same as always.', 'The usual, boss.', 'Normal one, thanks.'], jrLine: ['Regular, thanks.', 'Regular one.', 'Same as always, Regular.'] },
      clean:  { name: 'The Clean-Plater', icon: 'seal-check', appetite: [0.60, 0.85], line: ['Cannot waste food.', 'Whatever you give, I finish.', 'Normal can, I always clear my plate.'], jrLine: ['Regular, thanks.', 'Regular, I always finish.', 'Regular one, please.'], cleanPlater: true },
      picky:  { name: 'The Picky One', icon: 'magnifying-glass', appetite: [0.90, 1.10], line: ["Hmm… what's good today?", 'Is this one nice ah?', 'Hmm… OK lah, this one.'], jrLine: ['Regular… I guess.', 'Hmm, Regular then.', 'Regular, hope it is good today.'] },
      // big appetites: shareBig is split across these five equally (assumption). asks: what they order; quietMore: hungry but will not ask.
      big:    { name: 'The Gym Regular', icon: 'barbell', appetite: [1.10, 1.40], line: 'Boss, add rice please!', jrLine: 'Regular, add rice please!', bigGroup: true, asks: 'more' },
      omad:   { name: 'One Meal a Day', icon: 'clock-afternoon', appetite: [1.25, 1.50], line: 'Boss, add rice, more gravy can? First meal today.', jrLine: 'Regular, add rice please. First meal today.', bigGroup: true, asks: 'more' },
      athlete:{ name: 'The Hall Athlete', icon: 'basketball', appetite: [1.20, 1.45], line: 'Just finished training. Add rice please!', jrLine: 'Regular, add rice please. Just finished training!', bigGroup: true, asks: 'more' },
      late:   { name: 'The Late Luncher', icon: 'person-simple-run', appetite: [1.15, 1.35], line: 'Starving, but class at 2:30. Normal one, fast please!', jrLine: 'Regular, fast please. Class at 2:30!', bigGroup: true, asks: 'regular', alwaysRusher: true },
      quietbig:{ name: 'The Quiet Big Eater', icon: 'bowl-steam', appetite: [1.20, 1.40], line: '(points at the dish, eyes the rice pot)', jrLine: '(points at Regular, eyes the rice pot)', bigGroup: true, asks: 'regular', quietMore: true },
    },
    traitLines: { rusher: ['Fast fast, got class at 2!', 'Quick ah, lecture starting.', 'Rushing, sorry!'], budget: ['Got cheaper one?', 'Cheapest one can?', 'Anything cheaper?'] },
    // what a light eater says when the order differs from their usual line
    orderLines: { small: ['One Small, please.', 'Small one, thanks.', 'Can I get the Small?'], regular: ['Regular, please.', 'Regular one, thanks.', 'Regular.'],
      quietRegular: ['(points at Regular on the board)', '(taps Regular on the board)'], normalToday: ['Normal portion, thanks.', 'Normal one.', 'This one, normal.'] },
    // first names are drawn at random, independent of customer type. Fictional customers.
    names: ['Wei Ming', 'Jia Hui', 'Aisyah', 'Arjun', 'Hafiz', 'Priya', 'Jun Jie', 'Nurul', 'Kai Xuan', 'Divya', 'Ryan', 'Mei Ling', 'Farhan', 'Shu Ting', 'Rahul', 'Siti', 'Marcus', 'Xin Yi', 'Imran', 'Kavya',
      'Zhi Hao', 'Hui Min', 'Daniel', 'Amirah', 'Ethan', 'Yi Ting', 'Haziq', 'Sneha', 'Bryan', 'Wen Qi', 'Irfan', 'Meera', 'Javier', 'Pei Shan', 'Danish', 'Ananya', 'Sean', 'Li Ting', 'Faris', 'Rachel'],
    // how much cheaper a Small must be before a student will take it: our survey question 10 (97 answers).
    // "More than 50 cents" is read as 80 cents (our assumption); "would not choose a smaller portion" never takes it.
    // the discount steps a stall can pick by default (survey Q10 price points). Each stall takes the biggest one its rice saving covers.
    // Capped at S$0.30, the most common survey answer: in God Mode a bigger discount mostly pulls students from other stalls
    // (S$0.50 at the two big-plate stalls cut canteen profit by about S$6 a lunch for little extra waste saved).
    smallDiscountSteps: [0, 0.20, 0.30],
    smallDiscountNeeded: { source: 'Student survey (97 responses), Q10', answers: [[0, 10], [0.20, 10], [0.30, 23], [0.50, 13], [0.80, 20], [null, 21]] },
    patienceSpread: [0.75, 1.30],       // each customer's patience, times the patience setting. Rushers get the bottom half. Game difficulty, not data.
    bigLabel: 'Big appetites',
    // ---------- student mode. Stall types come from the group's game brief; their portions, prices, queues and ratings are assumptions.
    // The Standard and Just Right use the vendor settings above (Regular plate, Small plate, discount), so both modes agree.
    student: {
      biteG: 20,
      appetite: { light: 0.80, average: 1.00, big: 1.25 },          // share of a Regular plate. Assumption.
      // a student's own answer to our survey question 5 sets their game appetite. The mapping is our assumption.
      appetiteFromQ5: { Never: 1.20, Rarely: 1.00, Sometimes: 0.90, Often: 0.80, Always: 0.75 },
      breakfastEffect: { skipped: 1.15, normal: 1.00, big: 0.85 },   // hunger at lunch. Assumption.
      budgets: [30, 40, 50], defaultBudget: 40,                       // S$ for the week. Assumption.
      snackPrice: 4.00,                                               // bubble tea at 4 pm. Assumption.
      rushWindowMin: 15, minutesPerBite: 1,                           // Thursday: 15 minutes for lunch before a 1 pm class. Assumption.
      focus: { right: 100, hungrySnack: 80, hungry: 65, stuffed: 80, stuffedLecture: 55 },
      days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      lectureDays: ['Tue', 'Thu'], rushDays: ['Thu'],
      breakfastHabits: {
        always:    { Mon: 'normal', Tue: 'normal', Wed: 'big', Thu: 'normal', Fri: 'normal' },
        sometimes: { Mon: 'normal', Tue: 'skipped', Wed: 'big', Thu: 'skipped', Fri: 'normal' },
        rarely:    { Mon: 'skipped', Tue: 'skipped', Wed: 'normal', Thu: 'skipped', Fri: 'skipped' },
      },
      stalls: [
        { id: 'generous', name: 'Uncle Generous', icon: 'cooking-pot', share: 1.40, price: 6.50, queueMin: 8, stars: 4.3, blurb: 'Huge plates, pricey.' },
        { id: 'bigbowl', name: 'Big Bowl Budget', icon: 'bowl-food', share: 1.30, price: 4.00, queueMin: 10, stars: 3.6, blurb: 'Huge plates, cheap. Long queue.' },
        { id: 'smallpricey', name: 'Small and Pricey', icon: 'coins', share: 0.70, price: 6.00, queueMin: 3, stars: 4.0, blurb: 'Dainty plates, premium price.' },
        { id: 'smallcheap', name: 'Small and Cheap', icon: 'leaf', share: 0.70, price: 3.80, queueMin: 6, stars: 3.5, blurb: 'Small plates, low price.' },
        { id: 'standard', name: 'The Standard', icon: 'storefront', share: 'regular', price: 'regular', queueMin: 5, stars: 3.9, blurb: 'A normal plate at a normal price.' },
      ],
    },
    // ---------- God Mode: a whole canteen at lunch. Uses the student-mode stalls and the vendor-mode customers and settings.
    // Everything below is an assumption for the simulation unless it says otherwise.
    canteen: {
      students: 200, studentsMin: 50, studentsMax: 400,            // students who come in over one lunch
      lunchMin: 90, peakMin: 18,                                   // 12:00 to 1:30, busiest about 12:18
      seats: 96,                                                   // 24 tables of 4
      walkMin: 0.5,                                                // each walk: door to stall, stall to seat, seat to bin, bin to door
      eatBaseMin: 4, eatGPerMin: 18,                               // eating time = 4 min + rice eaten / 18 g a minute
      rushLeaveMin: 20,                                            // a student in a rush leaves 20 min after walking in. Set so that, as in survey Q4, running out of time is a rare reason for leaving food (about 1 in 10 here, 6% in the survey)
      serveSec: { generous: 35, bigbowl: 40, smallpricey: 30, smallcheap: 35, standard: 32 },
      jrExtraSec: 0,                                               // extra seconds per plate with two sizes. Vendors mostly said no slowdown (they pre-measure)
      // how students pick a stall: avoid a plate too small for their hunger (big plates bother them less), lower price, shorter wait, better rating, plus personal taste (noise)
      choice: { under: 3.0, over: 2.0, price: 1.0, budgetPrice: 2.5, wait: 0.12, rushWait: 0.35, stars: 0.5, pickyStars: 1.0, noise: 0.6 },
    },
  };
  CONFIG.defaults = JSON.parse(JSON.stringify(CONFIG.params));
  if (typeof module !== 'undefined' && module.exports) module.exports = CONFIG; else root.JR_CONFIG = CONFIG;
})(typeof window !== 'undefined' ? window : globalThis);
