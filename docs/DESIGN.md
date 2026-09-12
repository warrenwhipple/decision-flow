# Design guide: dviz visual language

2026-09-12. Written after research into Linear's app design. This guide sets the rules the dviz visualizer follows. It does not describe the implementation. See `docs/handoffs/2026-09-12 1200 dviz-linear-theme.md` for that.

Keep this guide short. Add a rule only when a real decision needed it.

## Why Linear

Linear's interface is calm, dense, and fast to scan. Those are the same goals the visualizer has: a human watches a decision structure take shape while talking to an agent, and must find the current focus at a glance. Linear's rules are also cheap to apply. Most of them are subtraction.

We borrow the rules, not the look. dviz keeps its own identity: a warm gray base, slug chips as the anchor of every card, and the ○ ◐ ● resolution glyphs.

## The rules

### 1. Color is information, not decoration

- The chrome is near-monochrome. Backgrounds, borders, and most text are shades of one warm gray.
- One accent color marks focus, selection, and the current navigation item. Nothing else uses it.
- Green, amber, and red mark state only: decided, leaning, offline, and assessment polarity. A color that does not tell the reader something is removed.
- No decorative gradients, no tinted page washes, no second chromatic accent.
- Slug chips keep a faint tint per kind (question, option, criterion) so cross-kind homonyms stay unambiguous. The tint is low chroma. It must not compete with state colors.

### 2. A theme is three variables

- Base color, accent color, and contrast. Every surface, border, and text tier derives from these three.
- Derivation happens in a perceptually uniform color space (OKLCH). Equal lightness steps look equal to the eye.
- Light and dark are the same system with a different base and contrast. Nothing is styled twice.
- Dark mode follows the OS by default. A manual toggle overrides it.

### 3. Attention hierarchy

- Not every element carries equal visual weight. The main content area is the brightest surface. The navigation sidebar sits a few notches dimmer.
- Headers and labels are compact. They do not compete with the cards.
- Icons are small and few.

### 4. Structure is felt, not seen

- Depth comes from a surface ladder: canvas, card surface, inset surface, floating surface. Each step is a small lightness change plus a hairline border.
- Borders come in three tiers: strong for section boundaries, default for component edges, subtle for row separators.
- Shadows appear only on floating elements: the recenter button and popovers. Cards are flat.
- No hover lift. Hover changes a border or a background, nothing more.
- Fewer separators. Alignment does the work of lines.

### 5. The inverted-L shell

- A fixed left navigation column and a consistent header form an L. The content fills the rest.
- The sidebar collapses to a narrow rail so the content can use the full width.
- The content column does not fight a narrow max-width.
- For now dviz keeps a single content column. Drilling into a decision swaps the outline for the detail view in place. A list/detail split is a possible later step, not a current rule.

### 6. Density through alignment

- Spacing uses a 4px unit.
- Navigation rows follow a 32px rhythm.
- Labels, chips, and glyphs align on a shared vertical grid inside each row.
- Density comes from restraint and alignment, not from cramming.

### 7. One typeface, hierarchy by weight

- One sans-serif family for everything (Inter, with system fallbacks). No serif.
- Weight 500 for medium emphasis, 600 for headings. Never 700 or above.
- Large headings get tight negative letter-spacing. Body text gets none.
- Monospace for slugs, codes, and identifiers only.
- Micro labels are small, uppercase, and letter-spaced, in the tertiary text color.

### 8. Motion communicates state

- State changes animate in about 150 to 200 ms with ease-out.
- Nothing moves for decoration.
- New cards insert. Nothing reflows. This rule comes from the visualizer spec and it is why the outline beat a graph canvas.

## Rules that stay from the visualizer spec

These predate this guide and take priority if there is ever a conflict. See `docs/visualizer-v0-spec.md`, "View" section.

- Slug chips anchor every card.
- `suggested` = dotted outline at every appearance.
- Resolution glyphs ○ ◐ ● are legible at a glance.
- Layout stability. New cards insert, nothing reflows.

## Deferred: keyboard commands

Linear is keyboard-first: a command palette, two-key go-to sequences, and shortcut hints on hover. These look interesting for dviz, but they are a feature, not a visual rule. We defer thinking about them until the visual system has settled. This guide does not encode them.

## Sources

- Linear, "How we redesigned the Linear UI (part II)": https://linear.app/now/how-we-redesigned-the-linear-ui
- Linear, "A calmer interface for a product in motion": https://linear.app/now/behind-the-latest-design-refresh
- Linear changelog, "Custom themes": https://linear.app/changelog/2020-12-04-themes
- Linear changelog, "UI refresh" (2026-03-12): https://linear.app/changelog/2026-03-12-ui-refresh
- Linear design patterns reference (third party): https://github.com/marcus/marcus-skills/blob/main/skills/linear-design-patterns/references/linear-design-system.md
- LogRocket, "Linear design: the SaaS design trend" (for the pitfalls): https://blog.logrocket.com/ux-design/linear-design/
