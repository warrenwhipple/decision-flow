import { Database } from "bun:sqlite";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, parse, resolve } from "node:path";
import { SCHEMA, SCHEMA_VERSION } from "./schema.ts";

export const DEFAULT_PORT = 4377;
export const SPACE_DIRECTORY = ".dviz";
export const SPACE_FILENAME = "space.db";
export const SERVER_FILENAME = "server.json";

export type Question = {
  id: number;
  title: string;
  detail: string;
  acceptance: "suggested" | "accepted";
  resolution: "open" | "leaning" | "decided";
  resolvedOptionId: number | null;
  createdAt: string;
  updatedAt: string;
};

export type Placement = {
  childId: number;
  parentId: number | null;
  position: number;
};

export type OutlineSnapshot = {
  questions: Question[];
  placements: Placement[];
};

export type AddQuestionInput = {
  title: string;
  detail?: string;
  parentId?: number | null;
  actor: string;
};

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

export function initializeSpace(path: string): Database {
  mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path, { create: true, strict: true });
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec(SCHEMA);
  db.exec(`PRAGMA user_version = ${SCHEMA_VERSION};`);
  return db;
}

export function openSpace(path: string): Database {
  if (!existsSync(path)) {
    throw new Error(`No decision space found at ${path}. Run \`dviz init\` first.`);
  }
  const db = new Database(path, { strict: true });
  db.exec("PRAGMA foreign_keys = ON;");
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

export function addQuestion(db: Database, input: AddQuestionInput): Question {
  const title = input.title.trim();
  if (!title) throw new Error("Question title must not be empty.");
  const parentId = input.parentId ?? null;

  const insert = db.transaction(() => {
    if (parentId !== null) {
      const parent = db.query("SELECT id FROM questions WHERE id = ?").get(parentId);
      if (!parent) throw new Error(`Parent question ${parentId} does not exist.`);
    }

    const now = new Date().toISOString();
    const result = db.query(`
      INSERT INTO questions (title, detail, created_at, updated_at)
      VALUES (?, ?, ?, ?)
    `).run(title, input.detail ?? "", now, now);
    const id = Number(result.lastInsertRowid);

    const positionRow = db.query(`
      SELECT COALESCE(MAX(position), 0) + 1 AS position
      FROM question_parents
      WHERE parent_id IS ?
    `).get(parentId) as { position: number };

    db.query(`
      INSERT INTO question_parents (child_id, parent_id, position)
      VALUES (?, ?, ?)
    `).run(id, parentId, positionRow.position);

    db.query(`
      INSERT INTO edits (ts, actor, verb, entity_kind, entity_id, payload)
      VALUES (?, ?, 'add', 'question', ?, ?)
    `).run(now, input.actor, id, JSON.stringify({
      title,
      detail: input.detail ?? "",
      parentId,
      acceptance: "suggested",
    }));

    return id;
  });

  const id = insert();
  return getQuestion(db, id);
}

export function getQuestion(db: Database, id: number): Question {
  const row = db.query(`
    SELECT id, title, detail, acceptance, resolution,
      resolved_option_id, created_at, updated_at
    FROM questions WHERE id = ?
  `).get(id) as Record<string, unknown> | null;
  if (!row) throw new Error(`Question ${id} does not exist.`);
  return mapQuestion(row);
}

export function getOutline(db: Database): OutlineSnapshot {
  const questionRows = db.query(`
    SELECT id, title, detail, acceptance, resolution,
      resolved_option_id, created_at, updated_at
    FROM questions
    ORDER BY id
  `).all() as Record<string, unknown>[];
  const placementRows = db.query(`
    SELECT child_id, parent_id, position
    FROM question_parents
    ORDER BY parent_id, position, child_id
  `).all() as Record<string, unknown>[];

  return {
    questions: questionRows.map(mapQuestion),
    placements: placementRows.map((row) => ({
      childId: Number(row.child_id),
      parentId: row.parent_id === null ? null : Number(row.parent_id),
      position: Number(row.position),
    })),
  };
}

function mapQuestion(row: Record<string, unknown>): Question {
  return {
    id: Number(row.id),
    title: String(row.title),
    detail: String(row.detail),
    acceptance: row.acceptance as Question["acceptance"],
    resolution: row.resolution as Question["resolution"],
    resolvedOptionId: row.resolved_option_id === null ? null : Number(row.resolved_option_id),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}
