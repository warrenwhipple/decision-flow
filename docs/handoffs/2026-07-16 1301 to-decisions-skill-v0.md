# Handoff: build `to-decisions` skill v0

2026-07-16 1301. Agent-generated handoff from a shared-understanding conversation with Warren. Fresh session should be able to build v0 from this doc alone.

## What this is

First extracted primitive from the `decision-mode` decomposition (see `docs/design-space`). A transcript-to-decision-handoff compiler, modeled on the contract of Matt Pocock's `to-spec`: no interview, pure synthesis of what already happened. It is deliberately NOT a miniature Decision Flow — it tests whether decision state can be captured faithfully, not whether decision-centered flow works.

## Contract (settled with Warren)

- Name: `to-decisions`. Lives at `skills/to-decisions/SKILL.md` in this repo.
- User-invoked only to preserve context window: e.g. `disable-model-invocation: true`.
- Input: the live conversation by default. Other sources (docs, transcripts from other harnesses, web) only when the user explicitly points at them.
- Do NOT: interview the user, explore the repo, research the subject, produce a spec, suggest next steps, or implement anything.
- Output: one timestamped markdown file per capture. Follow the repo's existing convention for such notes if one exists; otherwise `docs/decisions/{YYYY-MM-DD HHMM} {slug}.md`.
- End behavior: quiet compiler. Write the file, print a compact summary (decided/leaning/open counts, any inference marks worth eyeballing), stop. No menu.
- Consumer: a fresh context window — any agent, any harness, or future Warren — resuming decision work. Pocock-handoff-generic: context reset, task decomposition, or cross-harness handoff.

## Artifact shape (fresh minimal format)

Not DECISION v0.3 compatible. No schema marker, no encoding axis, no jobs, no rehearsals. Sections:

- Goal / context
- Decisions: status (DECIDED | LEANING | OPEN) + short why
- Open questions
- Alternatives and criteria **as actually discussed** — never generated to fill the template
- Contradictions / reversals, when present

Core guardrail — do not manufacture closure: distinguish what the user explicitly decided from inferred leanings. Add an inference mark only where capture involved judgment (e.g. `LEANING (inferred)`, `agent-suggested, user accepted`). Explicit user decisions carry no ceremony. A polished but fictional rationale is worse than an incomplete record.

## Keep v0 extremely minimal (Warren's explicit instruction)

Warren runs skills on very smart frontier models. Agents drafting skills love to write in edge cases, defensive instructions, and elaborated process steps that smart models don't need — that is exactly how `decision-mode` grew to 432 lines. Do not do this.

- v0 must cover the contract above and nothing else. Target the size class of `to-spec` (~60 lines, most of it template), not `decision-mode`.
- Build the smallest plausible prototype from the settled contract before assembling a corpus. v0 is an intuition-built probe for seeing whether the artifact and invocation feel useful, not yet an experimentally demonstrated improvement over a bare prompt.
- No edge-case handling, no failure-mode hedging, no "if the user does X" branches in v0. Guardrails get added later, one at a time, each earned by a reproducible observed failure and annotated with why it exists (so it can be pruned when models improve).
- When in doubt, leave it out. An under-specified v0 that fails informatively is the point of the experiment.

## Development process

### Phase 1: greenfield prototype and wild dogfood

- Write the minimal v0 from the contract above without waiting for an eval corpus.
- Try it on real greenfield decision work in at least two natural sessions: one ordinary "just talk to it" conversation and one structured Grill Me conversation. These may happen in different repos or in separate dogfood sessions. Do not shape either conversation to make `to-decisions` look good.
- At a natural stopping point, invoke `to-decisions`, inspect whether the artifact feels faithful, compact, and useful, then give only that artifact to a fresh context and see whether it can understand the state of deliberation and continue coherently.
- Preserve the original transcript, generated artifact, and brief human reaction where practical. These paired examples become the first corpus; corpus collection should emerge from real use rather than block the prototype.
- Do not immediately add an instruction for every awkward output. Gather multiple examples first unless a failure prevents the prototype from functioning.

### Phase 2: corpus evaluation and failure-driven refinement

- After several wild uses, freeze a small corpus of real transcripts. Expand beyond the first two friendly cases to include a messy voice dump with implicit leanings, a conversation with reversals, and mixed user/agent proposals.
- Run both the bare baseline prompt ("capture the decisions in this conversation") and the current skill against the corpus. Treat the SKILL.md as a candidate delta over baseline from this point forward; retain only instructions that demonstrably help.
- Eval properties, not exact wording: invented decisions = zero; important decisions not missed; correct DECIDED/LEANING/OPEN classification; rejected alternatives preserved with reasons; contradictions visible; scannable; and the headline test — a fresh agent can resume deliberation from the artifact without the transcript.
- Add guardrails only for reproducible observed failures. Periodically delete each later addition and confirm behavior actually worsens without it.

## References

- `to-spec`: https://github.com/mattpocock/skills/blob/main/skills/engineering/to-spec/SKILL.md — the contract to copy
- `writing-great-skills`: https://github.com/mattpocock/skills/blob/main/skills/productivity/writing-great-skills/SKILL.md — no-ops, sediment, leading words
- Ben Ilegbodu's deliberate skill write-up: https://www.benmvp.com/blog/deliberate-coding-ai-agents/ — failure-driven skill growth done right; also a cautionary monolith
- Thinking repo: `topics/decision-flow/vision.md`, `topics/decision-flow/fifty-years-essay/structured-decision-decisions.md` (ontology and provenance questions this experiment informs)
- This repo: `skills/decision-mode/SKILL.md` (the monolith being decomposed — do not inherit its schema), `docs/experience/insights.md`
