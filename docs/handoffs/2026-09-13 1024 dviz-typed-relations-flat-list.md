# Handoff: dviz typed relations and flat list view

2026-09-13 1024. Agent-generated handoff from a strategic conversation with Warren. Intended for a fresh coding-agent session. Warren will read and correct before it is acted on. Detailed enough that the implementer should not need to re-derive the design, but the implementer should still outline their approach before editing. Read `docs/DESIGN.md` before touching the view.

## Goal

Replace the single question hierarchy (`question_parents`, rendered as a nested outline with transclusion) with a small set of **typed relations** between questions, addable through the CLI, and render questions as a **flat ordered list** with relations shown as chips. The CLI stores relations; it does not decide when to use them. That policy lives in the agent skill (`skills/dviz/SKILL.md`).

## Why (the reasoning, so the implementer can make good local calls)

Dogfooding showed that one nesting relation was silently carrying four different meanings, and the outline read as tea leaves:

- **raising** — a question exists because a particular option was chosen or considered (QOC's "consequent question", Q → O → Q). "If braise, which cut?"
- **decomposition** — a broad question is answered by narrower ones (PHI's "serves", DRL's "sub-decision"). "What should we serve?" is answered by main, starter, dessert.
- **precedence** — one question should be decided before another (Kruchten's "constrains"; a tracker's "blocks"). Serve-time before prep-order.
- **coupling** — change one, revisit the other; symmetric, not a tree (Kruchten's "is bound to"; a tracker's "linked to").

Different modes of use (live Socratic capture, tidying a map for a reader, driving work) each want a different one of these as "the" hierarchy, so no single nesting semantics could be right. Decision: store the first three as explicit kinds, drop nesting, and let the skill say which to use when. Coupling is deliberately **not** modelled yet; each further kind (`linked`, `duplicate-of`, …) must earn its way in through felt pain, like guardrails.

## Decisions (settled with Warren, 2026-09-13)

1. **One `relations` table replaces `question_parents`.** The transclusion machinery (canonical placement, `TransclusionCard`, "also under X", re-rooting orphans on remove) is deleted, not adapted.
2. **Three kinds for now:** `raises`, `part-of`, `blocks`.
3. **`raises` points from an option to a question** (QOC-faithful). Question-to-question raising is expressed as `part-of` instead.
4. **The main list is flat, ordered by a manual, agent-controlled `position` on questions.** Layout stability rule stands: cards insert, nothing reflows.
5. **Relations render as chips on list cards and as links in the detail view.** What a chip *does* when clicked in the list view is undecided; make them non-interactive there for now.
6. **All layers in this one handoff:** schema + migration, CLI, server, skill, view, fixture, tests.

### Proposed (Warren to confirm or veto before implementation)

- **Naming collision.** The codebase already uses `relation` for the question↔criterion relevance edge (`Relation` type, `relate` verb, `accept relation …`). Proposal: rename that entity kind to `relevance` everywhere it is named as a kind (`EntityKind`, `accept`/`remove` kind list, edits `entity_kind`, snapshot field `relations` → `relevances`), keep the `dviz relate` verb as is, and use `relation` for the new typed question relations. Alternative if Warren prefers less churn: call the new table `links` and the verb `dviz link`. The rest of this document assumes the rename.
- **Insertion position default.** When `question add` is given `--part-of` or `--raised-by` and no `--after`, place the new question after the last question already related to that same target, or directly after the target if none. Without any relation, append at the end.

## Current state

- `dviz/src/db/schema.ts` — `SCHEMA_VERSION = 3`. `question_parents(child_id, parent_id NULL=root, position, acceptance)` with a `(parent_id, position)` index. Questions have no `position` column.
- `dviz/src/db/space.ts` (917 lines) — `Placement` type, `addQuestion` inserts a placement row, `addPlacement` (cycle check via recursive CTE, ~l.310), `nextPosition` over `question_parents`, accept/remove branches for `placement` (~l.537, ~l.602; remove re-roots orphaned children ~l.554–569), `getOutline` computes `canonical` per child (~l.709), `renderOutlineMarkdown` walks the tree with `--around`/`--depth` (~l.758–800), `show` prints `Parents:` (~l.818). `migrate()` (~l.144) handles one prior migration (pre-slug) by dropping and recreating tables when empty and refusing when populated.
- `dviz/src/cli/index.ts` (435 lines) — `question add … [--parent QSLUG]`, `place --question --parent`, `accept|remove KIND REF` where placement refs are `CHILD:PARENT` / `CHILD:root`, `outline [--depth N] [--around QSLUG]`.
- `dviz/src/server/server.ts` (358 lines) — `/api/command` dispatch (`place` action ~l.266), `/api/questions` POST accepts `parentSlug`, kind lists at ~l.292.
- `dviz/src/view/app.tsx` (748 lines) — `QuestionCard` takes a `Placement`; `TransclusionCard`; `Outline` builds `childrenByParent` and `canonicalByQuestion` and renders recursively; `DecisionView`; focus/follow scrolls to the canonical card.
- `dviz/src/view/dinner-fixture.ts` — hand-written snapshot with `placements`; its nesting mixes all four relation meanings (that is what surfaced the problem). It also has an incoherence: `main-course` leaning `braise` while child `protein` is decided `chicken`.
- `skills/dviz/SKILL.md` — mentions "placements" in the capture list; no guidance on relations.
- Tests: `dviz/test/space.test.ts` (placement/transclusion/re-rooting cases at ~l.107, 128, 224), `server.test.ts`, `library.test.ts`. Tests never touch view class names.
- Personal library spaces exist with real data (`~/.dviz/`), so **migration must preserve data**, unlike the previous drop-and-recreate migration.

## Data model

### Schema changes (`SCHEMA_VERSION = 4`)

```sql
-- questions: add a global list position
ALTER TABLE questions ADD COLUMN position REAL NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS questions_position ON questions(position);

DROP TABLE question_parents;  -- after migration, see below

CREATE TABLE IF NOT EXISTS relations (
  id INTEGER PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('raises', 'part-of', 'blocks')),
  from_kind TEXT NOT NULL CHECK (from_kind IN ('question', 'option')),
  from_id INTEGER NOT NULL,                       -- questions.id or options.id per from_kind
  to_id INTEGER NOT NULL REFERENCES questions(id),
  note TEXT NOT NULL DEFAULT '',
  acceptance TEXT NOT NULL DEFAULT 'suggested'
    CHECK (acceptance IN ('suggested', 'accepted')),
  created_at TEXT NOT NULL,
  UNIQUE (kind, from_kind, from_id, to_id)
);
CREATE INDEX IF NOT EXISTS relations_to ON relations(to_id, kind);
CREATE INDEX IF NOT EXISTS relations_from ON relations(from_kind, from_id, kind);
```

Semantics, enforced in the write transaction:

| kind | from | to | reads as | constraint |
|---|---|---|---|---|
| `raises` | option | question | "choosing *from* opens *to*" | `from_kind = 'option'`; the option's own question may not be `to` |
| `part-of` | question | question | "*from* is part of answering *to*" | `from_kind = 'question'`; `from ≠ to`; acyclic over `part-of` edges |
| `blocks` | question | question | "*from* should be decided before *to*" | `from_kind = 'question'`; `from ≠ to`; acyclic over `blocks` edges |

Acyclicity is checked **per kind**, on the question-level projection. For `raises`, project the option to its owning question (`Q(from.option) → to`) and reject a cycle in that projection. Cross-kind cycles are allowed (a `blocks` edge and a `part-of` edge pointing opposite ways is legitimate). Reuse the recursive-CTE pattern from `addPlacement`.

`note` is optional free text for the agent's one-line why ("pairing follows the main"). Keep it; it costs nothing and the chips can surface it in `title`.

### Migration v3 → v4 (data-preserving)

In one transaction, when `user_version < 4` and `question_parents` exists:

1. Add `questions.position`. Assign positions by a depth-first walk of the old tree: roots in `(parent_id IS NULL, position)` order, then each root's children by `position`, recursively, visiting each question **once** (at its canonical = lowest-rowid placement). Number 1, 2, 3, … in visit order. Questions with no placement at all (should not exist) go last.
2. For every `question_parents` row with a non-null `parent_id`, insert `relations(kind='part-of', from_kind='question', from_id=child_id, to_id=parent_id, acceptance=<row acceptance>, created_at=now)`. Root placements produce no relation.
3. Drop `question_parents` and its index. Set `user_version = 4`.
4. Append one `edits` row: `actor='migration'`, `verb='migrate'`, `entity_kind='space'`, payload `{ from: 3, to: 4, relations: <count> }`.

Note in the payload and in a stderr line that old nesting was imported as `part-of` because that is the closest neutral reading; Warren may re-tag some as `raises` or `blocks` by hand.

### Types (`space.ts`)

- Remove `Placement`. Add:

```ts
export type RelationKind = "raises" | "part-of" | "blocks";
export type QuestionRelation = {
  kind: RelationKind;
  fromKind: "question" | "option";
  from: string;          // question slug, or "question/option" path when fromKind = "option"
  to: string;            // question slug
  note: string;
  acceptance: Acceptance;
};
```

- `Question` gains `position: number`.
- Rename existing `Relation` → `Relevance` and `OutlineSnapshot.relations` → `relevances`; add `OutlineSnapshot.relations: QuestionRelation[]`; drop `placements`. Questions in the snapshot are ordered by `position, id`.
- `EntityKind = NodeKind | "assessment" | "relevance" | "relation"`.
- `AddQuestionInput`: drop `parentSlug`; add `partOf?: string`, `raisedBy?: string` (option path), `after?: string | "first"`.

### Position maintenance

Fractional positions (REAL), same approach as options: `after X` = midpoint between X and its successor, or X + 1 at the end; `first` = (min − 1). No renumbering in v0; add a `dviz question move` verb so the agent can reorder without deleting.

## CLI surface (changes only)

```
dviz question add SLUG "TITLE" [--detail TEXT] [--part-of QSLUG] [--raised-by QSLUG/OSLUG] [--after QSLUG | --first]
dviz question move QSLUG (--after QSLUG | --first)
dviz relation add KIND FROM TO [--note TEXT]
      KIND  raises | part-of | blocks
      FROM  QSLUG for part-of/blocks, QSLUG/OSLUG for raises
      TO    QSLUG
dviz accept relation KIND:FROM:TO
dviz remove relation KIND:FROM:TO
dviz accept relevance QSLUG:CSLUG        (was: accept relation …)
dviz outline [--around QSLUG] [--hops N]
```

Removed: `question add --parent`, `dviz place`, `accept|remove placement …`, `outline --depth`.

`--part-of` / `--raised-by` on `question add` create the question and the relation in the same transaction (one round trip, the common case during live capture). Both relation and question land `suggested`. Reference format for `accept`/`remove` is `KIND:FROM:TO` with `:` as the separator because `FROM` may contain `/`.

Errors stay readable, as today: unknown slug, wrong `from` kind for the `KIND`, self-relation, duplicate relation, cycle ("`serve-time blocks prep-order` would create a blocks cycle through `timing`").

## Server

- `/api/command`: replace `place` with `relation.add`; add `question.move`; `question.add` takes `partOf`, `raisedBy`, `after`. Kind lists gain `relation`, `relevance`, lose `placement`.
- `/api/questions` POST: drop `parentSlug`, accept the same three optional fields.
- `/api/outline` snapshot shape per the types above. SSE payload unchanged in kind.
- `/api/show/question/SLUG`: replace `Parents:` with grouped relation lines (see projection below).

## Projections (`dviz outline`, `dviz show`)

`outline` becomes a flat list in `position` order. One line per question, relation context appended compactly so an agent re-read stays cheap:

```
- ◐ main-course — What anchors the meal? (part of menu · blocks sides, wine, prep-order)
- ● braise-cut — Which cut for the braise? (raised by main-course/braise)
- ○ sides — Which sides belong on the table? (part of menu · blocked by main-course)
- ○ dessert — What ends the meal? [suggested] (part of menu)
```

Inbound and outbound both appear; order the tail as: `part of` · `parts:` · `raised by` · `raises` (grouped per option as `braise→braise-cut`) · `blocked by` · `blocks`. Suggested relations get `?` suffix on the slug inside the tail (e.g. `part of menu?`). Omit empty groups. Options stay collapsed to slug chips on the line only if the current outline already does that; do not add them if it does not.

`--around QSLUG [--hops N]` (default 1) prints the question plus every question within N relation hops of any kind, still in position order.

`show question SLUG` prints the same groups, one per line, with notes.

## View (`app.tsx`, `styles.css`)

### List view (replaces `Outline`)

- Rename `Outline` → `QuestionList`. Render `snapshot.questions` in order as a single `<ol>`; no nesting, no `childrenByParent`, no `TransclusionCard`, no `canonicalByQuestion`.
- `QuestionCard` no longer takes a `Placement`. `suggested` dotted outline derives from the question alone.
- Below the title row, a **relation chip row** (`.relation-chips`) showing this card's *inbound context only*: `part of X`, `raised by Q/O`, `blocked by X`. Outbound relations (parts, raises, blocks) are for the detail view. Rationale: in a list you want "why does this exist / what must come first" at a glance, and one row of chips per card keeps cards long-thin.
- Chip anatomy: a short kind label in `--text-3` micro-label style (`part of`, `raised by`, `blocked by`) followed by the target slug in the existing question-chip or option-chip style. Suggested relation = dotted chip. `title` attribute carries the full sentence plus the note. Non-interactive in the list view for now (`<span>`, not `<button>`/`<a>`). Empty row is not rendered.
- Do not introduce new colors for relation kinds. Kind is carried by the label text; color stays reserved for state, per `docs/DESIGN.md`.
- Layout stability: a new question inserts at its `position`; nothing else moves. Chips appearing on an existing card may change that card's height — acceptable, but no animation.

### Detail view (`DecisionView`)

- Add a **Relations** block under the decision header with grouped lines: Part of / Parts / Raised by / Blocked by / Blocks. Each target renders as a chip that is a link (`<a href>` using the existing question route) so the human can hop; suggested ones dotted; notes as secondary text.
- **Raises** renders on each **option card**: "Raises: braise-cut, …" as link chips, since that is where the QOC contingency lives. An option that raises nothing shows nothing.

### Focus / follow

- `questionForFocus` and `focusTarget` simplify: one card per question, so focus scrolls to that card. Remove canonical-placement lookups.
- `recenter` unchanged.

### Fixture (`dinner-fixture.ts`)

Rewrite with explicit relation semantics; keep the dinner domain and the no-repo-vocabulary rule. Suggested shape (positions in listed order):

- `menu` — What should we serve? **No options** (a topic answered by its parts). Open.
- `service-style` — Family style or plated? options `family-style`, `plated`. `part-of menu`.
- `main-course` — What anchors the meal? options `braise` (leaning), `roast`, `pasta` (suggested). `part-of menu`.
- `braise-cut` — Which cut for the braise? options `short-rib` (decided), `chuck`, `shank`. `raises: main-course/braise → braise-cut`. Replaces the incoherent `protein`.
- `roast-bird` — Which bird to roast? options `chicken`, `duck`. Suggested question. `raises: main-course/roast → roast-bird` (suggested).
- `sides` — Which sides belong on the table? `part-of menu`; `blocks: main-course → sides`.
- `starter` — decided `soup`. `part-of menu`.
- `dessert` — leaning `tart`, suggested question. `part-of menu` (suggested).
- `drinks` — options `mixed`, `wine-only`, `zero-proof` (suggested).
- `wine` — decided `pinot`. `part-of drinks`; `blocks: main-course → wine` with note "pairing follows the main".
- `seating` — leaning `one-table`. `table-layout` suggested, `part-of seating` (suggested).
- `timing` — options `relaxed`, `paced`.
- `serve-time` — decided `seven`. `part-of timing`.
- `prep-order` — `part-of timing`; `blocks: serve-time → prep-order`; `blocks: main-course → prep-order`.

Carry criteria, relevances and assessments over, retargeting `protein/*` assessments to `braise-cut/*`. The fixture must contain at least one of each: each relation kind, a suggested relation of each kind, a question with no options, a question with both inbound and outbound relations (`main-course`), an option that raises a question. `&shape=` variants keep working (they transform the base snapshot; `empty|single|all-suggested|big` — `big` clones with suffixes and must re-map relation endpoints).

## Skill (`skills/dviz/SKILL.md`)

Add one short section; keep the file minimal and in house style. Draft for Warren to edit:

> ## Relations
>
> Questions relate three ways. Use the fewest that are true; none is better than a guess.
>
> - `raises` — an option, if chosen, opens a question: `dviz question add braise-cut "Which cut?" --raised-by main-course/braise`. This is the default during live capture: most new questions come from an option we were just discussing.
> - `part-of` — a broad question is answered by narrower ones: `--part-of menu`. Use when I frame a topic, or when tidying.
> - `blocks` — one decision should wait on another: `dviz relation add blocks serve-time prep-order --note "…"`. Only when I say the order matters.
>
> New questions go after the question that raised or contains them (the default), or where I say (`--after`). Reorder with `dviz question move`. Relations land `suggested` like everything else.

Replace "placements" in the capture list with "relations".

## Tests

- `space.test.ts`: replace the three placement tests with: (a) `relation add` for each kind with correct `from_kind` enforcement and self/duplicate rejection; (b) per-kind acyclicity including the `raises` question-projection case; (c) `question add --raised-by/--part-of/--after` positions and single-transaction atomicity (a bad relation leaves no question); (d) `question move`; (e) migration: build a v3 DB with a small tree incl. a two-parent question, migrate, assert positions follow DFS order, `part-of` rows exist with preserved acceptance, `question_parents` is gone, one `migrate` edit exists; failure rolls back schema and data; reopening does not migrate twice; (f) `remove question` deletes its relations in both directions and its options' `raises` edges; (g) `outline` markdown tail formatting and `--around --hops`.
- `server.test.ts`: `relation.add`, `question.move`, and the new `question.add` fields through `/api/command`; snapshot shape.
- CLI parse test: `relation add`, `accept relation KIND:FROM:TO`, `question add --raised-by`.

## Execution order

1. Schema + types + migration + `space.ts` functions, with tests. Run `bun test` green before touching anything else.
2. Server + CLI + projections.
3. Skill edit.
4. Fixture rewrite (it will not typecheck until 1 lands).
5. View: list, chips, detail relations, focus simplification.
6. One pass over `docs/visualizer-v0-spec.md`: replace the `question_parents` DDL, the "Transclusion" rendering rule, and the "View: hierarchical outline" language with a short pointer to this handoff. Do not rewrite the spec wholesale.

## Not in scope

- Coupling (`linked`), `duplicate-of`, or any fourth relation kind.
- Derived resolution for option-less topic questions (a topic is "decided when its parts are"). Topics are plain open questions for now.
- Chip click behaviour in the list view. Filtering or grouping the list by relation or status.
- Rendering relations as a graph, tree, or indentation anywhere.
- Human editing in the UI. Keyboard commands. Any theme work beyond what the chips need.

## Verification

- `cd dviz && bun run typecheck && bun test`.
- Migration on a consistent copy of a real library space (stop writers before copying `~/.dviz` to a fresh temporary directory): run `DVIZ_HOME=/tmp/dviz-backup dviz serve --port 4387` against the copy, using a free port and removing only its copied `server.json` if it points to the original running server; open it, confirm every question still appears, order matches the old canonical DFS order, old nesting shows as `part of` chips, log shows one `migrate` entry.
- `bun run dev`, `http://localhost:4377/?fixture=dinner`: flat list in the listed order; `braise-cut` shows `raised by main-course/braise`; `sides`, `wine`, `prep-order` show `blocked by …`; `dessert` and `roast-bird` cards and their relation chips are dotted; `menu` renders sensibly with no options; opening `main-course` shows Parts/Blocks groups and `Raises: braise-cut` on the braise card and `Raises: roast-bird` (dotted) on the roast card; focus/recenter lands on the single `main-course` card.
- CLI round trip against a scratch space: `question add` with `--raised-by`, `relation add blocks`, an attempted `blocks` cycle rejected with a readable message, `accept relation …`, `remove question` cleaning up edges, `outline` tail formatting, `outline --around main-course --hops 2`.
- `&shape=big` still loads and its cloned relations resolve.

## Things to watch when implementing

- `from_id` is polymorphic (question or option id by `from_kind`); no FK. Delete relations explicitly in `remove question` (both directions, plus `raises` rows whose `from_id` is one of the question's options) and in `remove option` (its `raises` rows). Add tests for both.
- The `raises` cycle check must project through the option's owning question, or `A/a raises B` + `B/b raises A` slips through.
- The `relation`/`relevance` rename touches `entity_kind` strings already sitting in old `edits` rows. Leave historical rows alone; only new writes use the new name. `dviz log` prints whatever is stored.
- `renderOutlineMarkdown` currently guards against infinite recursion with an `ancestors` set; the flat list needs no such guard, but `--around --hops` does need a visited set.
- Keep `?fixture=dinner` dev-only as today.
