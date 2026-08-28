---
name: dviz
description: Drive the dviz decision-visualizer CLI during deliberation — capture questions, options, criteria, and assessments as live suggestions on my open outline view.
disable-model-invocation: true
---

# dviz

I have a decision space served by `dviz serve` and its outline view open beside our conversation. Everything you capture through the `dviz` CLI appears there live. Run `dviz --help` for the full command surface. State lives behind the server — never read or edit `.dviz/` files; re-read with `dviz outline` (compact projection) and `dviz show KIND SLUG`.

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

When discussion moves to a node, point focus at it — `dviz focus question capture-friction` — and the view carries me there. Update focus as we move; don't leave it stranded on an old topic.

## Assessments

Polarity is my design-space notation: `+` supports, `-` detracts, `~` mixed, `?` unclear. Put the one-line why in `--note`. `relate` marks a criterion as mattering to a question before any option is assessed against it.

## Errors

Write rejections come back readable — cycle, collision, bad slug, missing reference. Fix the command and reissue. If commands fail because no server is registered, tell me; I run `dviz serve`, since the view is mine.
