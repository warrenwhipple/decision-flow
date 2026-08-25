import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { initializeSpace } from "../src/db/space.ts";
import { startServer, type DvizServer } from "../src/server/server.ts";

const temporaryDirectories: string[] = [];
const servers: DvizServer[] = [];

async function availablePort(): Promise<number> {
  const probe = createServer();
  await new Promise<void>((resolve, reject) => {
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", resolve);
  });
  const address = probe.address();
  if (!address || typeof address === "string") throw new Error("Could not allocate a test port.");
  await new Promise<void>((resolve, reject) => probe.close((error) => error ? reject(error) : resolve()));
  return address.port;
}

afterEach(() => {
  for (const server of servers.splice(0)) server.stop(true);
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("POST /api/questions persists and broadcasts an outline SSE event", async () => {
  const directory = mkdtempSync(join(tmpdir(), "dviz-server-test-"));
  temporaryDirectories.push(directory);
  const dbPath = join(directory, "space.db");
  initializeSpace(dbPath).close();
  const server = await startServer({ dbPath, port: await availablePort() });
  servers.push(server);

  const eventsResponse = await fetch(`${server.url}/api/events`);
  const reader = eventsResponse.body!.getReader();
  const decoder = new TextDecoder();
  const initial = decoder.decode((await reader.read()).value);
  expect(initial).toContain('event: outline');
  expect(initial).toContain('"questions":[]');

  const response = await fetch(`${server.url}/api/questions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "Appears live", actor: "agent:test" }),
  });
  expect(response.status).toBe(201);
  expect(await response.json()).toMatchObject({
    question: { id: 1, title: "Appears live", acceptance: "suggested" },
  });

  const update = decoder.decode((await reader.read()).value);
  expect(update).toContain('event: outline');
  expect(update).toContain('"title":"Appears live"');
  await reader.cancel();
});
