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
  const selected = options.find(({ id }) => id === question.resolvedOptionId);
  const suggested = question.acceptance === "suggested" || placement.acceptance === "suggested";
  return (
    <div className="decision-entry">
      <article className={`question-card ${suggested ? "suggested" : "accepted"} ${question.resolution}`}>
        <span className="resolution" aria-label={`${question.resolution} question`}>
          {resolutionGlyph[question.resolution]}
        </span>
        <span className="question-copy">
          <span className="question-title">{question.title}</span>
          {selected && question.resolution !== "open" && (
            <span className="selected-option">
              {question.resolution === "decided" ? "Decided" : "Leaning"}: {selected.title}
            </span>
          )}
        </span>
        <span className="question-id">Q{question.id}</span>
      </article>
      {options.length > 0 && (
        <ul className="option-list" aria-label={`Options for ${question.title}`}>
          {options.map((option) => (
            <li
              className={`${option.acceptance} ${option.id === question.resolvedOptionId ? "selected" : ""}`}
              key={option.id}
            >
              <span>{option.title}</span>
              <span className="option-id">O{option.id}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Outline({ snapshot }: { snapshot: OutlineSnapshot }) {
  const questionsById = useMemo(
    () => new Map(snapshot.questions.map((question) => [question.id, question])),
    [snapshot.questions],
  );
  const childrenByParent = useMemo(() => {
    const children = new Map<number | null, Placement[]>();
    for (const placement of snapshot.placements) {
      const siblings = children.get(placement.parentId) ?? [];
      siblings.push(placement);
      children.set(placement.parentId, siblings);
    }
    return children;
  }, [snapshot.placements]);
  const optionsByQuestion = useMemo(() => {
    const options = new Map<number, Option[]>();
    for (const option of snapshot.options) {
      const siblings = options.get(option.questionId) ?? [];
      siblings.push(option);
      options.set(option.questionId, siblings);
    }
    return options;
  }, [snapshot.options]);

  const renderBranch = (parentId: number | null, ancestors = new Set<number>()) => {
    const placements = childrenByParent.get(parentId) ?? [];
    return placements.map((placement) => {
      const childId = placement.childId;
      const question = questionsById.get(childId);
      if (!question || ancestors.has(childId)) return null;
      const nextAncestors = new Set(ancestors).add(childId);
      const children = renderBranch(childId, nextAncestors);
      return (
        <li key={`${parentId ?? "root"}-${childId}`}>
          <QuestionCard question={question} placement={placement} options={optionsByQuestion.get(childId) ?? []} />
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
        <code>dviz question add "What should we decide?"</code>
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
