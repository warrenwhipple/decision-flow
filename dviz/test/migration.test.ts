import { Database } from "bun:sqlite";
import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SCHEMA as V3_SCHEMA } from "./fixtures/schema-v3.ts";
import { getEdits, getOutline, initializeSpace, openSpace } from "../src/db/space.ts";

const directories: string[] = [];
afterEach(() => directories.splice(0).forEach((path) => rmSync(path, { recursive: true, force: true })));

function legacy() {
  const directory = mkdtempSync(join(tmpdir(), "dviz-migration-"));
  directories.push(directory);
  const path = join(directory, "space.db");
  const db = new Database(path);
  db.exec(V3_SCHEMA);
  db.exec("PRAGMA user_version = 3");
  for (const [id, slug] of [[1, "root"], [2, "second"], [3, "shared"], [4, "leaf"], [5, "unplaced"]] as const) {
    db.query("INSERT INTO questions (id, slug, title, created_at, updated_at) VALUES (?, ?, ?, 'before', 'before')").run(id, slug, slug);
  }
  db.exec(`INSERT INTO question_parents VALUES (1, NULL, 1, 'accepted'), (2, NULL, 2, 'suggested'),
    (3, 2, 1, 'accepted'), (3, 1, 1, 'suggested'), (4, 3, 1, 'accepted');
    INSERT INTO options VALUES (1, 3, 'yes', 'Yes', 'detail', 'accepted', 1, 'before', 'before');
    UPDATE questions SET resolution = 'decided', resolved_option_id = 1 WHERE id = 3;
    INSERT INTO criteria VALUES (1, 'speed', 'Fast', 'accepted', 'before', 'before');
    INSERT INTO question_criteria VALUES (3, 1, 'accepted');
    INSERT INTO assessments VALUES (1, 1, '+', 'quick', 'accepted');
    INSERT INTO focus VALUES (1, 'option', 1, 'before');
    INSERT INTO edits (ts, actor, verb, entity_kind, payload) VALUES ('before', 'human', 'accept', 'relation', '{}');`);
  return { path, db };
}

test("v3 migration preserves canonical DFS, all parents, content, state, and historical edits; reopening is idempotent", () => {
  const { path, db } = legacy();
  const preserved = Object.fromEntries(["options", "criteria", "question_criteria", "assessments", "focus"].map((table) => [table, db.query(`SELECT * FROM ${table}`).all()]));
  const questions = db.query("SELECT * FROM questions ORDER BY id").all() as Record<string, unknown>[];
  db.close();
  const migrated = openSpace(path);
  const snapshot = getOutline(migrated);
  expect(snapshot.questions.map((q) => [q.slug, q.position])).toEqual([["root", 1], ["second", 2], ["shared", 3], ["leaf", 4], ["unplaced", 5]]);
  expect(snapshot.relations).toHaveLength(3);
  expect(snapshot.relations).toContainEqual({ kind: "part-of", fromKind: "question", from: "shared", to: "second", note: "", acceptance: "accepted" });
  expect(snapshot.relations).toContainEqual(expect.objectContaining({ from: "shared", to: "root", acceptance: "suggested" }));
  for (const [table, rows] of Object.entries(preserved)) expect(migrated.query(`SELECT * FROM ${table}`).all()).toEqual(rows);
  expect((migrated.query("SELECT * FROM questions ORDER BY id").all() as Record<string, unknown>[]).map(({ position, ...q }) => q)).toEqual(questions);
  expect(migrated.query("PRAGMA table_info(question_parents)").all()).toEqual([]);
  expect(migrated.query("PRAGMA foreign_key_check").all()).toEqual([]);
  expect(getEdits(migrated)).toHaveLength(2);
  expect(getEdits(migrated)[0]!.entityKind).toBe("relation");
  expect(getEdits(migrated)[1]).toMatchObject({ actor: "migration", verb: "migrate", payload: { from: 3, to: 4, relations: 3 } });
  migrated.close();
  const reopened = initializeSpace(path); // existing databases also travel through init safely
  expect(getOutline(reopened)).toEqual(snapshot);
  expect(getEdits(reopened)).toHaveLength(2);
  reopened.close();
});

test("a failed migration rolls back DDL, positions, relations, and version, then can be retried", () => {
  const { path, db } = legacy();
  db.exec("CREATE TRIGGER reject_migration BEFORE INSERT ON edits BEGIN SELECT RAISE(ABORT, 'test migration failure'); END");
  db.close();
  expect(() => openSpace(path)).toThrow("test migration failure");
  const failed = new Database(path);
  expect(failed.query("PRAGMA user_version").get()).toEqual({ user_version: 3 });
  expect(failed.query("SELECT COUNT(*) AS count FROM question_parents").get()).toEqual({ count: 5 });
  expect((failed.query("PRAGMA table_info(questions)").all() as { name: string }[]).some((c) => c.name === "position")).toBe(false);
  expect(failed.query("PRAGMA table_info(relations)").all()).toEqual([]);
  failed.exec("DROP TRIGGER reject_migration");
  failed.close();
  const retry = openSpace(path);
  expect(getOutline(retry).questions).toHaveLength(5);
  retry.close();
});
