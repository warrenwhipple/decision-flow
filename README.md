# Decision Flow

Decision Flow is an early-stage exploration of AI-assisted software work organized around decisions instead of agents, tickets, or tasks.

The core bet: for ambiguous product and engineering work, the useful top-level object is often an ordered list of open questions. Agents can help research, spike, and clarify those questions while the human stays focused on the next meaningful decision.

## Current Prototypes

This repo contains a decision visualizer and small, closely related prototype skills for decision-centered work.

Start here:

- [`dviz/`](dviz/) - the `dviz` decision visualizer (CLI + local server + live outline view), the current focus
- [`skills/dviz/SKILL.md`](skills/dviz/SKILL.md) - the agent skill for capturing a deliberation through the `dviz` CLI
- [`docs/visualizer-v0-spec.md`](docs/visualizer-v0-spec.md) - visualizer design and build order
- [`skills/decision-mode/SKILL.md`](skills/decision-mode/SKILL.md) - the prototype agent behavior
- [`skills/deliberate/SKILL.md`](skills/deliberate/SKILL.md) - interview a problem one decision at a time without writing files
- [`skills/to-decisions/SKILL.md`](skills/to-decisions/SKILL.md) - capture decision state from an existing conversation
- [`docs/vision.md`](docs/vision.md) - product vision and rationale
- [`docs/manual-only-skills.md`](docs/manual-only-skills.md) - manual-only invocation across Codex, Claude Code, and Cursor
- [`docs/experience/`](docs/experience/) - timestamped dogfood notes and observations
- [`docs/experience/insights.md`](docs/experience/insights.md) - tracking and synthesis of dogfood notes
- [`docs/reports/`](docs/reports/) - timestamped research and capability reports

## dviz

`dviz` is a local decision visualizer with a personal library of spaces. Each space is one decision map, independent of any repository. Run one `dviz serve` process from anywhere, keep the view beside your conversation, and use the persistent sidebar to create and browse spaces. Agents capture questions, options, criteria, and assessments through the CLI; each appears live as *suggested* until you accept it.

New spaces live in `~/.dviz/spaces/<slug>/space.db`, with titles and slugs tracked in `~/.dviz/library.db`. Set `DVIZ_HOME` to use another library directory. Agents access state through the CLI, never database files.

```sh
cd dviz && bun install && bun link   # global `dviz` binary
dviz serve                          # one server for the entire personal library
# Open the printed Outline URL; use + New to create a space.
# In another terminal (from any directory):
dviz space create travel "Travel plans"
dviz space list
dviz space open travel               # prints a link; does not switch agent targets
dviz question add destination "Where should we go?" --space travel
dviz outline --space travel
dviz --help
```

Every graph command needs `--space SLUG` or a conversation-local `DVIZ_SPACE` environment variable. An explicit flag overrides that variable. **Browsing another space never redirects agent edits.** Space links include `?space=SLUG`, so separate tabs and browser history work independently. Space titles may repeat; slugs must be unique lowercase handles. The sidebar updates when spaces are created through the CLI.

`dviz init SLUG "TITLE"` is an alias for `space create`; both require the server to be running. There is no shared active space, automatic repo discovery in the default CLI workflow, or automatic data migration. Folders, tags, renaming spaces, and deletion are not part of this iteration.

### Existing repo-local databases

Existing maps are left in place. Use the explicit compatibility mode to keep working with them (use a different port if the library server is also running):

```sh
dviz serve --db /path/to/project/.dviz/space.db --port 4318
dviz outline --db /path/to/project/.dviz/space.db
```

`DVIZ_DB` is still supported for this mode; do not combine it with `--space` or `DVIZ_SPACE`. `dviz init --db PATH` still creates a standalone database. Existing maps are not listed in the personal library and are not moved, copied, or deleted automatically. Stop an older server before starting its replacement.

Schema v4 upgrades v3 spaces when opened: existing nesting becomes `part-of` relations, preserving data and acceptance, and canonical outline order becomes the flat question order. Each upgrade runs in one transaction and logs a migration entry. Populated pre-slug spaces are still refused. Back up spaces before upgrading; older dviz versions cannot open v4.

For development, `cd dviz && bun run dev` serves the library with live UI updates and the `?fixture=dinner` demo. Run `bun test` and `bun run typecheck` in `dviz/`.

## Decision Mode

Decision Mode (the `decision-mode` skill) helps decompose a complex goal into:

- questions
- options
- criteria
- background jobs
- decisions

It records progress in a `DECISION.md` file — created per working session in whatever repo you run it in, not checked in here — so an ambiguous session remains inspectable and resumable. For a real example, see lightsight's [`DECISION.md`](https://github.com/warrenwhipple/lightsight/blob/main/DECISION.md) ([local](../lightsight/DECISION.md), if lightsight is cloned as a sibling repo).

## Deliberate

`deliberate` is a conversation-only skill that interviews the user one question at a time. It distinguishes decided, leaning, and open questions, and helps identify what would close each open question without writing project artifacts.

## Try it

Run `scripts/link-skills.sh` to link the repo's skills into the user-level skill directories used by Codex, Cursor, and Claude Code. The links point back to this checkout, so skill edits are immediately available for dogfooding without copying files. Existing real directories at the same skill names are moved to timestamped backups; unrelated installed skills remain in place. Harnesses may need a new session to reload changed instructions.

Invoke the skills explicitly with `$dviz`, `$decision-mode`, `$deliberate`, or `$to-decisions` in Codex, and with the corresponding slash command in Claude Code and Cursor. All four skills are user-invoked-only; see [`docs/manual-only-skills.md`](docs/manual-only-skills.md) for the harness metadata. OpenCode manual-only adapters are intentionally deferred.

## Status

Early public iteration. Current work is on the `dviz` visualizer; `decision-mode`, `deliberate`, and `to-decisions` are parked. The repo is intentionally small while things are being dogfooded; expect rough edges and fast changes.
