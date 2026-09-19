import { expect, test } from "bun:test";
import { dinnerFixture, dinnerShape } from "../src/view/dinner-fixture.ts";

test("dinner relations and shape clones resolve to valid entities", () => {
  for (const shape of [null, "empty", "single", "all-suggested", "big"]) {
    const snapshot = dinnerShape(shape);
    const questions = new Set(snapshot.questions.map((q) => q.slug));
    const options = new Set(snapshot.options.map((o) => `${o.questionSlug}/${o.slug}`));
    const criteria = new Set(snapshot.criteria.map((c) => c.slug));
    expect(questions.size).toBe(snapshot.questions.length);
    for (const r of snapshot.relations) {
      expect((r.fromKind === "option" ? options : questions).has(r.from)).toBe(true);
      expect(questions.has(r.to)).toBe(true);
    }
    for (const q of snapshot.questions) if (q.resolvedOptionSlug) expect(options.has(`${q.slug}/${q.resolvedOptionSlug}`)).toBe(true);
    for (const r of snapshot.relevances) {
      expect(questions.has(r.questionSlug)).toBe(true);
      expect(criteria.has(r.criterionSlug)).toBe(true);
    }
    for (const a of snapshot.assessments) {
      expect(options.has(a.optionPath)).toBe(true);
      expect(criteria.has(a.criterionSlug)).toBe(true);
    }
  }
  expect(dinnerFixture.options.some((o) => o.questionSlug === "menu")).toBe(false);
  expect(dinnerShape("big").questions).toHaveLength(dinnerFixture.questions.length * 8);
  for (const kind of ["part-of", "raises", "blocks"]) {
    expect(dinnerFixture.relations.some((r) => r.kind === kind && r.acceptance === "suggested")).toBe(true);
  }
  expect(dinnerShape("all-suggested").relations.every((r) => r.acceptance === "suggested")).toBe(true);
  expect(dinnerFixture.questions[0]!.acceptance).toBe("accepted");
});
