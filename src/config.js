/* Just Right: every number the game uses, with where it came from.
   status: "survey"     = from our student survey (97 responses, 1 to 7 October 2026)
           "vendor"     = from our vendor survey: confirm before quoting
           "assumption" = no data yet; flagged in the game
   Change values here (or on the "How this works" screen): nothing else needs editing. */
(function (root) {
  const CONFIG = {
    version: '0.1 (MVP)',
    params: {
      regularRiceG:   { label: 'Rice/noodles in a Regular plate', value: 200, unit: 'g', min: 150, max: 260, step: 10, source: 'Vendor survey, portion question (answers ~150-250 g)', status: 'vendor' },
      smallShare:     { label: 'Small plate as a share of Regular', value: 0.70, unit: '%', min: 0.5, max: 0.9, step: 0.05, source: 'Group decision, to test in the pilot', status: 'assumption', editable: true },
      regularPrice:   { label: 'Price of a Regular plate', value: 5.00, unit: 'S$', min: 4, max: 9, step: 0.1, source: 'Vendor survey, price question (S$4.50-8.00)', status: 'vendor', editable: true },
      discount:       { label: 'Small plate discount', value: 0.50, unit: 'S$', min: 0.1, max: 1.5, step: 0.1, source: 'Vendor survey, fair-discount question', status: 'vendor', editable: true },
      riceCostRegular:{ label: 'Rice/noodle cost in a Regular plate', value: 1.50, unit: 'S$', min: 0.3, max: 3, step: 0.1, source: 'Vendor survey, cost question. Answers unclear (rice only, or whole plate?). Confirm.', status: 'vendor', editable: true },
      toppingCost:    { label: 'Cost of everything else on the plate', value: 2.00, unit: 'S$', min: 1, max: 4, step: 0.1, source: 'No data. Does not change the Today vs Just Right difference', status: 'assumption' },
      extraVegCost:   { label: 'Cost of the extra vegetables a vendor adds instead of a discount', value: 0.30, unit: 'S$', min: 0, max: 1, step: 0.05, source: 'No data. Vendors said they add vegetables or meat instead of charging less', status: 'assumption' },
      lessRiceShare:  { label: '"Less rice" scoop today, as a share of Regular', value: 0.70, unit: '%', min: 0.5, max: 0.9, step: 0.05, source: 'Assumed equal to the Small plate', status: 'assumption' },
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
      shareBig:       { label: 'Big eaters (added on top, others scaled down)', value: 0.10, unit: '%', min: 0, max: 0.3, step: 0.05, source: 'No survey question asks this', status: 'assumption', editable: true },
      lightSpeakUp:   { label: 'Light eaters who ask for less rice', value: 0.50, unit: '%', min: 0, max: 1, step: 0.05, source: 'No data. 21 of 97 say they cannot choose their portion', status: 'assumption', editable: true },
      neverLeaveCleanPlater: { label: 'Of those who never leave food, share who finish even when full', value: 0.50, unit: '%', source: 'No data', status: 'assumption' },
      rusherShare:    { label: 'Chance a customer is rushing at this meal', value: 0.10, unit: '%', source: 'No data. 10 of 97 name time as one reason they leave food (not every meal)', status: 'assumption' },
      rushEatCap:     { label: 'Most a rusher can eat, as a share of Regular', value: 0.70, unit: '%', source: 'No data', status: 'assumption' },
      budgetShare:    { label: 'Budget-minded customers', value: 0.30, unit: '%', source: 'No data', status: 'assumption' },
      tasteLetdownPicky: { label: 'Chance the food disappoints a picky eater', value: 0.40, unit: '%', source: 'No data', status: 'assumption' },
      tasteLetdownOther: { label: 'Chance the food disappoints anyone else', value: 0.05, unit: '%', source: 'No data. 46 of 97 name taste as one reason they leave food', status: 'assumption' },
      ratingSensitivity: { label: 'Change in tomorrow\'s customers per star of rating difference', value: 0.30, unit: '%', source: 'No data. Illustrates how ratings drive customers', status: 'assumption' },
    },
    calibration: 'Check against the survey: in the model about 4 in 10 Today meals leave food (39% over 40 simulated days). Our survey of 97 students (23 Never, 23 Rarely, 41 Sometimes, 10 Often, 0 Always) gives about 28% if Rarely means about 15% of meals, Sometimes 40% and Often 70%. That conversion is our assumption, and it suggests the model overstates today\'s waste, and so the waste Just Right saves. The plate-waste photo audit should replace these appetite ranges.',
    personas: {
      light:  { name: 'The Light Eater', icon: 'feather', appetite: [0.80, 1.15], line: 'Auntie, less rice can?', jrLine: 'One Small, please.' },
      quiet:  { name: 'The Quiet One', icon: 'hand-pointing', appetite: [0.80, 1.15], line: '(points at the dish, says nothing)', jrLine: '(points at Small on the board)' },
      usual:  { name: 'The Usual', icon: 'repeat', appetite: [0.95, 1.20], line: 'Same as always.', jrLine: 'Regular, thanks.' },
      clean:  { name: 'The Clean-Plater', icon: 'seal-check', appetite: [0.60, 0.85], line: 'Cannot waste food.', jrLine: 'Regular, thanks.', cleanPlater: true },
      picky:  { name: 'The Picky One', icon: 'magnifying-glass', appetite: [0.90, 1.10], line: 'Hmm… what\'s good today?', jrLine: 'Regular… I guess.' },
      big:    { name: 'The Gym Regular', icon: 'barbell', appetite: [1.10, 1.40], line: 'Boss, add rice please!', jrLine: 'Regular, add rice please!' },
    },
    traitLines: { rusher: 'Fast fast, got class at 2!', budget: 'Got cheaper one?' },
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
        { id: 'justright', name: 'Just Right', icon: 'seal-check', share: 'regular', price: 'regular', queueMin: 5, stars: 4.0, blurb: 'Regular, and Small from week 2.', hasSmall: true },
      ],
    },
  };
  CONFIG.defaults = JSON.parse(JSON.stringify(CONFIG.params));
  if (typeof module !== 'undefined' && module.exports) module.exports = CONFIG; else root.JR_CONFIG = CONFIG;
})(typeof window !== 'undefined' ? window : globalThis);
