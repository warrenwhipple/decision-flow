import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { initializeSpace } from "../src/db/space.ts";
import { startServer, type DvizServer } from "../src/server/server.ts";

const temporaryDirectories: string[] = [];
const servers: DvizServer[] = [];
const cliPath = join(import.meta.dir, "../src/cli/index.ts");

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
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

async function runCli(dbPath: string, server: DvizServer, ...args: string[]): Promise<string> {
  const process = Bun.spawn(["bun", cliPath, ...args, "--db", dbPath, "--url", server.url], {
    stdout: "pipe",
    stderr: "pipe",
    env: { ...globalThis.process.env, DVIZ_ACTOR: "agent:test-cli" },
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
    process.exited,
  ]);
  if (exitCode !== 0) throw new Error(stderr);
  return stdout;
}

test("POST /api/questions persists a slug and broadcasts an ID-free outline SSE event", async () => {
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
    body: JSON.stringify({ slug: "appears-live", title: "Appears live", actor: "agent:test" }),
  });
  expect(response.status).toBe(201);
  expect(await response.json()).toMatchObject({
    question: { slug: "appears-live", title: "Appears live", acceptance: "suggested" },
  });

  const update = decoder.decode((await reader.read()).value);
  expect(update).toContain('"slug":"appears-live"');
  expect(update).not.toMatch(/"(?:id|questionId|childId|parentId)"/);
  await reader.cancel();
});

test("the HTML route bundles the view and dinner fixtures are dev-only", async () => {
  const directory = mkdtempSync(join(tmpdir(), "dviz-server-test-"));
  temporaryDirectories.push(directory);
  const dbPath = join(directory, "space.db");
  initializeSpace(dbPath).close();

  const productionServer = await startServer({ dbPath, port: await availablePort() });
  servers.push(productionServer);
  const htmlResponse = await fetch(productionServer.url);
  expect(htmlResponse.headers.get("content-type")).toContain("text/html");
  const html = await htmlResponse.text();
  expect(html).toContain("Decision Flow");
  expect(html).not.toContain("/app.js");
  expect((await fetch(`${productionServer.url}/api/fixtures/dinner`)).status).toBe(404);
  productionServer.stop(true);
  servers.splice(servers.indexOf(productionServer), 1);

  const developmentServer = await startServer({ dbPath, port: await availablePort(), development: true });
  servers.push(developmentServer);
  const response = await fetch(`${developmentServer.url}/api/fixtures/dinner`);
  expect(response.status).toBe(200);
  const fixture = await response.json() as {
    questions: Array<{ slug: string; resolution: string; resolvedOptionSlug: string | null }>;
    placements: Array<{ childSlug: string; parentSlug: string | null; canonical: boolean; acceptance: string }>;
    assessments: Array<{ polarity: string }>;
    focus: { kind: string; reference: string };
  };
  expect(fixture.questions.length).toBeGreaterThanOrEqual(12);
  expect(new Set(fixture.questions.map(({ resolution }) => resolution))).toEqual(new Set(["open", "leaning", "decided"]));
  expect(fixture.questions.find(({ slug }) => slug === "main-course")).toMatchObject({
    resolution: "leaning",
    resolvedOptionSlug: "braise",
  });
  expect(fixture.placements.filter(({ childSlug }) => childSlug === "wine")).toEqual([
    expect.objectContaining({ parentSlug: "main-course", canonical: true }),
    expect.objectContaining({ parentSlug: "drinks", canonical: false, acceptance: "suggested" }),
  ]);
  expect(new Set(fixture.assessments.map(({ polarity }) => polarity))).toEqual(new Set(["+", "-", "~", "?"]));
  expect(fixture.focus).toEqual(expect.objectContaining({ kind: "question", reference: "main-course" }));
});

test("command and projection APIs cover the slug-first v0 CLI lifecycle", async () => {
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

  await run("question.add", { slug: "route", title: "Choose a route" });
  await run("question.add", { slug: "delivery", title: "Choose delivery" });
  await run("place", { childSlug: "route", parentSlug: "delivery" });
  await run("question.update", { questionSlug: "route", slug: "travel-route" });
  await run("option.add", { questionSlug: "travel-route", slug: "north", title: "Northern route" });
  await run("option.update", { optionPath: "travel-route/north", slug: "northern" });
  const criterion = await run("criterion.add", { slug: "speed", description: "Arrive sooner" });
  await run("assess", { optionPath: "travel-route/northern", criterionSlug: "speed", polarity: "+", note: "Direct" });
  await run("relate", { questionSlug: "travel-route", criterionSlug: "speed" });
  await run("question.decide", { questionSlug: "travel-route", optionSlug: "northern" });
  await run("focus", { kind: "option", reference: "travel-route/northern" });
  await run("accept", { kind: "question", reference: "travel-route" });
  await run("accept", { kind: "placement", reference: "travel-route:root" });

  const outline = await (await fetch(`${server.url}/api/outline`)).json() as Record<string, unknown[]>;
  expect(outline).toMatchObject({
    questions: [
      { slug: "travel-route", resolution: "decided", resolvedOptionSlug: "northern", acceptance: "accepted" },
      { slug: "delivery", resolution: "open", acceptance: "suggested" },
    ],
    placements: [
      { childSlug: "travel-route", parentSlug: null, acceptance: "accepted", canonical: true },
      { childSlug: "delivery", parentSlug: null, canonical: true },
      { childSlug: "travel-route", parentSlug: "delivery", canonical: false },
    ],
    options: [{ questionSlug: "travel-route", slug: "northern", acceptance: "suggested" }],
    focus: { kind: "option", reference: "travel-route/northern" },
  });
  expect(JSON.stringify(outline)).not.toMatch(/"(?:id|questionId|childId|parentId|resolvedOptionId)"/);
  expect(await (await fetch(`${server.url}/api/outline.md`)).text())
    .toContain("● travel-route: Choose a route → northern");
  expect(await (await fetch(`${server.url}/api/show/option/travel-route%2Fnorthern`)).text())
    .toContain("+ speed [suggested] — Direct");
  const log = await (await fetch(`${server.url}/api/log`)).text();
  expect(log).toContain("rename question");
  expect(log).toContain('"question":"travel-route"');
  expect(criterion.slug).toBe("speed");
});

test("slug validation failures stay readable at the HTTP boundary", async () => {
  const directory = mkdtempSync(join(tmpdir(), "dviz-server-test-"));
  temporaryDirectories.push(directory);
  const dbPath = join(directory, "space.db");
  initializeSpace(dbPath).close();
  const server = await startServer({ dbPath, port: await availablePort() });
  servers.push(server);

  const response = await fetch(`${server.url}/api/command`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "question.add", slug: "123", title: "Bad", actor: "agent:test" }),
  });
  expect(response.status).toBe(400);
  expect(await response.json()).toMatchObject({ error: expect.stringContaining("Question slug must start with a letter") });
});

test("the real CLI parses slug-first question, option, status, and projection commands", async () => {
  const directory = mkdtempSync(join(tmpdir(), "dviz-cli-test-"));
  temporaryDirectories.push(directory);
  const dbPath = join(directory, "space.db");
  initializeSpace(dbPath).close();
  const server = await startServer({ dbPath, port: await availablePort() });
  servers.push(server);

  expect(await runCli(dbPath, server, "question", "add", "route", "Choose a route"))
    .toContain("Added suggested question route");
  expect(await runCli(dbPath, server, "question", "add", "delivery", "Choose delivery"))
    .toContain("Added suggested question delivery");
  expect(await runCli(dbPath, server, "place", "--question", "route", "--parent", "delivery"))
    .toContain("Placed suggested question route under delivery");
  expect(await runCli(dbPath, server, "option", "add", "--question", "route", "north", "Northern route"))
    .toContain("route/north");
  expect(await runCli(dbPath, server, "option", "update", "route/north", "--slug", "northern"))
    .toContain("route/northern");
  expect(await runCli(dbPath, server, "question", "decide", "route", "--option", "northern"))
    .toContain("Decided question route on option northern");
  expect(await runCli(dbPath, server, "focus", "option", "route/northern"))
    .toContain("Focused option route/northern");
  expect(await runCli(dbPath, server, "outline")).toContain("● route: Choose a route → northern");
  expect(await runCli(dbPath, server, "show", "option", "route/northern")).toContain("# route/northern: Northern route");
});
