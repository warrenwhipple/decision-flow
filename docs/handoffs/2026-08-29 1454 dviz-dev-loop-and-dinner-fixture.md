# Handoff: dviz dev loop + dinner-party fixture

2026-08-29 1454. Agent-generated handoff from a conversation with Warren. Intended for a fresh Codex session. High level on purpose — Warren will read and correct before it is acted on.

## Goal

Get the `bun dev` feeling for iterating on the dviz UI: edit `app.tsx` or `styles.css`, save, see the outline repaint with state intact. Plus a way to load known UI states without driving them through the CLI. Keep it as light as possible; this is inside the 20-hour visualizer timebox.

## Current state

`dviz serve` runs `Bun.build` once at startup (`buildView()` in `src/server/server.ts`) and serves the frozen `app.js` and `styles.css` from memory. Every UI change is kill, restart, refresh. `index.html` references `/app.js` and `/styles.css`. There is already a `window.__DVIZ_DEMO_SNAPSHOT__` hook in `app.tsx` that, when present, puts the view in "demo" connection mode and skips the SSE subscription.

## Decisions (settled with Warren)

- Use Bun's built-in fullstack dev server. Import `index.html` and pass it to `Bun.serve` via `routes`; let Bun bundle the `.tsx` and `.css` the HTML references. Enable `development: { hmr: true, console: true }` in dev mode so React state survives edits and browser console output echoes to the terminal (useful for agents).
- Change `index.html` to reference `./app.tsx` and `./styles.css` directly. Drop the hand-rolled `buildView()` and the `/app.js` / `/styles.css` handlers if the HTML import covers non-dev mode too (Bun bundles once at startup when development is off). Prefer one code path over two.
- Existing `/api/*` and SSE handlers stay in `fetch` untouched. Only `/` moves to `routes`.
- Add a `dev` script, roughly `bun --hot run src/cli/index.ts serve --dev` (or gate on `NODE_ENV`). Exact flag is the implementer's call.
- No Storybook. No Playwright / browser MCP for now. Revisit only if the loop above leaves a specific itch.

## Fixtures

- One hand-written fixture, loaded via URL: `?fixture=dinner`. Served as the demo snapshot (the existing `__DVIZ_DEMO_SNAPSHOT__` path), so the view shows "demo" and does not subscribe to SSE.
- Domain: planning a dinner party. Chosen because it has a real hierarchy, a natural DAG, reusable criteria, short option names, and no vocabulary overlap with this repo or the schema (avoid words like question, criteria, focus, flow, space, edit, outline, view, server, agent in the fixture content).
- The fixture must contain at least one of everything the view renders:
  - A dozen or so questions in a hierarchy: menu (main → protein, sides; starter; dessert), drinks, seating, timing.
  - One question with two parents, e.g. "which wine" under both "main course" and "drinks", to exercise transclusion (canonical appearance under first parent, "also under X" elsewhere).
  - A mix of open, leaning, and decided resolutions, with leaning/decided pointing at an option.
  - A few suggested (not yet accepted) entities and edges, so dotted rendering shows up.
  - Global criteria reused across many decisions: cost, prep time, make-ahead, dietary, seasonality, wow factor. Assessments using all four polarities.
  - Focus set on the main course, so focus-follow has an obvious target.
- Other shapes are derived in code, not hand-written: `?fixture=dinner&shape=empty|single|all-suggested|big`. Each is a small transformation of the base fixture (drop everything; keep the first question; set every acceptance to suggested; clone the tree a few times with a suffix). Don't build these up front — add each when it is needed.
- Connection states (connecting / offline / live) come from the SSE lifecycle, not the snapshot, so the fixture can't cover them. If that indicator ever needs iterating, a `&connection=` override is the same trick, but not now.

## Not in scope

Storybook, component-level playgrounds, Playwright or screenshot tooling, a fixtures folder of multiple JSON files, any change to the schema or the CLI surface.

## Things to watch when implementing

- The HTML-import route and the custom `fetch` handler both wanting `/`. Route wins; keep the rest in `fetch`.
- HMR plus the view's own SSE reconnect logic may double-connect after a hot edit. Check the connection indicator after the first few saves.
- Fixture loading should be a dev convenience, not a production feature: fine to only honor `?fixture=` when the server is in dev mode.
