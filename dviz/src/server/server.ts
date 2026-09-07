import type { Database } from "bun:sqlite";
import { SpaceLibrary, libraryPath } from "../db/library.ts";
import index from "../view/index.html";
import { dinnerFixture } from "../view/dinner-fixture.ts";
import {
  acceptEntity,
  addCriterion,
  addOption,
  addPlacement,
  addQuestion,
  DEFAULT_PORT,
  getOutline,
  openSpace,
  relateCriterion,
  removeEntity,
  renderEdits,
  renderEntity,
  renderOutline,
  setAssessment,
  setFocus,
  setQuestionResolution,
  updateOption,
  updateQuestion,
  type EntityKind,
  type NodeKind,
  type OutlineSnapshot,
  type Polarity,
} from "../db/space.ts";

export type DvizServer = {
  port: number;
  url: string;
  stop: (closeActiveConnections?: boolean) => void;
};

export type StartServerOptions = {
  dbPath?: string;
  libraryDir?: string;
  port?: number;
  hostname?: string;
  development?: boolean;
};

const textEncoder = new TextEncoder();

function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function errorResponse(error: unknown, status = 400): Response {
  const message = error instanceof Error ? error.message : String(error);
  return json({ error: message }, status);
}

function requiredInteger(value: unknown, label: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`${label} must be a positive integer.`);
  return parsed;
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a non-empty string.`);
  return value;
}

function sseEvent(event: string, data: unknown): Uint8Array {
  return textEncoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export async function startServer(options: StartServerOptions): Promise<DvizServer> {
  if (options.dbPath && options.libraryDir) throw new Error("Choose a library or a legacy database, not both.");
  const library = options.dbPath ? null : new SpaceLibrary(options.libraryDir ?? libraryPath());
  type SpaceState = { db: Database; clients: Set<ReadableStreamDefaultController<Uint8Array>> };
  const states = new Map<string, SpaceState>();
  if (options.dbPath) states.set("", { db: openSpace(options.dbPath), clients: new Set() });
  const sendToClients = (clients: SpaceState["clients"], message: Uint8Array) => {
    for (const client of clients) {
      try { client.enqueue(message); } catch { clients.delete(client); }
    }
  };
  const closeStores = () => {
    for (const { db } of states.values()) db.close();
    library?.close();
  };

  let server;
  try {
    server = Bun.serve({
      hostname: options.hostname ?? "127.0.0.1",
      port: options.port ?? DEFAULT_PORT,
      routes: { "/": index },
      development: options.development ? { hmr: true, console: true } : false,
      async fetch(request) {
        const url = new URL(request.url);

        if (request.method === "GET" && url.pathname === "/api/fixtures/dinner" && options.development) {
          return json(dinnerFixture);
        }
        // Reject cross-origin browser writes to this local service.
        if (request.method === "POST" && request.headers.get("origin") && request.headers.get("origin") !== url.origin) {
          return errorResponse(new Error("Cross-origin writes are not allowed."), 403);
        }
        if (url.pathname === "/api/spaces") {
          if (!library) return request.method === "GET"
            ? json({ mode: "legacy", spaces: [] })
            : errorResponse(new Error("Space creation requires the library server. Run dviz serve without --db."));
          try {
            if (request.method === "GET") return json({ mode: "library", spaces: library.list() });
            if (request.method === "POST") {
              const body = await request.json() as Record<string, unknown>;
              return json({ space: library.create(requiredString(body.slug, "slug"), requiredString(body.title, "title")) }, 201);
            }
            return errorResponse(new Error("Method not allowed."), 405);
          } catch (error) { return errorResponse(error); }
        }
        if (!url.pathname.startsWith("/api/")) return errorResponse(new Error("Not found."), 404);
        let state: SpaceState;
        try {
          const slug = url.searchParams.get("space");
          if (library) {
            if (!slug) throw new Error("A space is required. Pass --space SLUG (or DVIZ_SPACE) in the CLI.");
            const path = library.dbPath(slug);
            if (!states.has(slug)) states.set(slug, { db: openSpace(path), clients: new Set() });
            state = states.get(slug)!;
          } else {
            if (slug) throw new Error("This is a legacy single-space server; omit --space or use the library server.");
            state = states.get("")!;
          }
        } catch (error) { return errorResponse(error); }
        const { db, clients } = state;
        const broadcast = (snapshot: OutlineSnapshot) => sendToClients(clients, sseEvent("outline", snapshot));
        if (request.method === "GET" && url.pathname === "/api/outline") {
          return json(getOutline(db));
        }
        if (request.method === "GET" && url.pathname === "/api/outline.md") {
          try {
            const depthValue = url.searchParams.get("depth");
            const aroundValue = url.searchParams.get("around");
            const depth = depthValue === null ? undefined : requiredInteger(depthValue, "depth");
            const around = aroundValue ?? undefined;
            const ids = url.searchParams.has("ids");
            return new Response(renderOutline(db, { depth, around, ids }), {
              headers: { "Content-Type": "text/markdown; charset=utf-8", "Cache-Control": "no-store" },
            });
          } catch (error) {
            return errorResponse(error);
          }
        }
        if (request.method === "GET" && url.pathname.startsWith("/api/show/")) {
          try {
            const parts = url.pathname.split("/");
            const kind = parts[3] as NodeKind;
            if (!(["question", "option", "criterion"] as string[]).includes(kind)) {
              throw new Error("show kind must be question, option, or criterion.");
            }
            const reference = decodeURIComponent(parts.slice(4).join("/"));
            if (!reference) throw new Error("show reference is required.");
            return new Response(renderEntity(db, kind, reference), {
              headers: { "Content-Type": "text/markdown; charset=utf-8", "Cache-Control": "no-store" },
            });
          } catch (error) {
            return errorResponse(error);
          }
        }
        if (request.method === "GET" && url.pathname === "/api/log") {
          try {
            const since = url.searchParams.get("since") ?? undefined;
            return new Response(renderEdits(db, since), {
              headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
            });
          } catch (error) {
            return errorResponse(error);
          }
        }
        if (request.method === "GET" && url.pathname === "/api/events") {
          let controller: ReadableStreamDefaultController<Uint8Array>;
          const stream = new ReadableStream<Uint8Array>({
            start(nextController) {
              controller = nextController;
              clients.add(controller);
              controller.enqueue(sseEvent("outline", getOutline(db)));
            },
            cancel() {
              clients.delete(controller);
            },
          });
          return new Response(stream, {
            headers: {
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache",
              "Connection": "keep-alive",
            },
          });
        }
        if (request.method === "POST" && url.pathname === "/api/questions") {
          try {
            const body = await request.json() as Record<string, unknown>;
            const question = addQuestion(db, {
              slug: requiredString(body.slug, "slug"),
              title: requiredString(body.title, "title"),
              detail: typeof body.detail === "string" ? body.detail : "",
              parentSlug: body.parentSlug === null || body.parentSlug === undefined ? null : requiredString(body.parentSlug, "parentSlug"),
              actor: typeof body.actor === "string" && body.actor.trim() ? body.actor : "agent:cli",
            });
            broadcast(getOutline(db));
            return json({ question }, 201);
          } catch (error) {
            return errorResponse(error);
          }
        }
        if (request.method === "POST" && url.pathname === "/api/command") {
          try {
            const body = await request.json() as Record<string, unknown>;
            const action = requiredString(body.action, "action");
            const actor = typeof body.actor === "string" && body.actor.trim() ? body.actor : "agent:cli";
            let result: unknown;
            if (action === "question.add") {
              result = addQuestion(db, {
                slug: requiredString(body.slug, "slug"),
                title: requiredString(body.title, "title"),
                detail: typeof body.detail === "string" ? body.detail : "",
                parentSlug: body.parentSlug === null || body.parentSlug === undefined ? null : requiredString(body.parentSlug, "parentSlug"),
                actor,
              });
            } else if (action === "question.update") {
              result = updateQuestion(db, requiredString(body.questionSlug, "questionSlug"), {
                slug: typeof body.slug === "string" ? body.slug : undefined,
                title: typeof body.title === "string" ? body.title : undefined,
                detail: typeof body.detail === "string" ? body.detail : undefined,
                actor,
              });
            } else if (action === "question.lean" || action === "question.decide") {
              result = setQuestionResolution(
                db,
                requiredString(body.questionSlug, "questionSlug"),
                action === "question.lean" ? "leaning" : "decided",
                requiredString(body.optionSlug, "optionSlug"),
                actor,
              );
            } else if (action === "question.reopen") {
              result = setQuestionResolution(db, requiredString(body.questionSlug, "questionSlug"), "open", null, actor);
            } else if (action === "option.add") {
              result = addOption(db, {
                questionSlug: requiredString(body.questionSlug, "questionSlug"),
                slug: requiredString(body.slug, "slug"),
                title: requiredString(body.title, "title"),
                detail: typeof body.detail === "string" ? body.detail : "",
                actor,
              });
            } else if (action === "option.update") {
              result = updateOption(db, requiredString(body.optionPath, "optionPath"), {
                slug: typeof body.slug === "string" ? body.slug : undefined,
                title: typeof body.title === "string" ? body.title : undefined,
                detail: typeof body.detail === "string" ? body.detail : undefined,
                actor,
              });
            } else if (action === "criterion.add") {
              result = addCriterion(db, {
                slug: requiredString(body.slug, "slug"),
                description: typeof body.description === "string" ? body.description : "",
                actor,
              });
            } else if (action === "place") {
              result = addPlacement(db, {
                childSlug: requiredString(body.childSlug, "childSlug"),
                parentSlug: requiredString(body.parentSlug, "parentSlug"),
                actor,
              });
            } else if (action === "assess") {
              const polarity = body.polarity as Polarity;
              if (!(["+", "-", "~", "?"] as string[]).includes(polarity)) {
                throw new Error("polarity must be +, -, ~, or ?.");
              }
              result = setAssessment(db, {
                optionPath: requiredString(body.optionPath, "optionPath"),
                criterionSlug: requiredString(body.criterionSlug, "criterionSlug"),
                polarity,
                note: typeof body.note === "string" ? body.note : "",
                actor,
              });
            } else if (action === "relate") {
              result = relateCriterion(db, {
                questionSlug: requiredString(body.questionSlug, "questionSlug"),
                criterionSlug: requiredString(body.criterionSlug, "criterionSlug"),
                actor,
              });
            } else if (action === "accept" || action === "remove") {
              const kind = body.kind as EntityKind;
              if (!(["question", "option", "criterion", "assessment", "relation", "placement"] as string[]).includes(kind)) {
                throw new Error("kind must be question, option, criterion, assessment, relation, or placement.");
              }
              const reference = requiredString(body.reference, "reference");
              if (action === "accept") acceptEntity(db, kind, reference, actor);
              else removeEntity(db, kind, reference, actor);
              result = { kind, reference };
            } else if (action === "focus") {
              const kind = body.kind as NodeKind;
              if (!(["question", "option", "criterion"] as string[]).includes(kind)) {
                throw new Error("focus kind must be question, option, or criterion.");
              }
              const reference = requiredString(body.reference, "reference");
              setFocus(db, kind, reference, actor);
              result = { kind, reference };
            } else {
              throw new Error(`Unknown action: ${action}`);
            }
            broadcast(getOutline(db));
            return json({ result }, 200);
          } catch (error) {
            return errorResponse(error);
          }
        }

        return errorResponse(new Error("Not found."), 404);
      },
    });
  } catch (error) {
    closeStores();
    throw error;
  }

  // Bun closes inactive HTTP requests after ten seconds by default. A comment
  // heartbeat keeps the local EventSource connection alive between edits.
  const heartbeat = setInterval(() => {
    for (const { clients } of states.values()) sendToClients(clients, textEncoder.encode(": keep-alive\n\n"));
  }, 5_000);

  const actualPort = server.port;
  if (actualPort === undefined) {
    clearInterval(heartbeat);
    server.stop(true);
    closeStores();
    throw new Error("Bun started the server without reporting a port.");
  }
  const url = `http://${server.hostname}:${actualPort}`;
  return {
    port: actualPort,
    url,
    stop(closeActiveConnections = false) {
      for (const { clients } of states.values()) {
        for (const client of clients) {
          try {
            client.close();
          } catch {
            // The browser may already have disconnected.
          }
        }
        clients.clear();
      }
      clearInterval(heartbeat);
      server.stop(closeActiveConnections);
      closeStores();
    },
  };
}
