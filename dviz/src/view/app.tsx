import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import type { Option, OutlineSnapshot, Placement, Question } from "../db/space.ts";

type Connection = "connecting" | "live" | "offline";

const resolutionGlyph = { open: "○", leaning: "◐", decided: "●" } as const;

function QuestionCard({
  question,
  placement,
  options,
}: {
  question: Question;
  placement: Placement;
  options: Option[];
}) {
  const selected = options.find(({ slug }) => slug === question.resolvedOptionSlug);
  const suggested = question.acceptance === "suggested" || placement.acceptance === "suggested";
  return (
    <div className="decision-entry">
      <article className={`question-card ${suggested ? "suggested" : "accepted"} ${question.resolution}`}>
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
      </article>
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

function Outline({ snapshot }: { snapshot: OutlineSnapshot }) {
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
          <QuestionCard question={question} placement={placement} options={optionsByQuestion.get(childSlug) ?? []} />
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

function App() {
  const [snapshot, setSnapshot] = useState<OutlineSnapshot>({ questions: [], placements: [], options: [] });
  const [connection, setConnection] = useState<Connection>("connecting");

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

  return (
    <main>
      <header>
        <div>
          <p className="eyebrow">Decision Flow</p>
          <h1>Live outline</h1>
        </div>
        <div className={`connection ${connection}`}>
          <span aria-hidden="true" />
          {connection}
        </div>
      </header>
      <section aria-live="polite">
        <Outline snapshot={snapshot} />
      </section>
      <footer>○ open · ◐ leaning · ● decided · dotted outlines are suggested</footer>
    </main>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element.");
createRoot(root).render(<App />);
