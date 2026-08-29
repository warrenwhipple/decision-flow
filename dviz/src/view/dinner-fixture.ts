import type {
  Acceptance,
  Assessment,
  Criterion,
  Option,
  OutlineSnapshot,
  Placement,
  Question,
  Relation,
  Resolution,
} from "../db/space.ts";

const createdAt = "2026-08-29T18:00:00.000Z";

function question(
  slug: string,
  title: string,
  resolution: Resolution = "open",
  resolvedOptionSlug: string | null = null,
  acceptance: Acceptance = "accepted",
  detail = "",
): Question {
  return { slug, title, detail, acceptance, resolution, resolvedOptionSlug, createdAt, updatedAt: createdAt };
}

function placement(
  childSlug: string,
  parentSlug: string | null,
  position: number,
  canonical = true,
  acceptance: Acceptance = "accepted",
): Placement {
  return { childSlug, parentSlug, position, acceptance, canonical };
}

function option(
  questionSlug: string,
  slug: string,
  title: string,
  position: number,
  acceptance: Acceptance = "accepted",
  detail = "",
): Option {
  return { questionSlug, slug, title, detail, acceptance, position, createdAt, updatedAt: createdAt };
}

function criterion(
  slug: string,
  description: string,
  acceptance: Acceptance = "accepted",
): Criterion {
  return { slug, description, acceptance, createdAt, updatedAt: createdAt };
}

function assessment(
  optionPath: string,
  criterionSlug: string,
  polarity: Assessment["polarity"],
  note: string,
  acceptance: Acceptance = "accepted",
): Assessment {
  return { optionPath, criterionSlug, polarity, note, acceptance };
}

function relation(
  questionSlug: string,
  criterionSlug: string,
  acceptance: Acceptance = "accepted",
): Relation {
  return { questionSlug, criterionSlug, acceptance };
}

export const dinnerFixture: OutlineSnapshot = {
  questions: [
    question("menu", "What should we serve?"),
    question("main-course", "What anchors the meal?", "leaning", "braise", "accepted", "The centerpiece sets the tone for everything around it."),
    question("protein", "Which centerpiece protein?", "decided", "chicken"),
    question("sides", "Which sides belong on the table?"),
    question("starter", "What begins the meal?", "decided", "soup"),
    question("dessert", "What ends the meal?", "leaning", "tart", "suggested"),
    question("drinks", "What should guests drink?"),
    question("wine", "Which wine should we pour?", "decided", "pinot"),
    question("seating", "How should everyone sit?", "leaning", "one-table"),
    question("table-layout", "Which table layout fits best?", "open", null, "suggested"),
    question("timing", "How should the evening run?"),
    question("serve-time", "When should dinner land?", "decided", "seven"),
    question("prep-order", "What gets cooked first?"),
  ],
  placements: [
    placement("menu", null, 0),
    placement("drinks", null, 1),
    placement("seating", null, 2),
    placement("timing", null, 3),
    placement("main-course", "menu", 0),
    placement("starter", "menu", 1),
    placement("dessert", "menu", 2, true, "suggested"),
    placement("protein", "main-course", 0),
    placement("sides", "main-course", 1),
    placement("wine", "main-course", 2),
    placement("wine", "drinks", 0, false, "suggested"),
    placement("table-layout", "seating", 0, true, "suggested"),
    placement("serve-time", "timing", 0),
    placement("prep-order", "timing", 1),
  ],
  options: [
    option("menu", "family-style", "Family style", 0),
    option("menu", "plated", "Plated courses", 1),
    option("main-course", "braise", "Red-wine braise", 0, "accepted", "Rich, forgiving, and ready before guests arrive."),
    option("main-course", "roast", "Herb roast", 1, "accepted", "A dramatic centerpiece that needs careful timing."),
    option("main-course", "pasta", "Filled pasta", 2, "suggested", "Festive and friendly to a meat-free table."),
    option("protein", "chicken", "Roast chicken", 0),
    option("protein", "beef", "Braised beef", 1),
    option("protein", "mushrooms", "Glazed mushrooms", 2),
    option("sides", "greens", "Bitter greens", 0),
    option("sides", "potatoes", "Crisp potatoes", 1),
    option("sides", "squash", "Roasted squash", 2, "suggested"),
    option("starter", "soup", "Squash soup", 0),
    option("starter", "salad", "Pear salad", 1),
    option("dessert", "tart", "Apple tart", 0),
    option("dessert", "cake", "Chocolate cake", 1),
    option("drinks", "mixed", "A mixed bar", 0),
    option("drinks", "wine-only", "Wine only", 1),
    option("drinks", "zero-proof", "Zero-proof pairings", 2, "suggested"),
    option("wine", "pinot", "Pinot noir", 0),
    option("wine", "rioja", "Rioja", 1),
    option("wine", "chablis", "Chablis", 2),
    option("seating", "one-table", "One long table", 0),
    option("seating", "two-tables", "Two small tables", 1),
    option("table-layout", "banquet", "Banquet", 0),
    option("table-layout", "rounds", "Rounds", 1),
    option("timing", "relaxed", "Relaxed", 0),
    option("timing", "paced", "Paced courses", 1),
    option("serve-time", "seven", "Seven o'clock", 0),
    option("serve-time", "eight", "Eight o'clock", 1),
    option("prep-order", "oven-first", "Oven dishes", 0),
    option("prep-order", "stovetop-first", "Stovetop dishes", 1),
  ],
  criteria: [
    criterion("cost", "Keep the total spend comfortable."),
    criterion("prep-time", "Limit hands-on work during the afternoon."),
    criterion("make-ahead", "Reward dishes that improve while resting."),
    criterion("dietary", "Welcome meat-free and dairy-free guests."),
    criterion("seasonality", "Use late-summer produce at its best."),
    criterion("wow-factor", "Give guests one memorable reveal.", "suggested"),
  ],
  assessments: [
    assessment("main-course/braise", "make-ahead", "+", "Better after an overnight rest."),
    assessment("main-course/braise", "cost", "~", "Modest cut, but plenty of wine."),
    assessment("main-course/braise", "dietary", "-", "Leaves fewer choices for two guests."),
    assessment("main-course/roast", "prep-time", "-", "Needs attention just before serving."),
    assessment("main-course/roast", "make-ahead", "?", "Holding quality is uncertain."),
    assessment("main-course/roast", "wow-factor", "+", "Looks generous on a platter.", "suggested"),
    assessment("main-course/pasta", "dietary", "+", "Easy to fill without meat."),
    assessment("main-course/pasta", "prep-time", "-", "Shaping for twelve takes a while."),
    assessment("sides/greens", "seasonality", "+", "The market has excellent chicories."),
    assessment("starter/soup", "make-ahead", "+", "Can be finished the day before."),
    assessment("dessert/tart", "wow-factor", "+", "A glazed top makes a strong finish.", "suggested"),
    assessment("wine/pinot", "cost", "~", "Good bottles span the budget."),
    assessment("wine/pinot", "dietary", "+", "Works for the whole guest list."),
  ],
  relations: [
    relation("main-course", "cost"),
    relation("main-course", "prep-time"),
    relation("main-course", "make-ahead"),
    relation("main-course", "dietary"),
    relation("main-course", "seasonality"),
    relation("main-course", "wow-factor", "suggested"),
    relation("protein", "cost"),
    relation("protein", "dietary"),
    relation("protein", "wow-factor"),
    relation("sides", "prep-time"),
    relation("sides", "dietary"),
    relation("sides", "seasonality"),
    relation("starter", "make-ahead"),
    relation("starter", "seasonality"),
    relation("dessert", "make-ahead"),
    relation("dessert", "wow-factor", "suggested"),
    relation("wine", "cost"),
    relation("wine", "seasonality"),
    relation("wine", "wow-factor"),
    relation("timing", "prep-time"),
    relation("timing", "make-ahead"),
  ],
  focus: { kind: "question", reference: "main-course", setAt: createdAt },
};
