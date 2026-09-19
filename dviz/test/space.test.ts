import { Database } from "bun:sqlite";
import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  acceptEntity,
  addCriterion,
  addOption,
  addRelation,
  moveQuestion,
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
    expect((db.query("PRAGMA user_version").get() as { user_version: number }).user_version).toBe(4);
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

  test("inserts related questions in order and rolls back bad relations", () => {
    const { db } = testSpace();
    const actor = "agent:test";
    addQuestion(db, { slug: "parent", title: "Parent", actor });
    addQuestion(db, { slug: "last", title: "Last", actor });
    addOption(db, { questionSlug: "parent", slug: "choice", title: "Choice", actor });
    addQuestion(db, { slug: "child", title: "Child", partOf: "parent", actor });
    addQuestion(db, { slug: "child-two", title: "Second child", partOf: "parent", actor });
    addQuestion(db, { slug: "raised", title: "Raised", raisedBy: "parent/choice", actor });
    addQuestion(db, { slug: "raised-two", title: "Raised too", raisedBy: "parent/choice", actor });
    expect(getOutline(db).questions.map((q) => q.slug)).toEqual(["parent", "raised", "raised-two", "child", "child-two", "last"]);
    const before = getOutline(db);
    const edits = getEdits(db);
    expect(() => addQuestion(db, { slug: "bad", title: "Bad", partOf: "child", raisedBy: "missing/choice", after: "first", actor })).toThrow("does not exist");
    expect(getOutline(db)).toEqual(before);
    expect(getEdits(db)).toEqual(edits);
    moveQuestion(db, "last", "first", actor);
    moveQuestion(db, "child", "raised-two", actor);
    expect(getOutline(db).questions.map((q) => q.slug)).toEqual(["last", "parent", "raised", "raised-two", "child", "child-two"]);
    expect(() => moveQuestion(db, "child", "child", actor)).toThrow("itself");
    addQuestion(db, { slug: "first", title: "First", after: "first", actor });
    expect(getOutline(db).questions[0]!.slug).toBe("first");
    db.close();
  });

  test("enforces relation kinds, endpoints, duplicates, and per-kind projected cycles", () => {
    const { db } = testSpace();
    const actor = "agent:test";
    for (const slug of ["a", "b", "c"]) {
      addQuestion(db, { slug, title: slug, actor });
      addOption(db, { questionSlug: slug, slug: "choice", title: "Choice", actor });
    }
    for (const kind of ["part-of", "blocks", "raises"] as const) {
      const from = (slug: string) => kind === "raises" ? `${slug}/choice` : slug;
      expect(addRelation(db, { kind, from: from("a"), to: "b", actor }).acceptance).toBe("suggested");
      addRelation(db, { kind, from: from("b"), to: "c", actor });
      expect(() => addRelation(db, { kind, from: from("c"), to: "a", actor })).toThrow(`${kind} cycle`);
      expect(() => addRelation(db, { kind, from: from("a"), to: "b", actor })).toThrow("already exists");
      expect(() => addRelation(db, { kind, from: from("a"), to: "a", actor })).toThrow("itself");
      expect(() => addRelation(db, { kind, from: kind === "raises" ? "a" : "a/choice", to: "b", actor })).toThrow("requires");
    }
    removeEntity(db, "relation", "blocks:a:b", "human");
    removeEntity(db, "relation", "blocks:b:c", "human");
    addRelation(db, { kind: "blocks", from: "b", to: "a", actor }); // opposite to part-of is legitimate
    acceptEntity(db, "relation", "raises:a/choice:b", "human");
    expect(getOutline(db).relations.find((r) => r.kind === "raises" && r.from === "a/choice")!.acceptance).toBe("accepted");
    updateQuestion(db, "a", { slug: "renamed", actor });
    updateOption(db, "renamed/choice", { slug: "new", actor });
    expect(getOutline(db).relations).toContainEqual(expect.objectContaining({ from: "renamed/new" }));
    removeEntity(db, "option", "renamed/new", "human");
    expect(getOutline(db).relations.some((r) => r.from === "renamed/new")).toBe(false);
    removeEntity(db, "question", "b", "human");
    expect(getOutline(db).relations).toEqual([]);
    db.close();
  });

  test("renders both relation directions, notes, and undirected hop neighborhoods", () => {
    const { db } = testSpace();
    const actor = "agent:test";
    for (const slug of ["menu", "main", "cut", "sides", "other"]) addQuestion(db, { slug, title: slug, actor });
    addOption(db, { questionSlug: "main", slug: "braise", title: "Braise", actor });
    addRelation(db, { kind: "part-of", from: "main", to: "menu", actor });
    addRelation(db, { kind: "raises", from: "main/braise", to: "cut", actor });
    addRelation(db, { kind: "blocks", from: "main", to: "sides", note: "pairing follows the main", actor });
    expect(renderOutline(db)).toContain("(part of menu? · raises braise→cut? · blocks sides?)");
    expect(renderOutline(db)).toContain("(raised by main/braise?)");
    expect(renderEntity(db, "question", "sides")).toContain("Blocked by: main [suggested] — pairing follows the main");
    expect(renderOutline(db, { around: "cut" }).split("\n").filter(Boolean)).toHaveLength(2);
    expect(renderOutline(db, { around: "cut", hops: 2 }).split("\n").filter(Boolean)).toHaveLength(4);
    expect(renderOutline(db, { around: "cut", hops: 0 }).split("\n").filter(Boolean)).toHaveLength(1);
    expect(renderOutline(db, { around: "cut", hops: 3 })).not.toContain("other:");
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
    acceptEntity(db, "option", "travel-route/north", "human");
    acceptEntity(db, "criterion", "focus-flow", "human");
    acceptEntity(db, "assessment", "travel-route/north:focus-flow", "human");
    acceptEntity(db, "relevance", "travel-route:focus-flow", "human");
    setQuestionResolution(db, "travel-route", "decided", "north", "human");
    setFocus(db, "question", "travel-route", "agent:test");

    expect(getOutline(db)).toMatchObject({
      focus: { kind: "question", reference: "travel-route" },
      criteria: [{ slug: "focus-flow", description: "Preserves focus.", acceptance: "accepted" }],
      assessments: [{
        optionPath: "travel-route/north", criterionSlug: "focus-flow", polarity: "+",
        note: "Few interruptions.", acceptance: "accepted",
      }],
      relevances: [{ questionSlug: "travel-route", criterionSlug: "focus-flow", acceptance: "accepted" }],
    });
    expect(JSON.stringify(getOutline(db))).not.toMatch(/"(?:id|questionId|optionId|criterionId)"/);
    expect(renderOutline(db)).toContain("● travel-route: Which path now? → north");
    expect(renderOutline(db)).not.toContain("[suggested]");
    expect(renderEntity(db, "option", "travel-route/north")).toContain("+ focus-flow [accepted] — Few interruptions.");
    expect(getEdits(db).filter(({ verb }) => verb === "rename")).toHaveLength(2);
    expect(JSON.stringify(getEdits(db))).not.toContain("questionId");

    setQuestionResolution(db, "travel-route", "open", null, "human");
    expect(getOutline(db).questions[0]).toMatchObject({ resolution: "open", resolvedOptionSlug: null });
    db.close();
  });

  test("projects focus through stable slug references and clears it with its node", () => {
    const { db } = testSpace();
    addQuestion(db, { slug: "route", title: "Which route?", actor: "agent:test" });
    addOption(db, { questionSlug: "route", slug: "north", title: "Go north", actor: "agent:test" });
    addCriterion(db, { slug: "speed", description: "Arrive sooner", actor: "agent:test" });

    setFocus(db, "option", "route/north", "agent:test");
    expect(getOutline(db).focus).toMatchObject({ kind: "option", reference: "route/north" });
    updateOption(db, "route/north", { slug: "northern", actor: "agent:test" });
    expect(getOutline(db).focus).toMatchObject({ kind: "option", reference: "route/northern" });

    setFocus(db, "criterion", "speed", "agent:test");
    expect(getOutline(db)).toMatchObject({
      focus: { kind: "criterion", reference: "speed" },
      criteria: [{ slug: "speed" }],
    });
    removeEntity(db, "criterion", "speed", "human");
    expect(getOutline(db).focus).toBeNull();
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

  test("removes by slug and leaves surviving questions in place", () => {
    const { db } = testSpace();
    addQuestion(db, { slug: "parent", title: "Parent", actor: "agent:test" });
    addQuestion(db, { slug: "child", title: "Child", partOf: "parent", actor: "agent:test" });
    addOption(db, { questionSlug: "parent", slug: "chosen", title: "Chosen", actor: "agent:test" });
    addCriterion(db, { slug: "trust", actor: "agent:test" });
    setAssessment(db, { optionPath: "parent/chosen", criterionSlug: "trust", polarity: "+", actor: "agent:test" });
    setQuestionResolution(db, "parent", "decided", "chosen", "human");
    removeEntity(db, "question", "parent", "human");
    expect(getOutline(db)).toMatchObject({
      questions: [{ slug: "child" }],
      relations: [],
      options: [],
    });
    expect(db.query("SELECT COUNT(*) AS count FROM assessments").get()).toEqual({ count: 0 });
    db.close();
  });
});
