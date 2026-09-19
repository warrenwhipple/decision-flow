import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
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

  expect(await (await fetch(`${server.url}/api/spaces`)).json()).toEqual({ mode: "legacy", spaces: [] });
  expect((await fetch(`${server.url}/api/spaces`, { method: "POST" })).status).toBe(400);
  expect((await fetch(`${server.url}/api/outline?space=wrong-server`)).status).toBe(400);

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

function expectPrepaintTheme(html: string) {
  expect(html).toContain('name="color-scheme" content="light dark"');
  const script = /<script>([\s\S]*?)<\/script>/.exec(html);
  expect(script).not.toBeNull();
  expect(script!.index).toBeLessThan(html.indexOf('<link rel="stylesheet"'));
  for (const stored of [null, "light", "dark", "invalid"]) {
    const dataset: { theme?: string } = {};
    runInNewContext(script![1]!, {
      document: { documentElement: { dataset } },
      localStorage: { getItem: () => stored },
    });
    expect(dataset.theme).toBe(stored === "light" || stored === "dark" ? stored : undefined);
  }
  expect(() => runInNewContext(script![1]!, {
    document: { documentElement: { dataset: {} } },
    localStorage: { getItem: () => { throw new Error("Storage blocked"); } },
  })).not.toThrow();
}

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
  expectPrepaintTheme(html);
  expect(html).not.toContain("/app.js");
  expect((await fetch(`${productionServer.url}/api/fixtures/dinner`)).status).toBe(404);
  productionServer.stop(true);
  servers.splice(servers.indexOf(productionServer), 1);

  const developmentServer = await startServer({ dbPath, port: await availablePort(), development: true });
  servers.push(developmentServer);
  expectPrepaintTheme(await (await fetch(developmentServer.url)).text());
  const response = await fetch(`${developmentServer.url}/api/fixtures/dinner`);
  expect(response.status).toBe(200);
  const fixture = await response.json() as {
    questions: Array<{ slug: string; resolution: string; resolvedOptionSlug: string | null }>;
    relations: Array<{ kind: string; from: string; to: string; acceptance: string }>;
    assessments: Array<{ polarity: string }>;
    focus: { kind: string; reference: string };
  };
  expect(fixture.questions.length).toBeGreaterThanOrEqual(12);
  expect(new Set(fixture.questions.map(({ resolution }) => resolution))).toEqual(new Set(["open", "leaning", "decided"]));
  expect(fixture.questions.find(({ slug }) => slug === "main-course")).toMatchObject({
    resolution: "leaning",
    resolvedOptionSlug: "braise",
  });
  expect(fixture.relations.filter(({ to }) => to === "wine")).toEqual([
    expect.objectContaining({ kind: "blocks", from: "main-course" }),
  ]);
  expect(fixture.relations).toContainEqual(expect.objectContaining({ kind: "part-of", from: "wine", to: "drinks" }));
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
  await run("relation.add", { kind: "part-of", from: "route", to: "delivery" });
  await run("question.update", { questionSlug: "route", slug: "travel-route" });
  await run("option.add", { questionSlug: "travel-route", slug: "north", title: "Northern route" });
  await run("option.update", { optionPath: "travel-route/north", slug: "northern" });
  const criterion = await run("criterion.add", { slug: "speed", description: "Arrive sooner" });
  await run("assess", { optionPath: "travel-route/northern", criterionSlug: "speed", polarity: "+", note: "Direct" });
  await run("relate", { questionSlug: "travel-route", criterionSlug: "speed" });
  await run("question.decide", { questionSlug: "travel-route", optionSlug: "northern" });
  await run("focus", { kind: "option", reference: "travel-route/northern" });
  await run("accept", { kind: "question", reference: "travel-route" });
  await run("accept", { kind: "relation", reference: "part-of:travel-route:delivery" });
  await run("accept", { kind: "relevance", reference: "travel-route:speed" });

  const outline = await (await fetch(`${server.url}/api/outline`)).json() as Record<string, unknown[]>;
  expect(outline).toMatchObject({
    questions: [
      { slug: "travel-route", resolution: "decided", resolvedOptionSlug: "northern", acceptance: "accepted" },
      { slug: "delivery", resolution: "open", acceptance: "suggested" },
    ],
    relations: [{ kind: "part-of", from: "travel-route", to: "delivery", acceptance: "accepted" }],
    relevances: [{ questionSlug: "travel-route", criterionSlug: "speed", acceptance: "accepted" }],
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
  await run("question.add", { slug: "raised", title: "Raised", raisedBy: "travel-route/northern", after: "first" });
  await run("question.add", { slug: "part", title: "Part", partOf: "delivery" });
  await run("question.move", { questionSlug: "raised", after: "part" });
  const moved = await (await fetch(`${server.url}/api/outline`)).json() as { questions: { slug: string }[] };
  expect(moved.questions.map((q) => q.slug)).toEqual(["travel-route", "part", "raised", "delivery"]);
  const posted = await fetch(`${server.url}/api/questions`, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug: "posted", title: "Posted", partOf: "delivery", raisedBy: "travel-route/northern", after: "first" }) });
  expect(posted.status).toBe(201);
  expect(await posted.json()).toMatchObject({ question: { slug: "posted", position: expect.any(Number) } });
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
  expect(await runCli(dbPath, server, "relation", "add", "part-of", "route", "delivery"))
    .toContain("Added suggested relation part-of:route:delivery");
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
  expect(await runCli(dbPath, server, "question", "add", "raised", "Raised question", "--raised-by", "route/northern", "--first")).toContain("Added suggested question raised");
  expect(await runCli(dbPath, server, "accept", "relation", "raises:route/northern:raised")).toContain("Accepted relation");
  expect(await runCli(dbPath, server, "question", "move", "raised", "--after", "delivery")).toContain("Moved question raised");
  expect(await runCli(dbPath, server, "outline", "--around", "raised", "--hops", "0")).not.toContain("route:");
  expect(await runCli(dbPath, server, "remove", "question", "route")).toContain("Removed question route");
  expect(await runCli(dbPath, server, "outline")).not.toContain("raised by");
});
