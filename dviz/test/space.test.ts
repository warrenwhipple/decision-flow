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
  updateOption,
  updateQuestion,
  validateSlug,
} from "../src/db/space.ts";

const temporaryDirectories: string[] = [];

function testSpace(): { db: Database; directory: string } {
  const directory = mkdtempSync(join(tmpdir(), "dviz-test-"));
  temporaryDirectories.push(directory);
  return { db: initializeSpace(join(directory, "space.db")), directory };
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe("decision space", () => {
  test("creates the slug-first v0 schema", () => {
    const { db } = testSpace();
    const questionColumns = db.query("PRAGMA table_info(questions)").all() as { name: string; notnull: number }[];
    const optionColumns = db.query("PRAGMA table_info(options)").all() as { name: string; notnull: number }[];
    expect(questionColumns).toContainEqual(expect.objectContaining({ name: "slug", notnull: 1 }));
    expect(optionColumns).toContainEqual(expect.objectContaining({ name: "slug", notnull: 1 }));
    expect((db.query("PRAGMA user_version").get() as { user_version: number }).user_version).toBe(3);
    db.close();
  });

  test("migrates an empty pre-slug space but refuses to invent slugs for populated data", () => {
    const first = testSpace();
    first.db.close();
    const path = join(first.directory, "space.db");
    const legacy = new Database(path);
    legacy.exec("PRAGMA foreign_keys = OFF;");
    legacy.exec("ALTER TABLE questions RENAME TO questions_slug_first;");
    legacy.exec(`CREATE TABLE questions (
      id INTEGER PRIMARY KEY, title TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '',
      acceptance TEXT NOT NULL DEFAULT 'suggested', resolution TEXT NOT NULL DEFAULT 'open',
      resolved_option_id INTEGER, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );`);
    legacy.exec("DROP TABLE questions_slug_first;");
    legacy.exec("PRAGMA user_version = 2;");
    legacy.close();
    const migrated = openSpace(path);
    expect((migrated.query("PRAGMA table_info(questions)").all() as { name: string }[]).map(({ name }) => name)).toContain("slug");
    migrated.close();

    const second = testSpace();
    second.db.exec("PRAGMA user_version = 2;");
    second.db.close();
    const secondPath = join(second.directory, "space.db");
    const populated = new Database(secondPath);
    populated.exec("PRAGMA foreign_keys = OFF;");
    populated.exec("ALTER TABLE questions RENAME TO questions_slug_first;");
    populated.exec(`CREATE TABLE questions (
      id INTEGER PRIMARY KEY, title TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '',
      acceptance TEXT NOT NULL DEFAULT 'suggested', resolution TEXT NOT NULL DEFAULT 'open',
      resolved_option_id INTEGER, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );`);
    populated.exec("INSERT INTO questions VALUES (1, 'Legacy', '', 'suggested', 'open', NULL, 'now', 'now');");
    populated.exec("DROP TABLE questions_slug_first;");
    populated.close();
    expect(() => openSpace(secondPath)).toThrow("will not invent permanent slugs");
  });

  test("enforces the universal slug format and collision scopes", () => {
    const { db } = testSpace();
    expect(() => validateSlug("2fast")).toThrow("start with a letter");
    expect(() => validateSlug("two--fast")).toThrow("single hyphens");
    expect(() => validateSlug(" route ")).toThrow("lowercase letters");
    expect(() => validateSlug(`a${"b".repeat(64)}`)).toThrow("at most 64");

    addQuestion(db, { slug: "choose-route", title: "Choose a route", actor: "agent:test" });
    addQuestion(db, { slug: "other-route", title: "Choose another", actor: "agent:test" });
    expect(() => addQuestion(db, { slug: "choose-route", title: "Collision", actor: "agent:test" }))
      .toThrow("Question slug choose-route already exists");
    addOption(db, { questionSlug: "choose-route", slug: "north", title: "Northern route", actor: "agent:test" });
    addOption(db, { questionSlug: "other-route", slug: "north", title: "Northern route", actor: "agent:test" });
    expect(() => addOption(db, { questionSlug: "choose-route", slug: "north", title: "Duplicate", actor: "agent:test" }))
      .toThrow("Option slug north already exists in that question");
    addCriterion(db, { slug: "choose-route", actor: "agent:test" });
    db.close();
  });

  test("adds suggested slug-addressed questions and ordered children transactionally", () => {
    const { db } = testSpace();
    addQuestion(db, { slug: "parent", title: " Parent ", actor: "agent:test" });
    addQuestion(db, { slug: "first-child", title: "First", parentSlug: "parent", actor: "agent:test" });
    addQuestion(db, { slug: "second-child", title: "Second", parentSlug: "parent", actor: "agent:test" });
    expect(getOutline(db)).toMatchObject({
      questions: [
        { slug: "parent", title: "Parent", acceptance: "suggested", resolution: "open" },
        { slug: "first-child" },
        { slug: "second-child" },
      ],
      placements: [
        { childSlug: "parent", parentSlug: null, position: 1, acceptance: "suggested" },
        { childSlug: "first-child", parentSlug: "parent", position: 1, acceptance: "suggested" },
        { childSlug: "second-child", parentSlug: "parent", position: 2, acceptance: "suggested" },
      ],
    });
    expect(getEdits(db)[0]!.payload).toMatchObject({ slug: "parent", parent: "root" });
    db.close();
  });

  test("supports the slug-first status, rename, assessment, and projection lifecycle", () => {
    const { db } = testSpace();
    addQuestion(db, { slug: "route", title: "Which path?", detail: "Choose carefully.", actor: "agent:test" });
    updateQuestion(db, "route", { slug: "travel-route", title: "Which path now?", actor: "agent:test" });
    addOption(db, { questionSlug: "travel-route", slug: "path-a", title: "Path A", detail: "Fast.", actor: "agent:test" });
    updateOption(db, "travel-route/path-a", { slug: "north", actor: "agent:test" });
    addCriterion(db, { slug: "focus-flow", description: "Preserves focus.", actor: "agent:test" });
    setAssessment(db, { optionPath: "travel-route/north", criterionSlug: "focus-flow", polarity: "+", note: "Few interruptions.", actor: "agent:test" });
    relateCriterion(db, { questionSlug: "travel-route", criterionSlug: "focus-flow", actor: "agent:test" });
    setQuestionResolution(db, "travel-route", "leaning", "north", "human");

    acceptEntity(db, "question", "travel-route", "human");
    acceptEntity(db, "placement", "travel-route:root", "human");
    acceptEntity(db, "option", "travel-route/north", "human");
    acceptEntity(db, "criterion", "focus-flow", "human");
    acceptEntity(db, "assessment", "travel-route/north:focus-flow", "human");
    acceptEntity(db, "relation", "travel-route:focus-flow", "human");
    setQuestionResolution(db, "travel-route", "decided", "north", "human");
    setFocus(db, "question", "travel-route", "agent:test");

    expect(renderOutline(db)).toContain("● travel-route: Which path now? → north");
    expect(renderOutline(db)).toContain("- north");
    expect(renderOutline(db)).not.toContain("[suggested]");
    expect(renderEntity(db, "option", "travel-route/north")).toContain("+ focus-flow [accepted] — Few interruptions.");
    expect(getEdits(db).filter(({ verb }) => verb === "rename")).toHaveLength(2);
    expect(JSON.stringify(getEdits(db))).not.toContain("questionId");

    setQuestionResolution(db, "travel-route", "open", null, "human");
    expect(getOutline(db).questions[0]).toMatchObject({ resolution: "open", resolvedOptionSlug: null });
    db.close();
  });

  test("rejects a bare or wrong-question option path", () => {
    const { db } = testSpace();
    addQuestion(db, { slug: "first", title: "First", actor: "agent:test" });
    addQuestion(db, { slug: "second", title: "Second", actor: "agent:test" });
    addOption(db, { questionSlug: "second", slug: "other", title: "Other", actor: "agent:test" });
    expect(() => setQuestionResolution(db, "first", "decided", "other", "human"))
      .toThrow("Option first/other does not exist.");
    expect(() => renderEntity(db, "option", "other")).toThrow("question-slug/option-slug");
    db.close();
  });

  test("removes by slug and re-roots surviving children", () => {
    const { db } = testSpace();
    addQuestion(db, { slug: "parent", title: "Parent", actor: "agent:test" });
    addQuestion(db, { slug: "child", title: "Child", parentSlug: "parent", actor: "agent:test" });
    addOption(db, { questionSlug: "parent", slug: "chosen", title: "Chosen", actor: "agent:test" });
    addCriterion(db, { slug: "trust", actor: "agent:test" });
    setAssessment(db, { optionPath: "parent/chosen", criterionSlug: "trust", polarity: "+", actor: "agent:test" });
    setQuestionResolution(db, "parent", "decided", "chosen", "human");
    removeEntity(db, "question", "parent", "human");
    expect(getOutline(db)).toMatchObject({
      questions: [{ slug: "child" }],
      placements: [{ childSlug: "child", parentSlug: null, acceptance: "suggested" }],
      options: [],
    });
    expect(db.query("SELECT COUNT(*) AS count FROM assessments").get()).toEqual({ count: 0 });
    db.close();
  });
});
