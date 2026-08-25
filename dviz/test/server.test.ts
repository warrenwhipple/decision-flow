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

test("command and projection APIs cover the v0 CLI lifecycle", async () => {
  const directory = mkdtempSync(join(tmpdir(), "dviz-server-test-"));
  temporaryDirectories.push(directory);
  const dbPath = join(directory, "space.db");
  initializeSpace(dbPath).close();
  const server = await startServer({ dbPath, port: await availablePort() });
  servers.push(server);

  const run = async (action: string, body: Record<string, unknown>) => {
    const response = await fetch(`${server.url}/api/command`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, actor: "agent:test", ...body }),
    });
    expect(response.status).toBe(200);
    return (await response.json() as { result: Record<string, unknown> }).result;
  };

  const question = await run("question.add", { title: "Choose a route" });
  const option = await run("option.add", { questionId: question.id, title: "Northern route" });
  const criterion = await run("criterion.add", { slug: "speed", description: "Arrive sooner" });
  await run("assess", { optionId: option.id, criterionSlug: "speed", polarity: "+", note: "Direct" });
  await run("relate", { questionId: question.id, criterionSlug: "speed" });
  await run("question.decide", { id: question.id, optionId: option.id });
  await run("accept", { kind: "question", reference: question.id });
  await run("accept", { kind: "placement", reference: { firstId: question.id, second: "root" } });

  const outline = await (await fetch(`${server.url}/api/outline`)).json() as Record<string, unknown[]>;
  expect(outline).toMatchObject({
    questions: [{ resolution: "decided", resolvedOptionId: option.id, acceptance: "accepted" }],
    placements: [{ acceptance: "accepted" }],
    options: [{ title: "Northern route", acceptance: "suggested" }],
  });
  expect(await (await fetch(`${server.url}/api/outline.md`)).text())
    .toContain(`● Q${question.id} Choose a route → O${option.id}`);
  expect(await (await fetch(`${server.url}/api/show/option/${option.id}`)).text())
    .toContain("+ speed [suggested] — Direct");
  expect(await (await fetch(`${server.url}/api/log`)).text()).toContain("decide question");
  expect(criterion.slug).toBe("speed");
});
