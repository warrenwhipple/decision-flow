import { Database } from "bun:sqlite";
import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  acceptEntity,
  addCriterion,
  addOption,
  addQuestion,
  getEdits,
  getOutline,
  initializeSpace,
  openSpace,
  relateCriterion,
  removeEntity,
  renderEntity,
  renderOutline,
  setAssessment,
  setFocus,
  setQuestionResolution,
  updateQuestion,
} from "../src/db/space.ts";

const temporaryDirectories: string[] = [];

function testSpace(): { db: Database; directory: string } {
  const directory = mkdtempSync(join(tmpdir(), "dviz-test-"));
  temporaryDirectories.push(directory);
  return { db: initializeSpace(join(directory, "space.db")), directory };
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("decision space", () => {
  test("creates the complete v0 schema", () => {
    const { db } = testSpace();
    const tables = db.query(`
      SELECT name FROM sqlite_master
      WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `).all() as { name: string }[];
    expect(tables.map(({ name }) => name)).toEqual([
      "assessments",
      "criteria",
      "edits",
      "focus",
      "options",
      "question_criteria",
      "question_parents",
      "questions",
    ]);
    db.close();
  });

  test("migrates a thin-slice space to placement acceptance", () => {
    const { db, directory } = testSpace();
    db.exec("ALTER TABLE question_parents DROP COLUMN acceptance;");
    db.exec("PRAGMA user_version = 1;");
    db.close();

    const migrated = openSpace(join(directory, "space.db"));
    const columns = migrated.query("PRAGMA table_info(question_parents)").all() as { name: string }[];
    expect(columns.map(({ name }) => name)).toContain("acceptance");
    expect((migrated.query("PRAGMA user_version").get() as { user_version: number }).user_version).toBe(2);
    migrated.close();
  });

  test("adds a suggested root question and provenance in one transaction", () => {
    const { db } = testSpace();
    const question = addQuestion(db, { title: "  What next?  ", actor: "agent:test" });
    expect(question).toMatchObject({ id: 1, title: "What next?", acceptance: "suggested", resolution: "open" });
    expect(getOutline(db).placements).toEqual([
      { childId: 1, parentId: null, position: 1, acceptance: "suggested" },
    ]);

    const edit = db.query("SELECT actor, verb, entity_kind, entity_id, payload FROM edits").get() as Record<string, unknown>;
    expect(edit).toMatchObject({ actor: "agent:test", verb: "add", entity_kind: "question", entity_id: 1 });
    expect(JSON.parse(String(edit.payload))).toMatchObject({ title: "What next?", acceptance: "suggested" });
    db.close();
  });

  test("orders child questions under their parent", () => {
    const { db } = testSpace();
    const parent = addQuestion(db, { title: "Parent", actor: "agent:test" });
    addQuestion(db, { title: "First child", parentId: parent.id, actor: "agent:test" });
    addQuestion(db, { title: "Second child", parentId: parent.id, actor: "agent:test" });
    expect(getOutline(db).placements).toEqual([
      { childId: 1, parentId: null, position: 1, acceptance: "suggested" },
      { childId: 2, parentId: 1, position: 1, acceptance: "suggested" },
      { childId: 3, parentId: 1, position: 2, acceptance: "suggested" },
    ]);
    db.close();
  });

  test("supports the complete status and decision lifecycle", () => {
    const { db } = testSpace();
    const question = addQuestion(db, { title: "Which path?", detail: "Choose carefully.", actor: "agent:test" });
    updateQuestion(db, question.id, { title: "Which path now?", actor: "agent:test" });
    const option = addOption(db, { questionId: question.id, title: "Path A", detail: "Fast.", actor: "agent:test" });
    const criterion = addCriterion(db, { slug: "focus-flow", description: "Preserves focus.", actor: "agent:test" });
    setAssessment(db, {
      optionId: option.id,
      criterionSlug: criterion.slug,
      polarity: "+",
      note: "Few interruptions.",
      actor: "agent:test",
    });
    relateCriterion(db, { questionId: question.id, criterionSlug: criterion.slug, actor: "agent:test" });
    setQuestionResolution(db, question.id, "leaning", option.id, "human");

    acceptEntity(db, "question", question.id, "human");
    acceptEntity(db, "placement", { firstId: question.id, second: "root" }, "human");
    acceptEntity(db, "option", option.id, "human");
    acceptEntity(db, "criterion", criterion.id, "human");
    acceptEntity(db, "assessment", { firstId: option.id, second: criterion.slug }, "human");
    acceptEntity(db, "relation", { firstId: question.id, second: criterion.slug }, "human");
    setQuestionResolution(db, question.id, "decided", option.id, "human");
    setFocus(db, "question", question.id, "agent:test");

    expect(renderOutline(db)).toContain(`● Q${question.id} Which path now? → O${option.id}`);
    expect(renderOutline(db)).not.toContain("[suggested]");
    expect(renderEntity(db, "option", option.id)).toContain("+ focus-flow [accepted] — Few interruptions.");
    expect(getEdits(db).map(({ verb }) => verb)).toContain("decide");

    setQuestionResolution(db, question.id, "open", null, "human");
    expect(getOutline(db).questions[0]).toMatchObject({ resolution: "open", resolvedOptionId: null });
    db.close();
  });

  test("rejects a resolution pointing to another question's option", () => {
    const { db } = testSpace();
    const first = addQuestion(db, { title: "First", actor: "agent:test" });
    const second = addQuestion(db, { title: "Second", actor: "agent:test" });
    const option = addOption(db, { questionId: second.id, title: "Other option", actor: "agent:test" });
    expect(() => setQuestionResolution(db, first.id, "decided", option.id, "human"))
      .toThrow(`Option ${option.id} does not belong to question ${first.id}.`);
    expect(getOutline(db).questions[0]).toMatchObject({ resolution: "open", resolvedOptionId: null });
    db.close();
  });

  test("removes dependent records and re-roots surviving children", () => {
    const { db } = testSpace();
    const parent = addQuestion(db, { title: "Parent", actor: "agent:test" });
    const child = addQuestion(db, { title: "Child", parentId: parent.id, actor: "agent:test" });
    const option = addOption(db, { questionId: parent.id, title: "Chosen", actor: "agent:test" });
    addCriterion(db, { slug: "trust", actor: "agent:test" });
    setAssessment(db, { optionId: option.id, criterionSlug: "trust", polarity: "+", actor: "agent:test" });
    setQuestionResolution(db, parent.id, "decided", option.id, "human");

    removeEntity(db, "question", parent.id, "human");
    expect(getOutline(db)).toMatchObject({
      questions: [{ id: child.id, title: "Child" }],
      placements: [{ childId: child.id, parentId: null, acceptance: "suggested" }],
      options: [],
    });
    expect(db.query("SELECT COUNT(*) AS count FROM assessments").get()).toEqual({ count: 0 });
    db.close();
  });
});
