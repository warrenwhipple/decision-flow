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
  dviz serve [--db PATH] [--port PORT] [--dev]
  dviz question add SLUG "TITLE" [--parent QSLUG] [--detail TEXT]
  dviz question update QSLUG [--slug NEW] [--title TEXT] [--detail TEXT]
  dviz question lean QSLUG --option OSLUG
  dviz question decide QSLUG --option OSLUG
  dviz question reopen QSLUG
  dviz option add --question QSLUG SLUG "TITLE" [--detail TEXT]
  dviz option update QSLUG/OSLUG [--slug NEW] [--title TEXT] [--detail TEXT]
  dviz criterion add CSLUG [--desc TEXT]
  dviz place --question CHILD_QSLUG --parent PARENT_QSLUG
  dviz assess --option QSLUG/OSLUG --criterion CSLUG --polarity +|-|~|? [--note TEXT]
  dviz relate --question QSLUG --criterion CSLUG
  dviz accept KIND SLUG
  dviz remove KIND SLUG
  dviz focus KIND SLUG
  dviz outline [--depth N] [--around QSLUG]
  dviz show KIND SLUG
  dviz log [--since EDIT_ID|TIMESTAMP]

All server-backed commands also accept --db PATH and --url URL.
Option references outside a named question use QSLUG/OSLUG.
Edge references: assessment QSLUG/OSLUG:CSLUG, relation QSLUG:CSLUG,
placement CHILD_QSLUG:PARENT_QSLUG (use CHILD_QSLUG:root at the root).
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

function takeFlag(args: string[], name: string): boolean {
  const index = args.indexOf(name);
  if (index === -1) return false;
  args.splice(index, 1);
  return true;
}

function parsePositiveInteger(value: string | undefined, label: string): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`${label} must be a positive integer.`);
  return parsed;
}

function requireOption(args: string[], name: string): string {
  const value = takeOption(args, name);
  if (value === undefined) throw new Error(`${name} is required.`);
  return value;
}

function requireArgument(value: string | undefined, label: string): string {
  if (!value) throw new Error(`${label} is required.`);
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
  const development = takeFlag(args, "--dev");
  assertNoExtraArgs(args);
  const dbPath = findDbPath(process.cwd(), explicitDb);
  const server = await startServer({ dbPath, port, development });
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
  if (development) console.log(`Dinner fixture: ${server.url}?fixture=dinner`);
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
  return { baseUrl: urlOverride ?? readServerInfo(dbPath).url, actor: process.env.DVIZ_ACTOR?.trim() || "agent:cli" };
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
    const parentSlug = takeOption(args, "--parent") ?? null;
    const detail = takeOption(args, "--detail") ?? "";
    if (args.length !== 2) throw new Error("`dviz question add` requires a slug and one quoted title.");
    const result = await command(clientInfo, "question.add", { slug: args[0], title: args[1], detail, parentSlug }) as { slug: string; title: string };
    console.log(`Added suggested question ${result.slug}: ${result.title}`);
    return;
  }
  const questionSlug = requireArgument(args.shift(), "question slug");
  if (verb === "update") {
    const slug = takeOption(args, "--slug");
    const title = takeOption(args, "--title");
    const detail = takeOption(args, "--detail");
    assertNoExtraArgs(args);
    const result = await command(clientInfo, "question.update", { questionSlug, slug, title, detail }) as { slug: string; title: string };
    console.log(`Updated question ${result.slug}: ${result.title}`);
    return;
  }
  if (verb === "lean" || verb === "decide") {
    const optionSlug = requireOption(args, "--option");
    assertNoExtraArgs(args);
    await command(clientInfo, `question.${verb}`, { questionSlug, optionSlug });
    console.log(`${verb === "lean" ? "Leaning" : "Decided"} question ${questionSlug} on option ${optionSlug}`);
    return;
  }
  if (verb === "reopen") {
    assertNoExtraArgs(args);
    await command(clientInfo, "question.reopen", { questionSlug });
    console.log(`Reopened question ${questionSlug}`);
    return;
  }
  throw new Error("Question command must be add, update, lean, decide, or reopen.");
}

async function optionCommand(args: string[]): Promise<void> {
  const verb = args.shift();
  const clientInfo = client(args);
  if (verb === "add") {
    const questionSlug = requireOption(args, "--question");
    const detail = takeOption(args, "--detail") ?? "";
    if (args.length !== 2) throw new Error("`dviz option add` requires a slug and one quoted title.");
    const result = await command(clientInfo, "option.add", { questionSlug, slug: args[0], title: args[1], detail }) as { questionSlug: string; slug: string; title: string };
    console.log(`Added suggested option ${result.questionSlug}/${result.slug}: ${result.title}`);
    return;
  }
  if (verb === "update") {
    const optionPath = requireArgument(args.shift(), "option path");
    const slug = takeOption(args, "--slug");
    const title = takeOption(args, "--title");
    const detail = takeOption(args, "--detail");
    assertNoExtraArgs(args);
    const result = await command(clientInfo, "option.update", { optionPath, slug, title, detail }) as { questionSlug: string; slug: string; title: string };
    console.log(`Updated option ${result.questionSlug}/${result.slug}: ${result.title}`);
    return;
  }
  throw new Error("Option command must be add or update.");
}

async function criterionCommand(args: string[]): Promise<void> {
  if (args.shift() !== "add") throw new Error("Criterion command must be add.");
  const clientInfo = client(args);
  const description = takeOption(args, "--desc") ?? "";
  if (args.length !== 1) throw new Error("`dviz criterion add` requires exactly one slug.");
  const result = await command(clientInfo, "criterion.add", { slug: args[0], description }) as { slug: string };
  console.log(`Added suggested criterion ${result.slug}`);
}

async function assess(args: string[]): Promise<void> {
  const clientInfo = client(args);
  const optionPath = requireOption(args, "--option");
  const criterionSlug = requireOption(args, "--criterion");
  const polarity = requireOption(args, "--polarity");
  const note = takeOption(args, "--note") ?? "";
  assertNoExtraArgs(args);
  const result = await command(clientInfo, "assess", { optionPath, criterionSlug, polarity, note }) as { acceptance: string };
  console.log(`Assessed option ${optionPath} ${polarity} ${criterionSlug} [${result.acceptance}]`);
}

async function relate(args: string[]): Promise<void> {
  const clientInfo = client(args);
  const questionSlug = requireOption(args, "--question");
  const criterionSlug = requireOption(args, "--criterion");
  assertNoExtraArgs(args);
  await command(clientInfo, "relate", { questionSlug, criterionSlug });
  console.log(`Related suggested criterion ${criterionSlug} to question ${questionSlug}`);
}

async function place(args: string[]): Promise<void> {
  const clientInfo = client(args);
  const childSlug = requireOption(args, "--question");
  const parentSlug = requireOption(args, "--parent");
  assertNoExtraArgs(args);
  await command(clientInfo, "place", { childSlug, parentSlug });
  console.log(`Placed suggested question ${childSlug} under ${parentSlug}`);
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

async function mutateEntity(action: "accept" | "remove", args: string[]): Promise<void> {
  const clientInfo = client(args);
  const kind = parseKind(args.shift());
  const reference = requireArgument(args.shift(), `${kind} reference`);
  assertNoExtraArgs(args);
  await command(clientInfo, action, { kind, reference });
  console.log(`${action === "accept" ? "Accepted" : "Removed"} ${kind} ${reference}`);
}

async function focus(args: string[]): Promise<void> {
  const clientInfo = client(args);
  const kind = parseNodeKind(args.shift());
  const reference = requireArgument(args.shift(), `${kind} reference`);
  assertNoExtraArgs(args);
  await command(clientInfo, "focus", { kind, reference });
  console.log(`Focused ${kind} ${reference}`);
}

async function outline(args: string[]): Promise<void> {
  const clientInfo = client(args);
  const depth = parsePositiveInteger(takeOption(args, "--depth"), "--depth");
  const around = takeOption(args, "--around");
  const ids = takeFlag(args, "--ids");
  assertNoExtraArgs(args);
  const query = new URLSearchParams();
  if (depth !== undefined) query.set("depth", String(depth));
  if (around !== undefined) query.set("around", around);
  if (ids) query.set("ids", "");
  const response = await request(clientInfo, `/api/outline.md${query.size ? `?${query}` : ""}`);
  process.stdout.write(await response.text());
}

async function show(args: string[]): Promise<void> {
  const clientInfo = client(args);
  const kind = parseNodeKind(args.shift());
  const reference = requireArgument(args.shift(), `${kind} reference`);
  assertNoExtraArgs(args);
  const response = await request(clientInfo, `/api/show/${kind}/${encodeURIComponent(reference)}`);
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
  if (commandName === "place") return place(args);
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
