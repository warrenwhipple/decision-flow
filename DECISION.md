# Decision Mode Background Agent Rehearsal

Can `decision-mode` keep Warren in conversation while Codex background agents do rehearsal work?

<!-- decision-mode: schema=0.2; reviewed=2026-06-25 -->

**Criteria**
- HIGH - Main agent remains responsive during delegated work
- HIGH - Rehearsal jobs offload bounded work instead of stalling discussion
- HIGH - Worktree/background-agent limits known from real Codex behavior
- LOW - Timer trial is only capability rehearsal, not product evidence

## Can Codex sub-agents run while the main agent continues?

Need verify actual Codex app behavior, not just desired ontology.

**Options**
- Use sub-agent as background job while main agent continues
  - PRO - Matches skill's job model and Codex sub-agent guidance
  - CON - Need learn whether completion notifies main thread without explicit wait
- Main agent waits for sub-agent result
  - PRO - Simple synthesis path
  - CON - Defeats conversation-latency goal

**Jobs**
- REVIEWED - Rehearsal - 60-second timer sub-agent test; agent: Maxwell `019eff82-e2f4-7862-9aad-dff288472bdd`; result: "hi, I waited for 60 seconds."

**Decision**
- Status - DECIDED
- Encoding - ENCODED
- Choice - Use sub-agent as background job while main agent continues
- Confidence - TENTATIVE
- Why - Tool docs explicitly say to avoid waiting unless blocked and continue non-overlapping work; live trial confirmed main thread kept working after spawn; caveat: explicit `wait_agent` blocks that stretch of the turn unless interrupted; launch-and-yield rule now encoded in `skills/decision-mode/SKILL.md`

## Which Codex backend should decision-mode use for background jobs?

Need distinguish quick sub-agent jobs from isolated worktree rehearsal jobs.

**Options**
- Backend split: `spawn_agent` for bounded research/checks; worktree Codex thread for rehearsal implementation
  - PRO - Matches observed Codex notification and isolation behavior
  - PRO - Keeps main decision conversation responsive
  - CON - Worktree thread completion requires manual inspection
- Use `spawn_agent` worker for all background jobs
  - PRO - Completion notification comes back to parent
  - CON - No explicit worktree/branch control in tool surface
- Use worktree threads for all background jobs
  - PRO - Strong isolation
  - CON - Overkill for read-heavy research and small checks

**Jobs**
- REVIEWED - Research - Codex background agent/worktree thread capability report; report: `docs/reports/2026-06-25-codex-background-agents-and-worktree-threads.md`
- REVIEWED - Rehearsal - Worktree thread `story.md` test; pending id: `local:183e39c7-e9af-468b-8c3b-fa6a3fc07e60`; thread: `019eff93-8387-7c32-ab1e-aedbe7660a4f`; worktree: `/Users/warrenwhipple/.codex/worktrees/5cb4/decision-flow`

**Decision**
- Status - DECIDED
- Encoding - ENCODED
- Choice - Backend split: `spawn_agent` for bounded research/checks; worktree Codex thread for rehearsal implementation
- Confidence - TENTATIVE
- Why - `spawn_agent` notifies parent and supports launch-and-yield; `create_thread`/`fork_thread` worktrees give rehearsal isolation but need later `list_threads`/`read_thread` inspection; behavior now encoded in `skills/decision-mode/SKILL.md`
