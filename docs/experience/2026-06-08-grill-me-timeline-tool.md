---
observed_at: 2026-06-08
type: dogfood
decision_flow_target: decision-mode
dogfood_target: grill-me-on-timeline-tool
target_repo_state: essentially empty greenfield repo; skills only; no app scaffold
surface: Codex Mac app
input_mode: voice-to-text brain dump
session_focus: comparing Grill Me against Decision Mode; leaving options open as prototype variables; web research nudges; transition from intention extraction to prototype handoff
tags: [external-skill-comparison, grill-me, handoff, open-options, prototype-variable, spike-affordance, timeline-tool, web-research-affordance]
---

2026-06-08 13:15 - brain dumping - okay, so I'm trying out Matt Pocock's Grill Me skill. The raw `grill-me` one, not the skill `grill-with-docs` yet. I tried on my timeline too prompt straight fresh out of my head here's what I said

> [$grill-me](/Users/warrenwhipple/code/warrenwhipple/timeline-tool/.agents/skills/grill-me/SKILL.md) Hey, so I want to create a, kind of like a web interactive page that's a timeline This thing fairly often where I like review a bunch of events or blog posts or releases or something like that And like list them out as a timeline. And I think it would be really fun to easily display these in an interactive webpage So I thought I would try prototyping a web page I figured that I don't want to make a complete tool for it, like this is mainly going to be a kind of example web page. But I want to make it modular enough so it would be easy to fork it out and pull in other data So the sort of like timeline events and metadata should be kind of encapsulated and easily hot swappable But I really wanted to focus in on the core web page I did some research before to see if there was anything out there that felt like what I wanted and I didn't find existing projects yet that were like very close at all to what I wanted So I think we go with prototyping it, though I'm happy to lean heavily on existing libraries if they feel super helpful. I just don't know which ones to use My best experience of building things is in React and honestly in single page web apps But I'm open to other suggestions here if you think it's better, and I'm guessing this sort of thing would be hosted on eventually on GitHub pages or maybe on Vercel if I need to do that But yeah open to other suggestions maybe just be on like a raw HTML page I don't know

And you know, because GrillMe is super tiny. It's being very much driven by the AI model, which is ChatGPT. I'm trying it on, what is it? This is inside the Mac codex app. So it's kind of a GUI, but it's mostly a conversation. And I'm on GPT 5.5 high. It's good. It's very fun. We're on, where are we, we're on question six and it's going great. I like, I like his skill. It feels like it's asking me important questions that super tiny whatever prompt like walk me down the decision or design tree or something seems really smart. It did, it was a with codex Mac app, it was able to like do some searching. I think I kind of suggested that we should search during the conversation and it went out and gave me three links to look at and it was helpful. I clicked through them and I liked that. Like it was easy to like nudge it to say let's do some web research here even though it's not built into the skill. Now that we're on question six like here here's like the place that we got to so far which I think was helpful and interesting was that an important thing in my mind right right so this Grill Me skill is really based around intention extraction where this skill that I have in mind which I call decision mode is partially intention extraction but is it wants to also be like spiking right or trialing or prototyping and Grill Me sort of is just almost purely intention extracting and I had to like prod it to go out to the internet but maybe that's fine maybe that's like you know expert users should do that I have to think on whether or not decision flow is supposed to be for like a skilled expert user or if it's like so guiding that it like pushes you to do important things like web research I think it does push you. anyway yeah it's easy to get grill me to push you to do web research and it just happens in line without any affordances at least with the Codex Mac app but here, here's a thing that Grill Me is asking through Codex:

> Sixth question: how should dense timeline events behave visually: **always visible as compact marks/cards**, or **mostly marks that expand into cards only when relevant**?
>
> My recommended answer: **mostly compact marks, with cards appearing for active/highlighted/hovered events**.
>
> For the sidecar to stay dense and useful, I'd avoid rendering every event as a full card all the time. A better model:
>
> -   Every event is visible as a small mark on the vertical time rail.
> -   Important events can have tiny labels even when inactive.
> -   The active beat highlights a subset of events and expands those into compact cards.
> -   Hover/tap on any mark previews that event.
> -   Filtering dims or hides non-matching events, depending on density.
>
> That gives the timeline the "history at a glance" feeling without becoming a stack of cards that just duplicates the article.
>
> Do you want events to default to compact timeline marks, with cards only for active/highlighted/hovered events?

and I guess what I want to point out is it feels like this is like reading the suggestions like always visible versus expanding cards. I don't know the answer to that right? Like this feels like something we should spike or or A/B test or something like that right. Myself, we should do two prototypes, something like that. And the problem with the Grill Me skill is it's not suggesting we do that, it's just suggesting like you know the answer to this, just say it. and I don't know the answer to this, so I think an important thing that GrillMe is missing, which I am feeling now, is that it doesn't really give you the ability to leave options open. Maybe I just say that to GrillMe. I'll try it

...

Okay, I did it and Here's an interesting thing. So then it right, so I said

> I actually don't know the answer to this question. And I kind of wanna test both, so rather than make a decision right now

And Codex grill me said

> Good. Then we should treat that as a prototype variable, not a settled design decision.
>
> Seventh question: should the first spike include a **view-mode toggle** between "marks" and "cards," or should we build only one mode first and leave the other as a later experiment?
>
> My recommended answer: **include a simple view-mode toggle in the first spike**.
>
> Reason: this is one of the core unknowns, and it's cheap to test if we make the renderer modular. The data model can stay the same; only the timeline presentation changes:
>
> -   **Marks mode**: dense rail, labels/cards only for active events.
> -   **Cards mode**: compact chronological cards all visible, with active events emphasized.
> -   Same beat-driven state powers both.
>
> This will answer a real product question faster than arguing it abstractly.
>
> Should the first prototype include both "marks" and "cards" timeline modes behind a toggle?

and then I just assented to that suggestion. Like, okay, put in a toggle. now I'm thinking to like what decision flow would do. Decision flow instead would write into the decision.md file that there are two options here at least, maybe three, and that it's undecided. and like in fact it would probably be like expands doesn't expand and some toggle. like built-in optional expand. And I don't know which of those is actually better. Maybe the one where you just build in the option is fine and then you can rip it out later. Code is cheap, blah blah blah. Yeah, so this isn't like obvious win for decision mode over Grill Me. Like, Grill Me seems fine here in this place. do you like that decision mode sort of prods you to leave things open while grill me hasn't yet? I feel like I surprised it like surprise I want to leave this open and it was like oh okay yeah I guess we could do that. Sure. and the whole point of decision flow is to like allow things to be left open and something yeah it is and yeah I feel like if that's really important to you you could just fix Grill Me to say don't force the user to always make a decision allow them to leave certain design decisions open for prototyping... Bam. Grill me is fixed and we don't need decision flow sorry i'm being facetious but the one i don't want this to be my only complaint about Grill Me is it doesn't let you leave options open because that seems like a super easy fix for grill me and not a clear decision mode win.

...

did some more, we're on question 13. I don't mind it. Here's the thing I just wrote

> Seems fine? I don't know, is that hard to do? Yeah, okay, end date. Yeah, yeah, ranges seem fine. How far do you think we are from prototyping? I feel like maybe we should hone in on a prototyping feel. What do you think? If you think there's more design questions that need to be nailed down before we can jump into a prototype? I'm open to that

okay, it agreed to doing a prototype now which is good. That's what I wanted it to do. it asked me a very core question, like, you know, what should we implement this in and suggested Vite React, which is, I think, a great suggestion. so, yeah, I have this feeling like, oh, what if I don't wanna commit, right? But I think it's great for a prototype. and then Matt's method he has these skills like `to-prd` and and maybe something about tasks or, I don't know, he has a type, test-driven development. He has a `prototype` skill, I think? did I try these things? I guess we yeah to get the full view. I guess what I should do is a handoff right? Okay I said

> [$handoff](/Users/warrenwhipple/code/warrenwhipple/timeline-tool/.agents/skills/handoff/SKILL.md) great those all sound good. let's do a prototype handoff to a side agent. I'll try it and come back.

And Codex created a handoff in my system tmp folder

<handoff-doc>

# Timeline Tool Prototype Handoff

## Purpose

Build a first interactive prototype for a narrative-driven timeline page. The user wants something that accompanies a blog-post-style essay: the article remains the main attraction, while the timeline is a dense sidecar that helps readers understand event ordering, spacing, and context.

This is not a slideshow, carousel, or TimelineJS-style slide deck. The user explicitly disliked TimelineJS because it feels like a carousel with a timeline attached. They also disliked the ArcGIS StoryMaps + TimelineJS pattern because the story lives in slides. The desired product is closer to a blog post with a coordinated interactive timeline viewport.

## Current Repo State

Workspace: `/Users/warrenwhipple/code/warrenwhipple/timeline-tool`

The repo is essentially empty. Current files observed:

- `skills-lock.json`
- `.agents/skills/grill-me/SKILL.md`
- `.agents/skills/handoff/SKILL.md`
- `.git/`

No app scaffold exists yet.

## Resolved Decisions

- Build a read-only viewer/prototype, not an authoring tool.
- Use a narrative-driven page, not a standalone timeline viewer.
- Use Vite + React + TypeScript.
- Build a single-page spike before worrying about deployment.
- Use a desktop split layout: article/narrative pane plus timeline sidecar.
- On mobile, use a single-column responsive layout. Exact mobile interaction is still a design variable, but it should preserve the idea that reading focus drives timeline context.
- Structure the article as explicit narrative beats, not arbitrary paragraph-level tracking.
- Reading focus controls the timeline sidecar.
- Arrow keys should move focus beat-by-beat.
- Normal scrolling should also update the active beat using a visible reading/focal indicator.
- The first sample dataset should be about the history of web publishing/blogging tools.
- Use about 30 events so density, filters, highlighting, and timeline modes can actually be tested.
- Include a toggle between two timeline render modes:
  - Dense marks mode: events are compact marks on a vertical rail, with cards/labels for active, important, hovered, or highlighted events.
  - Cards mode: compact chronological cards are visible, with active/highlighted events emphasized.
- Include tags and categories as clickable filters.
- Events should support optional date ranges via `endDate`.

## Data Model Direction

Keep the model generic enough to hot-swap datasets while still supporting the UI.

Suggested TypeScript shape:

```ts
export type TimelineEvent = {
  id: string
  title: string
  date: string
  endDate?: string
  summary: string
  tags: string[]
  importance: 1 | 2 | 3
  category?: string
  url?: string
}

export type TimelineCategory = {
  id: string
  label: string
  color: string
  icon?: string
}

export type NarrativeBeat = {
  id: string
  eyebrow?: string
  title?: string
  paragraphs: string[]
  timelineState: {
    highlight?: string[]
    filterTags?: string[]
    filterCategories?: string[]
    dateRange?: [string, string]
  }
}
```

Important nuance: `category` is optional. The renderer should treat missing category as an internal uncategorized/default style, not force authors to invent a category. If category is present, it gives the UI a styling hook for color/icon/legend. Tags are the main semantic/filtering tool.

Do not add generic `metadata` in v1. It has no concrete UI job yet.

## Prototype Scope

Build enough to feel and evaluate the concept:

- Narrative article pane generated from explicit beats.
- Timeline sidecar driven by active beat state.
- Clear visual indicator for the active beat in the article.
- Scroll tracking: update active beat based on which beat is closest to a reading focal line.
- Keyboard navigation: up/down arrows move beat focus.
- 30-event web publishing/blogging timeline dataset.
- Beat definitions that reference event IDs, tags, categories, and/or date ranges.
- Clickable event tags/categories that toggle filters.
- View-mode toggle for marks vs cards.
- Desktop split layout.
- Mobile responsive layout.
- No editing UI.
- No persistence.
- No TimelineJS dependency.
- No deployment setup unless trivial after the spike is working.

## Visual/Interaction Intent

The timeline should feel dense and referential, not like a second article. Timeline cards should be compact. The sidecar helps the reader see statements like "this came before that" or "these ideas were surprisingly close/far apart in time."

The article should read like a normal blog post. The timeline illustrates and responds to the current narrative beat. Inline explicit buttons are acceptable as secondary controls, but the primary interaction should be reading focus.

Avoid over-explaining the UI in visible app text. The prototype should be usable through layout, affordances, and compact controls.

## Research Notes

The prior discussion looked briefly at:

- TimelineJS: useful reference for embeddable JSON/spreadsheet timelines, but rejected as a direct fit because it behaves like a slide deck.
- ArcGIS StoryMaps + TimelineJS: shows the narrative + embedded timeline pattern exists, but still slide/block-oriented rather than a blog sidecar.
- Microsoft Timeline Storyteller: conceptually relevant for event data, filtering/highlighting, scenes, and timeline narratives, but too much like a visualization authoring system for this lightweight blog companion.

Conclusion: build a custom lightweight React prototype. Borrow the broad scrollytelling idea, but keep the narrative as a blog post and the timeline as a coordinated sidecar.

## Open Questions To Resolve By Prototyping

- Whether dense marks mode or compact cards mode feels better for the sidecar.
- How aggressive filtering should be: hide non-matches vs dim them.
- Best mobile layout:
  - Interleave timeline snippets after beats.
  - Or use a compact sticky timeline/status panel.
  - Or allow a timeline drawer.
- How the focal line should behave during free scrolling on large screens.
- Whether categories need a visible legend in v1.

## Suggested Skills

- Use `browser:control-in-app-browser` after implementation to open the local Vite app and verify desktop/mobile layouts with screenshots.
- Use `grill-me` only if the agent needs to resume design questioning; otherwise proceed with the prototype because enough decisions are settled.
- Do not use `handoff` again unless preparing another transfer.

## Suggested Implementation Plan

1. Scaffold Vite React TypeScript in the repo.
2. Create generic timeline/narrative types.
3. Create sample web publishing dataset with roughly 30 events.
4. Create narrative beats that drive timeline state.
5. Implement active beat tracking via IntersectionObserver or scroll position measurement.
6. Implement arrow-key beat navigation.
7. Build timeline sidecar with mode toggle.
8. Add clickable tag/category filters.
9. Style desktop split layout and mobile responsive layout.
10. Run lint/build.
11. Start dev server and verify in browser.

## Final User Intent In One Sentence

Prototype a React single-page blog article where explicit narrative beats control a dense interactive timeline sidecar, using a 30-event web publishing history dataset and a toggle between marks and cards views.
