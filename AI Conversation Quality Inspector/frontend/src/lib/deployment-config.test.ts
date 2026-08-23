// @vitest-environment node

import { readFileSync } from "node:fs";

import ignore from "ignore";
import { describe, expect, it } from "vitest";

describe("veFaaS deployment packaging", () => {
  const deploymentIgnore = ignore().add(
    readFileSync(new URL("../../.vefaasignore", import.meta.url), "utf8"),
  );

  it.each([
    "node_modules/next/package.json",
    "node_modules/react/package.json",
  ])("keeps standalone runtime dependency %s", (runtimeFile) => {
    expect(deploymentIgnore.ignores(runtimeFile)).toBe(false);
  });

  it.each([
    ".env.production",
    ".next/cache/webpack/client.pack",
    "coverage/index.html",
    "playwright-report/index.html",
    "e2e/flow.spec.ts",
    "src/components/workbench.test.tsx",
  ])("excludes non-runtime deployment file %s", (excludedFile) => {
    expect(deploymentIgnore.ignores(excludedFile)).toBe(true);
  });
});
