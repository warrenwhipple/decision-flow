# Decision Mode Dogfood Insights

Rolling synthesis of dogfood experience notes. Keep bullets compact. Put source links beside each insight so one insight can point to many notes and one note can feed many insights.

## Current Product Feeling

- Decider, not manager - Warren talks to one orchestrating conversation agent and stays focused on decisions, not thread/worktree/task juggling. Sources: [2026-06-26 0734](<2026-06-26 0734 decision-mode-lightsight-rehearsal-orchestration.md>), conversation 2026-06-28
- Flow through dump plus menu - freeform brain dumps and numbered pseudo-UI actions should both feel native. Sources: [2026-06-26 0734](<2026-06-26 0734 decision-mode-lightsight-rehearsal-orchestration.md>), conversation 2026-06-28
- Progressive disclosure - stay in chat projection, with rendered DECISION and diffs available for confidence checks. Sources: [2026-06-06 0000](<2026-06-06 0000 decision-mode-ytmd.md>), [2026-06-08 1004](<2026-06-08 1004 decision-mode-lightsight.md>)
- Decision doc as data, conversation as view - assume user is not reading DECISION directly. Sources: [2026-06-08 1004](<2026-06-08 1004 decision-mode-lightsight.md>), [2026-06-25 1253](<2026-06-25 1253 decision-mode-lightsight-rehearsal-thread-ui.md>)

## Landed, Not Yet Dogfooded

- Universal dump affordance - sort messy prose into decisions, workflow moves, feedback, jobs, candidate questions, and meta feedback. Sources: [2026-06-25 1515](<2026-06-25 1515 decision-mode-lightsight-rehearsal-review-mode.md>), [2026-06-26 0734](<2026-06-26 0734 decision-mode-lightsight-rehearsal-orchestration.md>)
- Rehearsal lifecycle vocabulary - build, review, iterate, discard, promote, supersede; promote is not land. Sources: [2026-06-25 1623](<2026-06-25 1623 decision-mode-lightsight-rehearsal-prioritization.md>), [2026-06-26 0734](<2026-06-26 0734 decision-mode-lightsight-rehearsal-orchestration.md>)

## Active Feature Threads

- Rehearsal availability - surface rehearsal when unrehearsed/unimplemented frontier decisions exist. Sources: [2026-06-25 1623](<2026-06-25 1623 decision-mode-lightsight-rehearsal-prioritization.md>), conversation 2026-06-28
- Rehearsal information gain - push rehearsals upward when abstract uncertainty is hard and a throwaway artifact would teach quickly. Sources: [2026-06-08 1004](<2026-06-08 1004 decision-mode-lightsight.md>), [2026-06-25 1623](<2026-06-25 1623 decision-mode-lightsight-rehearsal-prioritization.md>)
- Rehearsal drift warning - warn when a parallel rehearsal lags the current decision frontier. Sources: [2026-06-26 0734](<2026-06-26 0734 decision-mode-lightsight-rehearsal-orchestration.md>), conversation 2026-06-28
- Prototype variables - leave uncertain UI/design choices open and test them with toggles or variants when cheap. Sources: [2026-06-08 1315](<2026-06-08 1315 grill-me-timeline-tool.md>)
- Prototype/rehearsal boundary - "build it so I can feel it" is not the same as a narrow spike. Sources: [2026-06-08 1004](<2026-06-08 1004 decision-mode-lightsight.md>), [2026-06-08 1315](<2026-06-08 1315 grill-me-timeline-tool.md>), [2026-06-25 1151](<2026-06-25 1151 decision-mode-lightsight-rehearsal-versioning.md>)
- Rehearsal should be runnable first - try-it card beats long code/report review. Sources: [2026-06-25 1253](<2026-06-25 1253 decision-mode-lightsight-rehearsal-thread-ui.md>), [2026-06-25 1515](<2026-06-25 1515 decision-mode-lightsight-rehearsal-review-mode.md>)
- Candidate questions need gatekeeping - rehearsal-discovered questions should not silently become accepted open questions. Sources: [2026-06-25 1515](<2026-06-25 1515 decision-mode-lightsight-rehearsal-review-mode.md>)

## Open Questions

- Approval interruptions - background agents can hit approvals and pull Warren back into manager mode. Sources: [2026-06-26 0734](<2026-06-26 0734 decision-mode-lightsight-rehearsal-orchestration.md>)
- Conversation versus orchestration split - maybe fast user interaction and worker management are separate jobs. Sources: [2026-06-26 0734](<2026-06-26 0734 decision-mode-lightsight-rehearsal-orchestration.md>)
- Codex thread/worktree UI ceiling - can Codex infrastructure be bent far enough before a custom app is needed? Sources: [2026-06-08 1315](<2026-06-08 1315 grill-me-timeline-tool.md>), [2026-06-25 1253](<2026-06-25 1253 decision-mode-lightsight-rehearsal-thread-ui.md>)
- Markdown model pressure - named rehearsals may be enough for now; database thoughts wait until Markdown breaks. Sources: [2026-06-06 0000](<2026-06-06 0000 decision-mode-ytmd.md>), [2026-06-25 1623](<2026-06-25 1623 decision-mode-lightsight-rehearsal-prioritization.md>)
- Differentiation from simpler methods - Decision Flow must be more than Grill Me plus "leave options open." Sources: [2026-06-06 0000](<2026-06-06 0000 decision-mode-ytmd.md>), [2026-06-08 1315](<2026-06-08 1315 grill-me-timeline-tool.md>)
- Agent guidance strength - useful suggestions can feel too pushy if the model argues one option into inevitability. Sources: [2026-06-06 0000](<2026-06-06 0000 decision-mode-ytmd.md>), [2026-06-08 1004](<2026-06-08 1004 decision-mode-lightsight.md>)

## Handled

- First-write restraint - large brain dumps should produce compact orientation before expanded decision records. Sources: [2026-06-06 0000](<2026-06-06 0000 decision-mode-ytmd.md>), [2026-06-08 1004](<2026-06-08 1004 decision-mode-lightsight.md>)
- Always re-orient after writes - after DECISION edits, return to ranked next moves instead of edit-confirmation mode. Sources: [2026-06-06 0000](<2026-06-06 0000 decision-mode-ytmd.md>)
- Menu order as recommendation - ranking is enough; avoid extra pushy "I'd focus on..." prose. Sources: [2026-06-06 0000](<2026-06-06 0000 decision-mode-ytmd.md>)
- No hidden resolve/decide - numbered choices should not resolve unseen DECISION state. Sources: [2026-06-25 1253](<2026-06-25 1253 decision-mode-lightsight-rehearsal-thread-ui.md>)
- Existential spike heuristic - suggest tiny evidence work when the project rests on an unvalidated assumption. Sources: [2026-06-06 0000](<2026-06-06 0000 decision-mode-ytmd.md>), [2026-06-08 1004](<2026-06-08 1004 decision-mode-lightsight.md>)
- Spike is evidence, not decision - jobs can inform a question but should not settle it by existing. Sources: [2026-06-06 0000](<2026-06-06 0000 decision-mode-ytmd.md>), [2026-06-08 1004](<2026-06-08 1004 decision-mode-lightsight.md>)
- Schema/version marker - DECISION files need compatibility handling without churn. Sources: [2026-06-25 1151](<2026-06-25 1151 decision-mode-lightsight-rehearsal-versioning.md>)
- Codex delegation backend guidance - use subagents for research/checks and worktree threads for rehearsals. Sources: [2026-06-08 1315](<2026-06-08 1315 grill-me-timeline-tool.md>), [2026-06-25 1151](<2026-06-25 1151 decision-mode-lightsight-rehearsal-versioning.md>), [2026-06-25 1253](<2026-06-25 1253 decision-mode-lightsight-rehearsal-thread-ui.md>)
- Rehearsal review mode - after try-it, stay in artifact review rather than generic triage. Sources: [2026-06-25 1515](<2026-06-25 1515 decision-mode-lightsight-rehearsal-review-mode.md>)
