---
name: dviz
description: Drive the dviz decision-visualizer CLI during deliberation — capture questions, options, criteria, and assessments as live suggestions on my open outline view.
disable-model-invocation: true
---

# dviz

I have a personal library served by `dviz serve` and its view open beside our conversation. Everything you capture through the `dviz` CLI appears live in its target space. Run `dviz --help` for the full command surface. State lives behind the server — never read or edit `.dviz/` files (including `~/.dviz/`); re-read with `dviz outline --space SLUG` and `dviz show KIND SLUG --space SPACE`.

## Bind this conversation to a space

Use `dviz space list` to discover maps. Establish which named space this conversation is working in; ask if the intended target is ambiguous. Pass `--space SPACE` on every graph command. A conversation-local `DVIZ_SPACE` is also supported, but do not set a global shared active space or change shell startup files. Browsing another map does not change our target: keep writing to this conversation's space unless I ask to switch.

When asked to create a map, use `dviz space create SPACE "Title"`; `dviz space open SPACE` prints its browser link. Share that link so I can open it. Space slugs follow the same format as node slugs and must be unique across the library. Space titles are readable labels. The sidebar's selected map is not an agent-routing signal.

Existing repo-local maps can still be targeted with explicit `--db PATH` instead of `--space`; never combine the two modes or migrate saved maps without asking.

## Suggest, never settle

Everything you create lands as `suggested` and renders dotted until I accept it. Capture freely — questions, options, criteria, assessments, placements — but `accept`, `lean`, `decide`, `reopen`, and `remove` are my verbs: issue them only when I say so in conversation, never from your own judgment of where we netted out.

## Slugs are our shared vocabulary

A node's slug is the one handle we both use — you in commands, me in speech, the view in chips. Mint slugs short and recognizable in a left-anchored column.

- Mint for meaning, not enumeration: no `option-1`/`option-2`; digits only when they are part of the name (`v0`, `oauth2`).
- Split when one word starts carrying two meanings (`trust` → `user-trust`, `agent-trust`).
- Rename early, rename rarely: fix a bad slug the moment it grates (`--slug NEW` on update), but leave a slug alone once it is in shared use.
- A collision or format rejection means mint a better name and retry — never suffix.

Refer to an option outside its question as `question-slug/option-slug`.

## Keep focus with the conversation

When discussion moves to a node, point focus at it — `dviz focus question capture-friction --space SPACE` — and the view carries me there. Update focus as we move; don't leave it stranded on an old topic.

## Assessments

Polarity is my design-space notation: `+` supports, `-` detracts, `~` mixed, `?` unclear. Put the one-line why in `--note`. `relate` marks a criterion as mattering to a question before any option is assessed against it.

## Errors

Write rejections come back readable — cycle, collision, bad slug, missing reference. Fix the command and reissue. If commands fail because no server is registered, tell me; I run `dviz serve`, since the view is mine.
