---
observed_at: 2026-06-06
type: dogfood
decision_flow_target: decision-mode
dogfood_target: ytmd
target_repo_state: greenfield; mkdir + git init only
surface: Codex CLI
input_mode: voice-to-text brain dump
session_focus: first DECISION.md creation; note-shape decisions; transcript-source spike
tags: [markdown-density, next-step-affordance, spike-affordance]
---

I `mkdir ytmd` and `git init` in there and started codex. then this

> $decision-mode ytmd means youtube to markdown. I wrote up a little thing a while ago I think it talks about obsidian and yeah I guess that sort of yeah this captures a lot of what I'm doing anyway let's kick off a decision mode and this is a completely greenfield repo so yeah lets go
>
> ### YouTube transcript to Obsidian quickly
>
> I'm finding more and more that there's a number of creators that are only dumping things onto YouTube and I think that some of those things are valuable but I just hate dealing
> with the YouTube algorithm and I also want to like surface it to my agents and Google is sort of like hoarding the YouTube transcripts in a way that makes it difficult for other
> AI agents to get at them and I just hate using Gemini. so I want a tool for me to like quickly rip down the transcripts of, and maybe the metadata around YouTube videos in
> particular. And I know that there's an API for this in Python that I already researched called `youtube_transcript_api`. probably gets me like 90% of the way there, but I want
> to be able to integrate this into my sort of Obsidian notes workflow right now and so Yeah, I'm thinking about Setting this up in a way that lets me easily pull stuff into
> Obsidian really quickly.

And then codex dumped out a very long new `DECISION.md` quite qucikly

```md
# YouTube Transcript to Obsidian

Quickly pull YouTube transcripts and video metadata into Obsidian-friendly Markdown. Avoid YouTube algorithm friction; make useful creator content available to local notes and agents.

**Criteria**
- HIGH - Fast personal workflow
- HIGH - Obsidian-ready Markdown output
- HIGH - Agent-readable local files
- HIGH - Minimal friction from URL to note
- HIGH - Use `youtube_transcript_api` if sufficient
- LOW - Polished public product
- IGNORE - Gemini workflow

## First Workflow Shape

How should `ytmd` fit into the user's Obsidian workflow?

**Options**
- CLI writes Markdown file into vault
  - PRO - Lowest friction for greenfield
  - PRO - Scriptable by agents and shell
  - PRO - Easy to point at vault folder
  - CON - Requires terminal or launcher wrapper
- Obsidian plugin
  - PRO - Native UX inside notes
  - CON - More moving parts before validating core flow
- Local web app
  - PRO - Friendly URL paste UI
  - CON - Less direct for agent workflows
- Python library only
  - PRO - Reusable internals
  - CON - Does not solve quick capture by itself

## Note Shape

What should the generated Markdown include?

**Options**
- Transcript plus compact frontmatter metadata
  - PRO - Useful immediately in Obsidian
  - PRO - Easy for agents to parse
- Transcript only
  - PRO - Simplest
  - CON - Loses source context
- Full research note with summary/prompts
  - PRO - Higher-value note
  - CON - Requires AI dependency and more decisions

## Transcript Source

How should transcripts be fetched reliably?

**Options**
- `youtube_transcript_api`
  - PRO - Already researched; likely 90 percent path
  - PRO - Python ecosystem fit
  - CON - Need verify limits, language handling, failures
- YouTube Data API
  - PRO - Official metadata path
  - CON - API keys and quota
  - CON - Transcript access likely not enough
- Browser/session scraping
  - PRO - Might bypass some restrictions
  - CON - Fragile and heavier

**Jobs**
- TODO - Research - For Transcript Source, verify current `youtube_transcript_api` behavior, install/API shape, failure modes, language support, generated transcript handling; synthesize into `DECISION.md`.

## Packaging and Runtime

What runtime and packaging should greenfield `ytmd` use?

**Options**
- Python CLI package
  - PRO - Matches `youtube_transcript_api`
  - PRO - Easy transcript fetching path
- Node CLI package
  - PRO - Familiar for Obsidian plugin future
  - CON - Transcript dependency less direct
- Hybrid Python core plus later Obsidian plugin wrapper
  - PRO - Keeps future native UX open
  - CON - Extra boundary if done too early

```

brain dumping - yeah, so at first I felt a little overwhelmed, right? Like in that it wrote a whole lot of lines based on a pretty short prompt. But now looking over the prompt and I'm looking over the lines and I feel like yeah it kinda got everything. Like those are all things I said. But I wonder, yeah now I'm worried that markdown is going to be, I don't know this feels a little bit like cognitive offloading or the AI writing way too much. it strikes me that having a sort of collapsible UI early might be important. we're Yeah, it's tricky it's tricky. wondering, maybe I just plow forward and see how this works, because I know, I guess what I imagined was that decision mode would make much smaller edits at a time, but I guess I dumped a lot of information on it at once with a brain dump which, you know, for instance I'm doing now and I really like to do... maybe I just plow through it and try. See how it feels. I want to register that if a user initially starts with a big old brain dump, that it may feel, I don't know, like the AI is writing too much. the user feels less in charge of steering. maybe an important part of the user experience is to front load more of those decision lists that I have in my example script. it's tricky, maybe I want to record like basically everything I said and just like pull it apart. but I feel like I probably want But I feel like I probably want, maybe if I switch it to, to like a rendered markdown view... and that's a little bit easier to parse maybe an important part is looking at it Still it's really dense. like all that, all that seems right, that I'm looking at it and everything I wrote down, I feel like that's really close to what I said. wow, prose is really dense. this does make me feel like the collapsed view is gonna be really important really early cause it is just gonna be completely overwhelming for a user to look at this massive file... let's plow forward. Try to ignore the massiveness of the file and see how far I get

oh let's look at the conversation. codex said

> Created DECISION.md with the goal, criteria, main questions, and a focused research TODO for youtube_transcript_api.
>
> My suggested first tentative direction:
>
> Build a Python CLI that takes a YouTube URL and writes an Obsidian-ready Markdown file into a configured vault folder.
>
> That matches the dependency you already found, keeps the repo simple, works well with agents and shell workflows, and doesn’t rule out an Obsidian plugin later.
>
> Next high-leverage decision:
>
> 1. Workflow shape: confirm Python CLI as the first version.
> 2. Note shape: decide frontmatter fields and transcript formatting.
> 3. Transcript source: verify youtube_transcript_api current behavior and failure modes.
>
> I’d focus next on Note Shape, because once the Markdown contract is clear, the first implementation path gets pretty straightforward.

yeah, this feels really sensible yeah. Maybe this is really good. Okay. I do feel like I'm driving here. it's a little wordy. I'm inclined to the last line I'd focus on, note shape. It's a little funny. Maybe what I, I think I want the AI to be a little less pushy. I think the instructions should say something like when you offer up the next steps, just order them in what you think is a good order. You don't need to then push it like the order is implicit. Then, yeah, there's this question of whether or not we should. Like other steps are like add more open questions or just do something completely different. should we always offer an affordance that's like, you don't have to choose one, two or three. You can do your own thing. I mean, we know that that's true and maybe having like pushing people to do voice-to-text, that's a good way. I'm going to keep trying with voice-to-text. let's think maybe a good thing to remember is that maybe lean back on the pushiness a little bit and allow the suggested next step to implicitly be the first thing in the list. one consideration is that it leaves out the Y, which is nice. Yeah. I think I just need to use this more.

one mitigation I'm considering so we're right so we're using Markdown which is sort of a combination of data recording and also display so it's kind of it's kind of conflating or mashing together model in view. so we could either dive into actually separate model and view. Do a more simple, generic kind of, or like a shortcut fix for now, which would be like offload to a log. so we can have something like `DECISION-TRIAGE.md` and `DECISION-LOG.md`, and as decisions get made or at least coded into the implementation maybe, we put them into the decision log. We offload them that way there's a record of them but they're hidden from the user and so there's less like in the triage view there's less to stare at. maybe we need something like `DECISION-DETAIL-{slug}.md` or just `D-{SLUG}.md` for when the triage file gets too big... this may be trying to over engineer too much into the markdown files and maybe the correct move there is to separate model and view either with JSON-L or a legit database. dig into Steve Yegge's what he's evolving beads into which is some sort of I forget the version controlled DB... yeah I probably need to pull back from the heavyweight mechanics maybe it's okay to have triage and log. maybe `docs/decision/triage.md` and `docs/decision/log.md`... Yeah yeah okay let's just plow forward with as is on `ytmd` and see how it feels...

okay, I've been working a few more conversation turns. We've been focusing on the, like the note shape and the transcript formatting kind of the timestamps. Here I'll clip out a little snippet

```md
## Note Shape

What should the generated Markdown include?

**Criteria**
- HIGH - Durable source document
- HIGH - Easy for agents to parse and cite
- HIGH - Human-readable transcript
- HIGH - Preserve source URL and fetch context
- LOW - AI-generated interpretation in v1

**Options**
- Transcript plus compact frontmatter metadata
  - PRO - Portable Markdown source note
  - PRO - Easy for agents to parse
  - PRO - Keeps AI summarization optional later
- Transcript only
  - PRO - Simplest
  - CON - Loses source context
- Full research note with summary/prompts
  - PRO - Higher-value note
  - CON - Requires AI dependency and more decisions

**Decision**
- DECIDED - Transcript plus compact frontmatter metadata
- Leaning SURE
- Why - Durable Markdown source note first; agent-readable; AI interpretation can layer on later

## Transcript Formatting

How should transcript text appear inside Markdown?

**Options**
- Timestamped chunks
  - PRO - Good citations and navigation
  - PRO - Preserves transcript structure
  - PRO - Fixed-width timestamps improve scanning
  - PRO - `MM:SS` for most videos; `HH:MM:SS` only when needed
  - CON - More visual noise
- Clean paragraphs with optional timestamps
  - PRO - More readable as prose
  - CON - Harder to cite exact moments
- Raw transcript items
  - PRO - Maximum fidelity
  - CON - Least pleasant to read

**Decision**
- DECIDED - Timestamped chunks with duration-aware fixed-width timestamps
- Leaning SURE
- Why - Keeps citation/navigation value while making transcript easier to scan; prefer `MM:SS` under 1 hour, `HH:MM:SS` for longer videos
```

I guess what's interesting is the AI then made the edits, changed it, tweaked my preferences. It had already written that this was decided and then I asked for a little tweak and it did tweak it and then it just kind of stopped and didn't suggest a next step. here's the quote

> User: I think it was slight preference to make that contingent on whether or not it's longer than an hour Just minutes and seconds if it's under an hour which is most most videos

Agent did some edits

> Agent: Updated.
>
> Timestamp decision is now:
>
> -   Use fixed-width timestamps.
> -   Use MM:SS for videos under 1 hour.
> -   Use HH:MM:SS for videos 1 hour or longer.
>
> Example:
>
> [00:03] Short video opening...
> [07:14] Main point...
>
> [01:05:09] Long video timestamp...

And yeah so my question here is do I want the agent to drive to the next decision? Feels like it kind of went back into like code editing mode and forgot that it's in decision mode. Like I want some options to do next so maybe it's important to put really clear instructions like always present next options. we're zoomed in on the transcript formatting now except that we marked it as decided so when we mark as decided do we immediately zoom back out? Yeah I think we do. maybe we need to tweak the SKILL.md instructions...

I cued it to suggest the next decision and it was like let's fiddle with the front matter and I think what it's missing and I'm pushing in my own judgement and maybe this is fine because it's like human judgement the whole point of this is that human engineers have judgement. I, what did I say? I wrote this

> I'm wondering if we should get a POC first. make sure that we can pull these transcripts. because if we can't the whole project is a bit kaput right? should we drive toward a minimal POC?

and yeah, this is like a high leverage thing and is it a decision? Yeah, I'm wondering if this this fits into the whole IBIS, QOC, decision flow framework... It feel like XP. Dash off POCs quickly to prune the possibility space... is it going to be the responsibility of `decision-mode` to make that judgment call? That's a tough question. we put it in, like, I think we put in a suggestion that if some assumptions seem to lean on… some things seem to lean on shaky assumptions. I mean, yeah, this is the whole point of The Spike. Yeah, yeah, yeah, yeah. Oh and what did it do? Let me look.

> Yes. That’s the right next step.
>
> I updated DECISION.md to make the next move a minimal transcript-fetch POC before more Markdown/frontmatter decisions.
>
> The POC should be very small:
>
> ytmd-poc "https://www.youtube.com/watch?v=..."
>
> And only prove:
>
> -   Can parse URL/video ID.
> -   Can call youtube_transcript_api.
> -   Can fetch transcript chunks.
> -   Can print timestamps + text.
> -   Can report clear failure modes.
>
> No Markdown file generation yet, no Obsidian, no metadata polish. Just answer: does the transcript access path work for real videos?
>
> A sample YouTube URL from the kind of creator/content you care about would make the spike much more meaningful.

and then edited

```md
## Transcript Source

How should transcripts be fetched reliably?

**Options**
- `youtube_transcript_api`
  - PRO - Already researched; likely 90 percent path
  - PRO - Python ecosystem fit
  - CON - Need verify limits, language handling, failures
- YouTube Data API
  - PRO - Official metadata path
  - CON - API keys and quota
  - CON - Transcript access likely not enough
- Browser/session scraping
  - PRO - Might bypass some restrictions
  - CON - Fragile and heavier

**Jobs**
- TODO - Spike - Build minimal POC that accepts a YouTube URL/video id and prints fetched transcript chunks; answer whether `youtube_transcript_api` can pull real transcripts before deeper Markdown decisions.
- TODO - Research - For Transcript Source, verify current `youtube_transcript_api` behavior, install/API shape, failure modes, language support, generated transcript handling; synthesize into `DECISION.md`.

**Decision**
- DECIDED - Drive a minimal transcript-fetch POC before more note-shape detail
- Leaning SURE
- Why - Transcript access is existential; Markdown/frontmatter decisions only matter if fetching works
```

yeah, this is, this just seems right. correct analysis. this is good. It just seems to be missing the little affordance, affordance? Little directive like push the user to spike on existential proof of concept assumptions, something like that, right?

good, good, good. Yeah.

and then, yeah, how do we spike and how do we research...

wait, no. Okay, now I'm looking and honestly, I think it's diverging from my mental model. like, so it's marked the transcript source as DECIDED in Leaning SURE. but it's not. because we have open jobs to do and a spike is not a decision, a spike is evidence to drive towards the decision. so I think we need to get that into the skill better. Okay, I feel like this is probably good enough user to experience, my personal dogfooding user experiential stuff. only time to iterate on the skill MD. I'm not sure let me let me let's discuss a little bit so one thing i'm a little worried about here is the peter steinberger objection which is that i'm layering on a bunch of silly uh ceremony and i shouldn't have done that like this is just creating a mess um and we could have gotten to these answers much much quicker... saying that that objection is fatal or I even agree with it. I mean, there's a little bit here where I feel like I'm in control of the decision making process. wow, yeah, I'm finding this Markdown file quite overwhelming. It's huge, and the AI is writing a ton of stuff, and it feels a little bit more like the AI is driving than I am driving, maybe. then with another consideration and i'm wondering if I should compare this feeling this feel of working here with right there's the Steinberger method which is like just talk to it and then there's the Matt Pocock method which is like the i think his very simple `grill-me` skill.

 wondering if I should just straightforwardly test the exact same thing that I just did with the YouTube to mark down Obsidian kind of prompt with Grill Me and with a more basic Steinberger approach and then whether I should be iterating on the skill. Yeah let's discuss that first like which of these is the most fruitful thing to pursue next
