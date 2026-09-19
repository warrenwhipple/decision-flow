import { relationGroups } from "./relations.ts";
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
export type EntityKind = NodeKind | "assessment" | "relevance" | "relation";

export type Question = {
  slug: string;
  title: string;
  detail: string;
  acceptance: Acceptance;
  resolution: Resolution;
  resolvedOptionSlug: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
};

export type RelationKind = "raises" | "part-of" | "blocks";
export type QuestionRelation = {
  kind: RelationKind;
  fromKind: "question" | "option";
  from: string;
  to: string;
  note: string;
  acceptance: Acceptance;
};

export type Option = {
  questionSlug: string;
  slug: string;
  title: string;
  detail: string;
  acceptance: Acceptance;
  position: number;
  createdAt: string;
  updatedAt: string;
};

export type Criterion = {
  slug: string;
  description: string;
  acceptance: Acceptance;
  createdAt: string;
  updatedAt: string;
};

export type Assessment = {
  optionPath: string;
  criterionSlug: string;
  polarity: Polarity;
  note: string;
  acceptance: Acceptance;
};

export type Relevance = {
  questionSlug: string;
  criterionSlug: string;
  acceptance: Acceptance;
};

export type Focus = {
  kind: NodeKind;
  reference: string;
  setAt: string;
};

export type Edit = {
  id: number;
  ts: string;
  actor: string;
  verb: string;
  entityKind: string;
  payload: Record<string, unknown>;
};

export type OutlineSnapshot = {
  questions: Question[];
  relations: QuestionRelation[];
  options: Option[];
  criteria: Criterion[];
  assessments: Assessment[];
  relevances: Relevance[];
  focus: Focus | null;
};

export type AddQuestionInput = {
  slug: string;
  title: string;
  detail?: string;
  partOf?: string;
  raisedBy?: string;
  after?: string;
  actor: string;
};

type InternalQuestion = { id: number; slug: string };
type InternalOption = { id: number; questionId: number; questionSlug: string; slug: string };
type InternalCriterion = { id: number; slug: string };

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
    if (!existsSync(path)) throw new Error(`No decision space found at ${path}. Run \`dviz init --db ${override}\` first.`);
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

function tableColumns(db: Database, table: string): string[] {
  return (db.query(`PRAGMA table_info(${table})`).all() as { name: string }[]).map(({ name }) => name);
}

function migrate(db: Database): void {
  const version = Number((db.query("PRAGMA user_version").get() as { user_version: number }).user_version);
  if (version > SCHEMA_VERSION) {
    throw new Error(`This decision space uses schema version ${version}, but this dviz supports ${SCHEMA_VERSION}.`);
  }
  if (version === SCHEMA_VERSION) return;
  const hasQuestions = tableColumns(db, "questions").length > 0;
  const needsSlugSchema = hasQuestions && (!tableColumns(db, "questions").includes("slug") || !tableColumns(db, "options").includes("slug"));
  if (needsSlugSchema) {
    const populated = ["questions", "options", "criteria", "edits"].some((table) => {
      if (!tableColumns(db, table).length) return false;
      return Number((db.query(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number }).count) > 0;
    });
    if (populated) throw new Error("This decision space predates slug handles and contains data. It was left unchanged because dviz will not invent permanent slugs; initialize a new space and re-add the data with explicit slugs.");
  }
  // Foreign keys may reference the pre-slug tables being replaced. Restore enforcement even on failure.
  if (needsSlugSchema) db.exec("PRAGMA foreign_keys = OFF;");
  let imported = false;
  try {
    db.transaction(() => {
      if (needsSlugSchema) {
        for (const table of ["focus", "assessments", "question_criteria", "question_parents", "relations", "options", "criteria", "questions", "edits"]) {
          db.exec(`DROP TABLE IF EXISTS ${table}`);
        }
      }
      const oldPlacements = tableColumns(db, "question_parents").length > 0;
      if (hasQuestions && !needsSlugSchema && !tableColumns(db, "questions").includes("position")) {
        db.exec("ALTER TABLE questions ADD COLUMN position REAL NOT NULL DEFAULT 0");
      }
      db.exec(SCHEMA);
      if (oldPlacements) {
        type OldPlacement = { rowid: number; child_id: number; parent_id: number | null; position: number };
        const placements = db.query("SELECT rowid, child_id, parent_id, position FROM question_parents ORDER BY position, child_id, rowid").all() as OldPlacement[];
        const canonical = new Map<number, OldPlacement>();
        for (const row of placements) {
          if (!canonical.has(row.child_id) || row.rowid < canonical.get(row.child_id)!.rowid) canonical.set(row.child_id, row);
        }
        const children = new Map<number | null, OldPlacement[]>();
        for (const row of placements) {
          if (canonical.get(row.child_id) !== row) continue;
          children.set(row.parent_id, [...(children.get(row.parent_id) ?? []), row]);
        }
        const visited = new Set<number>();
        const visit = (id: number) => {
          if (visited.has(id)) return;
          visited.add(id);
          db.query("UPDATE questions SET position = ? WHERE id = ?").run(visited.size, id);
          for (const child of children.get(id) ?? []) visit(child.child_id);
        };
        for (const root of children.get(null) ?? []) visit(root.child_id);
        for (const row of db.query("SELECT id FROM questions ORDER BY id").all() as { id: number }[]) visit(row.id);
        const ts = timestamp();
        const result = db.query(`INSERT INTO relations (kind, from_kind, from_id, to_id, acceptance, created_at)
          SELECT 'part-of', 'question', child_id, parent_id, acceptance, ? FROM question_parents WHERE parent_id IS NOT NULL`).run(ts);
        db.exec("DROP TABLE question_parents");
        appendEdit(db, "migration", "migrate", "space", null, {
          from: version, to: 4, relations: result.changes,
          note: "Old nesting imported as part-of, the closest neutral reading; re-tag as raises or blocks where appropriate.",
        }, ts);
        imported = true;
      }
      db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
    }).immediate();
  } finally {
    if (needsSlugSchema) db.exec("PRAGMA foreign_keys = ON;");
  }
  if (imported) console.error("dviz: migrated to v4; old nesting imported as part-of. Re-tag as raises or blocks where appropriate.");
}

export function initializeSpace(path: string): Database {
  mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path, { create: true, strict: true });
  try {
    configure(db);
    db.exec("PRAGMA journal_mode = WAL;");
    migrate(db);
    return db;
  } catch (error) {
    db.close();
    throw error;
  }
}

export function openSpace(path: string): Database {
  if (!existsSync(path)) throw new Error(`No decision space found at ${path}. Run \`dviz init\` first.`);
  const db = new Database(path, { strict: true });
  try {
    configure(db);
    migrate(db);
    return db;
  } catch (error) {
    db.close();
    throw error;
  }
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

function appendEdit(db: Database, actor: string, verb: string, entityKind: string, entityId: number | null, payload: Record<string, unknown>, ts = timestamp()): void {
  const cleanActor = actor.trim();
  if (!cleanActor) throw new Error("Actor must not be empty.");
  db.query("INSERT INTO edits (ts, actor, verb, entity_kind, entity_id, payload) VALUES (?, ?, ?, ?, ?, ?)")
    .run(ts, cleanActor, verb, entityKind, entityId, JSON.stringify(payload));
}

export function validateSlug(value: string, label = "Slug"): string {
  const slug = value;
  if (slug.length > 64 || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error(`${label} must start with a letter, use lowercase letters, digits, and single hyphens only, and be at most 64 characters.`);
  }
  return slug;
}

export function parseOptionPath(value: string): { questionSlug: string; optionSlug: string } {
  const parts = value.split("/");
  if (parts.length !== 2) throw new Error("Option reference must use question-slug/option-slug form.");
  return { questionSlug: validateSlug(parts[0]!, "Question slug"), optionSlug: validateSlug(parts[1]!, "Option slug") };
}

function optionPath(questionSlug: string, optionSlug: string): string {
  return `${questionSlug}/${optionSlug}`;
}

function questionRecord(db: Database, slugValue: string): InternalQuestion {
  const slug = validateSlug(slugValue, "Question slug");
  const row = db.query("SELECT id, slug FROM questions WHERE slug = ?").get(slug) as { id: number; slug: string } | null;
  if (!row) throw new Error(`Question ${slug} does not exist.`);
  return { id: Number(row.id), slug: String(row.slug) };
}

function optionRecord(db: Database, pathValue: string): InternalOption {
  const { questionSlug, optionSlug } = parseOptionPath(pathValue);
  const row = db.query(`SELECT o.id, o.question_id, q.slug AS question_slug, o.slug
    FROM options o JOIN questions q ON q.id = o.question_id
    WHERE q.slug = ? AND o.slug = ?`).get(questionSlug, optionSlug) as Record<string, unknown> | null;
  if (!row) throw new Error(`Option ${optionPath(questionSlug, optionSlug)} does not exist.`);
  return { id: Number(row.id), questionId: Number(row.question_id), questionSlug: String(row.question_slug), slug: String(row.slug) };
}

function optionInQuestion(db: Database, question: InternalQuestion, optionSlugValue: string): InternalOption {
  return optionRecord(db, optionPath(question.slug, validateSlug(optionSlugValue, "Option slug")));
}

function criterionRecord(db: Database, slugValue: string): InternalCriterion {
  const slug = validateSlug(slugValue, "Criterion slug");
  const row = db.query("SELECT id, slug FROM criteria WHERE slug = ?").get(slug) as { id: number; slug: string } | null;
  if (!row) throw new Error(`Criterion ${slug} does not exist.`);
  return { id: Number(row.id), slug: String(row.slug) };
}

function nextPosition(db: Database, table: "options", column: string, value: number | null): number {
  const row = db.query(`SELECT COALESCE(MAX(position), 0) + 1 AS position FROM ${table} WHERE ${column} IS ?`)
    .get(value) as { position: number };
  return Number(row.position);
}

function collisionError(error: unknown, kind: "Question" | "Option" | "Criterion", slug: string): never {
  if (String(error).includes("UNIQUE")) throw new Error(`${kind} slug ${slug} already exists${kind === "Option" ? " in that question" : ""}.`);
  throw error;
}

function questionPosition(db: Database, after?: string, movingId?: number): number {
  const rows = db.query("SELECT id, slug, position FROM questions WHERE id IS NOT ? ORDER BY position, id")
    .all(movingId ?? null) as { id: number; slug: string; position: number }[];
  if (after === "first") return (rows[0]?.position ?? 1) - 1;
  if (after === undefined) return (rows.at(-1)?.position ?? 0) + 1;
  const index = rows.findIndex(({ slug }) => slug === after);
  if (index < 0) {
    questionRecord(db, after);
    throw new Error("A question cannot move after itself.");
  }
  const position = rows[index]!.position;
  const next = rows[index + 1]?.position;
  const result = next === undefined ? position + 1 : position + (next - position) / 2;
  if (result === position || result === next) throw new Error("No position remains between these questions; choose another insertion point.");
  return result;
}

function insertionAnchor(db: Database, input: AddQuestionInput): string | undefined {
  if (input.after !== undefined) return input.after;
  if (input.partOf) {
    const parent = questionRecord(db, input.partOf);
    const sibling = db.query(`SELECT q.slug FROM relations r JOIN questions q ON q.id = r.from_id
      WHERE r.kind = 'part-of' AND r.to_id = ? ORDER BY q.position DESC, q.id DESC LIMIT 1`).get(parent.id) as { slug: string } | null;
    return sibling?.slug ?? parent.slug;
  }
  if (input.raisedBy) {
    const option = optionRecord(db, input.raisedBy);
    const sibling = db.query(`SELECT q.slug FROM relations r JOIN questions q ON q.id = r.to_id
      WHERE r.kind = 'raises' AND r.from_id = ? ORDER BY q.position DESC, q.id DESC LIMIT 1`).get(option.id) as { slug: string } | null;
    return sibling?.slug ?? option.questionSlug;
  }
  return undefined;
}

export function addQuestion(db: Database, input: AddQuestionInput): Question {
  const title = input.title.trim();
  if (!title) throw new Error("Question title must not be empty.");
  const id = db.transaction(() => {
    const slug = validateSlug(input.slug, "Question slug");
    const position = questionPosition(db, insertionAnchor(db, input));
    const ts = timestamp();
    let result;
    try {
      result = db.query("INSERT INTO questions (slug, title, detail, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
        .run(slug, title, input.detail ?? "", position, ts, ts);
    } catch (error) { collisionError(error, "Question", slug); }
    const questionId = Number(result.lastInsertRowid);
    appendEdit(db, input.actor, "add", "question", questionId, {
      slug, title, detail: input.detail ?? "", position, acceptance: "suggested",
    }, ts);
    if (input.partOf) addRelation(db, { kind: "part-of", from: slug, to: input.partOf, actor: input.actor });
    if (input.raisedBy) addRelation(db, { kind: "raises", from: input.raisedBy, to: slug, actor: input.actor });
    return questionId;
  }).immediate();
  return getQuestionById(db, id);
}

export function moveQuestion(db: Database, slug: string, after: string, actor: string): Question {
  db.transaction(() => {
    const question = questionRecord(db, slug);
    const position = questionPosition(db, after, question.id);
    const ts = timestamp();
    db.query("UPDATE questions SET position = ?, updated_at = ? WHERE id = ?").run(position, ts, question.id);
    appendEdit(db, actor, "move", "question", question.id, { slug, after, position }, ts);
  }).immediate();
  return getQuestion(db, slug);
}

export function validateRelationKind(value: string): RelationKind {
  if (value !== "raises" && value !== "part-of" && value !== "blocks") throw new Error("Relation kind must be raises, part-of, or blocks.");
  return value;
}

function relationEndpoints(db: Database, kind: RelationKind, from: string, to: string) {
  if (kind === "raises" && !from.includes("/")) throw new Error("raises requires an option path as FROM (QSLUG/OSLUG).");
  if (kind !== "raises" && from.includes("/")) throw new Error(`${kind} requires a question as FROM.`);
  const source = kind === "raises" ? optionRecord(db, from) : questionRecord(db, from);
  const target = questionRecord(db, to);
  return { source, target, fromKind: kind === "raises" ? "option" as const : "question" as const,
    sourceQuestionId: kind === "raises" ? (source as InternalOption).questionId : source.id };
}

export function addRelation(db: Database, input: { kind: RelationKind; from: string; to: string; note?: string; actor: string }): QuestionRelation {
  return db.transaction(() => {
    const kind = validateRelationKind(input.kind);
    const { source, target, fromKind, sourceQuestionId } = relationEndpoints(db, kind, input.from, input.to);
    if (sourceQuestionId === target.id) throw new Error(`${kind} cannot relate a question to itself (including its own options).`);
    if (db.query("SELECT 1 FROM relations WHERE kind = ? AND from_kind = ? AND from_id = ? AND to_id = ?").get(kind, fromKind, source.id, target.id)) {
      throw new Error(`Relation ${kind}:${input.from}:${input.to} already exists.`);
    }
    const cycle = db.query(`WITH RECURSIVE edges(source, target) AS (
      SELECT CASE WHEN r.from_kind = 'option' THEN o.question_id ELSE r.from_id END, r.to_id
      FROM relations r LEFT JOIN options o ON r.from_kind = 'option' AND o.id = r.from_id WHERE r.kind = ?
    ), reachable(id) AS (
      SELECT target FROM edges WHERE source = ?
      UNION SELECT e.target FROM edges e JOIN reachable r ON e.source = r.id
    ) SELECT 1 FROM reachable WHERE id = ? LIMIT 1`).get(kind, target.id, sourceQuestionId);
    if (cycle) throw new Error(`${input.from} ${kind} ${input.to} would create a ${kind} cycle through ${input.to}.`);
    const relation: QuestionRelation = { kind, fromKind, from: input.from, to: input.to, note: input.note ?? "", acceptance: "suggested" };
    const result = db.query("INSERT INTO relations (kind, from_kind, from_id, to_id, note, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(kind, fromKind, source.id, target.id, relation.note, timestamp());
    appendEdit(db, input.actor, "add", "relation", Number(result.lastInsertRowid), relation);
    return relation;
  }).immediate();
}

function relationRecord(db: Database, reference: string): { id: number } {
  const parts = reference.split(":");
  if (parts.length !== 3 || parts.some((part) => !part)) throw new Error("relation reference must use KIND:FROM:TO form.");
  const kind = validateRelationKind(parts[0]!);
  const { source, target, fromKind } = relationEndpoints(db, kind, parts[1]!, parts[2]!);
  const row = db.query("SELECT id FROM relations WHERE kind = ? AND from_kind = ? AND from_id = ? AND to_id = ?")
    .get(kind, fromKind, source.id, target.id) as { id: number } | null;
  if (!row) throw new Error(`relation ${reference} was not found.`);
  return row;
}

export function updateQuestion(db: Database, questionSlug: string, input: { slug?: string; title?: string; detail?: string; actor: string }): Question {
  const resultSlug = db.transaction(() => {
    const record = questionRecord(db, questionSlug);
    const current = getQuestionById(db, record.id);
    if (input.slug === undefined && input.title === undefined && input.detail === undefined) {
      throw new Error("Question update requires --slug, --title, or --detail.");
    }
    const slug = input.slug === undefined ? current.slug : validateSlug(input.slug, "Question slug");
    const title = input.title === undefined ? current.title : input.title.trim();
    if (!title) throw new Error("Question title must not be empty.");
    const detail = input.detail ?? current.detail;
    const ts = timestamp();
    try {
      db.query("UPDATE questions SET slug = ?, title = ?, detail = ?, updated_at = ? WHERE id = ?")
        .run(slug, title, detail, ts, record.id);
    } catch (error) {
      collisionError(error, "Question", slug);
    }
    const renamed = slug !== current.slug;
    appendEdit(db, input.actor, renamed ? "rename" : "update", "question", record.id, {
      ...(renamed ? { oldSlug: current.slug, newSlug: slug } : { slug }), title, detail,
    }, ts);
    return slug;
  })();
  return getQuestion(db, resultSlug);
}

export function setQuestionResolution(db: Database, questionSlug: string, resolution: Resolution, optionSlug: string | null, actor: string): Question {
  db.transaction(() => {
    const question = questionRecord(db, questionSlug);
    let option: InternalOption | null = null;
    if (resolution === "open") {
      if (optionSlug !== null) throw new Error("An open question cannot point to an option.");
    } else {
      if (optionSlug === null) throw new Error(`${resolution} requires an option.`);
      option = optionInQuestion(db, question, optionSlug);
    }
    const ts = timestamp();
    db.query("UPDATE questions SET resolution = ?, resolved_option_id = ?, updated_at = ? WHERE id = ?")
      .run(resolution, option?.id ?? null, ts, question.id);
    const verb = resolution === "open" ? "reopen" : resolution === "leaning" ? "lean" : "decide";
    appendEdit(db, actor, verb, "question", question.id, { question: question.slug, resolution, option: option?.slug ?? null }, ts);
  })();
  return getQuestion(db, questionSlug);
}

export function addOption(db: Database, input: { questionSlug: string; slug: string; title: string; detail?: string; actor: string }): Option {
  const title = input.title.trim();
  if (!title) throw new Error("Option title must not be empty.");
  const id = db.transaction(() => {
    const slug = validateSlug(input.slug, "Option slug");
    const question = questionRecord(db, input.questionSlug);
    const ts = timestamp();
    let result;
    try {
      result = db.query(`INSERT INTO options
        (question_id, slug, title, detail, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .run(question.id, slug, title, input.detail ?? "", nextPosition(db, "options", "question_id", question.id), ts, ts);
    } catch (error) {
      collisionError(error, "Option", slug);
    }
    const id = Number(result.lastInsertRowid);
    appendEdit(db, input.actor, "add", "option", id, {
      path: optionPath(question.slug, slug), title, detail: input.detail ?? "", acceptance: "suggested",
    }, ts);
    return id;
  })();
  return getOptionById(db, id);
}

export function updateOption(db: Database, pathValue: string, input: { slug?: string; title?: string; detail?: string; actor: string }): Option {
  const resultPath = db.transaction(() => {
    const record = optionRecord(db, pathValue);
    const current = getOptionById(db, record.id);
    if (input.slug === undefined && input.title === undefined && input.detail === undefined) {
      throw new Error("Option update requires --slug, --title, or --detail.");
    }
    const slug = input.slug === undefined ? current.slug : validateSlug(input.slug, "Option slug");
    const title = input.title === undefined ? current.title : input.title.trim();
    if (!title) throw new Error("Option title must not be empty.");
    const detail = input.detail ?? current.detail;
    const ts = timestamp();
    try {
      db.query("UPDATE options SET slug = ?, title = ?, detail = ?, updated_at = ? WHERE id = ?")
        .run(slug, title, detail, ts, record.id);
    } catch (error) {
      collisionError(error, "Option", slug);
    }
    const oldPath = optionPath(current.questionSlug, current.slug);
    const newPath = optionPath(current.questionSlug, slug);
    const renamed = slug !== current.slug;
    appendEdit(db, input.actor, renamed ? "rename" : "update", "option", record.id, {
      ...(renamed ? { oldSlug: oldPath, newSlug: newPath } : { slug: newPath }), title, detail,
    }, ts);
    return newPath;
  })();
  return getOption(db, resultPath);
}

export function addCriterion(db: Database, input: { slug: string; description?: string; actor: string }): Criterion {
  const id = db.transaction(() => {
    const slug = validateSlug(input.slug, "Criterion slug");
    const ts = timestamp();
    let result;
    try {
      result = db.query("INSERT INTO criteria (slug, description, created_at, updated_at) VALUES (?, ?, ?, ?)")
        .run(slug, input.description ?? "", ts, ts);
    } catch (error) {
      collisionError(error, "Criterion", slug);
    }
    const id = Number(result.lastInsertRowid);
    appendEdit(db, input.actor, "add", "criterion", id, { slug, description: input.description ?? "", acceptance: "suggested" }, ts);
    return id;
  })();
  return getCriterionById(db, id);
}

export function setAssessment(db: Database, input: { optionPath: string; criterionSlug: string; polarity: Polarity; note?: string; actor: string }): Assessment {
  db.transaction(() => {
    const option = optionRecord(db, input.optionPath);
    const criterion = criterionRecord(db, input.criterionSlug);
    const existing = db.query("SELECT 1 FROM assessments WHERE option_id = ? AND criterion_id = ?").get(option.id, criterion.id);
    if (existing) {
      db.query("UPDATE assessments SET polarity = ?, note = ? WHERE option_id = ? AND criterion_id = ?")
        .run(input.polarity, input.note ?? "", option.id, criterion.id);
    } else {
      db.query("INSERT INTO assessments (option_id, criterion_id, polarity, note) VALUES (?, ?, ?, ?)")
        .run(option.id, criterion.id, input.polarity, input.note ?? "");
    }
    appendEdit(db, input.actor, "assess", "assessment", null, {
      option: optionPath(option.questionSlug, option.slug), criterion: criterion.slug, polarity: input.polarity,
      note: input.note ?? "", ...(existing ? {} : { acceptance: "suggested" }),
    });
  })();
  return getAssessment(db, input.optionPath, input.criterionSlug);
}

export function relateCriterion(db: Database, input: { questionSlug: string; criterionSlug: string; actor: string }): Relevance {
  const relation = db.transaction(() => {
    const question = questionRecord(db, input.questionSlug);
    const criterion = criterionRecord(db, input.criterionSlug);
    if (db.query("SELECT 1 FROM question_criteria WHERE question_id = ? AND criterion_id = ?").get(question.id, criterion.id)) {
      throw new Error(`Criterion ${criterion.slug} is already related to question ${question.slug}.`);
    }
    db.query("INSERT INTO question_criteria (question_id, criterion_id) VALUES (?, ?)").run(question.id, criterion.id);
    appendEdit(db, input.actor, "relate", "relevance", null, { question: question.slug, criterion: criterion.slug, acceptance: "suggested" });
    return { question, criterion };
  })();
  return getRelevance(db, relation.question.id, relation.criterion.id);
}

function parseEdgeReference(kind: "assessment" | "relevance", reference: string): [string, string] {
  const separator = reference.indexOf(":");
  if (separator < 1 || separator !== reference.lastIndexOf(":") || separator === reference.length - 1) {
    throw new Error(`${kind} reference must use FIRST:SECOND form.`);
  }
  return [reference.slice(0, separator), reference.slice(separator + 1)];
}

export function acceptEntity(db: Database, kind: EntityKind, reference: string, actor: string): void {
  db.transaction(() => {
    const ts = timestamp();
    let changes = 0;
    let entityId: number | null = null;
    let payload: Record<string, unknown>;
    if (kind === "question") {
      const question = questionRecord(db, reference);
      entityId = question.id;
      changes = db.query("UPDATE questions SET acceptance = 'accepted', updated_at = ? WHERE id = ? AND acceptance = 'suggested'").run(ts, question.id).changes;
      payload = { slug: question.slug };
    } else if (kind === "option") {
      const option = optionRecord(db, reference);
      entityId = option.id;
      changes = db.query("UPDATE options SET acceptance = 'accepted', updated_at = ? WHERE id = ? AND acceptance = 'suggested'").run(ts, option.id).changes;
      payload = { slug: optionPath(option.questionSlug, option.slug) };
    } else if (kind === "criterion") {
      const criterion = criterionRecord(db, reference);
      entityId = criterion.id;
      changes = db.query("UPDATE criteria SET acceptance = 'accepted', updated_at = ? WHERE id = ? AND acceptance = 'suggested'").run(ts, criterion.id).changes;
      payload = { slug: criterion.slug };
    } else if (kind === "assessment") {
      const [optionReference, criterionSlug] = parseEdgeReference(kind, reference);
      const option = optionRecord(db, optionReference);
      const criterion = criterionRecord(db, criterionSlug);
      changes = db.query("UPDATE assessments SET acceptance = 'accepted' WHERE option_id = ? AND criterion_id = ? AND acceptance = 'suggested'").run(option.id, criterion.id).changes;
      payload = { option: optionPath(option.questionSlug, option.slug), criterion: criterion.slug };
    } else if (kind === "relevance") {
      const [questionSlug, criterionSlug] = parseEdgeReference(kind, reference);
      const question = questionRecord(db, questionSlug);
      const criterion = criterionRecord(db, criterionSlug);
      changes = db.query("UPDATE question_criteria SET acceptance = 'accepted' WHERE question_id = ? AND criterion_id = ? AND acceptance = 'suggested'").run(question.id, criterion.id).changes;
      payload = { question: question.slug, criterion: criterion.slug };
    } else {
      entityId = relationRecord(db, reference).id;
      changes = db.query("UPDATE relations SET acceptance = 'accepted' WHERE id = ? AND acceptance = 'suggested'").run(entityId).changes;
      payload = { reference };
    }
    if (changes === 0) throw new Error(`${kind} ${reference} was not found or is already accepted.`);
    appendEdit(db, actor, "accept", kind, entityId, payload, ts);
  })();
}

export function removeEntity(db: Database, kind: EntityKind, reference: string, actor: string): void {
  db.transaction(() => {
    let entityId: number | null = null;
    let changes = 0;
    let payload: Record<string, unknown>;
    if (kind === "question") {
      const question = questionRecord(db, reference);
      entityId = question.id;
      const optionRows = db.query("SELECT id FROM options WHERE question_id = ?").all(question.id) as { id: number }[];
      for (const { id } of optionRows) {
        db.query("UPDATE questions SET resolution = 'open', resolved_option_id = NULL, updated_at = ? WHERE resolved_option_id = ?").run(timestamp(), id);
        db.query("DELETE FROM assessments WHERE option_id = ?").run(id);
        db.query("DELETE FROM relations WHERE from_kind = 'option' AND from_id = ?").run(id);
        db.query("DELETE FROM focus WHERE kind = 'option' AND node_id = ?").run(id);
      }
      db.query("DELETE FROM question_criteria WHERE question_id = ?").run(question.id);
      db.query("DELETE FROM options WHERE question_id = ?").run(question.id);
      db.query("DELETE FROM relations WHERE (from_kind = 'question' AND from_id = ?) OR to_id = ?").run(question.id, question.id);
      changes = db.query("DELETE FROM questions WHERE id = ?").run(question.id).changes;
      db.query("DELETE FROM focus WHERE kind = 'question' AND node_id = ?").run(question.id);
      payload = { slug: question.slug };
    } else if (kind === "option") {
      const option = optionRecord(db, reference);
      entityId = option.id;
      db.query("UPDATE questions SET resolution = 'open', resolved_option_id = NULL, updated_at = ? WHERE resolved_option_id = ?").run(timestamp(), option.id);
      db.query("DELETE FROM assessments WHERE option_id = ?").run(option.id);
      db.query("DELETE FROM relations WHERE from_kind = 'option' AND from_id = ?").run(option.id);
      changes = db.query("DELETE FROM options WHERE id = ?").run(option.id).changes;
      db.query("DELETE FROM focus WHERE kind = 'option' AND node_id = ?").run(option.id);
      payload = { slug: optionPath(option.questionSlug, option.slug) };
    } else if (kind === "criterion") {
      const criterion = criterionRecord(db, reference);
      entityId = criterion.id;
      db.query("DELETE FROM assessments WHERE criterion_id = ?").run(criterion.id);
      db.query("DELETE FROM question_criteria WHERE criterion_id = ?").run(criterion.id);
      changes = db.query("DELETE FROM criteria WHERE id = ?").run(criterion.id).changes;
      db.query("DELETE FROM focus WHERE kind = 'criterion' AND node_id = ?").run(criterion.id);
      payload = { slug: criterion.slug };
    } else if (kind === "assessment") {
      const [optionReference, criterionSlug] = parseEdgeReference(kind, reference);
      const option = optionRecord(db, optionReference);
      const criterion = criterionRecord(db, criterionSlug);
      changes = db.query("DELETE FROM assessments WHERE option_id = ? AND criterion_id = ?").run(option.id, criterion.id).changes;
      payload = { option: optionPath(option.questionSlug, option.slug), criterion: criterion.slug };
    } else if (kind === "relevance") {
      const [questionSlug, criterionSlug] = parseEdgeReference(kind, reference);
      const question = questionRecord(db, questionSlug);
      const criterion = criterionRecord(db, criterionSlug);
      changes = db.query("DELETE FROM question_criteria WHERE question_id = ? AND criterion_id = ?").run(question.id, criterion.id).changes;
      payload = { question: question.slug, criterion: criterion.slug };
    } else {
      entityId = relationRecord(db, reference).id;
      changes = db.query("DELETE FROM relations WHERE id = ?").run(entityId).changes;
      payload = { reference };
    }
    if (changes === 0) throw new Error(`${kind} ${reference} was not found.`);
    appendEdit(db, actor, "remove", kind, entityId, payload);
  })();
}

export function setFocus(db: Database, kind: NodeKind, reference: string, actor: string): void {
  db.transaction(() => {
    const node = kind === "question" ? questionRecord(db, reference) : kind === "option" ? optionRecord(db, reference) : criterionRecord(db, reference);
    const slug = kind === "option" ? optionPath((node as InternalOption).questionSlug, node.slug) : node.slug;
    const ts = timestamp();
    db.query(`INSERT INTO focus (row_lock, kind, node_id, set_at) VALUES (1, ?, ?, ?)
      ON CONFLICT(row_lock) DO UPDATE SET kind = excluded.kind, node_id = excluded.node_id, set_at = excluded.set_at`)
      .run(kind, node.id, ts);
    appendEdit(db, actor, "focus", kind, node.id, { kind, slug }, ts);
  })();
}

export function getFocus(db: Database): Focus | null {
  const row = db.query("SELECT kind, node_id, set_at FROM focus WHERE row_lock = 1").get() as {
    kind: NodeKind;
    node_id: number;
    set_at: string;
  } | null;
  if (!row) return null;

  let reference: string | null = null;
  if (row.kind === "question") {
    const question = db.query("SELECT slug FROM questions WHERE id = ?").get(row.node_id) as { slug: string } | null;
    reference = question?.slug ?? null;
  } else if (row.kind === "option") {
    const option = db.query(`SELECT q.slug AS question_slug, o.slug AS option_slug
      FROM options o JOIN questions q ON q.id = o.question_id WHERE o.id = ?`).get(row.node_id) as {
      question_slug: string;
      option_slug: string;
    } | null;
    reference = option ? optionPath(option.question_slug, option.option_slug) : null;
  } else if (row.kind === "criterion") {
    const criterion = db.query("SELECT slug FROM criteria WHERE id = ?").get(row.node_id) as { slug: string } | null;
    reference = criterion?.slug ?? null;
  }

  return reference === null ? null : { kind: row.kind, reference, setAt: row.set_at };
}

export function getQuestion(db: Database, slug: string): Question {
  return getQuestionById(db, questionRecord(db, slug).id);
}

function getQuestionById(db: Database, id: number): Question {
  const row = db.query(`SELECT q.slug, q.title, q.detail, q.acceptance, q.resolution, q.position,
    o.slug AS resolved_option_slug, q.created_at, q.updated_at
    FROM questions q LEFT JOIN options o ON o.id = q.resolved_option_id WHERE q.id = ?`).get(id) as Record<string, unknown> | null;
  if (!row) throw new Error("Question does not exist.");
  return mapQuestion(row);
}

export function getOption(db: Database, pathValue: string): Option {
  return getOptionById(db, optionRecord(db, pathValue).id);
}

function getOptionById(db: Database, id: number): Option {
  const row = db.query(`SELECT q.slug AS question_slug, o.slug, o.title, o.detail, o.acceptance,
    o.position, o.created_at, o.updated_at FROM options o JOIN questions q ON q.id = o.question_id WHERE o.id = ?`).get(id) as Record<string, unknown> | null;
  if (!row) throw new Error("Option does not exist.");
  return mapOption(row);
}

export function getCriterion(db: Database, slug: string): Criterion {
  return getCriterionById(db, criterionRecord(db, slug).id);
}

function getCriterionById(db: Database, id: number): Criterion {
  const row = db.query("SELECT slug, description, acceptance, created_at, updated_at FROM criteria WHERE id = ?").get(id) as Record<string, unknown> | null;
  if (!row) throw new Error("Criterion does not exist.");
  return mapCriterion(row);
}

export function getAssessment(db: Database, pathValue: string, criterionSlugValue: string): Assessment {
  const option = optionRecord(db, pathValue);
  const criterionSlug = validateSlug(criterionSlugValue, "Criterion slug");
  const row = db.query(`SELECT q.slug AS question_slug, o.slug AS option_slug, c.slug AS criterion_slug,
    a.polarity, a.note, a.acceptance FROM assessments a JOIN options o ON o.id = a.option_id
    JOIN questions q ON q.id = o.question_id JOIN criteria c ON c.id = a.criterion_id
    WHERE a.option_id = ? AND c.slug = ?`).get(option.id, criterionSlug) as Record<string, unknown> | null;
  if (!row) throw new Error(`Assessment ${pathValue}:${criterionSlug} does not exist.`);
  return mapAssessment(row);
}

function getRelevance(db: Database, questionId: number, criterionId: number): Relevance {
  const row = db.query(`SELECT q.slug AS question_slug, c.slug AS criterion_slug, qc.acceptance
    FROM question_criteria qc JOIN questions q ON q.id = qc.question_id
    JOIN criteria c ON c.id = qc.criterion_id WHERE qc.question_id = ? AND qc.criterion_id = ?`).get(questionId, criterionId) as Record<string, unknown> | null;
  if (!row) throw new Error("Relevance does not exist.");
  return { questionSlug: String(row.question_slug), criterionSlug: String(row.criterion_slug), acceptance: row.acceptance as Acceptance };
}

export function getOutline(db: Database): OutlineSnapshot {
  const questionRows = db.query(`SELECT q.slug, q.title, q.detail, q.acceptance, q.resolution, q.position,
    o.slug AS resolved_option_slug, q.created_at, q.updated_at FROM questions q
    LEFT JOIN options o ON o.id = q.resolved_option_id ORDER BY q.position, q.id`).all() as Record<string, unknown>[];
  const typedRelations = db.query(`SELECT r.kind, r.from_kind, r.note, r.acceptance,
    CASE WHEN r.from_kind = 'option' THEN owner.slug || '/' || o.slug ELSE source.slug END AS source,
    target.slug AS target FROM relations r
    LEFT JOIN questions source ON r.from_kind = 'question' AND source.id = r.from_id
    LEFT JOIN options o ON r.from_kind = 'option' AND o.id = r.from_id
    LEFT JOIN questions owner ON owner.id = o.question_id
    JOIN questions target ON target.id = r.to_id ORDER BY r.id`).all() as Record<string, unknown>[];
  const optionRows = db.query(`SELECT q.slug AS question_slug, o.slug, o.title, o.detail, o.acceptance,
    o.position, o.created_at, o.updated_at FROM options o JOIN questions q ON q.id = o.question_id
    ORDER BY o.question_id, o.position, o.id`).all() as Record<string, unknown>[];
  const criterionRows = db.query(`SELECT DISTINCT c.slug, c.description, c.acceptance, c.created_at, c.updated_at
    FROM criteria c
    WHERE EXISTS (SELECT 1 FROM question_criteria qc WHERE qc.criterion_id = c.id)
       OR EXISTS (SELECT 1 FROM assessments a WHERE a.criterion_id = c.id)
       OR EXISTS (SELECT 1 FROM focus f WHERE f.kind = 'criterion' AND f.node_id = c.id)
    ORDER BY c.slug`).all() as Record<string, unknown>[];
  const assessmentRows = db.query(`SELECT q.slug AS question_slug, o.slug AS option_slug,
    c.slug AS criterion_slug, a.polarity, a.note, a.acceptance
    FROM assessments a
    JOIN options o ON o.id = a.option_id
    JOIN questions q ON q.id = o.question_id
    JOIN criteria c ON c.id = a.criterion_id
    ORDER BY o.question_id, o.position, c.slug`).all() as Record<string, unknown>[];
  const relevanceRows = db.query(`SELECT q.slug AS question_slug, c.slug AS criterion_slug, qc.acceptance
    FROM question_criteria qc
    JOIN questions q ON q.id = qc.question_id
    JOIN criteria c ON c.id = qc.criterion_id
    ORDER BY q.id, c.slug`).all() as Record<string, unknown>[];
  return {
    questions: questionRows.map(mapQuestion),
    relations: typedRelations.map((row) => ({ kind: row.kind as RelationKind, fromKind: row.from_kind as "question" | "option",
      from: String(row.source), to: String(row.target), note: String(row.note), acceptance: row.acceptance as Acceptance })),
    options: optionRows.map(mapOption),
    criteria: criterionRows.map(mapCriterion),
    assessments: assessmentRows.map(mapAssessment),
    relevances: relevanceRows.map((row) => ({
      questionSlug: String(row.question_slug),
      criterionSlug: String(row.criterion_slug),
      acceptance: row.acceptance as Acceptance,
    })),
    focus: getFocus(db),
  };
}

export function renderOutline(db: Database, options: { hops?: number; around?: string; ids?: boolean } = {}): string {
  const snapshot = getOutline(db);
  const hops = options.hops ?? 1;
  if (!Number.isInteger(hops) || hops < 0) throw new Error("hops must be a non-negative integer.");
  let included: Set<string> | undefined;
  if (options.around !== undefined) {
    questionRecord(db, options.around);
    included = new Set([options.around]);
    let frontier = new Set(included);
    for (let hop = 0; hop < hops && frontier.size; hop++) {
      const next = new Set<string>();
      for (const r of snapshot.relations) {
        const from = r.fromKind === "option" ? r.from.split("/")[0]! : r.from;
        if (frontier.has(from) && !included.has(r.to)) next.add(r.to);
        if (frontier.has(r.to) && !included.has(from)) next.add(from);
      }
      for (const slug of next) included.add(slug);
      frontier = next;
    }
  }
  const lines = snapshot.questions.filter((q) => !included || included.has(q.slug)).map((q) => {
    const context = relationGroups(snapshot.relations, q.slug).map(({ label, entries }) =>
      `${label}${label === "parts" ? ":" : ""} ${entries.map(({ reference, relation }) => `${reference}${relation.acceptance === "suggested" ? "?" : ""}`).join(", ")}`).join(" · ");
    const debug = options.ids ? ` Q${questionRecord(db, q.slug).id}` : "";
    return `- ${resolutionGlyph(q.resolution)} ${q.slug}${debug}: ${q.title}${q.resolvedOptionSlug ? ` → ${q.resolvedOptionSlug}` : ""}${q.acceptance === "suggested" ? " [suggested]" : ""}${context ? ` (${context})` : ""}`;
  });
  return lines.length ? `${lines.join("\n")}\n` : "No questions yet.\n";
}

export function renderEntity(db: Database, kind: NodeKind, reference: string): string {
  if (kind === "question") {
    const record = questionRecord(db, reference);
    const question = getQuestionById(db, record.id);
    const optionRows = db.query(`SELECT q.slug AS question_slug, o.slug, o.title, o.detail, o.acceptance,
      o.position, o.created_at, o.updated_at FROM options o JOIN questions q ON q.id = o.question_id
      WHERE o.question_id = ? ORDER BY o.position, o.id`).all(record.id) as Record<string, unknown>[];
    const relations = db.query(`SELECT c.slug, qc.acceptance FROM question_criteria qc
      JOIN criteria c ON c.id = qc.criterion_id WHERE qc.question_id = ? ORDER BY c.slug`).all(record.id) as Record<string, unknown>[];
    const lines = [
      `# ${question.slug}: ${question.title}`, "", `Acceptance: ${question.acceptance}`,
      `Resolution: ${question.resolution}${question.resolvedOptionSlug ? ` → ${question.resolvedOptionSlug}` : ""}`,
      ...relationGroups(getOutline(db).relations, question.slug).map(({ label, entries }) =>
        `${label[0]!.toUpperCase()}${label.slice(1)}: ${entries.map(({ reference, relation }) => `${reference} [${relation.acceptance}]${relation.note ? ` — ${relation.note}` : ""}`).join(", ")}`),
    ];
    if (question.detail) lines.push("", question.detail);
    lines.push("", "## Options");
    if (!optionRows.length) lines.push("", "None.");
    for (const row of optionRows) {
      const option = mapOption(row);
      lines.push("", `- ${option.slug}: ${option.title} [${option.acceptance}]${option.detail ? ` — ${option.detail}` : ""}`);
    }
    lines.push("", `Criteria: ${relations.map((row) => `${row.slug} [${row.acceptance}]`).join(", ") || "none"}`);
    return `${lines.join("\n")}\n`;
  }
  if (kind === "option") {
    const option = getOption(db, reference);
    const record = optionRecord(db, reference);
    const assessments = db.query(`SELECT q.slug AS question_slug, o.slug AS option_slug, c.slug AS criterion_slug,
      a.polarity, a.note, a.acceptance FROM assessments a JOIN options o ON o.id = a.option_id
      JOIN questions q ON q.id = o.question_id JOIN criteria c ON c.id = a.criterion_id
      WHERE a.option_id = ? ORDER BY c.slug`).all(record.id) as Record<string, unknown>[];
    const lines = [`# ${optionPath(option.questionSlug, option.slug)}: ${option.title}`, "", `Question: ${option.questionSlug}`, `Acceptance: ${option.acceptance}`];
    if (option.detail) lines.push("", option.detail);
    lines.push("", "## Assessments");
    if (!assessments.length) lines.push("", "None.");
    for (const row of assessments) {
      const assessment = mapAssessment(row);
      lines.push("", `- ${assessment.polarity} ${assessment.criterionSlug} [${assessment.acceptance}]${assessment.note ? ` — ${assessment.note}` : ""}`);
    }
    return `${lines.join("\n")}\n`;
  }
  const criterion = getCriterion(db, reference);
  const record = criterionRecord(db, reference);
  const lines = [`# ${criterion.slug}`, "", `Acceptance: ${criterion.acceptance}`];
  if (criterion.description) lines.push("", criterion.description);
  const relations = db.query(`SELECT q.slug AS question_slug, qc.acceptance FROM question_criteria qc
    JOIN questions q ON q.id = qc.question_id WHERE qc.criterion_id = ? ORDER BY q.slug`).all(record.id) as Record<string, unknown>[];
  const assessments = db.query(`SELECT q.slug AS question_slug, o.slug AS option_slug,
    a.polarity, a.note, a.acceptance FROM assessments a JOIN options o ON o.id = a.option_id
    JOIN questions q ON q.id = o.question_id WHERE a.criterion_id = ? ORDER BY q.slug, o.slug`).all(record.id) as Record<string, unknown>[];
  lines.push("", "## Questions");
  if (!relations.length) lines.push("", "None.");
  for (const row of relations) lines.push("", `- ${row.question_slug} [${row.acceptance}]`);
  lines.push("", "## Assessments");
  if (!assessments.length) lines.push("", "None.");
  for (const row of assessments) {
    lines.push("", `- ${row.polarity} ${optionPath(String(row.question_slug), String(row.option_slug))} [${row.acceptance}]${row.note ? ` — ${row.note}` : ""}`);
  }
  return `${lines.join("\n")}\n`;
}

export function getEdits(db: Database, since?: string, limit = 20): Edit[] {
  const numericSince = since !== undefined && /^\d+$/.test(since) ? Number(since) : undefined;
  const rows = numericSince !== undefined
    ? db.query("SELECT id, ts, actor, verb, entity_kind, payload FROM edits WHERE id > ? ORDER BY id DESC LIMIT ?").all(numericSince, limit)
    : since !== undefined
      ? db.query("SELECT id, ts, actor, verb, entity_kind, payload FROM edits WHERE ts >= ? ORDER BY id DESC LIMIT ?").all(since, limit)
      : db.query("SELECT id, ts, actor, verb, entity_kind, payload FROM edits ORDER BY id DESC LIMIT ?").all(limit);
  return (rows as Record<string, unknown>[]).reverse().map((row) => ({
    id: Number(row.id), ts: String(row.ts), actor: String(row.actor), verb: String(row.verb),
    entityKind: String(row.entity_kind), payload: JSON.parse(String(row.payload)) as Record<string, unknown>,
  }));
}

export function renderEdits(db: Database, since?: string): string {
  const edits = getEdits(db, since);
  if (!edits.length) return "No edits.\n";
  return `${edits.map((edit) => `${edit.id}\t${edit.ts}\t${edit.actor}\t${edit.verb} ${edit.entityKind}\t${JSON.stringify(edit.payload)}`).join("\n")}\n`;
}

function resolutionGlyph(resolution: Resolution): string {
  return resolution === "decided" ? "●" : resolution === "leaning" ? "◐" : "○";
}

function mapQuestion(row: Record<string, unknown>): Question {
  return {
    slug: String(row.slug), title: String(row.title), detail: String(row.detail), acceptance: row.acceptance as Acceptance,
    position: Number(row.position), resolution: row.resolution as Resolution, resolvedOptionSlug: row.resolved_option_slug === null ? null : String(row.resolved_option_slug),
    createdAt: String(row.created_at), updatedAt: String(row.updated_at),
  };
}

function mapOption(row: Record<string, unknown>): Option {
  return {
    questionSlug: String(row.question_slug), slug: String(row.slug), title: String(row.title), detail: String(row.detail),
    acceptance: row.acceptance as Acceptance, position: Number(row.position), createdAt: String(row.created_at), updatedAt: String(row.updated_at),
  };
}

function mapCriterion(row: Record<string, unknown>): Criterion {
  return {
    slug: String(row.slug), description: String(row.description), acceptance: row.acceptance as Acceptance,
    createdAt: String(row.created_at), updatedAt: String(row.updated_at),
  };
}

function mapAssessment(row: Record<string, unknown>): Assessment {
  return {
    optionPath: optionPath(String(row.question_slug), String(row.option_slug)), criterionSlug: String(row.criterion_slug),
    polarity: row.polarity as Polarity, note: String(row.note), acceptance: row.acceptance as Acceptance,
  };
}
