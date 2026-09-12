# Handoff: dviz Linear-style theme and layout

2026-09-12 1200. Agent-generated handoff from a conversation with Warren. Intended for a fresh agent session. Detailed on purpose so the implementer does not need to re-scan the repo. Read `docs/DESIGN.md` first for the design rules this plan applies.

## Goal

Restyle the dviz visualizer (`dviz/src/view/`) to follow the design rules in `docs/DESIGN.md`: color carries information not style, a dimmer collapsible left nav with the main content on the right, structure from a surface ladder and hairline borders instead of shadows, one sans typeface with hierarchy by weight, and light + dark themes.

## Decisions (settled with Warren)

- Keep the current full-width swap between `Outline` and `DecisionView`. No right-hand detail column.
- Drop the Georgia serif entirely. Inter / system sans only. Hierarchy by weight (500 / 600), tight negative tracking on large headings, monospace for slugs and codes.
- Light and dark mode. Follow the OS via `prefers-color-scheme` by default. Add a manual system / light / dark toggle persisted in `localStorage`.
- The space sidebar (`.space-sidebar`) becomes collapsible to a narrow rail.
- Keyboard commands (command palette, go-to sequences) are deferred. Do not build them.

## Rules from the spec that must survive

From `docs/visualizer-v0-spec.md`, "View" section:

- Slug chips lead every card. Question, option, and criterion chips stay visually distinct.
- `suggested` = dotted outline at every appearance.
- Resolution glyphs ○ ◐ ● stay legible. Decided / leaning / open get distinct colors.
- Layout stability. New cards insert, nothing reflows. No motion that moves content.

## Current state

- `dviz/src/view/styles.css` (720 lines). Plain CSS. No CSS custom properties. Every color is a literal hex or rgba. Warm sage palette, green radial page wash, card drop shadows, hover lift, Georgia serif on `h1`, `.decision-header h2`, `.option-card h3`.
- `dviz/src/view/app.tsx` (666 lines). React 19, no router. Components: `QuestionCard` (~l.33), `TransclusionCard` (~l.86), `Outline` (~l.109), `CriterionChip` (~l.208), `AssessmentRow` (~l.226), `DecisionView` (~l.244), `DemoControls` (~l.368), `App` (~l.396), `LibraryApp` (~l.571).
- `dviz/src/view/index.html`. `<meta name="color-scheme" content="light">`, links `./styles.css`, loads `./app.tsx` as a module.
- `LibraryApp` renders `.library-layout`, a CSS grid `240px | 1fr` (styles.css ~l.690): sticky `.space-sidebar` on the left, `.space-content` on the right. `App` renders a header, then `Outline` or `DecisionView`, a fixed `.recenter-button`, and a glyph-legend footer.
- Dev loop: `cd dviz && bun run dev`. Demo: `http://localhost:4377/?fixture=dinner` (no sidebar, "demo" connection). Library mode with sidebar: `http://localhost:4377/` (needs a space in the local library).
- Tests in `dviz/test/` never touch the view or class names. Class renames are safe.

## Shared contract

Two workstreams edit disjoint files. They must agree on these names before starting.

New class names (B adds them in JSX, A styles them in CSS):

- `.library-layout.sidebar-collapsed`
- `.sidebar-top`, `.sidebar-toggle`, `.space-initial`
- `.header-tools`
- `.theme-toggle`, and `.theme-toggle button[aria-checked="true"]`

Theme attribute: `<html data-theme="light|dark">`. Absent = follow the OS.

localStorage keys:

- `dviz.theme` = `light` | `dark`. Absent = system.
- `dviz.sidebar` = `collapsed` | `expanded`.

## Workstream A: `styles.css` rewrite

Rewrite the file around tokens. Keep every selector the JSX uses. Add rules for the new class names in the shared contract.

### A1. Token layer (replaces lines 1-17)

Three inputs. Everything else derives with relative color syntax and `color-mix`. No JavaScript color math.

```css
:root {
  color-scheme: light;
  --base: oklch(96.5% 0.006 80);   /* warm neutral canvas */
  --accent: oklch(52% 0.16 278);   /* the only UI accent: focus, selection, current nav item */
  --contrast: oklch(20% 0.012 80); /* text and border source */
  --border-a-strong: 22%; --border-a: 12%; --border-a-subtle: 7%;
  --state-l: 44%; --state-bg-a: 14%;
  --shadow-floating: 0 8px 24px oklch(0% 0 0 / 0.14);
}

/* Dark: the same block under both selectors. Keep them in sync. */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { /* DARK */ }
}
:root[data-theme="dark"] { /* DARK */ }
/* DARK =
   color-scheme: dark;
   --base: oklch(19% 0.008 80); --accent: oklch(72% 0.13 278); --contrast: oklch(95% 0.006 80);
   --border-a-strong: 26%; --border-a: 16%; --border-a-subtle: 9%;
   --state-l: 72%; --state-bg-a: 18%;
   --shadow-floating: 0 8px 24px oklch(0% 0 0 / 0.5);
*/

:root {
  --canvas: var(--base);
  --surface-1: oklch(from var(--base) calc(l + 0.025) c h);  /* cards */
  --surface-2: oklch(from var(--base) calc(l - 0.025) c h);  /* sidebar, inset rows */
  --floating:  oklch(from var(--base) calc(l + 0.05) c h);   /* recenter button, demo controls */
  --hover: color-mix(in oklch, var(--contrast) 5%, transparent);
  --border-strong: color-mix(in oklch, var(--contrast) var(--border-a-strong), transparent);
  --border:        color-mix(in oklch, var(--contrast) var(--border-a), transparent);
  --border-subtle: color-mix(in oklch, var(--contrast) var(--border-a-subtle), transparent);
  --text-1: var(--contrast);
  --text-2: color-mix(in oklch, var(--contrast) 68%, var(--canvas));
  --text-3: color-mix(in oklch, var(--contrast) 46%, var(--canvas));
  --accent-bg: color-mix(in oklch, var(--accent) 12%, transparent);
  --ring: color-mix(in oklch, var(--accent) 40%, transparent);
  --green: oklch(var(--state-l) 0.13 150);
  --amber: oklch(var(--state-l) 0.13 75);
  --red:   oklch(var(--state-l) 0.16 25);
  --green-bg: color-mix(in oklch, var(--green) var(--state-bg-a), transparent);
  --amber-bg: color-mix(in oklch, var(--amber) var(--state-bg-a), transparent);
  --red-bg:   color-mix(in oklch, var(--red)   var(--state-bg-a), transparent);
  --chip-question-bg: var(--surface-2);
  --chip-question-fg: var(--text-2);
  --chip-option-bg: oklch(from var(--base) calc(l - 0.03) 0.03 70);
  --chip-option-fg: oklch(from var(--contrast) l 0.03 70);
  --chip-criterion-bg: oklch(from var(--base) calc(l - 0.03) 0.03 210);
  --chip-criterion-fg: oklch(from var(--contrast) l 0.03 210);
  --font-sans: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  --font-mono: ui-monospace, "SF Mono", Menlo, monospace;
  --ease: 160ms ease-out;
  --radius: 6px;
  --row: 32px;
}
```

Why this shape: the dark override changes only the three inputs. Every derived token re-resolves. The same `+0.025` lift makes cards lighter than the canvas in both modes, and `--surface-2` makes the sidebar dimmer in both.

Slug chips: low-chroma tints. Question chips stay neutral because they are the most numerous. Option = warm hue 70. Criterion = cool hue 210. The three kinds stay distinct without competing with the resolution glyphs.

### A2. Color literal to token mapping

| Group | Current literals | Token |
|---|---|---|
| Page bg | `#f4f2eb`, radial gradient (l.15) | `--canvas`. Delete the gradient. |
| Text primary | `#20231f #344431 #283e23 #35452e` | `--text-1` |
| Text secondary | `#5d655a #5e6857 #5f685a #626c5d #626b5e #656c61 #666e62 #5d6758 #485244 #424b3b #42493e #596254 #71786d` | `--text-2` |
| Text tertiary | `#68705f #777d73 #8b9288 #8a8e85 #92988e #9a9d96` | `--text-3` |
| Card fills | `rgba(255,255,252,*)`, `#f7f8f2 #fafbf7 #f4f4ed` | `--surface-1` |
| Inset fills | `rgba(247,247,241,.72)`, `rgba(235,235,227,.58)`, `#e6e7df #e1e2da #eaece1` | `--surface-2` |
| Floating fills | `rgba(250,250,245,*)` on recenter and demo controls | `--floating` + `--shadow-floating`. Keep `backdrop-filter`. |
| Border strong / hover | `#aeb2a7 #9ca99a #9ca297 #7d8978 #879080 #73816f` | `--border-strong` |
| Border default | `#bfc3b9 #c0c4ba #c3c8be #b8c3ae #b7bfd0 rgba(128,137,126,.45)` | `--border` |
| Border subtle | `#d2d1c8 #d1d3ca #d5dacd #c9bda9` | `--border-subtle` |
| Green (decided / live / `+`) | fg `#587d53 #497047 #3d6f45 #527457 #6e8d68 #91aa8a`; bg `#dbe9d8 #dae4d2 rgba(242,248,238,.92)` | `--green` / `--green-bg` |
| Amber (leaning / paused / connecting / `~`) | fg `#d49b3c #a66d22 #9a651f #8c651f #76511f #76521f #b57d35 #a87330 #b7833e #c79b5d`; bg `#f0dfc4 #f1e6ca rgba(252,247,235,.92)` | `--amber` / `--amber-bg` |
| Red (offline / `-` / alert) | `#a84d40 #984b40 #943e32`; bg `#f1ddda` | `--red` / `--red-bg` |
| Demo connection dot `#6376a0` | | `--accent` |
| Unclear polarity `#626778` / `#e1e3ea` | | `--text-3` / `--surface-2` |
| Slug kinds | question `#3f5745` / `#dce6d8`; option `#66563f` / `#ece1cf`; criterion `#49566d` / `#e1e6ef` / border `#b7bfd0` | `--chip-*-fg` / `--chip-*-bg`; criterion border `--border` |
| Sidebar current / hover `#d4dfc7` / `#e0e5d6` | | `--accent-bg` / `--hover` |
| Focus rings `rgba(74,109,77,.3)`, `rgba(71,112,78,*)`, `#47704e`, `#587d53` | | `--ring` for outline and box-shadow rings. `--accent` for `.focus-target` border and `.focus-kicker`. |
| Card shadows (l.98, 108, 316, 428, 547 second value) | | Delete. |
| Recenter icon `#527457` / `#f6f5ef`, paused `#a87330` | | `--accent` bg / `--canvas` fg. Paused `--amber`. |

Also delete `transform: translateY(-1px)` at l.109 and l.600. Transitions become `border-color var(--ease), background var(--ease)` only.

### A3. Typography

- Remove Georgia at `h1` (l.46), `.decision-header h2` (l.337), `.option-card h3` (l.448). Set `font-family: var(--font-sans)` on `:root`. Mono selectors (l.154, 189, 504, 622, 663, 702) use `var(--font-mono)`.
- `body { font-size: 14px; line-height: 1.45 }`.
- `h1`: 20px / 600 / -0.02em. Header `margin-bottom: 20px`. `main` padding `28px 0 24px`.
- `.decision-header h2`: `clamp(1.25rem, 3vw, 1.6rem)` / 600 / -0.02em / line-height 1.2.
- `.option-card h3`: 15px / 600 / -0.01em.
- `.question-title`: 14px / 500.
- Secondary copy (`.decision-detail`, `.option-detail`, `.assessment-note`, `.selected-option`): 13px, `--text-2`.
- Chips and mono: 12px.
- Micro labels (`.eyebrow`, `.section-label`, `.resolution-label`, `.selection-badge`, `.focus-kicker`, `.sidebar-heading h2`, `.demo-controls > span`): 11px / 600 / 0.06em uppercase / `--text-3`.
- Every 650 / 700 / 750 / 800 weight becomes 600. Footer 12px `--text-3`.

### A4. Component restyle

- Cards (`.question-card`, `.transclusion-card`, `.decision-header`, `.option-card`, `.unplaced-focus`, `.empty-state`, `.criteria-context`, `.empty-options`, `.missing-decision`): `--surface-1`, `1px solid var(--border)`, `border-radius: var(--radius)` (8px for `.decision-header`), padding on a 4px grid, hover = `border-color: var(--border-strong)` only. Question card `min-height: 40px`. Transclusion card `min-height: 32px`.
- Suggested stays `2px dotted var(--border-strong)` on all six `.suggested` selectors (`.question-card`, `.transclusion-card`, `.decision-header`, `.option-card`, `.option-chip`, `.criterion-slug`) plus `.assessment-row.suggested` (1px dotted).
- `.focus-target`: `border-color: var(--accent); box-shadow: 0 0 0 3px var(--ring)`. Chips get the same ring.
- `.assessment-row`: `--surface-2`, radius 4px. `.polarity`: 20px, weight 600, state color on the matching `-bg` tint. Unclear = `--text-3` on `--surface-2`.
- Selected option chips and cards: leaning = amber tint + amber border. Decided = green tint + green border.
- `.recenter-button`, `.demo-controls`: `--floating` + `--shadow-floating`. No hover transform.
- Sidebar block (l.689-720):
  - `.library-layout { grid-template-columns: var(--sidebar-w, 240px) minmax(0, 1fr); transition: grid-template-columns var(--ease) }`
  - `.library-layout.sidebar-collapsed { --sidebar-w: 44px }`
  - `.space-sidebar { background: var(--surface-2); border-right: 1px solid var(--border-subtle); padding: 8px }`
  - `.sidebar-top`: flex, space-between, align center, brand on the left, toggle on the right.
  - `nav a`: flex row, `min-height: var(--row)`, padding `0 8px`, gap 8px, radius `--radius`. `strong` 13px / 500. `small` 12px mono `--text-3`, ellipsis. Hover `--hover`. `[aria-current]` `--accent-bg` + `--text-1`.
  - Collapsed: hide brand text, `.sidebar-heading`, `.new-space-form`, `.sidebar-hint`, `[role=alert]`, `nav strong`, `nav small`, `.theme-toggle`. Show `.space-initial` as a 28px square. `nav a` becomes a 28px square, centered. The toggle stays visible.
  - Expanded: `.space-initial { display: none }`.
  - 640px breakpoint: `--sidebar-w: 150px` instead of the current literal.
- `.theme-toggle`: inline flex of three 24px buttons, one `--border-subtle` group border, `[aria-checked="true"]` = `--accent-bg`.
- `.header-tools`: flex, gap 12px, align center.

## Workstream B: `app.tsx` and `index.html`

### B1. Pre-paint theme (`index.html`)

- Change the meta to `<meta name="color-scheme" content="light dark">`.
- Add an inline non-module `<script>` in `<head>` before the stylesheet link:

```html
<script>
  (function () {
    try {
      var t = localStorage.getItem("dviz.theme");
      if (t === "light" || t === "dark") document.documentElement.dataset.theme = t;
    } catch (e) {}
  })();
</script>
```

- Risk: Bun's HTML loader may bundle inline scripts. Verify in dev: set `dviz.theme` to `dark`, hard reload, confirm no light flash. Fallback: run the same IIFE as the first statement of `app.tsx`.

### B2. `ThemeToggle` component

New component in `app.tsx`, after `DemoControls`.

- `useState<"system" | "light" | "dark">` initialised from `localStorage.getItem("dviz.theme") ?? "system"`.
- `useEffect`: `system` removes the key and deletes `document.documentElement.dataset.theme`. Otherwise it sets both.
- Renders `<div className="theme-toggle" role="radiogroup" aria-label="Theme">` with three `<button type="button" role="radio" aria-checked={...}>` for System / Light / Dark. Glyphs `◐ ☼ ☾` with the label in `title` and a `.visually-hidden` span.
- Mount points: in `LibraryApp` sidebar after `.sidebar-hint`; and in the `App` header only when `!space` (demo and legacy modes have no sidebar). Wrap `.connection` and the toggle in `<div className="header-tools">`.

### B3. Sidebar collapse (`LibraryApp`)

- `const [collapsed, setCollapsed] = useState(() => localStorage.getItem("dviz.sidebar") === "collapsed")`. An effect persists `"collapsed" | "expanded"`.
- Root div: `` className={`library-layout ${collapsed ? "sidebar-collapsed" : ""}`} ``.
- First child of `.space-sidebar`:

```tsx
<div className="sidebar-top">
  <a className="library-brand" href="/">Decision Flow</a>
  <button
    className="sidebar-toggle"
    type="button"
    aria-expanded={!collapsed}
    aria-controls="space-list"
    aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
    onClick={() => setCollapsed(!collapsed)}
  >
    {collapsed ? "»" : "«"}
  </button>
</div>
```

- `<nav id="space-list">`. Each space link adds `title={space.title}` and `<span className="space-initial" aria-hidden="true">{space.title[0]}</span>` before the existing `strong` / `small`.
- Optional: a `Mod+B` keydown listener toggles collapse. Skip if it adds more than a few lines.

## Execution order

1. Run A and B in parallel. They edit disjoint files and share the contract above. Each implementer should outline its approach briefly before editing.
2. One integration pass: run the app, fix any class-name mismatch, verify the pre-paint script under Bun (B1 risk).

## Not in scope

Keyboard commands and command palette. A right-hand detail column. Any change to the schema, the CLI, or the server. Component libraries or a CSS framework.

## Verification

- `cd dviz && bun run typecheck && bun test`.
- `cd dviz && bun run dev`, then in the browser (call Jean `get_run_environments` first if a run environment exists and use its URL):
  1. `http://localhost:4377/?fixture=dinner` in OS light, OS dark, and each manual toggle setting. `<html data-theme>` matches. Reload persists. No flash with `dviz.theme=dark`.
  2. Lightness ladder visible: canvas < card < floating. Sidebar dimmer than content in library mode at `http://localhost:4377/`.
  3. Slug chips lead every card. Question / option / criterion chips are distinguishable. All `.suggested` variants are dotted.
  4. ○ ◐ ● glyphs legible. Decided green, leaning amber, offline red, connecting amber, demo accent.
  5. Demo-controls focus buttons put an accent ring on `.focus-target`. Recenter button floats with a shadow. No card hover lift.
  6. Sidebar collapse works by click and keyboard (Tab, Enter). `aria-expanded` flips. Initials show at 44px. Reload preserves. `?space=` links still work.
  7. DevTools: only `.recenter-button` and `.demo-controls` have `box-shadow`, besides focus rings.
  8. 520px and 640px breakpoints still stack correctly.
- Browser support: relative color syntax needs Chrome 119+, Safari 16.4+, Firefox 128+. Acceptable for a local dev tool.

## Things to watch when implementing

- Both dark blocks (media query and `data-theme`) must stay identical. Consider a comment in the CSS that says so.
- The `ThemeToggle` must not render in the sidebar when collapsed, or it must be hidden by CSS. Either is fine. Pick one.
- `LibraryApp` returns plain `<App />` in demo and legacy modes with no sidebar. The header toggle covers those modes.
- Keep the `.visually-hidden` utility. The polarity pills and the toggle depend on it.
