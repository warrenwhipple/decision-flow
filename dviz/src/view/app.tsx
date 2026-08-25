import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import type { OutlineSnapshot, Question } from "../db/space.ts";

type Connection = "connecting" | "live" | "offline";

function QuestionCard({ question }: { question: Question }) {
  return (
    <article className={`question-card ${question.acceptance}`}>
      <span className="resolution" aria-label={`${question.resolution} question`}>○</span>
      <span className="question-title">{question.title}</span>
      <span className="question-id">Q{question.id}</span>
    </article>
  );
}

function Outline({ snapshot }: { snapshot: OutlineSnapshot }) {
  const questionsById = useMemo(
    () => new Map(snapshot.questions.map((question) => [question.id, question])),
    [snapshot.questions],
  );
  const childrenByParent = useMemo(() => {
    const children = new Map<number | null, number[]>();
    for (const placement of snapshot.placements) {
      const siblings = children.get(placement.parentId) ?? [];
      siblings.push(placement.childId);
      children.set(placement.parentId, siblings);
    }
    return children;
  }, [snapshot.placements]);

  const renderBranch = (parentId: number | null, ancestors = new Set<number>()) => {
    const childIds = childrenByParent.get(parentId) ?? [];
    return childIds.map((childId) => {
      const question = questionsById.get(childId);
      if (!question || ancestors.has(childId)) return null;
      const nextAncestors = new Set(ancestors).add(childId);
      const children = renderBranch(childId, nextAncestors);
      return (
        <li key={`${parentId ?? "root"}-${childId}`}>
          <QuestionCard question={question} />
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
  const [snapshot, setSnapshot] = useState<OutlineSnapshot>({ questions: [], placements: [] });
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
      <footer>Suggested questions use a dotted outline.</footer>
    </main>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element.");
createRoot(root).render(<App />);
