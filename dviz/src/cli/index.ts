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
} from "../db/space.ts";
import { startServer } from "../server/server.ts";

type ServerInfo = {
  pid: number;
  url: string;
  port: number;
  dbPath: string;
};

function usage(): string {
  return `dviz — decision visualizer

Usage:
  dviz init [--db PATH]
  dviz serve [--db PATH] [--port PORT]
  dviz question add "TITLE" [--parent ID] [--detail TEXT] [--db PATH]
`;
}

function takeOption(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  const value = args[index + 1];
  if (value === undefined || value.startsWith("--")) {
    throw new Error(`${name} requires a value.`);
  }
  args.splice(index, 2);
  return value;
}

function parsePositiveInteger(value: string | undefined, label: string): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${label} must be a positive integer.`);
  }
  return parsed;
}

function assertNoExtraArgs(args: string[]): void {
  if (args.length > 0) throw new Error(`Unexpected argument: ${args[0]}`);
}

async function init(args: string[]): Promise<void> {
  const explicitDb = takeOption(args, "--db");
  assertNoExtraArgs(args);
  const path = explicitDb || process.env.DVIZ_DB
    ? resolvePath(dbOverride(explicitDb)!)
    : defaultDbPath();
  if (existsSync(path)) throw new Error(`A decision space already exists at ${path}.`);

  const db = initializeSpace(path);
  db.close();
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
  process.once("SIGINT", () => {
    cleanup();
    process.exit(0);
  });
  process.once("SIGTERM", () => {
    cleanup();
    process.exit(0);
  });

  console.log(`Serving ${dbPath}`);
  console.log(`Outline: ${server.url}`);
}

function readServerInfo(dbPath: string): ServerInfo {
  const path = serverInfoPath(dbPath);
  if (!existsSync(path)) {
    throw new Error(`No running server is registered for ${dbPath}. Run \`dviz serve\` first.`);
  }
  try {
    return JSON.parse(readFileSync(path, "utf8")) as ServerInfo;
  } catch {
    throw new Error(`Could not read server registration at ${path}. Restart \`dviz serve\`.`);
  }
}

async function addQuestionCommand(args: string[]): Promise<void> {
  const explicitDb = takeOption(args, "--db");
  const parentId = parsePositiveInteger(takeOption(args, "--parent"), "--parent") ?? null;
  const detail = takeOption(args, "--detail") ?? "";
  const urlOverride = takeOption(args, "--url") ?? process.env.DVIZ_URL;
  if (args.length !== 1) {
    throw new Error("`dviz question add` requires exactly one quoted title.");
  }
  const title = args[0]!;
  const dbPath = findDbPath(process.cwd(), explicitDb);
  const baseUrl = urlOverride ?? readServerInfo(dbPath).url;

  let response: Response;
  try {
    response = await fetch(new URL("/api/questions", baseUrl), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        detail,
        parentId,
        actor: process.env.DVIZ_ACTOR ?? "agent:cli",
      }),
    });
  } catch {
    throw new Error(`Could not reach the dviz server at ${baseUrl}. Run \`dviz serve\` and try again.`);
  }
  const result = await response.json() as {
    question?: { id: number; title: string };
    error?: string;
  };
  if (!response.ok || !result.question) {
    throw new Error(result.error ?? `Server returned HTTP ${response.status}.`);
  }
  console.log(`Added suggested question ${result.question.id}: ${result.question.title}`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args.shift();
  if (!command || command === "--help" || command === "-h" || command === "help") {
    console.log(usage());
    return;
  }
  if (command === "init") return init(args);
  if (command === "serve") return serve(args);
  if (command === "question" && args.shift() === "add") return addQuestionCommand(args);
  throw new Error(`Unknown command.\n\n${usage()}`);
}

main().catch((error) => {
  console.error(`dviz: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
