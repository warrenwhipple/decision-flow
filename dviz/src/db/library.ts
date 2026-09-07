import { Database } from "bun:sqlite";
import { mkdirSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { initializeSpace, validateSlug } from "./space.ts";

export type SpaceSummary = { slug: string; title: string; createdAt: string };

export function libraryPath(): string {
  return resolve(process.env.DVIZ_HOME || join(homedir(), ".dviz"));
}

/** Metadata only; each graph retains its own independent SQLite database. */
export class SpaceLibrary {
  private catalog: Database;

  constructor(readonly directory: string) {
    mkdirSync(join(directory, "spaces"), { recursive: true });
    this.catalog = new Database(join(directory, "library.db"), { create: true, strict: true });
    this.catalog.exec(`CREATE TABLE IF NOT EXISTS spaces (
      slug TEXT PRIMARY KEY, title TEXT NOT NULL, createdAt TEXT NOT NULL
    )`);
  }

  list(): SpaceSummary[] {
    return this.catalog.query("SELECT slug, title, createdAt FROM spaces ORDER BY title COLLATE NOCASE, slug").all() as SpaceSummary[];
  }

  get(slug: string): SpaceSummary {
    validateSlug(slug, "Space slug");
    const space = this.catalog.query("SELECT slug, title, createdAt FROM spaces WHERE slug = ?").get(slug) as SpaceSummary | null;
    if (!space) throw new Error(`No space named ${slug}. Use dviz space list or dviz space create.`);
    return space;
  }

  dbPath(slug: string): string {
    this.get(slug);
    return join(this.directory, "spaces", slug, "space.db");
  }

  create(slug: string, title: string): SpaceSummary {
    validateSlug(slug, "Space slug");
    if (!title.trim() || title.trim().length > 200) throw new Error("Space title must contain 1–200 characters.");
    const space = { slug, title: title.trim(), createdAt: new Date().toISOString() };
    const directory = join(this.directory, "spaces", slug);
    this.catalog.transaction(() => {
      if (this.catalog.query("SELECT slug FROM spaces WHERE slug = ?").get(slug)) {
        throw new Error(`A space named ${slug} already exists. Choose another slug.`);
      }
      // Exclusive mkdir also protects orphaned data; never overwrite an existing graph.
      mkdirSync(directory);
      try {
        initializeSpace(join(directory, "space.db")).close();
        this.catalog.query("INSERT INTO spaces (slug, title, createdAt) VALUES (?, ?, ?)")
          .run(space.slug, space.title, space.createdAt);
      } catch (error) {
        rmSync(directory, { recursive: true, force: true });
        throw error;
      }
    }).immediate();
    return space;
  }

  close(): void { this.catalog.close(); }
}
