import { afterEach, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OutlineSnapshot } from "../src/db/space.ts";
import { SpaceLibrary } from "../src/db/library.ts";
import { startServer, type DvizServer } from "../src/server/server.ts";

const directories: string[] = [];
const servers: DvizServer[] = [];
function temporaryDirectory() {
  const directory = mkdtempSync(join(tmpdir(), "dviz-library-test-"));
  directories.push(directory);
  return directory;
}
async function start(directory = temporaryDirectory()) {
  const server = await startServer({ libraryDir: directory, port: 0 });
  servers.push(server);
  return server;
}
function post(server: DvizServer, path: string, body: unknown) {
  return fetch(`${server.url}${path}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
}
async function create(server: DvizServer, slug: string) {
  const response = await post(server, "/api/spaces", { slug, title: `Space ${slug}` });
  expect(response.status).toBe(201);
}
async function cli(server: DvizServer, args: string[], env: Record<string, string> = {}) {
  const child = Bun.spawn(["bun", join(import.meta.dir, "../src/cli/index.ts"), ...args], {
    cwd: temporaryDirectory(), stdout: "pipe", stderr: "pipe",
    env: { ...process.env, DVIZ_DB: "", DVIZ_SPACE: "", DVIZ_URL: server.url, ...env },
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited,
  ]);
  return { stdout, stderr, code };
}
afterEach(() => {
  for (const server of servers.splice(0)) server.stop(true);
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

test("library validates names, preserves duplicates and orphaned data, and persists metadata", () => {
  const directory = temporaryDirectory();
  let library = new SpaceLibrary(directory);
  try {
    expect(library.list()).toEqual([]);
    const first = library.create("travel", " Travel plans ");
    expect(first.title).toBe("Travel plans");
    expect(() => library.create("travel", "Replacement")).toThrow("already exists");
    for (const slug of ["../escape", "Uppercase", "a/b", "", "x".repeat(65)]) {
      expect(() => library.create(slug, "Title")).toThrow("Space slug");
    }
    expect(() => library.create("blank", " ")).toThrow("title");
    expect(() => library.create("long", "x".repeat(201))).toThrow("title");
    mkdirSync(join(directory, "spaces", "orphan"));
    expect(() => library.create("orphan", "Orphan")).toThrow();
    expect(existsSync(join(directory, "spaces", "orphan"))).toBe(true);
    expect(library.list()).toEqual([first]);
    library.close();
    library = new SpaceLibrary(directory);
    expect(library.get("travel")).toEqual(first);
    expect(() => library.dbPath("missing")).toThrow("No space named");
  } finally { library.close(); }
});

test("one server requires explicit targets and keeps graphs, focus, and logs isolated across restart", async () => {
  const directory = temporaryDirectory();
  let server = await start(directory);
  expect(await (await fetch(`${server.url}/api/spaces`)).json()).toEqual({ mode: "library", spaces: [] });
  await create(server, "alpha");
  await create(server, "beta");
  for (const path of ["/api/outline", "/api/events", "/api/outline?space=missing", "/api/outline?space=..%2Fescape"]) {
    expect((await fetch(`${server.url}${path}`)).status).toBe(400);
  }
  for (const space of ["alpha", "beta"]) {
    expect((await post(server, `/api/command?space=${space}`, { action: "question.add", slug: "same", title: space })).status).toBe(200);
  }
  await post(server, "/api/command?space=alpha", { action: "focus", kind: "question", reference: "same" });
  server.stop(true);
  servers.splice(servers.indexOf(server), 1);
  server = await start(directory);
  const alpha = await (await fetch(`${server.url}/api/outline?space=alpha`)).json() as OutlineSnapshot;
  const beta = await (await fetch(`${server.url}/api/outline?space=beta`)).json() as OutlineSnapshot;
  expect(alpha.questions[0]).toMatchObject({ title: "alpha", acceptance: "suggested" });
  expect(alpha.focus!.reference).toBe("same");
  expect(beta.questions[0].title).toBe("beta");
  expect(beta.focus).toBeNull();
  expect(await (await fetch(`${server.url}/api/log?space=beta`)).text()).not.toContain('"focus"');
});

test("SSE subscribers receive only their own space updates", async () => {
  const server = await start();
  await create(server, "alpha");
  await create(server, "beta");
  const a = (await fetch(`${server.url}/api/events?space=alpha`)).body!.getReader();
  const b = (await fetch(`${server.url}/api/events?space=beta`)).body!.getReader();
  const decode = (value: Uint8Array | undefined) => new TextDecoder().decode(value);
  try {
    await a.read(); await b.read();
    await post(server, "/api/questions?space=alpha", { slug: "only-alpha", title: "Only alpha" });
    expect(decode((await a.read()).value)).toContain("only-alpha");
    await post(server, "/api/questions?space=beta", { slug: "only-beta", title: "Only beta" });
    const update = decode((await b.read()).value);
    expect(update).toContain("only-beta");
    expect(update).not.toContain("only-alpha");
  } finally { await a.cancel(); await b.cancel(); }
});

test("real CLI creates, lists, links, and targets spaces independently of cwd or browsing", async () => {
  const server = await start();
  expect((await cli(server, ["space", "create", "alpha", "Alpha map"])).code).toBe(0);
  expect((await cli(server, ["init", "beta", "Beta map"])).code).toBe(0);
  expect((await cli(server, ["space", "list"])).stdout).toContain("alpha — Alpha map");
  const open = await cli(server, ["space", "open", "alpha"]);
  expect(open.stdout).toContain("?space=alpha");
  expect((await cli(server, ["space", "open", "missing"])).code).toBe(1);
  expect((await cli(server, ["question", "add", "choice", "Alpha choice", "--space", "alpha"])).code).toBe(0);
  // Opening beta does not retarget an agent with DVIZ_SPACE=alpha.
  await fetch(`${server.url}/?space=beta`);
  expect((await cli(server, ["outline"], { DVIZ_SPACE: "alpha" })).stdout).toContain("Alpha choice");
  expect((await cli(server, ["outline", "--space", "beta"], { DVIZ_SPACE: "alpha" })).stdout).not.toContain("Alpha choice");
  expect((await cli(server, ["outline"])).stderr).toContain("Choose a space");
  expect((await cli(server, ["outline", "--space", "alpha", "--db", "unused.db"])).stderr).toContain("Cannot combine");
  expect((await cli(server, ["space", "create", "alpha", "Duplicate"])).code).toBe(1);
});

test("HTTP creation rejects invalid input and cross-origin writes without adding spaces", async () => {
  const server = await start();
  for (const body of [{ slug: "../escape", title: "Bad" }, { slug: "valid", title: " " }, { slug: 42, title: "Bad" }]) {
    expect((await post(server, "/api/spaces", body)).status).toBe(400);
  }
  expect((await fetch(`${server.url}/api/spaces`, {
    method: "POST", headers: { Origin: "https://example.com", "Content-Type": "application/json" },
    body: JSON.stringify({ slug: "foreign", title: "Foreign" }),
  })).status).toBe(403);
  expect(await (await fetch(`${server.url}/api/spaces`)).json()).toMatchObject({ spaces: [] });
});

test("CLI serve registers a library, refuses a second writer, and cleans up on shutdown", async () => {
  const directory = temporaryDirectory();
  // Select a free port without touching a real user library.
  const probe = Bun.serve({ port: 0, fetch: () => new Response("probe") });
  const port = probe.port!;
  probe.stop(true);
  const env = { ...process.env, DVIZ_HOME: directory, DVIZ_DB: "", DVIZ_URL: "", DVIZ_SPACE: "" };
  const args = ["bun", join(import.meta.dir, "../src/cli/index.ts"), "serve", "--port", String(port)];
  const child = Bun.spawn(args, { env, stdout: "pipe", stderr: "pipe" });
  try {
    for (let attempt = 0; attempt < 100 && !existsSync(join(directory, "server.json")); attempt++) {
      await Bun.sleep(20);
    }
    expect(existsSync(join(directory, "server.json"))).toBe(true);
    const second = Bun.spawn(args, { env, stdout: "pipe", stderr: "pipe" });
    expect(await second.exited).toBe(1);
    expect(await new Response(second.stderr).text()).toContain("already registered");
    // No --url: exercise discovery via the CLI-created server registration.
    const command = Bun.spawn(["bun", join(import.meta.dir, "../src/cli/index.ts"), "space", "create", "registered", "Registered map"], {
      env, stdout: "pipe", stderr: "pipe",
    });
    expect(await command.exited).toBe(0);
    expect(await new Response(command.stdout).text()).toContain("Created space registered");
  } finally {
    child.kill("SIGTERM");
    await child.exited;
  }
  expect(existsSync(join(directory, "server.json"))).toBe(false);
});
