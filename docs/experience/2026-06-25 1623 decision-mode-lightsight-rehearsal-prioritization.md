---
observed_at: 2026-06-25 16:23 EDT
type: dogfood
decision_flow_target: decision-mode
dogfood_target: lightsight
target_repo_state: existing dogfood repo; ongoing decision-mode session; rehearsal thread triggered and inspected
surface: Codex Mac app
input_mode: voice-to-text field note
session_focus: rehearsal prioritization in next-move options; Codex thread readiness ambiguity; rehearsal as its own entity; possible relational model pressure
tags: [codex-mac-app, decision-doc-pseudo-ui, dogfood, lightsight, rehearsal-entity, rehearsal-prioritization, thread-orchestration, worktree-rehearsal]
---

2026-06-25 16:23 - I'm working through lightsight again, going through the various decisions. I feel like it's working really well, like really well. Which is a nice feeling. 21:00 I think I wanna consider one more thing which is that I think the Decision Mode should slightly press rehearsals towards the top of the you know next 1 2 3 list. Especially if it feels like their rehearsal will give us good information. Like if there's open questions that are like hard or that are really required for the next rehearsal or maybe yeah like very confusing I understand pushing them to the top but my guess is that we do I think it's important to kind of pressure rehearsals a little bit more. Maybe this is a decision I can wait on after working through a few more.

2026-06-25 16:27 - I triggered a rehearsal after making a few more decisions and it's interesting the decision flow agent gave me an option focus and option clarify and an option three inspect rehearsal when thread is ready. That sounds like it's queuing a wait on something. If I remember correctly, the agent doesn't actually know when the rehearsal is done because it doesn't get messaged back because it's not a sub-agent, it's another thread. I wonder if it would check it. I'm looking at my UI and I see a little rotation guy in the thread for the rehearsal. Yeah. Again, the problem is the infrastructure provided by the Codex Mac app is just not enough to get us completely out of manager mode. Then one of the actions is called clarify, and it sounds like it's opening up a new question. Is that right? Checking what the vocabulary I'm surfacing to the user is. Now looking at the decision document and there I'm trying to see there's every decision has a status and then encoding and a choice. I guess this is making me think that we're going to need a relational database soon. The encoding can be rehearsed, and it seems to me like a rehearsal is its own entity, and like you could have multiple rehearsals and decisions get pointed at each one, and I'm not sure where we're keeping the rehearsal entity. In this document or if we need to I don't even know. 

2026-06-25 16:39 - I tried the rehearsal. Yeah, it's nice. Let's see dump feedback. I guess maybe I'll try iterating on the rehearsal 
