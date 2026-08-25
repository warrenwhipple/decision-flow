import { Database } from "bun:sqlite";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, parse, resolve } from "node:path";
import { SCHEMA, SCHEMA_VERSION } from "./schema.ts";

export const DEFAULT_PORT = 4377;
export const SPACE_DIRECTORY = ".dviz";
export const SPACE_FILENAME = "space.db";
export const SERVER_FILENAME = "server.json";

export type Acceptance = "suggested" | "accepted";
export type Resolution = "open" | "leaning" | "decided";
export type Polarity = "+" | "-" | "~" | "?";
export type NodeKind = "question" | "option" | "criterion";
export type EntityKind = NodeKind | "assessment" | "relation" | "placement";

export type Question = {
  id: number;
  title: string;
  detail: string;
  acceptance: Acceptance;
  resolution: Resolution;
  resolvedOptionId: number | null;
  createdAt: string;
  updatedAt: string;
};

export type Placement = {
  childId: number;
  parentId: number | null;
  position: number;
  acceptance: Acceptance;
};

export type Option = {
  id: number;
  questionId: number;
  title: string;
  detail: string;
  acceptance: Acceptance;
  position: number;
  createdAt: string;
  updatedAt: string;
};

export type Criterion = {
  id: number;
  slug: string;
  description: string;
  acceptance: Acceptance;
  createdAt: string;
  updatedAt: string;
};

export type Assessment = {
  optionId: number;
  criterionId: number;
  criterionSlug: string;
  polarity: Polarity;
  note: string;
  acceptance: Acceptance;
};

export type Relation = {
  questionId: number;
  criterionId: number;
  criterionSlug: string;
  acceptance: Acceptance;
};

export type Edit = {
  id: number;
  ts: string;
  actor: string;
  verb: string;
  entityKind: string;
  entityId: number | null;
  payload: Record<string, unknown>;
};

export type OutlineSnapshot = {
  questions: Question[];
  placements: Placement[];
  options: Option[];
};

export type AddQuestionInput = {
  title: string;
  detail?: string;
  parentId?: number | null;
  actor: string;
};

export type EdgeReference = { firstId: number; second: string };

export function resolvePath(path: string, cwd = process.cwd()): string {
  return isAbsolute(path) ? path : resolve(cwd, path);
}

export function defaultDbPath(cwd = process.cwd()): string {
  return join(cwd, SPACE_DIRECTORY, SPACE_FILENAME);
}

export function dbOverride(explicit?: string): string | undefined {
  return explicit ?? process.env.DVIZ_DB;
}

export function findDbPath(cwd = process.cwd(), explicit?: string): string {
  const override = dbOverride(explicit);
  if (override) {
    const path = resolvePath(override, cwd);
    if (!existsSync(path)) {
      throw new Error(`No decision space found at ${path}. Run \`dviz init --db ${override}\` first.`);
    }
    return path;
  }
  let directory = resolve(cwd);
  const root = parse(directory).root;
  while (true) {
    const candidate = defaultDbPath(directory);
    if (existsSync(candidate)) return candidate;
    if (directory === root) break;
    directory = dirname(directory);
  }
  throw new Error("No decision space found from the current directory upward. Run `dviz init` first.");
}

function configure(db: Database): void {
  db.exec("PRAGMA foreign_keys = ON;");
}

function migrate(db: Database): void {
  const version = Number((db.query("PRAGMA user_version").get() as { user_version: number }).user_version);
  if (version > SCHEMA_VERSION) {
    throw new Error(`This decision space uses schema version ${version}, but this dviz supports ${SCHEMA_VERSION}.`);
  }
  if (version < 2) {
    const columns = db.query("PRAGMA table_info(question_parents)").all() as { name: string }[];
    if (!columns.some(({ name }) => name === "acceptance")) {
      db.exec(`ALTER TABLE question_parents ADD COLUMN acceptance TEXT NOT NULL DEFAULT 'suggested'
        CHECK (acceptance IN ('suggested', 'accepted'));`);
    }
  }
  db.exec(`PRAGMA user_version = ${SCHEMA_VERSION};`);
}

export function initializeSpace(path: string): Database {
  mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path, { create: true, strict: true });
  configure(db);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec(SCHEMA);
  migrate(db);
  return db;
}

export function openSpace(path: string): Database {
  if (!existsSync(path)) throw new Error(`No decision space found at ${path}. Run \`dviz init\` first.`);
  const db = new Database(path, { strict: true });
  configure(db);
  migrate(db);
  return db;
}

export function ensureGitignored(projectDirectory: string): boolean {
  const gitignore = join(projectDirectory, ".gitignore");
  const entry = `${SPACE_DIRECTORY}/`;
  const current = existsSync(gitignore) ? readFileSync(gitignore, "utf8") : "";
  const lines = current.split(/\r?\n/).map((line) => line.trim());
  if (lines.includes(entry)) return false;
  const prefix = current.length > 0 && !current.endsWith("\n") ? "\n" : "";
  appendFileSync(gitignore, `${prefix}${entry}\n`, "utf8");
  return true;
}

export function serverInfoPath(dbPath: string): string {
  return join(dirname(dbPath), SERVER_FILENAME);
}

function timestamp(): string {
  return new Date().toISOString();
}

function appendEdit(
  db: Database,
  actor: string,
  verb: string,
  entityKind: string,
  entityId: number | null,
  payload: Record<string, unknown>,
  ts = timestamp(),
): void {
  const cleanActor = actor.trim();
  if (!cleanActor) throw new Error("Actor must not be empty.");
  db.query(`INSERT INTO edits (ts, actor, verb, entity_kind, entity_id, payload)
    VALUES (?, ?, ?, ?, ?, ?)`)
    .run(ts, cleanActor, verb, entityKind, entityId, JSON.stringify(payload));
}

function requireQuestion(db: Database, id: number): void {
  if (!db.query("SELECT 1 FROM questions WHERE id = ?").get(id)) throw new Error(`Question ${id} does not exist.`);
}

function requireOption(db: Database, id: number): void {
  if (!db.query("SELECT 1 FROM options WHERE id = ?").get(id)) throw new Error(`Option ${id} does not exist.`);
}

function getCriterionBySlug(db: Database, slug: string): Criterion {
  const row = db.query(`SELECT id, slug, description, acceptance, created_at, updated_at
    FROM criteria WHERE slug = ?`).get(slug) as Record<string, unknown> | null;
  if (!row) throw new Error(`Criterion ${slug} does not exist.`);
  return mapCriterion(row);
}

function nextPosition(db: Database, table: "question_parents" | "options", column: string, value: number | null): number {
  const row = db.query(`SELECT COALESCE(MAX(position), 0) + 1 AS position
    FROM ${table} WHERE ${column} IS ?`).get(value) as { position: number };
  return Number(row.position);
}

export function addQuestion(db: Database, input: AddQuestionInput): Question {
  const title = input.title.trim();
  if (!title) throw new Error("Question title must not be empty.");
  const parentId = input.parentId ?? null;
  const insert = db.transaction(() => {
    if (parentId !== null) requireQuestion(db, parentId);
    const ts = timestamp();
    const result = db.query(`INSERT INTO questions (title, detail, created_at, updated_at)
      VALUES (?, ?, ?, ?)`).run(title, input.detail ?? "", ts, ts);
    const id = Number(result.lastInsertRowid);
    db.query(`INSERT INTO question_parents (child_id, parent_id, position) VALUES (?, ?, ?)`)
      .run(id, parentId, nextPosition(db, "question_parents", "parent_id", parentId));
    appendEdit(db, input.actor, "add", "question", id, {
      title, detail: input.detail ?? "", parentId, acceptance: "suggested",
    }, ts);
    return id;
  });
  return getQuestion(db, insert());
}

export function updateQuestion(
  db: Database,
  id: number,
  input: { title?: string; detail?: string; actor: string },
): Question {
  db.transaction(() => {
    const current = getQuestion(db, id);
    if (input.title === undefined && input.detail === undefined) throw new Error("Question update requires --title or --detail.");
    const title = input.title === undefined ? current.title : input.title.trim();
    if (!title) throw new Error("Question title must not be empty.");
    const detail = input.detail ?? current.detail;
    const ts = timestamp();
    db.query("UPDATE questions SET title = ?, detail = ?, updated_at = ? WHERE id = ?").run(title, detail, ts, id);
    appendEdit(db, input.actor, "update", "question", id, { title, detail }, ts);
  })();
  return getQuestion(db, id);
}

export function setQuestionResolution(
  db: Database,
  questionId: number,
  resolution: Resolution,
  optionId: number | null,
  actor: string,
): Question {
  db.transaction(() => {
    requireQuestion(db, questionId);
    if (resolution === "open") {
      if (optionId !== null) throw new Error("An open question cannot point to an option.");
    } else {
      if (optionId === null) throw new Error(`${resolution} requires an option.`);
      const option = db.query("SELECT question_id FROM options WHERE id = ?").get(optionId) as { question_id: number } | null;
      if (!option) throw new Error(`Option ${optionId} does not exist.`);
      if (Number(option.question_id) !== questionId) throw new Error(`Option ${optionId} does not belong to question ${questionId}.`);
    }
    const ts = timestamp();
    db.query("UPDATE questions SET resolution = ?, resolved_option_id = ?, updated_at = ? WHERE id = ?")
      .run(resolution, optionId, ts, questionId);
    const verb = resolution === "open" ? "reopen" : resolution === "leaning" ? "lean" : "decide";
    appendEdit(db, actor, verb, "question", questionId, { resolution, optionId }, ts);
  })();
  return getQuestion(db, questionId);
}

export function addOption(
  db: Database,
  input: { questionId: number; title: string; detail?: string; actor: string },
): Option {
  const title = input.title.trim();
  if (!title) throw new Error("Option title must not be empty.");
  const insert = db.transaction(() => {
    requireQuestion(db, input.questionId);
    const ts = timestamp();
    const result = db.query(`INSERT INTO options
      (question_id, title, detail, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(input.questionId, title, input.detail ?? "", nextPosition(db, "options", "question_id", input.questionId), ts, ts);
    const id = Number(result.lastInsertRowid);
    appendEdit(db, input.actor, "add", "option", id, {
      questionId: input.questionId, title, detail: input.detail ?? "", acceptance: "suggested",
    }, ts);
    return id;
  });
  return getOption(db, insert());
}

export function addCriterion(
  db: Database,
  input: { slug: string; description?: string; actor: string },
): Criterion {
  const slug = input.slug.trim();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error("Criterion slug must use lowercase kebab-case.");
  const insert = db.transaction(() => {
    const ts = timestamp();
    let result;
    try {
      result = db.query(`INSERT INTO criteria (slug, description, created_at, updated_at) VALUES (?, ?, ?, ?)`)
        .run(slug, input.description ?? "", ts, ts);
    } catch (error) {
      if (String(error).includes("UNIQUE")) throw new Error(`Criterion ${slug} already exists.`);
      throw error;
    }
    const id = Number(result.lastInsertRowid);
    appendEdit(db, input.actor, "add", "criterion", id, {
      slug, description: input.description ?? "", acceptance: "suggested",
    }, ts);
    return id;
  });
  return getCriterion(db, insert());
}

export function setAssessment(
  db: Database,
  input: { optionId: number; criterionSlug: string; polarity: Polarity; note?: string; actor: string },
): Assessment {
  db.transaction(() => {
    requireOption(db, input.optionId);
    const criterion = getCriterionBySlug(db, input.criterionSlug);
    const existing = db.query("SELECT 1 FROM assessments WHERE option_id = ? AND criterion_id = ?")
      .get(input.optionId, criterion.id);
    if (existing) {
      db.query("UPDATE assessments SET polarity = ?, note = ? WHERE option_id = ? AND criterion_id = ?")
        .run(input.polarity, input.note ?? "", input.optionId, criterion.id);
    } else {
      db.query("INSERT INTO assessments (option_id, criterion_id, polarity, note) VALUES (?, ?, ?, ?)")
        .run(input.optionId, criterion.id, input.polarity, input.note ?? "");
    }
    appendEdit(db, input.actor, "assess", "assessment", null, {
      optionId: input.optionId,
      criterion: criterion.slug,
      polarity: input.polarity,
      note: input.note ?? "",
      ...(existing ? {} : { acceptance: "suggested" }),
    });
  })();
  return getAssessment(db, input.optionId, input.criterionSlug);
}

export function relateCriterion(
  db: Database,
  input: { questionId: number; criterionSlug: string; actor: string },
): Relation {
  const criterionId = db.transaction(() => {
    requireQuestion(db, input.questionId);
    const criterion = getCriterionBySlug(db, input.criterionSlug);
    if (db.query("SELECT 1 FROM question_criteria WHERE question_id = ? AND criterion_id = ?")
      .get(input.questionId, criterion.id)) {
      throw new Error(`Criterion ${criterion.slug} is already related to question ${input.questionId}.`);
    }
    db.query("INSERT INTO question_criteria (question_id, criterion_id) VALUES (?, ?)").run(input.questionId, criterion.id);
    appendEdit(db, input.actor, "relate", "relation", null, {
      questionId: input.questionId, criterion: criterion.slug, acceptance: "suggested",
    });
    return criterion.id;
  })();
  return getRelation(db, input.questionId, criterionId);
}

export function acceptEntity(
  db: Database,
  kind: EntityKind,
  reference: number | EdgeReference,
  actor: string,
): void {
  db.transaction(() => {
    const ts = timestamp();
    let changes = 0;
    let entityId: number | null = null;
    let payload: Record<string, unknown> = {};
    if (kind === "question" || kind === "option" || kind === "criterion") {
      if (typeof reference !== "number") throw new Error(`${kind} requires a numeric ID.`);
      entityId = reference;
      const table = kind === "criterion" ? "criteria" : `${kind}s`;
      changes = db.query(`UPDATE ${table} SET acceptance = 'accepted', updated_at = ?
        WHERE id = ? AND acceptance = 'suggested'`).run(ts, reference).changes;
      payload = { id: reference };
    } else {
      if (typeof reference === "number") throw new Error(`${kind} requires a composite reference.`);
      if (kind === "assessment") {
        const criterion = getCriterionBySlug(db, reference.second);
        changes = db.query(`UPDATE assessments SET acceptance = 'accepted'
          WHERE option_id = ? AND criterion_id = ? AND acceptance = 'suggested'`)
          .run(reference.firstId, criterion.id).changes;
        payload = { optionId: reference.firstId, criterion: reference.second };
      } else if (kind === "relation") {
        const criterion = getCriterionBySlug(db, reference.second);
        changes = db.query(`UPDATE question_criteria SET acceptance = 'accepted'
          WHERE question_id = ? AND criterion_id = ? AND acceptance = 'suggested'`)
          .run(reference.firstId, criterion.id).changes;
        payload = { questionId: reference.firstId, criterion: reference.second };
      } else {
        const parentId = parseParent(reference.second);
        changes = db.query(`UPDATE question_parents SET acceptance = 'accepted'
          WHERE child_id = ? AND parent_id IS ? AND acceptance = 'suggested'`)
          .run(reference.firstId, parentId).changes;
        payload = { childId: reference.firstId, parentId };
      }
    }
    if (changes === 0) throw new Error(`${kind} was not found or is already accepted.`);
    appendEdit(db, actor, "accept", kind, entityId, payload, ts);
  })();
}

export function removeEntity(
  db: Database,
  kind: EntityKind,
  reference: number | EdgeReference,
  actor: string,
): void {
  db.transaction(() => {
    let entityId: number | null = null;
    let payload: Record<string, unknown> = {};
    let changes = 0;
    if (kind === "question") {
      if (typeof reference !== "number") throw new Error("question requires a numeric ID.");
      requireQuestion(db, reference);
      entityId = reference;
      const children = db.query("SELECT child_id FROM question_parents WHERE parent_id = ?").all(reference) as { child_id: number }[];
      const optionRows = db.query("SELECT id FROM options WHERE question_id = ?").all(reference) as { id: number }[];
      for (const { id } of optionRows) {
        db.query(`UPDATE questions SET resolution = 'open', resolved_option_id = NULL, updated_at = ?
          WHERE resolved_option_id = ?`).run(timestamp(), id);
        db.query("DELETE FROM assessments WHERE option_id = ?").run(id);
        db.query("DELETE FROM focus WHERE kind = 'option' AND node_id = ?").run(id);
      }
      db.query("DELETE FROM question_criteria WHERE question_id = ?").run(reference);
      db.query("DELETE FROM options WHERE question_id = ?").run(reference);
      db.query("DELETE FROM question_parents WHERE child_id = ? OR parent_id = ?").run(reference, reference);
      changes = db.query("DELETE FROM questions WHERE id = ?").run(reference).changes;
      db.query("DELETE FROM focus WHERE kind = 'question' AND node_id = ?").run(reference);
      for (const { child_id } of children) {
        if (!db.query("SELECT 1 FROM question_parents WHERE child_id = ? LIMIT 1").get(child_id)) {
          db.query("INSERT INTO question_parents (child_id, parent_id, position) VALUES (?, NULL, ?)")
            .run(child_id, nextPosition(db, "question_parents", "parent_id", null));
        }
      }
      payload = { id: reference };
    } else if (kind === "option") {
      if (typeof reference !== "number") throw new Error("option requires a numeric ID.");
      requireOption(db, reference);
      entityId = reference;
      db.query(`UPDATE questions SET resolution = 'open', resolved_option_id = NULL, updated_at = ?
        WHERE resolved_option_id = ?`).run(timestamp(), reference);
      db.query("DELETE FROM assessments WHERE option_id = ?").run(reference);
      changes = db.query("DELETE FROM options WHERE id = ?").run(reference).changes;
      db.query("DELETE FROM focus WHERE kind = 'option' AND node_id = ?").run(reference);
      payload = { id: reference };
    } else if (kind === "criterion") {
      if (typeof reference !== "number") throw new Error("criterion requires a numeric ID.");
      const criterion = getCriterion(db, reference);
      entityId = reference;
      db.query("DELETE FROM assessments WHERE criterion_id = ?").run(reference);
      db.query("DELETE FROM question_criteria WHERE criterion_id = ?").run(reference);
      changes = db.query("DELETE FROM criteria WHERE id = ?").run(reference).changes;
      db.query("DELETE FROM focus WHERE kind = 'criterion' AND node_id = ?").run(reference);
      payload = { id: reference, slug: criterion.slug };
    } else {
      if (typeof reference === "number") throw new Error(`${kind} requires a composite reference.`);
      if (kind === "assessment") {
        const criterion = getCriterionBySlug(db, reference.second);
        changes = db.query("DELETE FROM assessments WHERE option_id = ? AND criterion_id = ?")
          .run(reference.firstId, criterion.id).changes;
        payload = { optionId: reference.firstId, criterion: reference.second };
      } else if (kind === "relation") {
        const criterion = getCriterionBySlug(db, reference.second);
        changes = db.query("DELETE FROM question_criteria WHERE question_id = ? AND criterion_id = ?")
          .run(reference.firstId, criterion.id).changes;
        payload = { questionId: reference.firstId, criterion: reference.second };
      } else {
        const parentId = parseParent(reference.second);
        changes = db.query("DELETE FROM question_parents WHERE child_id = ? AND parent_id IS ?")
          .run(reference.firstId, parentId).changes;
        if (changes > 0 && !db.query("SELECT 1 FROM question_parents WHERE child_id = ? LIMIT 1").get(reference.firstId)) {
          db.query("INSERT INTO question_parents (child_id, parent_id, position) VALUES (?, NULL, ?)")
            .run(reference.firstId, nextPosition(db, "question_parents", "parent_id", null));
        }
        payload = { childId: reference.firstId, parentId };
      }
    }
    if (changes === 0) throw new Error(`${kind} was not found.`);
    appendEdit(db, actor, "remove", kind, entityId, payload);
  })();
}

export function setFocus(db: Database, kind: NodeKind, id: number, actor: string): void {
  db.transaction(() => {
    if (kind === "question") requireQuestion(db, id);
    else if (kind === "option") requireOption(db, id);
    else getCriterion(db, id);
    const ts = timestamp();
    db.query(`INSERT INTO focus (row_lock, kind, node_id, set_at) VALUES (1, ?, ?, ?)
      ON CONFLICT(row_lock) DO UPDATE SET kind = excluded.kind, node_id = excluded.node_id, set_at = excluded.set_at`)
      .run(kind, id, ts);
    appendEdit(db, actor, "focus", kind, id, { kind, id }, ts);
  })();
}

export function getQuestion(db: Database, id: number): Question {
  const row = db.query(`SELECT id, title, detail, acceptance, resolution,
    resolved_option_id, created_at, updated_at FROM questions WHERE id = ?`)
    .get(id) as Record<string, unknown> | null;
  if (!row) throw new Error(`Question ${id} does not exist.`);
  return mapQuestion(row);
}

export function getOption(db: Database, id: number): Option {
  const row = db.query(`SELECT id, question_id, title, detail, acceptance, position, created_at, updated_at
    FROM options WHERE id = ?`).get(id) as Record<string, unknown> | null;
  if (!row) throw new Error(`Option ${id} does not exist.`);
  return mapOption(row);
}

export function getCriterion(db: Database, id: number): Criterion {
  const row = db.query(`SELECT id, slug, description, acceptance, created_at, updated_at
    FROM criteria WHERE id = ?`).get(id) as Record<string, unknown> | null;
  if (!row) throw new Error(`Criterion ${id} does not exist.`);
  return mapCriterion(row);
}

export function getAssessment(db: Database, optionId: number, criterionSlug: string): Assessment {
  const row = db.query(`SELECT a.option_id, a.criterion_id, c.slug AS criterion_slug,
    a.polarity, a.note, a.acceptance FROM assessments a JOIN criteria c ON c.id = a.criterion_id
    WHERE a.option_id = ? AND c.slug = ?`).get(optionId, criterionSlug) as Record<string, unknown> | null;
  if (!row) throw new Error(`Assessment ${optionId}:${criterionSlug} does not exist.`);
  return mapAssessment(row);
}

function getRelation(db: Database, questionId: number, criterionId: number): Relation {
  const row = db.query(`SELECT qc.question_id, qc.criterion_id, c.slug AS criterion_slug, qc.acceptance
    FROM question_criteria qc JOIN criteria c ON c.id = qc.criterion_id
    WHERE qc.question_id = ? AND qc.criterion_id = ?`)
    .get(questionId, criterionId) as Record<string, unknown> | null;
  if (!row) throw new Error("Relation does not exist.");
  return {
    questionId: Number(row.question_id), criterionId: Number(row.criterion_id),
    criterionSlug: String(row.criterion_slug), acceptance: row.acceptance as Acceptance,
  };
}

export function getOutline(db: Database): OutlineSnapshot {
  const questionRows = db.query(`SELECT id, title, detail, acceptance, resolution,
    resolved_option_id, created_at, updated_at FROM questions ORDER BY id`).all() as Record<string, unknown>[];
  const placementRows = db.query(`SELECT child_id, parent_id, position, acceptance
    FROM question_parents ORDER BY parent_id, position, child_id`).all() as Record<string, unknown>[];
  const optionRows = db.query(`SELECT id, question_id, title, detail, acceptance, position, created_at, updated_at
    FROM options ORDER BY question_id, position, id`).all() as Record<string, unknown>[];
  return {
    questions: questionRows.map(mapQuestion),
    placements: placementRows.map((row) => ({
      childId: Number(row.child_id),
      parentId: row.parent_id === null ? null : Number(row.parent_id),
      position: Number(row.position),
      acceptance: row.acceptance as Acceptance,
    })),
    options: optionRows.map(mapOption),
  };
}

export function renderOutline(db: Database, depth?: number, around?: number): string {
  const snapshot = getOutline(db);
  const questions = new Map(snapshot.questions.map((question) => [question.id, question]));
  const options = new Map<number, Option[]>();
  for (const option of snapshot.options) options.set(option.questionId, [...(options.get(option.questionId) ?? []), option]);
  const children = new Map<number | null, Placement[]>();
  for (const placement of snapshot.placements) children.set(placement.parentId, [...(children.get(placement.parentId) ?? []), placement]);
  if (around !== undefined && !questions.has(around)) throw new Error(`Question ${around} does not exist.`);
  const lines: string[] = [];
  const render = (placement: Placement, level: number, ancestors: Set<number>) => {
    if (depth !== undefined && level > depth) return;
    const question = questions.get(placement.childId);
    if (!question || ancestors.has(question.id)) return;
    const selected = question.resolvedOptionId === null ? "" : ` → O${question.resolvedOptionId}`;
    const suggestion = question.acceptance === "suggested" || placement.acceptance === "suggested" ? " [suggested]" : "";
    lines.push(`${"  ".repeat(level)}- ${resolutionGlyph(question.resolution)} Q${question.id} ${question.title}${selected}${suggestion}`);
    for (const option of options.get(question.id) ?? []) {
      lines.push(`${"  ".repeat(level + 1)}- O${option.id} ${option.title}${option.acceptance === "suggested" ? " [suggested]" : ""}`);
    }
    const next = new Set(ancestors).add(question.id);
    for (const child of children.get(question.id) ?? []) render(child, level + 1, next);
  };
  if (around !== undefined) {
    const placement = snapshot.placements.find(({ childId }) => childId === around);
    if (placement) render(placement, 0, new Set());
  } else {
    for (const placement of children.get(null) ?? []) render(placement, 0, new Set());
  }
  return lines.length ? `${lines.join("\n")}\n` : "No questions yet.\n";
}

export function renderEntity(db: Database, kind: NodeKind, id: number): string {
  if (kind === "question") {
    const question = getQuestion(db, id);
    const placements = db.query(`SELECT parent_id, position, acceptance FROM question_parents
      WHERE child_id = ? ORDER BY position`).all(id) as Record<string, unknown>[];
    const optionRows = db.query(`SELECT id, question_id, title, detail, acceptance, position, created_at, updated_at
      FROM options WHERE question_id = ? ORDER BY position, id`).all(id) as Record<string, unknown>[];
    const relations = db.query(`SELECT c.slug, qc.acceptance FROM question_criteria qc
      JOIN criteria c ON c.id = qc.criterion_id WHERE qc.question_id = ? ORDER BY c.slug`).all(id) as Record<string, unknown>[];
    const lines = [
      `# Q${question.id}: ${question.title}`, "", `Acceptance: ${question.acceptance}`,
      `Resolution: ${question.resolution}${question.resolvedOptionId ? ` → O${question.resolvedOptionId}` : ""}`,
      `Parents: ${placements.map((row) => `${row.parent_id === null ? "root" : `Q${row.parent_id}`} (${row.acceptance})`).join(", ") || "none"}`,
    ];
    if (question.detail) lines.push("", question.detail);
    lines.push("", "## Options");
    if (!optionRows.length) lines.push("", "None.");
    for (const row of optionRows) {
      const option = mapOption(row);
      lines.push("", `- O${option.id}: ${option.title} [${option.acceptance}]${option.detail ? ` — ${option.detail}` : ""}`);
    }
    lines.push("", `Criteria: ${relations.map((row) => `${row.slug} [${row.acceptance}]`).join(", ") || "none"}`);
    return `${lines.join("\n")}\n`;
  }
  if (kind === "option") {
    const option = getOption(db, id);
    const assessments = db.query(`SELECT a.option_id, a.criterion_id, c.slug AS criterion_slug,
      a.polarity, a.note, a.acceptance FROM assessments a JOIN criteria c ON c.id = a.criterion_id
      WHERE a.option_id = ? ORDER BY c.slug`).all(id) as Record<string, unknown>[];
    const lines = [`# O${option.id}: ${option.title}`, "", `Question: Q${option.questionId}`, `Acceptance: ${option.acceptance}`];
    if (option.detail) lines.push("", option.detail);
    lines.push("", "## Assessments");
    if (!assessments.length) lines.push("", "None.");
    for (const row of assessments) {
      const assessment = mapAssessment(row);
      lines.push("", `- ${assessment.polarity} ${assessment.criterionSlug} [${assessment.acceptance}]${assessment.note ? ` — ${assessment.note}` : ""}`);
    }
    return `${lines.join("\n")}\n`;
  }
  const criterion = getCriterion(db, id);
  const lines = [`# ${criterion.slug}`, "", `Criterion ID: C${criterion.id}`, `Acceptance: ${criterion.acceptance}`];
  if (criterion.description) lines.push("", criterion.description);
  const relations = db.query("SELECT question_id, acceptance FROM question_criteria WHERE criterion_id = ? ORDER BY question_id")
    .all(id) as Record<string, unknown>[];
  const assessments = db.query(`SELECT option_id, polarity, note, acceptance FROM assessments
    WHERE criterion_id = ? ORDER BY option_id`).all(id) as Record<string, unknown>[];
  lines.push("", "## Questions");
  if (!relations.length) lines.push("", "None.");
  for (const row of relations) lines.push("", `- Q${row.question_id} [${row.acceptance}]`);
  lines.push("", "## Assessments");
  if (!assessments.length) lines.push("", "None.");
  for (const row of assessments) {
    lines.push("", `- ${row.polarity} O${row.option_id} [${row.acceptance}]${row.note ? ` — ${row.note}` : ""}`);
  }
  return `${lines.join("\n")}\n`;
}

export function getEdits(db: Database, since?: string, limit = 20): Edit[] {
  const numericSince = since !== undefined && /^\d+$/.test(since) ? Number(since) : undefined;
  const rows = numericSince !== undefined
    ? db.query(`SELECT id, ts, actor, verb, entity_kind, entity_id, payload FROM edits
        WHERE id > ? ORDER BY id DESC LIMIT ?`).all(numericSince, limit)
    : since !== undefined
      ? db.query(`SELECT id, ts, actor, verb, entity_kind, entity_id, payload FROM edits
          WHERE ts >= ? ORDER BY id DESC LIMIT ?`).all(since, limit)
      : db.query(`SELECT id, ts, actor, verb, entity_kind, entity_id, payload FROM edits
          ORDER BY id DESC LIMIT ?`).all(limit);
  return (rows as Record<string, unknown>[]).reverse().map((row) => ({
    id: Number(row.id), ts: String(row.ts), actor: String(row.actor), verb: String(row.verb),
    entityKind: String(row.entity_kind), entityId: row.entity_id === null ? null : Number(row.entity_id),
    payload: JSON.parse(String(row.payload)) as Record<string, unknown>,
  }));
}

export function renderEdits(db: Database, since?: string): string {
  const edits = getEdits(db, since);
  if (!edits.length) return "No edits.\n";
  return `${edits.map((edit) => {
    const id = edit.entityId === null ? "" : ` ${edit.entityId}`;
    return `${edit.id}\t${edit.ts}\t${edit.actor}\t${edit.verb} ${edit.entityKind}${id}\t${JSON.stringify(edit.payload)}`;
  }).join("\n")}\n`;
}

function parseParent(value: string): number | null {
  if (value === "root") return null;
  const parentId = Number(value);
  if (!Number.isInteger(parentId) || parentId < 1) throw new Error("Placement parent must be a positive question ID or root.");
  return parentId;
}

function resolutionGlyph(resolution: Resolution): string {
  return resolution === "decided" ? "●" : resolution === "leaning" ? "◐" : "○";
}

function mapQuestion(row: Record<string, unknown>): Question {
  return {
    id: Number(row.id), title: String(row.title), detail: String(row.detail), acceptance: row.acceptance as Acceptance,
    resolution: row.resolution as Resolution,
    resolvedOptionId: row.resolved_option_id === null ? null : Number(row.resolved_option_id),
    createdAt: String(row.created_at), updatedAt: String(row.updated_at),
  };
}

function mapOption(row: Record<string, unknown>): Option {
  return {
    id: Number(row.id), questionId: Number(row.question_id), title: String(row.title), detail: String(row.detail),
    acceptance: row.acceptance as Acceptance, position: Number(row.position),
    createdAt: String(row.created_at), updatedAt: String(row.updated_at),
  };
}

function mapCriterion(row: Record<string, unknown>): Criterion {
  return {
    id: Number(row.id), slug: String(row.slug), description: String(row.description),
    acceptance: row.acceptance as Acceptance, createdAt: String(row.created_at), updatedAt: String(row.updated_at),
  };
}

function mapAssessment(row: Record<string, unknown>): Assessment {
  return {
    optionId: Number(row.option_id), criterionId: Number(row.criterion_id), criterionSlug: String(row.criterion_slug),
    polarity: row.polarity as Polarity, note: String(row.note), acceptance: row.acceptance as Acceptance,
  };
}
