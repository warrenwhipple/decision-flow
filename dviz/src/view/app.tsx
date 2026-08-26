import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import type {
  Acceptance,
  Assessment,
  Criterion,
  Option,
  OutlineSnapshot,
  Placement,
  Question,
} from "../db/space.ts";

type Connection = "connecting" | "live" | "offline";

const resolutionGlyph = { open: "○", leaning: "◐", decided: "●" } as const;
const polarityLabel = { "+": "supports", "-": "detracts", "~": "mixed", "?": "unclear" } as const;
const emptySnapshot: OutlineSnapshot = {
  questions: [], placements: [], options: [], criteria: [], assessments: [], relations: [],
};

function QuestionCard({ question, placement, options, onOpen }: {
  question: Question;
  placement: Placement;
  options: Option[];
  onOpen: (slug: string) => void;
}) {
  const selected = options.find(({ slug }) => slug === question.resolvedOptionSlug);
  const suggested = question.acceptance === "suggested" || placement.acceptance === "suggested";
  return (
    <div className="decision-entry">
      <button
        className={`question-card ${suggested ? "suggested" : "accepted"} ${question.resolution}`}
        type="button"
        onClick={() => onOpen(question.slug)}
        aria-label={`Open decision ${question.title}`}
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
              className={`${option.acceptance} ${option.slug === question.resolvedOptionSlug ? "selected" : ""}`}
              key={option.slug}
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
            onOpen={onOpen}
          />
          {children.length > 0 && <ol>{children}</ol>}
        </li>
      );
    });
  };

  const roots = renderBranch(null);
  if (roots.length === 0) {
    return (
      <div className="empty-state">
        <p>No questions yet.</p>
        <code>dviz question add next-step "What should we decide?"</code>
      </div>
    );
  }
  return <ol className="outline">{roots}</ol>;
}

function CriterionChip({ criterion, acceptance }: { criterion: Criterion; acceptance?: Acceptance }) {
  const suggested = criterion.acceptance === "suggested" || acceptance === "suggested";
  return (
    <span
      className={`slug-chip criterion-slug ${suggested ? "suggested" : "accepted"}`}
      title={criterion.description || criterion.slug}
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
      <div className={`decision-header ${question.acceptance}`}>
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
                <article className={`option-card ${option.acceptance} ${selected ? `selected ${question.resolution}` : ""}`}>
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

function App() {
  const [snapshot, setSnapshot] = useState<OutlineSnapshot>(emptySnapshot);
  const [connection, setConnection] = useState<Connection>("connecting");
  const [selectedQuestion, setSelectedQuestion] = useState<string | null>(questionFromUrl);

  useEffect(() => {
    const events = new EventSource("/api/events");
    events.onopen = () => setConnection("live");
    events.onerror = () => setConnection("offline");
    events.addEventListener("outline", (event) => {
      setSnapshot(JSON.parse((event as MessageEvent<string>).data) as OutlineSnapshot);
      setConnection("live");
    });
    return () => events.close();
  }, []);

  useEffect(() => {
    const onPopState = () => setSelectedQuestion(questionFromUrl());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const navigate = (questionSlug: string | null) => {
    const url = new URL(window.location.href);
    if (questionSlug) url.searchParams.set("question", questionSlug);
    else url.searchParams.delete("question");
    window.history.pushState({}, "", url);
    setSelectedQuestion(questionSlug);
    window.scrollTo({ top: 0, behavior: "smooth" });
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
      <footer>○ open · ◐ leaning · ● decided · dotted outlines are suggested</footer>
    </main>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element.");
createRoot(root).render(<App />);
