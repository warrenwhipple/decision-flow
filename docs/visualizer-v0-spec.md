# Visualizer v0 Spec (draft)

AI-compiled draft (Claude, 2026-08-24) carpentered from Warren's deliberation session. Warren owns final decisions; mark up freely. Every decision below was stated or accepted by Warren on 2026-08-24 (slug/handle decisions: 2026-08-25) unless marked **(proposed)**.

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

### Slugs, the universal handle

Every question, option, and criterion carries a required human-minted-or-agent-minted **slug** (e.g. `capture-friction`, `oauth2`). Slugs exist for two reasons: **scannability** (a left-anchored column of short recognizable tokens makes dense outline cards scannable the way design-space.md is) and **shared vocabulary** (one stable handle used identically by the human in conversation, the agent in CLI calls, and the view in chips).

- **Slug + title coexist** on questions and options: the slug is the handle, the title stays a full human phrase. Criteria remain slug + description only (no title for v0).
- **Format**, enforced inside the write transaction: `^[a-z][a-z0-9]*(-[a-z0-9]+)*$`, max 64 chars. Starts with a letter so a slug can never be all-numeric (kills slug-vs-integer-ID ambiguity forever); lowercase, digits allowed (`v0`, `oauth2`), single hyphens as the only separator. Everything else stays reserved: `+ - ~ ?` for polarity, `/` for option paths.
- **Uniqueness per kind**: question slugs unique per space; criterion slugs unique per space (unchanged); option slugs unique **within their question** only. Cross-kind homonyms are allowed (a question and a criterion may both be `trust`) — the CLI always carries a kind, and the view styles the kinds distinctly.
- **Collisions are rejected** at write time with a readable error. Never auto-suffix — that would silently mint a bad name into permanent shared vocabulary; the agent should retry with a better one.
- **Renames** are ordinary updates (no acceptance knock-back) but get a distinct `rename` verb in the edits log with old→new in the payload. No aliases, no old handles: after a rename the old slug resolves to nothing; history lives in the log, not the data model.
- **Integer IDs are internal only.** They stay as primary keys (rename stability, cheap FKs) but nothing above the SQL layer speaks them: the CLI addresses by slug, and `outline`/`show`/errors render slugs. Rationale: one canonical handle per entity is cleaner context hygiene than two, slugs bind semantically for the agent, and a hallucinated slug fails loudly (no such slug → readable rejection) where a near-miss integer ID would silently hit the wrong row. `dviz outline --ids` **(proposed)** as an undocumented debug flag.
- **Option paths.** Where an option is referenced outside its question's context, qualify it as `question-slug/option-slug` (e.g. `dviz show option ontology/spec`).
- Slug-minting heuristics (when to split `trust` into `user-trust`/`agent-trust`, rename-early-rename-rarely, don't use digits for mere enumeration) belong in the agent skill, not the CLI or schema.

### Status, two orthogonal dimensions

- **Acceptance** — `suggested | accepted` — applies to *every* entity and edge. Agent-proposed objects enter as `suggested` and render dotted until the human accepts them (the gate: suggestions must never silently become accepted).
- **Resolution** — `open | leaning | decided` — applies to questions only, with `leaning`/`decided` pointing at an option. Vocabulary shared with `deliberate`/`to-decisions`.

### Tables (proposed DDL sketch)

```sql
CREATE TABLE questions (
  id INTEGER PRIMARY KEY,         -- internal only; never surfaced above SQL
  slug TEXT NOT NULL UNIQUE,      -- handle; format checked in write transaction
  title TEXT NOT NULL,            -- full human phrase; slug carries the scan
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
  slug TEXT NOT NULL,             -- unique within the question, not globally
  title TEXT NOT NULL,
  detail TEXT DEFAULT '',
  acceptance TEXT NOT NULL DEFAULT 'suggested',
  position REAL NOT NULL,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  UNIQUE (question_id, slug)
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
  verb TEXT NOT NULL,             -- add | update | rename | accept | assess | decide | lean | focus | ...
                                  -- rename payload records old + new slug
  entity_kind TEXT NOT NULL,
  entity_id INTEGER,
  payload TEXT NOT NULL           -- JSON of the change
);
```

Every write records an `edits` row with an `actor` — this is the provenance answer (human/agent/mixed per edit) and the raw material for later session replay.

## CLI surface (`dviz`, "decision visualizer")

All addressing is by slug; integer IDs never appear on this surface. `QSLUG` = question slug, `OSLUG` = option slug (bare where the question is already named, `QSLUG/OSLUG` path form elsewhere), `CSLUG` = criterion slug.

```
dviz init [--db <path>]           create a decision space (default .dviz/space.db, gitignored)
dviz serve [--db <path>] [--port] start server + view
dviz question add <slug> "title" [--parent QSLUG] [--detail ...]
dviz question update QSLUG [--slug NEW] [...]
dviz question lean QSLUG --option OSLUG
dviz question decide QSLUG --option OSLUG
dviz question reopen QSLUG
dviz option add --question QSLUG <slug> "title" [--detail ...]
dviz option update QSLUG/OSLUG [--slug NEW] [...]
dviz criterion add <slug> [--desc ...]
dviz place --question CHILD_QSLUG --parent PARENT_QSLUG
dviz assess --option QSLUG/OSLUG --criterion CSLUG --polarity +|-|~|? [--note ...]
dviz relate --question QSLUG --criterion CSLUG
dviz accept <kind> <slug>           suggested → accepted (any entity or edge)
dviz remove <kind> <slug>
dviz focus <kind> <slug>
dviz outline [--depth N] [--around QSLUG] [--ids]   compact markdown projection for agent re-reads
dviz show <kind> <slug>                             full detail of one node
dviz log [--since ...]                              recent edits
```

Notes: everything an agent creates defaults to `suggested`; `accept` is the human-consent verb (invoked by the agent only when the human says so in conversation). `dviz outline` is the markdown-as-output principle in practice — the agent re-reads state as a projection, never edits files. Slug collisions and format violations reject inside the write transaction with a readable error; `--slug NEW` on update logs as `rename`.

## View

Two views plus one deferred:

1. **Overview outline** — the default. Ordered, dense, long-thin cards (slug chip + title + status glyphs), recursive outline of questions; options visible inline or one drill-in down **(proposed: inline, collapsed to titles)**. Used to see live decisions and pick the next one to work.
2. **Zoomed decision view** — one question: all options with details, assessments as slug chips with +/−/~/? polarity and notes, plus criteria attached via `question_criteria`. Shown criteria = relevance edges ∪ criteria appearing in the options' assessments.
3. **Global criteria list** (sort/filter) — build only if time allows; not demo-critical.

Rendering rules:

- **Slug chips anchor every card.** Each card leads with its slug as a monospace chip, then the title, then status glyphs — a left-anchored column of short recognizable tokens is what makes the dense outline scannable (and it matches the criteria chips already in the zoomed view). Options in the overview outline collapse to slug-only **(proposed)**; titles appear in the zoomed view. Criterion chips, question slugs, and option slugs get distinct styling so cross-kind homonyms stay unambiguous.
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

- Review policy for agent edits to accepted entities (incl. renames) — how to display edits so the human isn't surprised, without full diff UI. Deferred; the edits log captures old→new, so nothing is foreclosed.
- Whether the outline shows options inline or only on drill-in
- Detail-view contents (research links/citations live here?)
- Fractional vs integer `position` maintenance
- Log/replay UI (v0 ships the table, not the scrubber)
