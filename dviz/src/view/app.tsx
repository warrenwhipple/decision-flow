import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
      </button>
      {options.length > 0 && (
        <ul className="option-list" aria-label={`Options for ${question.title}`}>
          {options.map((option) => (
            <li
              className={`${option.acceptance} ${option.slug === question.resolvedOptionSlug ? "selected" : ""} ${isFocused(focus, "option", `${question.slug}/${option.slug}`) ? "focus-target" : ""}`}
              key={option.slug}
              data-node-kind="option"
              data-node-reference={`${question.slug}/${option.slug}`}
            >
              <span className="slug-chip option-slug">{option.slug}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Outline({ snapshot, onOpen }: { snapshot: OutlineSnapshot; onOpen: (slug: string) => void }) {
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

  const renderBranch = (parentSlug: string | null, ancestors = new Set<string>()) => {
    const placements = childrenByParent.get(parentSlug) ?? [];
    return placements.map((placement) => {
      const childSlug = placement.childSlug;
      const question = questionsBySlug.get(childSlug);
      if (!question || ancestors.has(childSlug)) return null;
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
          <code>dviz question add next-step "What should we decide?"</code>
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
      <span className={`polarity polarity-${polarityClass}`}>
        <span aria-hidden="true">{assessment.polarity}</span>
        <span className="visually-hidden">{polarityLabel[assessment.polarity]}</span>
      </span>
      <CriterionChip criterion={criterion} acceptance={assessment.acceptance} />
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

function App() {
  const demo = window.__DVIZ_DEMO_SNAPSHOT__;
  const [snapshot, setSnapshot] = useState<OutlineSnapshot>(demo ?? emptySnapshot);
  const [connection, setConnection] = useState<Connection>(demo ? "demo" : "connecting");
  const [selectedQuestion, setSelectedQuestion] = useState<string | null>(questionFromUrl);
  const [following, setFollowing] = useState(true);
  const [recenterRequest, setRecenterRequest] = useState(0);
  const programmaticScroll = useRef(false);
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (demo) return;
    const events = new EventSource("/api/events");
    events.onopen = () => setConnection("live");
    events.onerror = () => setConnection("offline");
    events.addEventListener("outline", (event) => {
      setSnapshot(JSON.parse((event as MessageEvent<string>).data) as OutlineSnapshot);
      setConnection("live");
    });
    return () => events.close();
  }, [demo]);

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
          <h1>{zoomed ? "Decision" : "Live outline"}</h1>
        </div>
        <div className={`connection ${connection}`}>
          <span aria-hidden="true" />
          {connection}
        </div>
      </header>
      {demo && (
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
          <Outline snapshot={snapshot} onOpen={(slug) => navigate(slug)} />
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

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element.");
createRoot(root).render(<App />);
