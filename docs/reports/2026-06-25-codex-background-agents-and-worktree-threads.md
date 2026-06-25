---
observed_at: 2026-06-25
type: capability-report
surface: Codex Mac app
topic: Codex background agents and worktree threads for decision-mode rehearsal jobs
tags: [background-agents, codex, decision-mode, rehearsal, subagents, worktrees]
---

# Codex Background Agents And Worktree Threads

Question: can `decision-mode` launch background work and keep Warren in the main decision conversation?

Short answer: yes for sub-agents, and mostly yes for worktree threads, but they have different completion behavior.

## Tools Tested

- `multi_agent_v1.spawn_agent`
  - Launches sub-agents with roles like `default`, `explorer`, and `worker`.
  - Has no explicit `worktree` parameter.
  - Coding-worker guidance mentions a "forked workspace", but the tool surface does not expose a named Codex worktree or branch choice.
  - Completion returns to the parent thread through a `subagent_notification`.
- `multi_agent_v1.wait_agent`
  - Blocks the main agent while waiting.
  - Minimum timeout observed in tool schema: 10 seconds.
  - Should be avoided during live decision conversation unless the result is on the critical path.
- `multi_agent_v1.close_agent`
  - Reveals the prior status while closing the agent.
  - Appropriate after completion, not as a non-destructive status check.
- `codex_app.create_thread`
  - Starts a separate Codex thread with a fresh prompt.
  - Can target the current project in `local` or `worktree` environment.
  - Worktree threads can start from the current working tree or a named branch.
  - For a worktree, the initial return was a `pendingWorktreeId`, not a final thread result.
- `codex_app.list_threads` and `codex_app.read_thread`
  - Can discover and inspect the created worktree thread after it exists.
  - Manual inspection was needed; no automatic completion notification appeared in the parent thread.
- `codex_app.fork_thread`
  - Forks completed conversation history from an existing thread.
  - Can also create a worktree child.
  - Best reserved for cases where important context has not yet been captured in a DECISION file or compact brief.

## Sub-Agent Timer Trial

Spawned a sub-agent named `Carver` with a 60-second wait instruction.

Observed behavior:

- Parent thread yielded immediately after launch.
- Warren sent a normal chat message while the sub-agent was running.
- The message did not appear to be queued behind the sub-agent once the parent had yielded.
- When the sub-agent finished, the parent thread received a `subagent_notification`.
- Closing the agent showed the final status: `hi, I waited for 60 seconds.`

Operational finding:

- The stall happens when the parent agent keeps its turn open or calls `wait_agent`, not merely because a sub-agent exists.
- Preferred pattern: launch sub-agent, yield immediately, continue normal conversation, synthesize result when notification arrives.

## Worktree Thread Trial

Created a fresh Codex worktree thread for `decision-flow` with this task:

> Create a new file named `story.md` at the repository root. Put a very tiny original story in it, no more than 5 sentences. Do not edit any other files.

Observed behavior:

- `create_thread` returned pending worktree id: `local:183e39c7-e9af-468b-8c3b-fa6a3fc07e60`.
- Parent thread did not receive an automatic completion message.
- Later `list_threads` found thread `019eff93-8387-7c32-ab1e-aedbe7660a4f`, title `Create story.md`, status `idle`.
- The thread ran in worktree path `/Users/warrenwhipple/.codex/worktrees/5cb4/decision-flow`.
- `read_thread` showed it created `/Users/warrenwhipple/.codex/worktrees/5cb4/decision-flow/story.md`.

Operational finding:

- Worktree threads are suitable for isolated rehearsal implementation.
- They do not currently behave like sub-agents for completion notification back to the parent thread.
- Parent can inspect them manually with `list_threads` and `read_thread`.

## Create Thread Versus Fork Thread

Conversation context and filesystem context are separate axes.

Conversation context:

- `create_thread` starts a fresh thread from a prompt.
- `fork_thread` copies completed transcript history from an existing thread, plus any follow-up prompt.

Filesystem context:

- `local` or `same-directory` uses an existing checkout.
- `worktree` uses an isolated Codex checkout.
- Worktree starting state can be current working tree or a named branch.

Decision Flow implication:

- Default rehearsal should use `create_thread` in a worktree with a compact brief and DECISION file path.
- Use `fork_thread` only when transcript context is important and not yet captured in the DECISION file.

## Decision-Mode Job Backend Guidance

Suggested mapping:

- Research/codebase lookup jobs: `spawn_agent`, usually `explorer` or `default`.
- Small status/timer/check jobs: `spawn_agent`, then yield immediately.
- Rehearsal implementation jobs: `create_thread` or `fork_thread` in a Codex worktree.
- Parent `decision-mode` agent owns DECISION file updates and synthesis.

Recommended parent-agent pattern:

1. Record the job as BUSY with agent id, pending worktree id, thread id, or report path.
2. Launch the background worker.
3. Yield immediately to keep Warren in normal conversation.
4. When a sub-agent notification arrives, synthesize it.
5. For worktree threads, inspect manually with `list_threads` / `read_thread` when Warren asks or when returning to the job.
6. Mark the job READY or REVIEWED only after reading the result.

## Open Questions

- Is there a nonblocking status API for worktree threads beyond `list_threads` / `read_thread`?
- Can created worktree threads be configured to notify the parent thread on completion?
- How should `decision-mode` record worktree locations so rehearsal artifacts are easy to inspect, hand off, or discard?
