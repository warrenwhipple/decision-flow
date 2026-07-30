# decision-flow/design-space

This structured decision doc maps the design space of using structured decisions in human-AI interactions.
This is an intentional application of a structured decision method to itself.
This doc is user owned and manually maintained.
AI agents should not edit this file unless explicitly asked.

## Abbreviation Key

`+` = pro / supports
`-` = con / detracts from

## Criteria Key

Criteria cut across questions and options.

- `popular` - Feature has seen positive reception from users in existing tools.
- `thinking-architecture` - Structured harness architecture like chain-of-thought scratch pads and task lists can improve agent performance.
- `simple-architecture`
	- `bitter-lesson` - Often better to leave AI intelligence optimization to broad training principles, rather than imposing bespoke reasoning architecture.
	- `expert-driver` - Expert AI agent users can steer better using simple loaded instruction over harness constraint and ceremony, see Peter Steinberger "Just talk to it", examples here "discuss alternatives", "discuss pros and cons", "discuss cross cutting criteria".
- `shared-understanding` - The user and the AI align on a shared mental model.
	- `user-sees-ai` - Agent reasoning is made visible to the user.
	- `ai-sees-user` - Latent user intention is made visible to the agent.
- `trust` - User is confident the agent will not act on misunderstandings, faulty assumptions, hallucinations or malicious outside data; nor enshrine these in artifacts or the codebase.
- `cognitive-engagement` - Push back cognitive debt caused by cognitive offloading, complacent approval and the paradox of automation.
- `focus-flow` - Push back human context switching and attention fragmentation.
- `conversation-flow` - Human-AI interaction centered around a conversation feels natural.
- `human-scannable` - Repeating or compressing familiar ideas using summaries, key words, and compact lists can help users process more information efficiently
- `hitl-throughput` - Fast and efficient human-in-the-loop interactions can achieve more work.
- `parallel-throughput` - Parallel agent runs can achieve more work.
- `auto-throughput` - Longer autonomous agent runs, or automatic event-hooked agent runs can achieve more work.
- `context-hygiene` - Agents perform better when context windows are kept smaller, focused and unpolluted with irrelevant or stale information.
	- `positive-space` - Descriptions of of negative space "never" rules or rejected alternatives can confuse smaller LLMs or cost KVM space in larger LLMs.
- `subagent-offloadable` - Context window burn can be mitigated by delegating work to subagents

## Questions and Options

- `ontology` - How much structured decision ontology is useful?
    - `none` - Just talk to it.
    - `spec` - Capture decisions as a structured list of requirements.
    - `q-and-a` - A decision is a question and it's answer.
    - `multiple-choice` - A decision is a question framing a selection among options.
    - `pro-con` - Questions have options; options have pro and con arguments.
    - `qoc` - Questions have options; criteria cut across options.
    - `complex` - Problems, goals, sub-goals, alternatives, claims, criteria, sub-criteria, arguments, supports/detracts relations, etc...
- `topology` - How do decisions relate to other decisions?
	- `set` - Decision order is irrelevant.
    - `list` - Decision order is indifferent to upstream decisions.
    - `tree` - A decision is downstream of one other decision, or a root problem/goal.
    - `dag` - A decision may be relevant to multiple upstream decision branches.
    - `dense-coupling` - every decision potentially influences the relevance of every other decision.
- `architecture` - Where do structured decisions belong in human-AI system architecture?
    - `llm-reasoning` - LLMs use scratchpad structured decisions similar to chain-of-thought reasoning, context window only, collapsed from responses, human inspectable.
		- `+ thinking-architecture`
		- `- bitter-lesson`
    - `structured-chat` - Structure a human-AI conversation around open questions, but do not persist beyond the transcript.
		- `+ popular` - examples `superpowers/brainstorming`, `grill-me`
		- `- expert-driver`
    - `pre-spec` - Post-discussion, persist a structured decision artifact, then derive one or more structured specs.
		- `+ user-sees-ai`
		- `- context-hygiene`
		- `- conversation-flow`
    - `spec-alternative` - Replace the requirements spec artifact's role with a richer decision data augmented artifact.
		- `+ user-sees-ai`
		- `+/- context-hygiene`
    - `sidecar-view` - At each conversation turn, an agent updates a structured decision view for better user understanding.
		- `+ user-sees-ai`
		- `+ human-scannable`
		- `- context-hygiene`
		- `+ subagent-offloadable`
    - `ui` - A user manipulates structured decisions directly via a UI surface, in addition to chatting with an agent that edits via tool calls.
    - `collaboration-sync` - A shared decision store serves as a synchronization layer between multiple users-agent-sessions, sub-agents, or event-hook-agents.
    - `adr` - Record decisions only after planning and decision making, documenting rationale for future agent context, team, or future-you understanding.
- `suggestion-friction` - How should an agent suggest questions, options, or criteria?
    - `passive` - Agent does not suggest questions or options or criteria, only scribes extracted data as post/background transcript processing.
        - `+ conversation-flow`
        - `+ user-sees-ai`
        - `- ai-sees-user`
        - `- cognitive-engagement`
    - `socratic` - Agent asks one high leverage question at a time, no suggested options.
        - `+ conversation-flow`
        - `+ shared-understanding`
        - `- hitl-throughput`
    - `suggestion-driven` - Agent presents a suggestion menu of questions, then options; user chooses.
        - `+ shared-understanding`
        - `+ hitl-throughput`
        - `- cognitive-engagement`
- `capture-friction` - How should an agent gate persisting decision data to the artifact?
    - `confirmed` - User must explicitly confirm edits to the record.
        - `+ trust` - User can check no agent assumptions sneak in.
        - `- conversation-flow` - Approval gates break conversation flow.
        - `? cognitive-engagement` - Asking engages, but constant approval requests lead to cognitive complacency.
    - `explicit`
        - `+ trust`
    - `inferred`
        - `? trust`
        - `+ conversation-flow`
    - `speculative`
        - `- trust`
        - `+ conversation-flow`
- `stopping` - When to stop asking questions, considering new alternatives, or weighing current alternatives?
- `iteration` - How often to commit decisions as prototype ready, or production implementation ready?
- `decomposition` - How to break up large decision spaces into separate artifacts, or agent sessions.
- `provenance` - How to distinguish between human, agent, and mixed sources of decision information?
- `deferral` - How to reach beyond the latent knowledge exploration of the human-AI conversation, and pull in research, team input, user feedback, code spikes, or prototype evaluation?
