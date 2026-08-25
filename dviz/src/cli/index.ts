#!/usr/bin/env bun

import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import {
  dbOverride,
  DEFAULT_PORT,
  defaultDbPath,
  ensureGitignored,
  findDbPath,
  initializeSpace,
  resolvePath,
  serverInfoPath,
  type EdgeReference,
  type EntityKind,
  type NodeKind,
} from "../db/space.ts";
import { startServer } from "../server/server.ts";

type ServerInfo = { pid: number; url: string; port: number; dbPath: string };
type Client = { baseUrl: string; actor: string };

function usage(): string {
  return `dviz — decision visualizer

Usage:
  dviz init [--db PATH]
  dviz serve [--db PATH] [--port PORT]
  dviz question add "TITLE" [--parent ID] [--detail TEXT]
  dviz question update ID [--title TEXT] [--detail TEXT]
  dviz question lean ID --option ID
  dviz question decide ID --option ID
  dviz question reopen ID
  dviz option add --question ID "TITLE" [--detail TEXT]
  dviz criterion add SLUG [--desc TEXT]
  dviz assess --option ID --criterion SLUG --polarity +|-|~|? [--note TEXT]
  dviz relate --question ID --criterion SLUG
  dviz accept KIND ID
  dviz remove KIND ID
  dviz focus KIND ID
  dviz outline [--depth N] [--around QUESTION_ID]
  dviz show KIND ID
  dviz log [--since EDIT_ID|TIMESTAMP]

All server-backed commands also accept --db PATH and --url URL.
Edge IDs: assessment OPTION:SLUG, relation QUESTION:SLUG,
placement CHILD:PARENT (use CHILD:root for a root placement).
`;
}

function takeOption(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  const value = args[index + 1];
  if (value === undefined || value.startsWith("--")) throw new Error(`${name} requires a value.`);
  args.splice(index, 2);
  return value;
}

function parsePositiveInteger(value: string | undefined, label: string): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`${label} must be a positive integer.`);
  return parsed;
}

function requirePositiveInteger(value: string | undefined, label: string): number {
  const parsed = parsePositiveInteger(value, label);
  if (parsed === undefined) throw new Error(`${label} is required.`);
  return parsed;
}

function requireOption(args: string[], name: string): string {
  const value = takeOption(args, name);
  if (value === undefined) throw new Error(`${name} is required.`);
  return value;
}

function assertNoExtraArgs(args: string[]): void {
  if (args.length > 0) throw new Error(`Unexpected argument: ${args[0]}`);
}

async function init(args: string[]): Promise<void> {
  const explicitDb = takeOption(args, "--db");
  assertNoExtraArgs(args);
  const path = explicitDb || process.env.DVIZ_DB ? resolvePath(dbOverride(explicitDb)!) : defaultDbPath();
  if (existsSync(path)) throw new Error(`A decision space already exists at ${path}.`);
  initializeSpace(path).close();
  const gitignored = !explicitDb && !process.env.DVIZ_DB ? ensureGitignored(process.cwd()) : false;
  console.log(`Initialized decision space at ${path}`);
  if (gitignored) console.log("Added .dviz/ to .gitignore");
}

async function serve(args: string[]): Promise<void> {
  const explicitDb = takeOption(args, "--db");
  const port = parsePositiveInteger(takeOption(args, "--port"), "--port") ?? DEFAULT_PORT;
  assertNoExtraArgs(args);
  const dbPath = findDbPath(process.cwd(), explicitDb);
  const server = await startServer({ dbPath, port });
  const infoPath = serverInfoPath(dbPath);
  const info: ServerInfo = { pid: process.pid, url: server.url, port: server.port, dbPath };
  writeFileSync(infoPath, `${JSON.stringify(info, null, 2)}\n`, "utf8");
  const cleanup = () => {
    if (existsSync(infoPath)) {
      try {
        const registered = JSON.parse(readFileSync(infoPath, "utf8")) as ServerInfo;
        if (registered.pid === process.pid) unlinkSync(infoPath);
      } catch {
        // Leave an unfamiliar file untouched.
      }
    }
    server.stop(true);
  };
  process.once("SIGINT", () => { cleanup(); process.exit(0); });
  process.once("SIGTERM", () => { cleanup(); process.exit(0); });
  console.log(`Serving ${dbPath}`);
  console.log(`Outline: ${server.url}`);
}

function readServerInfo(dbPath: string): ServerInfo {
  const path = serverInfoPath(dbPath);
  if (!existsSync(path)) throw new Error(`No running server is registered for ${dbPath}. Run \`dviz serve\` first.`);
  try {
    return JSON.parse(readFileSync(path, "utf8")) as ServerInfo;
  } catch {
    throw new Error(`Could not read server registration at ${path}. Restart \`dviz serve\`.`);
  }
}

function client(args: string[]): Client {
  const explicitDb = takeOption(args, "--db");
  const urlOverride = takeOption(args, "--url") ?? process.env.DVIZ_URL;
  const dbPath = findDbPath(process.cwd(), explicitDb);
  return {
    baseUrl: urlOverride ?? readServerInfo(dbPath).url,
    actor: process.env.DVIZ_ACTOR?.trim() || "agent:cli",
  };
}

async function request(clientInfo: Client, path: string, init?: RequestInit): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(new URL(path, clientInfo.baseUrl), init);
  } catch {
    throw new Error(`Could not reach the dviz server at ${clientInfo.baseUrl}. Run \`dviz serve\` and try again.`);
  }
  if (!response.ok) {
    let message = `Server returned HTTP ${response.status}.`;
    try {
      const body = await response.json() as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // Keep the HTTP fallback.
    }
    throw new Error(message);
  }
  return response;
}

async function command(clientInfo: Client, action: string, body: Record<string, unknown>): Promise<unknown> {
  const response = await request(clientInfo, "/api/command", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, actor: clientInfo.actor, ...body }),
  });
  return (await response.json() as { result: unknown }).result;
}

async function questionCommand(args: string[]): Promise<void> {
  const verb = args.shift();
  const clientInfo = client(args);
  if (verb === "add") {
    const parentId = parsePositiveInteger(takeOption(args, "--parent"), "--parent") ?? null;
    const detail = takeOption(args, "--detail") ?? "";
    if (args.length !== 1) throw new Error("`dviz question add` requires exactly one quoted title.");
    const result = await command(clientInfo, "question.add", { title: args[0], detail, parentId }) as { id: number; title: string };
    console.log(`Added suggested question ${result.id}: ${result.title}`);
    return;
  }
  const id = requirePositiveInteger(args.shift(), "question ID");
  if (verb === "update") {
    const title = takeOption(args, "--title");
    const detail = takeOption(args, "--detail");
    assertNoExtraArgs(args);
    const result = await command(clientInfo, "question.update", { id, title, detail }) as { title: string };
    console.log(`Updated question ${id}: ${result.title}`);
    return;
  }
  if (verb === "lean" || verb === "decide") {
    const optionId = requirePositiveInteger(requireOption(args, "--option"), "--option");
    assertNoExtraArgs(args);
    await command(clientInfo, `question.${verb}`, { id, optionId });
    console.log(`${verb === "lean" ? "Leaning" : "Decided"} question ${id} on option ${optionId}`);
    return;
  }
  if (verb === "reopen") {
    assertNoExtraArgs(args);
    await command(clientInfo, "question.reopen", { id });
    console.log(`Reopened question ${id}`);
    return;
  }
  throw new Error("Question command must be add, update, lean, decide, or reopen.");
}

async function optionCommand(args: string[]): Promise<void> {
  if (args.shift() !== "add") throw new Error("Option command must be add.");
  const clientInfo = client(args);
  const questionId = requirePositiveInteger(requireOption(args, "--question"), "--question");
  const detail = takeOption(args, "--detail") ?? "";
  if (args.length !== 1) throw new Error("`dviz option add` requires exactly one quoted title.");
  const result = await command(clientInfo, "option.add", { questionId, title: args[0], detail }) as { id: number; title: string };
  console.log(`Added suggested option ${result.id}: ${result.title}`);
}

async function criterionCommand(args: string[]): Promise<void> {
  if (args.shift() !== "add") throw new Error("Criterion command must be add.");
  const clientInfo = client(args);
  const description = takeOption(args, "--desc") ?? "";
  if (args.length !== 1) throw new Error("`dviz criterion add` requires exactly one slug.");
  const result = await command(clientInfo, "criterion.add", { slug: args[0], description }) as { id: number; slug: string };
  console.log(`Added suggested criterion ${result.id}: ${result.slug}`);
}

async function assess(args: string[]): Promise<void> {
  const clientInfo = client(args);
  const optionId = requirePositiveInteger(requireOption(args, "--option"), "--option");
  const criterionSlug = requireOption(args, "--criterion");
  const polarity = requireOption(args, "--polarity");
  const note = takeOption(args, "--note") ?? "";
  assertNoExtraArgs(args);
  const result = await command(clientInfo, "assess", { optionId, criterionSlug, polarity, note }) as { acceptance: string };
  console.log(`Assessed option ${optionId} ${polarity} ${criterionSlug} [${result.acceptance}]`);
}

async function relate(args: string[]): Promise<void> {
  const clientInfo = client(args);
  const questionId = requirePositiveInteger(requireOption(args, "--question"), "--question");
  const criterionSlug = requireOption(args, "--criterion");
  assertNoExtraArgs(args);
  await command(clientInfo, "relate", { questionId, criterionSlug });
  console.log(`Related suggested criterion ${criterionSlug} to question ${questionId}`);
}

function parseKind(value: string | undefined): EntityKind {
  if (!value || !(["question", "option", "criterion", "assessment", "relation", "placement"] as string[]).includes(value)) {
    throw new Error("kind must be question, option, criterion, assessment, relation, or placement.");
  }
  return value as EntityKind;
}

function parseNodeKind(value: string | undefined): NodeKind {
  if (!value || !(["question", "option", "criterion"] as string[]).includes(value)) {
    throw new Error("kind must be question, option, or criterion.");
  }
  return value as NodeKind;
}

function parseReference(kind: EntityKind, value: string | undefined): number | EdgeReference {
  if (kind === "question" || kind === "option" || kind === "criterion") return requirePositiveInteger(value, "ID");
  if (!value) throw new Error(`${kind} reference is required.`);
  const separator = value.indexOf(":");
  if (separator < 1 || separator === value.length - 1) throw new Error(`${kind} reference must use FIRST:SECOND form.`);
  return {
    firstId: requirePositiveInteger(value.slice(0, separator), `${kind} first ID`),
    second: value.slice(separator + 1),
  };
}

async function mutateEntity(action: "accept" | "remove", args: string[]): Promise<void> {
  const clientInfo = client(args);
  const kind = parseKind(args.shift());
  const rawReference = args.shift();
  const reference = parseReference(kind, rawReference);
  assertNoExtraArgs(args);
  await command(clientInfo, action, { kind, reference });
  console.log(`${action === "accept" ? "Accepted" : "Removed"} ${kind} ${rawReference}`);
}

async function focus(args: string[]): Promise<void> {
  const clientInfo = client(args);
  const kind = parseNodeKind(args.shift());
  const id = requirePositiveInteger(args.shift(), "ID");
  assertNoExtraArgs(args);
  await command(clientInfo, "focus", { kind, id });
  console.log(`Focused ${kind} ${id}`);
}

async function outline(args: string[]): Promise<void> {
  const clientInfo = client(args);
  const depth = parsePositiveInteger(takeOption(args, "--depth"), "--depth");
  const around = parsePositiveInteger(takeOption(args, "--around"), "--around");
  assertNoExtraArgs(args);
  const query = new URLSearchParams();
  if (depth !== undefined) query.set("depth", String(depth));
  if (around !== undefined) query.set("around", String(around));
  const response = await request(clientInfo, `/api/outline.md${query.size ? `?${query}` : ""}`);
  process.stdout.write(await response.text());
}

async function show(args: string[]): Promise<void> {
  const clientInfo = client(args);
  const kind = parseNodeKind(args.shift());
  const id = requirePositiveInteger(args.shift(), "ID");
  assertNoExtraArgs(args);
  const response = await request(clientInfo, `/api/show/${kind}/${id}`);
  process.stdout.write(await response.text());
}

async function log(args: string[]): Promise<void> {
  const clientInfo = client(args);
  const since = takeOption(args, "--since");
  assertNoExtraArgs(args);
  const query = since === undefined ? "" : `?${new URLSearchParams({ since })}`;
  const response = await request(clientInfo, `/api/log${query}`);
  process.stdout.write(await response.text());
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const commandName = args.shift();
  if (!commandName || commandName === "--help" || commandName === "-h" || commandName === "help") {
    console.log(usage());
    return;
  }
  if (commandName === "init") return init(args);
  if (commandName === "serve") return serve(args);
  if (commandName === "question") return questionCommand(args);
  if (commandName === "option") return optionCommand(args);
  if (commandName === "criterion") return criterionCommand(args);
  if (commandName === "assess") return assess(args);
  if (commandName === "relate") return relate(args);
  if (commandName === "accept") return mutateEntity("accept", args);
  if (commandName === "remove") return mutateEntity("remove", args);
  if (commandName === "focus") return focus(args);
  if (commandName === "outline") return outline(args);
  if (commandName === "show") return show(args);
  if (commandName === "log") return log(args);
  throw new Error(`Unknown command.\n\n${usage()}`);
}

main().catch((error) => {
  console.error(`dviz: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
