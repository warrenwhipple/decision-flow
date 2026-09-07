import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SpaceSummary } from "../db/library.ts";
import { createRoot } from "react-dom/client";
import type {
  Acceptance,
  Assessment,
  Criterion,
  Focus,
  Option,
  OutlineSnapshot,
  Placement,
  Question,
} from "../db/space.ts";

declare global {
  interface Window {
    __DVIZ_DEMO_SNAPSHOT__?: OutlineSnapshot;
  }
}

type Connection = "connecting" | "live" | "offline" | "demo";

const resolutionGlyph = { open: "○", leaning: "◐", decided: "●" } as const;
const polarityLabel = { "+": "supports", "-": "detracts", "~": "mixed", "?": "unclear" } as const;
const emptySnapshot: OutlineSnapshot = {
  questions: [], placements: [], options: [], criteria: [], assessments: [], relations: [], focus: null,
};

function isFocused(focus: Focus | null, kind: Focus["kind"], reference: string): boolean {
  return focus?.kind === kind && focus.reference === reference;
}

function QuestionCard({ question, placement, options, focus, onOpen }: {
  question: Question;
  placement: Placement;
  options: Option[];
  focus: Focus | null;
  onOpen: (slug: string) => void;
}) {
  const selected = options.find(({ slug }) => slug === question.resolvedOptionSlug);
  const suggested = question.acceptance === "suggested" || placement.acceptance === "suggested";
  return (
    <div className="decision-entry">
      <button
        className={`question-card ${suggested ? "suggested" : "accepted"} ${question.resolution} ${isFocused(focus, "question", question.slug) ? "focus-target" : ""}`}
        type="button"
        onClick={() => onOpen(question.slug)}
        aria-label={`Open decision ${question.title}`}
        data-node-kind="question"
        data-node-reference={question.slug}
      >
        <span className="slug-chip question-slug">{question.slug}</span>
        <span className="question-copy">
          <span className="question-title">{question.title}</span>
          {selected && question.resolution !== "open" && (
            <span className="selected-option">
              {question.resolution === "decided" ? "Decided" : "Leaning"}: {selected.slug}
            </span>
          )}
        </span>
        <span className="resolution" aria-label={`${question.resolution} question`}>
          {resolutionGlyph[question.resolution]}
        </span>
        <span className="open-cue" aria-hidden="true">›</span>
        {options.length > 0 && (
          <span className="option-list" role="list" aria-label={`Options for ${question.title}`}>
            {options.map((option) => (
              <span
                className={`slug-chip option-slug option-chip ${option.acceptance} ${option.slug === question.resolvedOptionSlug ? "selected" : ""} ${isFocused(focus, "option", `${question.slug}/${option.slug}`) ? "focus-target" : ""}`}
                key={option.slug}
                role="listitem"
                title={option.title}
                data-node-kind="option"
                data-node-reference={`${question.slug}/${option.slug}`}
              >
                {option.slug}
              </span>
            ))}
          </span>
        )}
      </button>
    </div>
  );
}

function TransclusionCard({ question, placement, canonicalParent, onOpen }: {
  question: Question;
  placement: Placement;
  canonicalParent: string | null;
  onOpen: (slug: string) => void;
}) {
  const suggested = question.acceptance === "suggested" || placement.acceptance === "suggested";
  const location = canonicalParent ?? "top level";
  return (
    <button
      className={`transclusion-card ${suggested ? "suggested" : "accepted"}`}
      type="button"
      onClick={() => onOpen(question.slug)}
      aria-label={`Open transcluded decision ${question.title}, also under ${location}`}
    >
      <span className="transclusion-icon" aria-hidden="true">↳</span>
      <span className="slug-chip question-slug">{question.slug}</span>
      <span className="transclusion-marker">also under <strong>{location}</strong></span>
      <span className="open-cue" aria-hidden="true">›</span>
    </button>
  );
}

function Outline({ snapshot, onOpen, space }: { snapshot: OutlineSnapshot; onOpen: (slug: string) => void; space?: string }) {
  const questionsBySlug = useMemo(
    () => new Map(snapshot.questions.map((question) => [question.slug, question])),
    [snapshot.questions],
  );
  const childrenByParent = useMemo(() => {
    const children = new Map<string | null, Placement[]>();
    for (const placement of snapshot.placements) {
      const siblings = children.get(placement.parentSlug) ?? [];
      siblings.push(placement);
      children.set(placement.parentSlug, siblings);
    }
    return children;
  }, [snapshot.placements]);
  const optionsByQuestion = useMemo(() => {
    const options = new Map<string, Option[]>();
    for (const option of snapshot.options) {
      const siblings = options.get(option.questionSlug) ?? [];
      siblings.push(option);
      options.set(option.questionSlug, siblings);
    }
    return options;
  }, [snapshot.options]);
  const canonicalByQuestion = useMemo(
    () => new Map(snapshot.placements.filter(({ canonical }) => canonical).map((placement) => [placement.childSlug, placement])),
    [snapshot.placements],
  );

  const renderBranch = (parentSlug: string | null, ancestors = new Set<string>()) => {
    const placements = childrenByParent.get(parentSlug) ?? [];
    return placements.map((placement) => {
      const childSlug = placement.childSlug;
      const question = questionsBySlug.get(childSlug);
      if (!question || ancestors.has(childSlug)) return null;
      if (!placement.canonical) {
        return (
          <li key={`${parentSlug ?? "root"}-${childSlug}`}>
            <TransclusionCard
              question={question}
              placement={placement}
              canonicalParent={canonicalByQuestion.get(childSlug)?.parentSlug ?? null}
              onOpen={onOpen}
            />
          </li>
        );
      }
      const nextAncestors = new Set(ancestors).add(childSlug);
      const children = renderBranch(childSlug, nextAncestors);
      return (
        <li key={`${parentSlug ?? "root"}-${childSlug}`}>
          <QuestionCard
            question={question}
            placement={placement}
            options={optionsByQuestion.get(childSlug) ?? []}
            focus={snapshot.focus}
            onOpen={onOpen}
          />
          {children.length > 0 && <ol>{children}</ol>}
        </li>
      );
    });
  };

  const roots = renderBranch(null);
  const focusedCriterion = snapshot.focus?.kind === "criterion"
    ? snapshot.criteria.find(({ slug }) => slug === snapshot.focus?.reference)
    : undefined;
  const focusedCriterionHasContext = snapshot.focus?.kind === "criterion" && (
    snapshot.relations.some(({ criterionSlug }) => criterionSlug === snapshot.focus?.reference)
    || snapshot.assessments.some(({ criterionSlug }) => criterionSlug === snapshot.focus?.reference)
  );
  const unplacedFocus = focusedCriterion && !focusedCriterionHasContext ? (
    <aside className="unplaced-focus focus-target" data-node-kind="criterion" data-node-reference={focusedCriterion.slug}>
      <span className="focus-kicker">Conversation focus</span>
      <CriterionChip criterion={focusedCriterion} isFocused />
      <span>{focusedCriterion.description || "This criterion is not attached to a decision yet."}</span>
    </aside>
  ) : null;

  if (roots.length === 0) {
    return (
      <>
        {unplacedFocus}
        <div className="empty-state">
          <p>No questions yet.</p>
          <code>dviz question add next-step "What should we decide?"{space ? ` --space ${space}` : ""}</code>
        </div>
      </>
    );
  }

  return (
    <>
      {unplacedFocus}
      <ol className="outline">{roots}</ol>
    </>
  );
}

function CriterionChip({ criterion, acceptance, isFocused: focused = false }: {
  criterion: Criterion;
  acceptance?: Acceptance;
  isFocused?: boolean;
}) {
  const suggested = criterion.acceptance === "suggested" || acceptance === "suggested";
  return (
    <span
      className={`slug-chip criterion-slug ${suggested ? "suggested" : "accepted"} ${focused ? "focus-target" : ""}`}
      title={criterion.description || criterion.slug}
      data-node-kind="criterion"
      data-node-reference={criterion.slug}
    >
      {criterion.slug}
    </span>
  );
}

function AssessmentRow({ assessment, criterion }: { assessment: Assessment; criterion: Criterion }) {
  const polarityClass = assessment.polarity === "+" ? "plus"
    : assessment.polarity === "-" ? "minus"
      : assessment.polarity === "~" ? "mixed" : "unclear";
  return (
    <li className={`assessment-row ${assessment.acceptance}`}>
      <div className="assessment-heading">
        <span className={`polarity polarity-${polarityClass}`}>
          <span aria-hidden="true">{assessment.polarity}</span>
          <span className="visually-hidden">{polarityLabel[assessment.polarity]}</span>
        </span>
        <CriterionChip criterion={criterion} acceptance={assessment.acceptance} />
      </div>
      {assessment.note && <span className="assessment-note">{assessment.note}</span>}
    </li>
  );
}

function DecisionView({ snapshot, question, onBack }: {
  snapshot: OutlineSnapshot;
  question: Question;
  onBack: () => void;
}) {
  const options = snapshot.options.filter(({ questionSlug }) => questionSlug === question.slug);
  const criteriaBySlug = new Map(snapshot.criteria.map((criterion) => [criterion.slug, criterion]));
  const relations = snapshot.relations.filter(({ questionSlug }) => questionSlug === question.slug);
  const assessments = snapshot.assessments.filter(({ optionPath }) => optionPath.startsWith(`${question.slug}/`));
  const assessmentSlugs = new Set(assessments.map(({ criterionSlug }) => criterionSlug));
  const relationByCriterion = new Map(relations.map((relation) => [relation.criterionSlug, relation]));
  const shownCriteria = snapshot.criteria.filter(
    ({ slug }) => relationByCriterion.has(slug) || assessmentSlugs.has(slug),
  );

  return (
    <section className="zoomed-view" aria-labelledby="decision-title">
      <button className="back-button" type="button" onClick={onBack}>← All decisions</button>
      <div
        className={`decision-header ${question.acceptance} ${isFocused(snapshot.focus, "question", question.slug) ? "focus-target" : ""}`}
        data-node-kind="question"
        data-node-reference={question.slug}
      >
        <div className="decision-heading">
          <span className="slug-chip question-slug">{question.slug}</span>
          <span className={`resolution-label ${question.resolution}`}>
            <span aria-hidden="true">{resolutionGlyph[question.resolution]}</span> {question.resolution}
          </span>
        </div>
        <h2 id="decision-title">{question.title}</h2>
        {question.detail && <p className="decision-detail">{question.detail}</p>}
      </div>

      {shownCriteria.length > 0 && (
        <section className="criteria-context" aria-labelledby="criteria-title">
          <div>
            <p className="section-label" id="criteria-title">Criteria in play</p>
            <p className="criteria-hint">Related directly or used in an assessment</p>
          </div>
          <div className="criteria-list">
            {shownCriteria.map((criterion) => (
              <CriterionChip
                criterion={criterion}
                acceptance={relationByCriterion.get(criterion.slug)?.acceptance}
                isFocused={isFocused(snapshot.focus, "criterion", criterion.slug)}
                key={criterion.slug}
              />
            ))}
          </div>
        </section>
      )}

      <div className="options-heading">
        <p className="section-label">Options</p>
        <span>{options.length}</span>
      </div>
      {options.length === 0 ? (
        <div className="empty-options">No options yet.</div>
      ) : (
        <ol className="option-cards">
          {options.map((option) => {
            const selected = option.slug === question.resolvedOptionSlug && question.resolution !== "open";
            const optionAssessments = assessments.filter(({ optionPath }) => optionPath === `${question.slug}/${option.slug}`);
            return (
              <li key={option.slug}>
                <article
                  className={`option-card ${option.acceptance} ${selected ? `selected ${question.resolution}` : ""} ${isFocused(snapshot.focus, "option", `${question.slug}/${option.slug}`) ? "focus-target" : ""}`}
                  data-node-kind="option"
                  data-node-reference={`${question.slug}/${option.slug}`}
                >
                  <div className="option-card-heading">
                    <span className="slug-chip option-slug">{option.slug}</span>
                    {selected && (
                      <span className={`selection-badge ${question.resolution}`}>
                        {resolutionGlyph[question.resolution]} {question.resolution}
                      </span>
                    )}
                  </div>
                  <h3>{option.title}</h3>
                  {option.detail && <p className="option-detail">{option.detail}</p>}
                  {optionAssessments.length > 0 ? (
                    <ul className="assessment-list" aria-label={`Assessments for ${option.title}`}>
                      {optionAssessments.map((assessment) => {
                        const criterion = criteriaBySlug.get(assessment.criterionSlug);
                        return criterion ? (
                          <AssessmentRow assessment={assessment} criterion={criterion} key={assessment.criterionSlug} />
                        ) : null;
                      })}
                    </ul>
                  ) : (
                    <p className="no-assessments">No assessments yet</p>
                  )}
                </article>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function questionFromUrl(): string | null {
  return new URL(window.location.href).searchParams.get("question");
}

function fixtureFromUrl(): string | null {
  return new URL(window.location.href).searchParams.get("fixture");
}

function questionForFocus(snapshot: OutlineSnapshot, focus: Focus): string | null {
  if (focus.kind === "question") return null;
  if (focus.kind === "option") return focus.reference.split("/", 1)[0] ?? null;
  const relation = snapshot.relations.find(({ criterionSlug }) => criterionSlug === focus.reference);
  if (relation) return relation.questionSlug;
  const assessment = snapshot.assessments.find(({ criterionSlug }) => criterionSlug === focus.reference);
  return assessment?.optionPath.split("/", 1)[0] ?? null;
}

function focusTarget(focus: Focus): HTMLElement | undefined {
  return Array.from(document.querySelectorAll<HTMLElement>("[data-node-kind][data-node-reference]"))
    .find((element) => element.dataset.nodeKind === focus.kind && element.dataset.nodeReference === focus.reference);
}

function DemoControls({ snapshot, onFocus }: {
  snapshot: OutlineSnapshot;
  onFocus: (focus: Focus) => void;
}) {
  const questionTargets = snapshot.questions.length < 2
    ? snapshot.questions
    : [snapshot.questions[0]!, snapshot.questions.at(-1)!];
  const targets: Focus[] = [
    ...questionTargets.map(({ slug }) => ({ kind: "question" as const, reference: slug, setAt: "" })),
    ...snapshot.options.slice(0, 1).map(({ questionSlug, slug }) => ({ kind: "option" as const, reference: `${questionSlug}/${slug}`, setAt: "" })),
    ...snapshot.criteria.slice(0, 1).map(({ slug }) => ({ kind: "criterion" as const, reference: slug, setAt: "" })),
  ];
  return (
    <aside className="demo-controls" aria-label="Static demo controls">
      <span>Simulate agent focus</span>
      {targets.map((target) => (
        <button
          type="button"
          key={`${target.kind}:${target.reference}`}
          onClick={() => onFocus({ ...target, setAt: new Date().toISOString() })}
        >
          {target.reference}
        </button>
      ))}
    </aside>
  );
}

function App({ space, title }: { space?: string; title?: string }) {
  const demo = window.__DVIZ_DEMO_SNAPSHOT__;
  const fixture = fixtureFromUrl();
  const [snapshot, setSnapshot] = useState<OutlineSnapshot>(demo ?? emptySnapshot);
  const [connection, setConnection] = useState<Connection>(demo ? "demo" : "connecting");
  const [selectedQuestion, setSelectedQuestion] = useState<string | null>(questionFromUrl);
  const [following, setFollowing] = useState(true);
  const [recenterRequest, setRecenterRequest] = useState(0);
  const programmaticScroll = useRef(false);
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (demo) return;
    let cancelled = false;
    let events: EventSource | undefined;

    const connect = () => {
      if (cancelled) return;
      events = new EventSource(`/api/events${space ? `?${new URLSearchParams({ space })}` : ""}`);
      events.onopen = () => setConnection("live");
      events.onerror = () => setConnection("offline");
      events.addEventListener("outline", (event) => {
        setSnapshot(JSON.parse((event as MessageEvent<string>).data) as OutlineSnapshot);
        setConnection("live");
      });
    };

    if (fixture) {
      fetch(`/api/fixtures/${encodeURIComponent(fixture)}`)
        .then(async (response) => {
          if (!response.ok) {
            connect();
            return;
          }
          const fixtureSnapshot = await response.json() as OutlineSnapshot;
          if (cancelled) return;
          window.__DVIZ_DEMO_SNAPSHOT__ = fixtureSnapshot;
          setSnapshot(fixtureSnapshot);
          setConnection("demo");
        })
        .catch(connect);
    } else {
      connect();
    }

    return () => {
      cancelled = true;
      events?.close();
    };
  }, [demo, fixture, space]);

  useEffect(() => {
    const onPopState = () => {
      setFollowing(false);
      setSelectedQuestion(questionFromUrl());
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const setRoute = useCallback((questionSlug: string | null, history: "push" | "replace") => {
    const url = new URL(window.location.href);
    if (questionSlug) url.searchParams.set("question", questionSlug);
    else url.searchParams.delete("question");
    window.history[history === "push" ? "pushState" : "replaceState"]({}, "", url);
    setSelectedQuestion(questionSlug);
  }, []);

  const navigate = useCallback((questionSlug: string | null) => {
    setFollowing(false);
    setRoute(questionSlug, "push");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [setRoute]);

  useEffect(() => {
    const suspend = () => {
      programmaticScroll.current = false;
      if (scrollTimer.current) clearTimeout(scrollTimer.current);
      setFollowing(false);
    };
    const onScroll = () => {
      if (!programmaticScroll.current) setFollowing(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(event.key)) suspend();
    };
    window.addEventListener("wheel", suspend, { passive: true });
    window.addEventListener("touchstart", suspend, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("wheel", suspend);
      window.removeEventListener("touchstart", suspend);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("keydown", onKeyDown);
      if (scrollTimer.current) clearTimeout(scrollTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!following || !snapshot.focus) return;
    const destination = questionForFocus(snapshot, snapshot.focus);
    if (selectedQuestion !== destination) {
      setRoute(destination, "replace");
      return;
    }
    const frame = requestAnimationFrame(() => {
      const target = focusTarget(snapshot.focus!);
      if (!target) return;
      programmaticScroll.current = true;
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      if (scrollTimer.current) clearTimeout(scrollTimer.current);
      scrollTimer.current = setTimeout(() => { programmaticScroll.current = false; }, 1_200);
    });
    return () => cancelAnimationFrame(frame);
  }, [following, recenterRequest, selectedQuestion, setRoute, snapshot]);

  const recenter = () => {
    setFollowing(true);
    setRecenterRequest((request) => request + 1);
  };

  const question = snapshot.questions.find(({ slug }) => slug === selectedQuestion);
  const zoomed = selectedQuestion !== null;

  return (
    <main className={zoomed ? "zoomed" : "overview"}>
      <header>
        <div>
          <p className="eyebrow">Decision Flow</p>
          <h1>{title ?? (zoomed ? "Decision" : "Live outline")}</h1>
          {space && <p className="space-target">Agent target: <code>--space {space}</code></p>}
        </div>
        <div className={`connection ${connection}`}>
          <span aria-hidden="true" />
          {connection}
        </div>
      </header>
      {connection === "demo" && (
        <DemoControls
          snapshot={snapshot}
          onFocus={(focus) => setSnapshot((current) => ({ ...current, focus }))}
        />
      )}
      {question ? (
        <DecisionView snapshot={snapshot} question={question} onBack={() => navigate(null)} />
      ) : selectedQuestion ? (
        <section className="missing-decision">
          <p>Decision <code>{selectedQuestion}</code> is not in this space.</p>
          <button className="back-button" type="button" onClick={() => navigate(null)}>← All decisions</button>
        </section>
      ) : (
        <section aria-live="polite">
          <Outline snapshot={snapshot} onOpen={(slug) => navigate(slug)} space={space} />
        </section>
      )}
      {snapshot.focus && (
        <button
          className={`recenter-button ${following ? "following" : "paused"}`}
          type="button"
          onClick={recenter}
          aria-label={`${following ? "Following" : "Return to"} conversation focus ${snapshot.focus.reference}`}
        >
          <span className="recenter-icon" aria-hidden="true">⌖</span>
          <span>
            <strong>{following ? "Following" : "Return to focus"}</strong>
            <small>{snapshot.focus.reference}</small>
          </span>
        </button>
      )}
      <footer>○ open · ◐ leaning · ● decided · dotted outlines are suggested</footer>
    </main>
  );
}

function LibraryApp() {
  const [spaces, setSpaces] = useState<SpaceSummary[]>([]);
  const [mode, setMode] = useState<"loading" | "library" | "legacy">("loading");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const selected = new URL(window.location.href).searchParams.get("space");
  const demo = Boolean(window.__DVIZ_DEMO_SNAPSHOT__ || fixtureFromUrl());

  useEffect(() => {
    if (demo) return;
    let cancelled = false;
    const controller = new AbortController();
    const refresh = async () => {
      try {
        const response = await fetch("/api/spaces", { signal: controller.signal });
        if (!response.ok) throw new Error("Could not load spaces. Check that dviz serve is running.");
        const body = await response.json() as { mode: "library" | "legacy"; spaces: SpaceSummary[] };
        if (!cancelled) { setSpaces(body.spaces); setMode(body.mode); setError(""); }
      } catch (error) {
        if (!cancelled) setError(error instanceof Error ? error.message : String(error));
      }
    };
    void refresh();
    const interval = setInterval(refresh, 3_000);
    return () => { cancelled = true; controller.abort(); clearInterval(interval); };
  }, [demo]);

  const [createError, setCreateError] = useState("");
  const createSpace = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setCreateError("");
    try {
      const response = await fetch("/api/spaces", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, title }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Could not create space.");
      window.location.assign(`/?${new URLSearchParams({ space: slug })}`);
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : String(error));
      setSaving(false);
    }
  };

  if (demo || mode === "legacy") return <App />;
  const current = spaces.find(({ slug }) => slug === selected);
  return (
    <div className="library-layout">
      <aside className="space-sidebar" aria-label="Decision spaces">
        <a className="library-brand" href="/">Decision Flow</a>
        <div className="sidebar-heading"><h2>Spaces</h2><button type="button" onClick={() => setCreating(!creating)} aria-expanded={creating}>+ New</button></div>
        {creating && (
          <form className="new-space-form" onSubmit={createSpace}>
            <label>Title<input autoFocus required maxLength={200} value={title} onChange={(event) => {
              const value = event.target.value;
              setTitle(value);
              if (!slugEdited) setSlug(value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^[^a-z]+/, "").replace(/-$/, "").slice(0, 64).replace(/-$/, ""));
            }} /></label>
            <label>Space slug<input required maxLength={64} pattern="[a-z][a-z0-9]*(-[a-z0-9]+)*" value={slug} onChange={(event) => { setSlugEdited(true); setSlug(event.target.value); }} /></label>
            <small>A unique handle for agent commands.</small>
            {createError && <p role="alert">{createError}</p>}
            <button disabled={saving} type="submit">{saving ? "Creating…" : "Create space"}</button>
          </form>
        )}
        {error && <p role="alert">{error}</p>}
        <nav aria-label="Spaces">
          {spaces.map((space) => (
            <a key={space.slug} href={`/?${new URLSearchParams({ space: space.slug })}`} aria-current={selected === space.slug ? "page" : undefined}>
              <strong>{space.title}</strong><small>{space.slug}</small>
            </a>
          ))}
        </nav>
        {mode === "library" && spaces.length === 0 && <p className="sidebar-hint">Your decision maps live here, independent of repositories.</p>}
      </aside>
      <div className="space-content">
        {current ? <App key={current.slug} space={current.slug} title={current.title} /> : (
          <main>
            <p className="eyebrow">Personal decision library</p>
            <h1>{mode === "loading" ? "Loading spaces…" : selected ? "Space not found" : "Your decision spaces"}</h1>
            <p>{selected && mode !== "loading" ? `No space named “${selected}” is in this library.` : "Choose a space from the sidebar, or create one to start a decision map."}</p>
            <p>Browsing spaces does not change where an agent is working.</p>
          </main>
        )}
      </div>
    </div>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element.");
createRoot(root).render(<LibraryApp />);
