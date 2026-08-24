# Visualizer v0 Spec (draft)

AI-compiled draft (Claude, 2026-08-24) carpentered from Warren's deliberation session. Warren owns final decisions; mark up freely. Every decision below was stated or accepted by Warren on 2026-08-24 unless marked **(proposed)**.

## Purpose

A sidecar web view that lets a human watch a decision structure take shape *while* deliberating with an AI agent, solving the core pain from prior dogfooding: nothing visible during the conversation, and decision documents growing too large to find the current focus.

Timebox: ~20 hours of deep-work time. Win condition: a demo-able prototype, first shown live to JC (not on camera), dogfooded on Lightsight.

## Non-goals for v0

- No orchestration: no launching sub-agents, no research runs. At most, room to link/cite research on nodes.
- No human editing via UI (view + navigate only; revisit after dogfooding).
- No voice handling (typed input; user brings their own voice tooling).
- No markdown backing store (markdown is an output/projection only).
- No CRDT / multi-machine sync (single local server serializes all writes).
- No matrix rendering for criteria.
- No arguments-on-assessments, criterion weights, or goal decomposition (DRL territory; capture cost kills it — protect slug-level capture).

## Architecture

One local **Bun** process per decision space:

- owns the SQLite file (single source of truth, one file per decision space)
- exposes an HTTP API for edits and reads
- serves the **React** outline view
- pushes live updates to the view over SSE **(proposed; websocket fine too)**

A thin **CLI** wraps the HTTP API. Agents edit exclusively through the CLI, guided by a minimal skill in house style (~60 lines, no defensive guardrails until earned). MCP is a possible later typed wrapper — not v0.

Multi-agent concurrency = queueing at the single writer. Invariants (e.g. DAG acyclicity) are checked inside the write transaction and rejected with readable errors the agent can act on.

### DB file location

- **Repo-local, one space per project.** Default DB is `.dviz/space.db`, resolved by walking up from cwd (like `.git`). No space found → readable error pointing at `dviz init`.
- **Gitignored for v0.** `dviz init` creates `.dviz/` and adds it to `.gitignore` (directory, not just the file — SQLite WAL/SHM sidecars live there too). Committing a markdown projection alongside is a possible later win, not v0.
- **Override** via `--db <path>` or `DVIZ_DB` env var, which also covers the rare cross-project space. The default is a UX choice, cheap to revisit after dogfooding.
- One Bun process per decision space; concurrently served repos are distinguished by port.

### Code location

- All visualizer code lives in `dviz/` at the repo root: a single Bun package (`src/cli/`, `src/server/`, `src/view/`) sharing one `package.json` and lockfile. `bun link` provides the global `dviz` binary.
- The agent-facing skill lives in `skills/dviz/SKILL.md`, following existing skill conventions.
- No workspace/monorepo split and no separate repo for v0; extract to its own repo only if it survives dogfooding.

## Data model

### Status, two orthogonal dimensions

- **Acceptance** — `suggested | accepted` — applies to *every* entity and edge. Agent-proposed objects enter as `suggested` and render dotted until the human accepts them (the gate: suggestions must never silently become accepted).
- **Resolution** — `open | leaning | decided` — applies to questions only, with `leaning`/`decided` pointing at an option. Vocabulary shared with `deliberate`/`to-decisions`.

### Tables (proposed DDL sketch)

```sql
CREATE TABLE questions (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,            -- short card text; outline cards are dense
  detail TEXT DEFAULT '',         -- expandable detail view body
  acceptance TEXT NOT NULL DEFAULT 'suggested',  -- suggested | accepted
  resolution TEXT NOT NULL DEFAULT 'open',       -- open | leaning | decided
  resolved_option_id INTEGER REFERENCES options(id),  -- target of leaning/decided
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);

-- Question topology is a DAG. Rendered transclusion-style, never as a graph.
CREATE TABLE question_parents (
  child_id INTEGER NOT NULL REFERENCES questions(id),
  parent_id INTEGER REFERENCES questions(id),   -- NULL = root-level outline entry
  position REAL NOT NULL,                       -- ordering within the parent
  UNIQUE (child_id, parent_id)
);
-- write-time check: inserting/updating must not create a cycle

CREATE TABLE options (
  id INTEGER PRIMARY KEY,
  question_id INTEGER NOT NULL REFERENCES questions(id),
  title TEXT NOT NULL,
  detail TEXT DEFAULT '',
  acceptance TEXT NOT NULL DEFAULT 'suggested',
  position REAL NOT NULL,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);

CREATE TABLE criteria (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,      -- e.g. focus-flow, trust; global per space
  description TEXT DEFAULT '',
  acceptance TEXT NOT NULL DEFAULT 'suggested',
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);

-- QOC-style assessment: option × criterion with polarity.
-- Polarity enum lifted from Warren's own design-space.md notation.
CREATE TABLE assessments (
  option_id INTEGER NOT NULL REFERENCES options(id),
  criterion_id INTEGER NOT NULL REFERENCES criteria(id),
  polarity TEXT NOT NULL,         -- supports (+) | detracts (-) | mixed (+/-) | unclear (?)
  note TEXT DEFAULT '',
  acceptance TEXT NOT NULL DEFAULT 'suggested',
  PRIMARY KEY (option_id, criterion_id)
);

-- DRL-style relevance: "this criterion matters for this question,"
-- even before any option is assessed against it.
CREATE TABLE question_criteria (
  question_id INTEGER NOT NULL REFERENCES questions(id),
  criterion_id INTEGER NOT NULL REFERENCES criteria(id),
  acceptance TEXT NOT NULL DEFAULT 'suggested',
  PRIMARY KEY (question_id, criterion_id)
);

-- Single-row current focus (Google-Maps follow model).
CREATE TABLE focus (
  row_lock INTEGER PRIMARY KEY CHECK (row_lock = 1),
  kind TEXT NOT NULL,             -- question | option | criterion
  node_id INTEGER NOT NULL,
  set_at TEXT NOT NULL
);

-- Append-only change log, written in the same transaction as every edit.
-- Tables are truth; the log is history/provenance/replay. Not event sourcing.
CREATE TABLE edits (
  id INTEGER PRIMARY KEY,
  ts TEXT NOT NULL,
  actor TEXT NOT NULL,            -- e.g. agent:<name> | human | import
  verb TEXT NOT NULL,             -- add | update | accept | assess | decide | lean | focus | ...
  entity_kind TEXT NOT NULL,
  entity_id INTEGER,
  payload TEXT NOT NULL           -- JSON of the change
);
```

Every write records an `edits` row with an `actor` — this is the provenance answer (human/agent/mixed per edit) and the raw material for later session replay.

## CLI surface (`dviz`, "decision visualizer")

```
dviz init [--db <path>]           create a decision space (default .dviz/space.db, gitignored)
dviz serve [--db <path>] [--port] start server + view
dviz question add "..." [--parent ID] [--detail ...]
dviz question update ID [...]
dviz question lean ID --option ID
dviz question decide ID --option ID
dviz question reopen ID
dviz option add --question ID "..."
dviz criterion add <slug> [--desc ...]
dviz assess --option ID --criterion SLUG --polarity +|-|~|? [--note ...]
dviz relate --question ID --criterion SLUG
dviz accept <kind> ID               suggested → accepted (any entity or edge)
dviz remove <kind> ID
dviz focus <kind> ID
dviz outline [--depth N] [--around ID]    compact markdown projection for agent re-reads
dviz show <kind> ID                       full detail of one node
dviz log [--since ...]                    recent edits
```

Notes: everything an agent creates defaults to `suggested`; `accept` is the human-consent verb (invoked by the agent only when the human says so in conversation). `dviz outline` is the markdown-as-output principle in practice — the agent re-reads state as a projection, never edits files.

## View

Two views plus one deferred:

1. **Overview outline** — the default. Ordered, dense, long-thin cards (title + status glyphs), recursive outline of questions; options visible inline or one drill-in down **(proposed: inline, collapsed to titles)**. Used to see live decisions and pick the next one to work.
2. **Zoomed decision view** — one question: all options with details, assessments as slug chips with +/−/~/? polarity and notes, plus criteria attached via `question_criteria`. Shown criteria = relevance edges ∪ criteria appearing in the options' assessments.
3. **Global criteria list** (sort/filter) — build only if time allows; not demo-critical.

Rendering rules:

- **Statuses legible at a glance.** `suggested` = dotted card outline, at every appearance. `decided` / `leaning` / `open` get distinct glyphs/affordances on the card **(proposed: filled dot / half dot / empty dot + selected-option shown on decided/leaning cards)**.
- **Transclusion.** A multi-parent question renders under each parent. Its first parent is its canonical appearance (focus jumps go there); secondary appearances render collapsed with an "also under X" marker.
- **Follow mode.** View follows the focus pointer by default; any manual scroll/drill breaks follow; a persistent recenter button returns to the conversation's current focus and re-engages following. v0 focus is a single node id.
- **Layout stability.** New cards insert; nothing reflows. This is the reason the outline beat a graph canvas — protect it.

## Build order (proposed, for timebox planning)

1. Thin slice: schema + server + `question add` + hardcoded outline rendering + SSE — agent adds a question, card appears live.
2. Full CLI surface + statuses + dotted rendering.
3. Zoomed decision view + assessments/chips.
4. Focus + follow mode.
5. Transclusion details (multi-parent, collapse, canonical).
6. Polish pass for the JC demo; dogfood on Lightsight; global criteria list only if hours remain.

## Open questions (parked, not blocking)

- Whether the outline shows options inline or only on drill-in
- Detail-view contents (research links/citations live here?)
- Fractional vs integer `position` maintenance
- Log/replay UI (v0 ships the table, not the scrubber)
