import type { QuestionRelation } from "./space.ts";

/** Both directions, in the same order in outline and show. */
export function relationGroups(relations: QuestionRelation[], slug: string): { label: string; entries: { reference: string; relation: QuestionRelation }[] }[] {
  const group = (label: string, kind: QuestionRelation["kind"], direction: "from" | "to") => ({ label,
    entries: relations.filter((r) => r.kind === kind && (direction === "from" && kind === "raises" ? r.from.split("/")[0] : r[direction]) === slug)
      .map((relation) => ({ relation, reference: direction === "to" ? relation.from : kind === "raises" ? `${relation.from.split("/")[1]}→${relation.to}` : relation.to })),
  });
  return [group("part of", "part-of", "from"), group("parts", "part-of", "to"),
    group("raised by", "raises", "to"), group("raises", "raises", "from"),
    group("blocked by", "blocks", "to"), group("blocks", "blocks", "from")].filter(({ entries }) => entries.length);
}

