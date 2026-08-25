import type { Database } from "bun:sqlite";
import { resolve } from "node:path";
import {
  addQuestion,
  DEFAULT_PORT,
  getOutline,
  openSpace,
  type OutlineSnapshot,
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
