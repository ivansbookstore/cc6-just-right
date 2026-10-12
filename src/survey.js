/* Just Right: our real student survey, as counts only (no individual answers). Generated from the Google Form responses.
   n = 97, collected 1 to 7 October 2026. Multi-select questions count every option a student ticked, so they add up to more than n. */
(function (root) {
  const SURVEY = {
 "n": 97,
 "collected": "1 to 7 October 2026",
 "source": "CC6 Sustainability Survey on NTU Canteen Food Waste (Google Form)",
 "questions": {
  "q1": {
   "text": "How often do you buy meals from NTU canteens or food courts?",
   "kind": "single",
   "options": [
    [
     "Less than once a week",
     6
    ],
    [
     "1-2 times a week",
     12
    ],
    [
     "3-5 times a week",
     35
    ],
    [
     "Daily",
     44
    ]
   ]
  },
  "q2": {
   "text": "How often do you leave part of your meal unfinished at NTU canteens?",
   "kind": "scale",
   "options": [
    [
     "Never",
     23
    ],
    [
     "Rarely",
     23
    ],
    [
     "Sometimes",
     41
    ],
    [
     "Often",
     10
    ],
    [
     "Always",
     0
    ]
   ]
  },
  "q3": {
   "text": "When you leave food, what do you usually leave? (pick all that apply)",
   "kind": "multi",
   "options": [
    [
     "Rice / Noodles",
     80
    ],
    [
     "Meat / protein",
     9
    ],
    [
     "Vegetables",
     11
    ],
    [
     "Other food items (soup, gravy, fries)",
     48
    ],
    [
     "I usually finish my meal",
     20
    ]
   ]
  },
  "q4": {
   "text": "Why do you leave food? (pick all that apply)",
   "kind": "multi",
   "options": [
    [
     "Portion too large",
     57
    ],
    [
     "Food does not taste as expected",
     46
    ],
    [
     "I am not hungry enough",
     28
    ],
    [
     "Unable to choose my preferred portion size",
     21
    ],
    [
     "Time constraint",
     10
    ],
    [
     "I usually finish my meal",
     19
    ]
   ]
  },
  "q5": {
   "text": "How often is the standard portion larger than what you need?",
   "kind": "scale",
   "options": [
    [
     "Never",
     11
    ],
    [
     "Rarely",
     41
    ],
    [
     "Sometimes",
     21
    ],
    [
     "Often",
     24
    ],
    [
     "Always",
     0
    ]
   ]
  },
  "q6": {
   "text": "A smaller portion at a slightly lower price: how likely are you to choose it when you do not need a full portion?",
   "kind": "scale",
   "low": "Very unlikely",
   "high": "Very likely",
   "options": [
    [
     "1",
     8
    ],
    [
     "2",
     0
    ],
    [
     "3",
     3
    ],
    [
     "4",
     24
    ],
    [
     "5",
     62
    ]
   ]
  },
  "q8": {
   "text": "Which would you prefer when ordering at an NTU canteen?",
   "kind": "single",
   "options": [
    [
     "Smaller portion at lower price",
     42
    ],
    [
     "Standard portion with easy option to request less rice/noodles",
     27
    ],
    [
     "Smaller default portion with free top-up",
     15
    ],
    [
     "Current standard portion",
     10
    ],
    [
     "None of the above",
     3
    ]
   ]
  },
  "q10": {
   "text": "How much cheaper would a smaller rice or noodle portion need to be for you to choose it?",
   "kind": "single",
   "options": [
    [
     "I would choose it even at the same price",
     10
    ],
    [
     "20 cents cheaper",
     10
    ],
    [
     "30 cents cheaper",
     23
    ],
    [
     "50 cents cheaper",
     13
    ],
    [
     "More than 50 cents cheaper",
     20
    ],
    [
     "I would not choose a smaller portion",
     21
    ]
   ]
  },
  "q11": {
   "text": "If a stall showed a small and a regular portion side by side with prices, would it change what you order?",
   "kind": "single",
   "options": [
    [
     "Yes: more likely to order the small size",
     37
    ],
    [
     "Yes: more likely to order the regular size",
     12
    ],
    [
     "No: it would not change what I order",
     25
    ],
    [
     "Not sure",
     23
    ]
   ]
  }
 }
};
  if (typeof module !== 'undefined' && module.exports) module.exports = SURVEY; else root.JR_SURVEY = SURVEY;
})(typeof window !== 'undefined' ? window : globalThis);
