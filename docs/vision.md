# Decision Flow Vision

This doc: Decision Flow notes and docs keep fanning out and sprawling. This "vision" doc compresses the core motivation and idea. Intended to be continuously updated.

## Summary pitch

- Pick the wrong top-level object and you get attention fragmentation: today's AI coding tools organize around **agents** or **tasks**, both of which make the developer juggle parallel work to lift throughput.
- That turns the maker into a synthetic-team manager. Survivable for a defined backlog; corrosive for ambiguous, exploratory work.
- Decision Flow's bet: organize around **decisions** - an ordered, living set of open questions - so the developer can concentrate on one high-leverage choice while agents work underneath it.
- The core object is not "an agent doing a task." The core object is "a question we are trying to close well enough to keep building."
- Trajectory of the idea: branching search over codebase possibility space -> ordered list of decisions -> focused session where background agents serve one live decision.
- "Flow" here is not frictionless ease but protected, effortful concentration — the tool offloads consideration and the periphery yet deliberately keeps the human in the decision synthesis itself (see Selective cognitive reloading).

## Working name

- "Decision Flow" - tentative
- "Decision" - Socratic elicitation, problem framing, and structured choice
- "Flow" - preserving developer deep work under agent orchestration

## Core thesis

- Decision Flow is a software-engineer tool for **satisficing under cheaper consideration**, not an anti-procrastination tool.
- Background agents drop the cost of consideration: docs can be read, code can be inspected, spikes can be run, and prior art can be checked while the user stays in the main conversation.
- When the cost of considering another option falls, the optimal stopping point moves. You can often afford more consideration before additional deliberation costs more than it is worth.
- But consideration cost is endogenous, not just a falling gift from agents. Sometimes you must spend a decision to lower it — pick a tech stack or scaffold so the rehearsal and iteration loop gets fast. Decision Flow's keep-options-open bias can perversely defer the very loop-tightening decisions that make consideration cheap. Treat loop latency as a first-class signal: when setup cost dominates learning, surface the loop-tightening decision as a move.
- The tool changes the math of its own stopping rule:
    - It should push analysis-paralysis users toward closure when enough is known.
    - It should push premature-deciders to keep looking when the decision has long lock-in or weak evidence.
    - It should not treat "more options" as automatically better, or "fast decisions" as automatically shallow.
- Fast-and-frugal decision making is genuinely right in many environments. The failure mode is under-weighting reversibility and lock-in duration, not deciding quickly.

Touchstones: Herbert Simon / satisficing, optimal stopping, Rittel's problem-solution co-evolution, Double Diamond framing/divergence, IBIS/QOC/DRL.

## The problem: manager mode

- Plan mode + SDD have pushed toward long upfront spec/plan phases followed by long autonomous agent runs.
- The loop becomes: big plan -> big wait -> big review.
- During the wait, the human has nothing to do, so they:
    - Spawn a new terminal tab and start a new plan, or
    - Switch to another tab to review a completed task.
- Net effect: developer becomes a **synthetic-employee manager**, not a maker.
- Today's orchestration UIs reinforce this: agent list down the left, worktrees or cloud containers per agent.
    - cmux as current daily driver, Codex Mac app, Claude Code's recent additions, Cursor v3 "agents" pane.
    - Some try to unify local + cloud views.
- Context-switch cost is high because tasks are deliberately picked to be independent, partly to avoid merge conflicts and partly because the practice inherits pre-AI team-management patterns: kanban boards, tickets, pull requests, parallel ownership.
- Historical inversion: early AI coding (Copilot, tab-to-jump, tab-to-edit) enhanced flow by absorbing tedious work; agent orchestration now often breaks flow by pulling attention to tangential tasks.
- This critique aligns with the emerging flow / cognitive-load countercurrent: Addy Osmani's "ambient anxiety tax" and the argument that three good threads can beat six half-supervised threads.
- Decision Flow extends that countercurrent: not merely "cap your threads," but one focused session where agents are subordinated to the live decision.

## The felt job: permission to focus

- The manager-mode critique is not only cognitive (fragmented attention); it is emotional, and the emotional layer is the real differentiator. Uptake depends on the user *feeling* something other tools do not give.
- The anxiety to soothe: the compulsion that you should be running more agents, the token-maxing / agent-simultaneity-quota feeling, waking up feeling you are not managing enough. Widely reported; corrosive and distracting.
- Decision Flow's felt promise: permission to focus. Because the tool is reliably running the right background work, the user is *allowed* to concentrate on one decision without guilt that more agents should be spawned.
- Keep the right forcing function. When the user over-fiddles low-value detail, the nudge to move on should be "there is a more important decision to make" — never "go back to managing agents." Same redirection of attention, opposite source of pressure.
- The decider stance: talk to one orchestrating agent and stay on strategy, architecture, product feel, and decisions; know that multiple agents work underneath without juggling them.

## Where existing tooling is strong, and the gap

- OpenAI Symphony framing: complexity x ambiguity matrix.
    - Symphony-class tools cover three quadrants well: low/low, high-complexity/low-ambiguity, low-complexity/high-ambiguity.
    - Uncovered quadrant: **high complexity + high ambiguity = exploratory work = wicked problems**.
- Frontier labs and orchestrator startups are well-funded against independent, well-specified tasks: delegate to N agents, merge later.
- Open gap: a tool that respects deep work for exploratory work - building new products or new features where you do not know what you are building until you have built some of it.

## The architecture

- A tool optimized for the wicked-problem quadrant.
- Still harnesses agent orchestration. That unlock is real. But the orchestration serves **one focused session**, not fragmented manager mode.
- Centered on a grill-me / brainstorming-style interview, with one critical addition:
    - When the conversation hits a question the user genuinely cannot answer from current context, the tool launches one or two background agents to answer it.
    - The user stays in the conversation while those agents work.
- Background agents are scoped to the current decision/spec:
    - They answer questions that disambiguate the current choice.
    - They sharpen criteria, expose constraints, or validate reversibility.
    - They do not pursue tangential task throughput.
- Goal: **deep-work flow state with concurrent agents** - parallelism that does not fracture attention.

Conversation vs orchestration (likely a two-agent split):
- Dogfooding the single-agent skill exposed a structural problem: keeping the user in flow and managing the worker threads are two different jobs, and one agent doing both is what breaks flow. When the lone agent reads reports, shepherds threads, and lands work, the user is left watching orchestration instead of talking.
- Likely shape: a fast conversational **decider/flow agent** the user talks to, handing off to an **orchestration agent/layer** that drives worker threads, reads their reports, and absorbs approvals. The flow agent yields immediately after delegating; it never blocks the conversation to babysit workers.
- Approval interruptions are the concrete leak. Background rehearsal agents hit permission prompts (localhost access, temp-dir writes) that yank the user back into manager mode. The orchestration layer should absorb or batch these.
- A hypothesis to spike cheaply, not a committed architecture. Smallest test: separate talking from orchestrating and feel whether the decider stance returns.

Open architecture questions:
- Separability: are the decision graph (data + editing + views) and the flow loop (conversation agent offloading to orchestration) two composable products or one? Worth framing in notes; not worth committing yet.
- Orchestration count: one orchestration agent, several, or a shared data model synchronizing parallel background agents with the conversation agent? Premature — downstream of proving the basic split.
- Persistence: DECISION-as-Markdown is holding. Defer a relational/graph data model until Markdown actually breaks under multi-agent synchronization, not before.
- Audience: scalpel for adept engineers or guide for vibe-coders? Adept users want code/diagram/schema views and deliberate reloading; novices may not. Possibly lean on the host agent (Codex, Claude Code) to adapt to skill level rather than deciding it inside Decision Flow.

## The "Decision" half: elicitation and framing

- Peter Steinberger's "just talk to it" - conversational, anti-ceremony.
- Matt Pocock's `/grill-me` - Socratic interview mode, refuses to plan.
- Matt Pocock's `/grill-with-docs` - same shape, docs-grounded variant.
- Obra (Jesse Vincent) `/brainstorm` from `superpowers`.
- Aporia (Kasibatla et al.) - decision bank with decisions as persisted objects, linked to tests.
    - Tentatively not convinced the decisions <-> tests linkage is the right primitive. Flag as a real difference to pin down.
- Convergent pattern across these: AI elicits the user's intent while simultaneously helping the user form it.
- Decision Flow should not jump straight to the solution diamond. It needs a first-class **leftward / zoom-out / problem-framing move**:
    - Interrogate the goals section.
    - Pull a "constraint" up into an "open question."
    - Add a "prior question" when the current question assumes too much.
    - Ask whether we are solving the right problem before diverging on solutions.
- This is the Double Diamond's first diamond and Rittel's problem-solution co-evolution in the AI coding workflow.

## The stopping rule

- Decision Flow carries the **deliberation-stop** rule: when is the question good enough to close for now?
- It does not carry the **execution-stop** rule: when should the human stop working for the day, use a timer, avoid burnout, or do exposure-style anti-avoidance mechanics? That belongs in Convergence, if connected at all.
- The deliberation-stop rule is bidirectional:
    - Close when the remaining uncertainty is low-value, the decision is reversible, or further search is not worth the cost.
    - Keep looking when the decision binds for a long time, is hard to reverse, has weak evidence, or hides unresolved prior questions.
- Calibrate to reversibility and lock-in duration, not option count.
- The same reversibility/lock-in dial governs cognitive participation, not just search: low-leverage, reversible decisions can stay offloaded and skimmed; high-leverage, hard-to-reverse, architecture-defining decisions warrant deliberate reloading (see Selective cognitive reloading).
- Light self-recognition is allowed: if too many decisions are open, the system can nudge toward closure or triage.
- No timer in Decision Flow. It is continuous-in-life, not timeboxed.

## Selective cognitive reloading

- Cognitive offloading has a cost beyond skill atrophy: a failure of *participation*. Naur's programming-as-theory-building — the working theory of a system lives in the heads of the people who built it, not in the code. Margaret-Anne Storey extends this to AI coding: developers who only direct agents drift, accrue cognitive debt, and eventually lose the plot, unable to make architectural or strategic changes. Sustainable for a few weeks, then it breaks.
- Cognitive *reloading* is the deliberate counter-practice: doing cognitive work you could offload, in order to participate in the synthesis — not to learn a skill, but to stay competent to decide.
- Decision Flow is not "offload everything for frictionless flow." It is a tool for *selective* cognitive reloading. The satisficing thesis already says which work to offload — search, consideration, spikes, peripheral reading — and, by contrast, which to keep: the decision synthesis itself, the participation that builds the user's theory of the system.
- Flow is not frictionless ease. Passive TV or Instagram is frictionless ease. Flow (Csikszentmihalyi) requires real effort, applied skill mastery, and a challenge that stretches you — the challenge/skill balance. So "flow" here means protected, deliberate cognitive load on the highest-leverage decision, with the periphery offloaded so it does not fracture that concentration.
- This resolves the easy-load tension: the goal is not to make every decision effortless. It is to remove the *wrong* friction (thread-juggling, manager-anxiety, peripheral slog) so the user can spend real effort on the *right* friction (the decision that earns deliberate synthesis).
- The offload-vs-reload choice runs on the same dial as the stopping rule. Low-leverage and reversible -> stay in frictionless flow; let the agent render a thin projected view, skim it. High-leverage and architecture-defining -> deliberately slow down: read the code, draw the state machine, do the synthesis yourself, AI-checked but not AI-fed. The pseudo-UI's "assume the user is not reading the DECISION file, just render menus" is right only at the low-leverage end; for a reloading-worthy decision, hand over the real artifact (code, schema, diagram) and invite participation rather than summarizing it away. The earlier "I wanted the state-machine schema, not the decision tree" reaction was reloading asserting itself on a decision that warranted it.
- Touchstones: Naur (programming as theory building), Margaret-Anne Storey (cognitive debt in AI coding), Csikszentmihalyi (flow as challenge-skill balance), and the offloading lineage from Socrates/Phaedrus through Ted Chiang. Full theory lives in the `cognitive-reloading` topic; Decision Flow needs only the selective-reloading principle. Guardrail from that topic: beware unearned coherence — AI can string a brain dump into seductive synthesis that was never really there; the human who participated in the synthesis is the one who can tell.

## Adjacent space: records vs orchestration ontology

- The adjacent space is filling with decision-record and agent-memory systems: ADRs refreshed for AI coding, Aporia-style decision banks, and local project memory/governance logs.
- Those systems make decisions durable artifacts alongside agent work.
- Decision Flow's sharper claim is different: **decisions are not merely records after or alongside work; they are the top-level interaction and orchestration ontology during work.**
- The delta:
    - ADRs / decision records: "What did we decide, and why?"
    - Agent memory logs: "What happened, what worked, what failed, what should the agent remember?"
    - Aporia-style decision banks: "Which design decisions should be elicited, persisted, and validated?"
    - Decision Flow: "Which live question should steer human attention and agent work right now?"
- Stop selling "decisions matter." That is table stakes now.
- Sell the architecture:
    - Decision list replaces agent list as the primary navigation object.
    - Elicitation front-end helps form intent, not merely record it.
    - Background agents serve one live decision, instead of creating independent managerial threads.
    - The decision record is not just documentation; it is the control surface.

## Kinds of background work

- **Spike experiments** - throwaway code to answer one unresolved design question. XP "spike" in spirit. Output is evidence for a decision, not product direction by itself.
- **Rehearsals** - throwaway implementation passes over already-decided parts of the decision record. Output is a felt, runnable artifact plus a report on what materialized, what felt wrong, and what assumptions were needed.
- **Codebase research** - exploring existing code in the repo.
- **Internet/docs research** - reading docs, blogs, prior art, patterns, libraries.
- **Dependency code research** - downloading a dependency source and inspecting the code. See Amp "Librarian" and OpenCode "Scout."
- **Prepare collaborator brief** - when a decision needs input from other humans, help get them up to speed for discussing the decision.
- **Prepare observability plan** - when a decision needs real-world deployment, prepare an A/B test, feature-flag rollout, reversible trial, or measurement plan.
- All bounded by one criterion: must move the current decision/spec forward.

Spike vs rehearsal:
- A spike points forward from uncertainty: "Can we learn enough to choose?"
- A rehearsal points backward from decisions already recorded: "What happens if we try to enact this?"

Rehearsal scope and quality:
- Scoping a rehearsal is a decider act, not a manager act. Show the slice it will cover and take a quick yes/adjust before launch. Do not auto-collapse the whole frontier — a rehearsal can be PR-sized (one or two decisions) or a few small competing variants.
- Rehearsal-quality and landed-quality are different criteria. A rehearsal is a fast felt artifact; landed code meets main-branch standards. Hold the two criteria apart, and keep promote (choose as reference) distinct from land (encode in the real codebase).

## UI top-level ontology

- Current orchestration UIs -> top-level = **agents** -> user becomes manager-of-agents.
- Jira / Linear / Symphony style -> top-level = **tasks/issues** -> great for backlog grinding, weak for exploratory work.
- Decision Flow -> top-level = **decisions/questions**.
    - Heritage: IBIS / QOC / DRL / Kruchten / ADRs - 55-year-old ontology, finally tractable now that LLMs can bear the capture cost.
- The primary surface should make the decision stack legible:
    - What is open?
    - What is leaning?
    - What is decided but not yet encoded?
    - What evidence is arriving?
    - What question should get attention next?
- The decision stack is the top-level object, but not the only view a skilled decider needs. Sometimes the right thing to look at is the code, a schema, a diagram, or a state machine — the artifact that lets the user reload context for a high-leverage decision (see Selective cognitive reloading). Decision Flow should allow dropping into these views, or compose cleanly with tools that provide them, rather than forcing every view through the IBIS tree.

## UI interaction model

- At least two interaction modes:
- **Triage Questions** - decide which decision to tackle next.
    - Ordered list of questions.
    - Status, evidence, lock-in/reversibility, and work to do.
    - Agent inbox and active background jobs may be visible here.
    - This is where the shape check belongs: are we opening too many fronts, or prematurely narrowing before the framing is sound?
- **Question Focus** - zoom into one question.
    - More detail, criteria, options, evidence, and suggested next moves.
    - Other question notifications should be muted or strongly de-emphasized.
    - This is where the live interview happens.
- Phase transitions matter more than continuous nudging:
    - Triage -> Focus: ask whether this is the right question to work now.
    - Focus -> Triage: after a question closes, re-rank the remaining open space.
    - Focus -> Zoom-out: if a hidden prior question appears, move left instead of forcing an answer.
- Do we need deeper modes inside Question Focus like "Evaluate spike" or "Refine collaborator brief"?

## Product vocabulary (ubiquitous language)

- Internal theory vocabulary is leaking into the conversation and control surface — "frontier", "scribing", "promote/land", "R1" — and it makes the flow feel heavy, even intimidating.
- Because code editors foreground the agent's thinking, you cannot have the agent think in one vocabulary and speak in another; think-language is speak-language.
- Commit to domain-driven ubiquitous language: pick one deliberate user-facing vocabulary, write the skill in it, and keep the IBIS/QOC/DRL scaffolding in the theory docs only. The rehearsal lifecycle terms are the worst offenders — collapse or rename the promote/land/implement chain into something a user feels rather than decodes.

## Agent `decision-mode` skill prototype

- Smallest viable prototype: `decision-mode` as a single `SKILL.md`.
- Intentionally focus on **decision**: agent behavior, elicitation method, decision-centered workflow.
- Out of scope for now: **flow** as graphical orchestration UI.
- Rationale: UI-first prototype is too large; skill-first prototype is dogfoodable immediately.
- Dogfood target: ordinary side projects, not Decision Flow itself.
    - Test against real ambiguity.
    - Avoid building a tool that only works on its own design.
- Distribution later: GitHub open source / Vercel skill registry / blog post, after private iteration.
- Time horizon: days or weeks of use before broader sharing.
- Learning goal: determine whether the `decision-mode` behavior is strong enough to justify a dedicated UI.
- Product hypothesis: a successful skill becomes the behavioral core of a later Decision Flow sidecar visualizer or full orchestrator app.
