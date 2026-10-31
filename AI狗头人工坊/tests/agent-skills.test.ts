import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { loadAgentSkill, parseAgentSkill, type AgentSkillId } from "../server/agent-skills";

test("runtime skill identity matches the exact loaded file and rejects ambiguous metadata", async () => {
  const source = await readFile("agent-skills/creation-workflow/SKILL.md", "utf8");
  const skill = await loadAgentSkill("creation-workflow");
  assert.equal(skill.version, "1.1.0");
  assert.equal(skill.sha256, createHash("sha256").update(source).digest("hex"));
  assert.ok(skill.instructions.includes("accepted 后直接调用 generate_image"));
  assert.ok(!skill.instructions.startsWith("---"));
  assert.throws(() => parseAgentSkill("portrait-director", source));
  assert.throws(() => parseAgentSkill("creation-workflow", source.replace("version: 1.1.0", "version: current")));
  assert.throws(() => parseAgentSkill("creation-workflow", source.replace("version: 1.1.0", "version: 1.1.0\nversion: 2.0.0")));
  assert.throws(() => parseAgentSkill("creation-workflow", "---\nname: creation-workflow\nversion: 1.1.0\n---\n  "));
});

test("unreviewed or path-traversal skill names cannot select runtime files", async () => {
  for (const name of ["../../README", "testing-reality-checker", "toString"]) {
    await assert.rejects(loadAgentSkill(name as AgentSkillId), /Unknown runtime skill/);
  }
});

test("runtime skills load from the project when the process starts elsewhere", async () => {
  const originalCwd = process.cwd();
  const otherCwd = await mkdtemp(path.join(tmpdir(), "goutou-skill-cwd-"));
  try {
    process.chdir(otherCwd);
    const skill = await loadAgentSkill("portrait-director");
    assert.equal(skill.name, "portrait-director");
  } finally {
    process.chdir(originalCwd);
    await rm(otherCwd, { recursive: true, force: true });
  }
});
