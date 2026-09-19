import type {
  Acceptance,
  Assessment,
  Criterion,
  Option,
  OutlineSnapshot,
  QuestionRelation,
  Question,
  Relevance,
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
  return { slug, title, detail, acceptance, resolution, resolvedOptionSlug, position: 0, createdAt, updatedAt: createdAt };
}

function relation(kind: QuestionRelation["kind"], from: string, to: string, acceptance: Acceptance = "accepted", note = ""): QuestionRelation {
  return { kind, fromKind: kind === "raises" ? "option" : "question", from, to, acceptance, note };
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

function relevance(
  questionSlug: string,
  criterionSlug: string,
  acceptance: Acceptance = "accepted",
): Relevance {
  return { questionSlug, criterionSlug, acceptance };
}

export const dinnerFixture: OutlineSnapshot = {
  questions: [
    question("menu", "What should we serve?"),
    question("service-style", "Family style or plated?"),
    question("main-course", "What anchors the meal?", "leaning", "braise", "accepted", "The centerpiece sets the tone for everything around it."),
    question("braise-cut", "Which cut for the braise?", "decided", "short-rib"),
    question("roast-bird", "Which bird to roast?", "open", null, "suggested"),
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
  ].map((question, index) => ({ ...question, position: index + 1 })),
  relations: [
    relation("part-of", "service-style", "menu"),
    relation("part-of", "main-course", "menu"),
    relation("raises", "main-course/braise", "braise-cut"),
    relation("raises", "main-course/roast", "roast-bird", "suggested"),
    relation("part-of", "sides", "menu"),
    relation("blocks", "main-course", "sides"),
    relation("part-of", "starter", "menu"),
    relation("part-of", "dessert", "menu", "suggested"),
    relation("part-of", "wine", "drinks"),
    relation("blocks", "main-course", "wine", "accepted", "pairing follows the main"),
    relation("part-of", "table-layout", "seating", "suggested"),
    relation("part-of", "serve-time", "timing"),
    relation("part-of", "prep-order", "timing"),
    relation("blocks", "serve-time", "prep-order"),
    relation("blocks", "main-course", "prep-order", "suggested"),
  ],
  options: [
    option("service-style", "family-style", "Family style", 0),
    option("service-style", "plated", "Plated courses", 1),
    option("main-course", "braise", "Red-wine braise", 0, "accepted", "Rich, forgiving, and ready before guests arrive."),
    option("main-course", "roast", "Herb roast", 1, "accepted", "A dramatic centerpiece that needs careful timing."),
    option("main-course", "pasta", "Filled pasta", 2, "suggested", "Festive and friendly to a meat-free table."),
    option("braise-cut", "short-rib", "Short rib", 0),
    option("braise-cut", "chuck", "Chuck", 1),
    option("braise-cut", "shank", "Shank", 2),
    option("roast-bird", "chicken", "Chicken", 0),
    option("roast-bird", "duck", "Duck", 1),
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
  relevances: [
    relevance("main-course", "cost"),
    relevance("main-course", "prep-time"),
    relevance("main-course", "make-ahead"),
    relevance("main-course", "dietary"),
    relevance("main-course", "seasonality"),
    relevance("main-course", "wow-factor", "suggested"),
    relevance("braise-cut", "cost"),
    relevance("braise-cut", "dietary"),
    relevance("braise-cut", "wow-factor"),
    relevance("sides", "prep-time"),
    relevance("sides", "dietary"),
    relevance("sides", "seasonality"),
    relevance("starter", "make-ahead"),
    relevance("starter", "seasonality"),
    relevance("dessert", "make-ahead"),
    relevance("dessert", "wow-factor", "suggested"),
    relevance("wine", "cost"),
    relevance("wine", "seasonality"),
    relevance("wine", "wow-factor"),
    relevance("timing", "prep-time"),
    relevance("timing", "make-ahead"),
  ],
  focus: { kind: "question", reference: "main-course", setAt: createdAt },
};

/** Dev-only stress shapes retain valid endpoints and deterministic list order. */
export function dinnerShape(shape: string | null): OutlineSnapshot {
  const snapshot = structuredClone(dinnerFixture);
  if (shape === "empty") return { questions: [], options: [], criteria: [], assessments: [], relevances: [], relations: [], focus: null };
  if (shape === "single") {
    const slug = "main-course";
    return { ...snapshot, questions: snapshot.questions.filter((q) => q.slug === slug),
      options: snapshot.options.filter((o) => o.questionSlug === slug),
      relevances: snapshot.relevances.filter((r) => r.questionSlug === slug),
      assessments: snapshot.assessments.filter((a) => a.optionPath.startsWith(`${slug}/`)), relations: [] };
  }
  if (shape === "all-suggested") {
    for (const entities of [snapshot.questions, snapshot.options, snapshot.criteria, snapshot.assessments, snapshot.relevances, snapshot.relations]) {
      for (const entity of entities) entity.acceptance = "suggested";
    }
  }
  if (shape === "big") {
    const copies = Array.from({ length: 8 }, (_, i) => {
      const suffix = (slug: string) => `${slug}-${i + 1}`;
      const path = (value: string) => value.split("/").map(suffix).join("/");
      return {
        questions: snapshot.questions.map((q, j) => ({ ...q, slug: suffix(q.slug), resolvedOptionSlug: q.resolvedOptionSlug ? suffix(q.resolvedOptionSlug) : null, position: i * snapshot.questions.length + j + 1 })),
        options: snapshot.options.map((o) => ({ ...o, questionSlug: suffix(o.questionSlug), slug: suffix(o.slug) })),
        criteria: snapshot.criteria.map((c) => ({ ...c, slug: suffix(c.slug) })),
        assessments: snapshot.assessments.map((a) => ({ ...a, optionPath: path(a.optionPath), criterionSlug: suffix(a.criterionSlug) })),
        relevances: snapshot.relevances.map((r) => ({ ...r, questionSlug: suffix(r.questionSlug), criterionSlug: suffix(r.criterionSlug) })),
        relations: snapshot.relations.map((r) => ({ ...r, from: path(r.from), to: suffix(r.to) })),
      };
    });
    return { questions: copies.flatMap((c) => c.questions), options: copies.flatMap((c) => c.options),
      criteria: copies.flatMap((c) => c.criteria), assessments: copies.flatMap((c) => c.assessments),
      relevances: copies.flatMap((c) => c.relevances), relations: copies.flatMap((c) => c.relations),
      focus: { kind: "question", reference: "main-course-1", setAt: createdAt } };
  }
  return snapshot;
}
