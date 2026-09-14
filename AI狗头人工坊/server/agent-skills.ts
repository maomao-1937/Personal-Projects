import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

const skillIds = ["creation-workflow", "portrait-director", "portrait-review"] as const;
export type AgentSkillId = (typeof skillIds)[number];
export type AgentSkill = {
  name: AgentSkillId;
  version: string;
  sha256: string;
  instructions: string;
};

// Only reviewed, project-owned files can become runtime instructions.
// Downloaded role references and user-provided names never expand this allowlist.
export function parseAgentSkill(name: AgentSkillId, source: string): AgentSkill {
  if (!skillIds.includes(name)) throw new Error("Unknown runtime skill");
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]+)$/);
  if (!match || source.length > 16000) throw new Error(`Invalid skill document: ${name}`);
  const names = [...match[1].matchAll(/^name: ([a-z-]+)\r?$/gm)];
  const versions = [...match[1].matchAll(/^version: (\d+\.\d+\.\d+)\r?$/gm)];
  if (names.length !== 1 || names[0][1] !== name || versions.length !== 1 || !match[2].trim()) {
    throw new Error(`Invalid skill identity or version: ${name}`);
  }
  return {
    name,
    version: versions[0][1],
    sha256: createHash("sha256").update(source).digest("hex"),
    instructions: match[2].trim(),
  };
}

const cache = new Map<AgentSkillId, Promise<AgentSkill>>();
export function loadAgentSkill(name: AgentSkillId): Promise<AgentSkill> {
  if (!skillIds.includes(name)) return Promise.reject(new Error("Unknown runtime skill"));
  let loading = cache.get(name);
  if (!loading) {
    loading = readFile(path.resolve("agent-skills", name, "SKILL.md"), "utf8")
      .then(source => parseAgentSkill(name, source))
      .catch(error => { cache.delete(name); throw error; });
    cache.set(name, loading);
  }
  return loading;
}
