# Vision - Decision Flow

This doc: Decision Flow notes and docs keep fanning out and sprawling. This "vision" doc compresses the core motivation and idea. Intended to be continuously updated.

## Summary Pitch

- Pick the wrong top-level object and you get attention fragmentation: today's tools organize coding-with-AI around **agents** or **tasks**, both of which make you juggle parallel work to lift throughput — maker becomes synthetic-team manager.
- That juggling kills flow. Survivable for a defined backlog; corrosive for ambiguous, exploratory work.
- Decision Flow's bet: organize around **decisions** — an ordered list of open questions — so you concentrate on one high-leverage choice while agents run beneath you.
- Trajectory of the idea: branching search over codebase possibility space → ordered list of decisions.

## Working name

- "Decision Flow" — tentative
- "Decision" → the Socratic/elicitation half
- "Flow" → preserving developer deep-work under agent orchestration

## The "Decision" half: touchstones

- Peter Steinberger's "just talk to it" — conversational, anti-ceremony
- Matt Pocock's `/grill-me` — Socratic interview mode, refuses to plan
- Matt Pocock's `/grill-with-docs` — same shape, docs-grounded variant
- Obra (Jesse Vincent) `/brainstorm` from `superpowers`
- Aporia (Kasibatla et al.) — decision bank with decisions as persisted objects, linked to tests
    - Tentatively _not_ convinced the decisions ↔ tests linkage is the right primitive — flag as a real difference to pin down
- Convergent pattern across all of these: AI elicits the user's intent while simultaneously _helping the user form_ it (Rittel's "problem formulation and solution co-evolve" in modern dress)

## The "Flow" half: problem being solved

- Plan mode + SDD have pushed toward long upfront spec/plan phases followed by long autonomous agent runs
- "Big plan → big wait → big review" loop
- During the big wait, human has nothing to do, so:
    - Spawns a new terminal tab → starts a new plan, or
    - Switches to another tab to review a completed task
- Net effect: developer becomes a **synthetic-employee manager**, not a maker
- Today's orchestration UIs all reinforce this: agent list down the left, worktrees or cloud containers per agent
    - cmux (current daily driver), Codex Mac app, Claude Code's recent additions, Cursor v3 "agents" pane
    - Some try to unify local + cloud views
- Context-switch cost is high because tasks are _deliberately_ picked to be independent, to reduce eventual avoiding merge conflicts, perhaps related to this practice being anchored in pre AI, human team management concepts and tools like kanban boards, git pull requests, etc
- Historical inversion: early AI coding (Copilot, tab-to-jump, tab-to-edit) _enhanced_ flow by absorbing tedious work; agent orchestration now _breaks_ flow by pulling attention to tangential tasks

## Where existing tooling is strong, and the gap

- OpenAI Symphony framing: complexity × ambiguity matrix
    - Symphony-class tools cover three quadrants well: low/low, high-complexity/low-ambiguity, low-complexity/high-ambiguity
    - Uncovered quadrant: **high complexity + high ambiguity = exploratory work = wicked problems**
- Frontier labs / orchestrator startups are well-funded against independent, well-specified tasks (delegate to N agents, merge later)
- Open gap: a tool that respects deep work _for exploratory work_ — building new products or new features where you don't know what you're building until you've built some of it

## Core vision

- A tool optimized for the wicked-problem quadrant
- Still harnesses agent orchestration — that unlock is real — but in service of _one focused session_ instead of fragmented manager mode
- Centered on a grill-me / brainstorming-style interview, with the critical addition:
    - When the conversation hits a question the user genuinely doesn't know the answer to, the tool launches one or two background agents to answer it
    - The user stays in the conversation while those agents work
- Background agents are scoped: they only work on questions that disambiguate or sharpen the current spec — never tangential
- Goal: **deep-work flow state with concurrent agents** — parallelism that doesn't fracture attention

## Kinds of work the background agents do

- **Spike experiments** — throwaway code to answer a design question (XP "spike" in spirit — output is "we learned enough to choose," not "we built something")
- **Codebase research** — exploring existing code in the repo
- **Internet/docs research** — reading docs, blogs, prior art, finding patterns or libraries
- **Dependency code research** — downloading a dependency source and inspecting the code (see Amp "Librarian" and OpenCode "Scout")
- **Prepare collaborator brief** — when a decision needs input from other humans, help get them up to speed for discussing the decision
- **Prepare observability plan** — when a decision needs real world deploy, prepare a plan for A/B test or feature or reversible trial etc
- All bounded by one criterion: must move the current decision/spec forward

## UI top-level ontology

- Current orchestration UIs → top-level = **agents** → user becomes manager-of-agents
- Jira/Linear/Symphony style → top-level = **tasks/issues** → great for backlog grinding, weak for exploratory work
- Decision Flow's bet → top-level = **decisions** or **questions**
    - Heritage: IBIS / QOC / DRL / Kruchten / ADRs — 55-year-old ontology, finally tractable now that LLMs can bear the capture cost

## UI interaction model

- At least two interaction modes:
- **Triage Questions** — Decide what decision to tackle next. Should appear to user as an ordered list of "questions", with core important info for each, like status, evidence, work to do. Probably okay to put agent "inbox" like notifications here, and "spinners" showing active background agent tasks.
- **Question Focus** — Zoom into one question to see much more info and suggested next moves. Should probably block out other question notification distractions while focused.
- Do we need deeper modes inside a Question Focus like "Evaluate spike" or "Refine collaborator brief"?

## Agent `decision-mode` skill prototype

- Smallest viable prototype: `decision-mode` as a single `SKILL.md`
- Intentionally focus on **decision** → agent behavior / elicitation method / decision-centered workflow
- Out of scope so defer **flow** → graphical orchestration UI,
- Rationale: UI-first prototype is too large; skill-first prototype is dogfoodable immediately
- Dogfood target: ordinary side projects, not Decision Flow itself
    - Test against real ambiguity
    - Avoid building a tool that only works on its own design
- Distribution later: GitHub open source / Vercel skill registry / blog post, after private iteration
- Time horizon: days or weeks of use before broader sharing
- Learning goal: determine whether the `decision-mode` behavior is strong enough to justify a dedicated UI
- Product hypothesis: a successful skill becomes the behavioral core of a later Decision Flow sidecar visualizer or full orchestrator app
