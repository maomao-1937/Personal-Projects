export type KnowledgeMode = "source_bound" | "topic_general";

export function getKnowledgeMode(sourceText: string): KnowledgeMode {
  return sourceText.trim().length === 0 ? "topic_general" : "source_bound";
}
