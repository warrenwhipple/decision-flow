import type { Database } from "bun:sqlite";
import { resolve } from "node:path";
import {
  acceptEntity,
  addCriterion,
  addOption,
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
  updateQuestion,
  type EdgeReference,
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
  dbPath: string;
  port?: number;
  hostname?: string;
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

function entityReference(value: unknown): number | EdgeReference {
  if (typeof value === "number") return requiredInteger(value, "ID");
  if (!value || typeof value !== "object") throw new Error("A valid entity reference is required.");
  const record = value as Record<string, unknown>;
  return { firstId: requiredInteger(record.firstId, "Composite reference ID"), second: requiredString(record.second, "Composite reference target") };
}

function sseEvent(event: string, data: unknown): Uint8Array {
  return textEncoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

async function buildView(): Promise<string> {
  const viewPath = resolve(import.meta.dir, "../view/app.tsx");
  const result = await Bun.build({
    entrypoints: [viewPath],
    target: "browser",
    format: "esm",
    minify: false,
  });
  if (!result.success || result.outputs.length !== 1) {
    const detail = result.logs.map((log) => log.message).join("\n");
    throw new Error(`Could not build the outline view.\n${detail}`);
  }
  return result.outputs[0]!.text();
}

export async function startServer(options: StartServerOptions): Promise<DvizServer> {
  const db = openSpace(options.dbPath);
  const appJavaScript = await buildView();
  const html = await Bun.file(resolve(import.meta.dir, "../view/index.html")).text();
  const css = await Bun.file(resolve(import.meta.dir, "../view/styles.css")).text();
  const clients = new Set<ReadableStreamDefaultController<Uint8Array>>();

  const sendToClients = (message: Uint8Array) => {
    for (const client of clients) {
      try {
        client.enqueue(message);
      } catch {
        clients.delete(client);
      }
    }
  };

  const broadcast = (snapshot: OutlineSnapshot) => {
    sendToClients(sseEvent("outline", snapshot));
  };

  const server = Bun.serve({
    hostname: options.hostname ?? "127.0.0.1",
    port: options.port ?? DEFAULT_PORT,
    async fetch(request) {
      const url = new URL(request.url);

      if (request.method === "GET" && url.pathname === "/") {
        return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
      }
      if (request.method === "GET" && url.pathname === "/app.js") {
        return new Response(appJavaScript, { headers: { "Content-Type": "text/javascript; charset=utf-8" } });
      }
      if (request.method === "GET" && url.pathname === "/styles.css") {
        return new Response(css, { headers: { "Content-Type": "text/css; charset=utf-8" } });
      }
      if (request.method === "GET" && url.pathname === "/api/outline") {
        return json(getOutline(db));
      }
      if (request.method === "GET" && url.pathname === "/api/outline.md") {
        try {
          const depthValue = url.searchParams.get("depth");
          const aroundValue = url.searchParams.get("around");
          const depth = depthValue === null ? undefined : requiredInteger(depthValue, "depth");
          const around = aroundValue === null ? undefined : requiredInteger(aroundValue, "around");
          return new Response(renderOutline(db, depth, around), {
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
          const id = requiredInteger(parts[4], "ID");
          return new Response(renderEntity(db, kind, id), {
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
          if (typeof body.title !== "string") {
            return errorResponse(new Error("Request body must include a string title."));
          }
          const parentId = body.parentId === null || body.parentId === undefined
            ? null
            : Number(body.parentId);
          if (parentId !== null && (!Number.isInteger(parentId) || parentId < 1)) {
            return errorResponse(new Error("parentId must be a positive integer or null."));
          }
          const question = addQuestion(db, {
            title: body.title,
            detail: typeof body.detail === "string" ? body.detail : "",
            parentId,
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
              title: requiredString(body.title, "title"),
              detail: typeof body.detail === "string" ? body.detail : "",
              parentId: body.parentId === null || body.parentId === undefined ? null : requiredInteger(body.parentId, "parentId"),
              actor,
            });
          } else if (action === "question.update") {
            result = updateQuestion(db, requiredInteger(body.id, "id"), {
              title: typeof body.title === "string" ? body.title : undefined,
              detail: typeof body.detail === "string" ? body.detail : undefined,
              actor,
            });
          } else if (action === "question.lean" || action === "question.decide") {
            result = setQuestionResolution(
              db,
              requiredInteger(body.id, "id"),
              action === "question.lean" ? "leaning" : "decided",
              requiredInteger(body.optionId, "optionId"),
              actor,
            );
          } else if (action === "question.reopen") {
            result = setQuestionResolution(db, requiredInteger(body.id, "id"), "open", null, actor);
          } else if (action === "option.add") {
            result = addOption(db, {
              questionId: requiredInteger(body.questionId, "questionId"),
              title: requiredString(body.title, "title"),
              detail: typeof body.detail === "string" ? body.detail : "",
              actor,
            });
          } else if (action === "criterion.add") {
            result = addCriterion(db, {
              slug: requiredString(body.slug, "slug"),
              description: typeof body.description === "string" ? body.description : "",
              actor,
            });
          } else if (action === "assess") {
            const polarity = body.polarity as Polarity;
            if (!(["+", "-", "~", "?"] as string[]).includes(polarity)) {
              throw new Error("polarity must be +, -, ~, or ?.");
            }
            result = setAssessment(db, {
              optionId: requiredInteger(body.optionId, "optionId"),
              criterionSlug: requiredString(body.criterionSlug, "criterionSlug"),
              polarity,
              note: typeof body.note === "string" ? body.note : "",
              actor,
            });
          } else if (action === "relate") {
            result = relateCriterion(db, {
              questionId: requiredInteger(body.questionId, "questionId"),
              criterionSlug: requiredString(body.criterionSlug, "criterionSlug"),
              actor,
            });
          } else if (action === "accept" || action === "remove") {
            const kind = body.kind as EntityKind;
            if (!(["question", "option", "criterion", "assessment", "relation", "placement"] as string[]).includes(kind)) {
              throw new Error("kind must be question, option, criterion, assessment, relation, or placement.");
            }
            const reference = entityReference(body.reference);
            if (action === "accept") acceptEntity(db, kind, reference, actor);
            else removeEntity(db, kind, reference, actor);
            result = { kind, reference };
          } else if (action === "focus") {
            const kind = body.kind as NodeKind;
            if (!(["question", "option", "criterion"] as string[]).includes(kind)) {
              throw new Error("focus kind must be question, option, or criterion.");
            }
            const id = requiredInteger(body.id, "id");
            setFocus(db, kind, id, actor);
            result = { kind, id };
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

  // Bun closes inactive HTTP requests after ten seconds by default. A comment
  // heartbeat keeps the local EventSource connection alive between edits.
  const heartbeat = setInterval(() => {
    sendToClients(textEncoder.encode(": keep-alive\n\n"));
  }, 5_000);

  const actualPort = server.port;
  if (actualPort === undefined) {
    clearInterval(heartbeat);
    server.stop(true);
    db.close();
    throw new Error("Bun started the server without reporting a port.");
  }
  const url = `http://${server.hostname}:${actualPort}`;
  return {
    port: actualPort,
    url,
    stop(closeActiveConnections = false) {
      for (const client of clients) {
        try {
          client.close();
        } catch {
          // The browser may already have disconnected.
        }
      }
      clients.clear();
      clearInterval(heartbeat);
      server.stop(closeActiveConnections);
      db.close();
    },
  };
}
