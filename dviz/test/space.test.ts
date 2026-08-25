import { Database } from "bun:sqlite";
import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { addQuestion, getOutline, initializeSpace } from "../src/db/space.ts";

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

  test("adds a suggested root question and provenance in one transaction", () => {
    const { db } = testSpace();
    const question = addQuestion(db, { title: "  What next?  ", actor: "agent:test" });
    expect(question).toMatchObject({ id: 1, title: "What next?", acceptance: "suggested", resolution: "open" });
    expect(getOutline(db).placements).toEqual([{ childId: 1, parentId: null, position: 1 }]);

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
      { childId: 1, parentId: null, position: 1 },
      { childId: 2, parentId: 1, position: 1 },
      { childId: 3, parentId: 1, position: 2 },
    ]);
    db.close();
  });
});
