import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";
import { loadConfigFromFile } from "vite";

describe("Vitest path aliases", () => {
  it("uses a decoded filesystem path when the project directory contains spaces", async () => {
    const loadedConfig = await loadConfigFromFile(
      { command: "serve", mode: "test" },
      resolve(process.cwd(), "vitest.config.ts"),
    );
    const aliases = loadedConfig?.config.resolve?.alias as Record<string, string>;
    const expectedSourcePath = resolve(process.cwd(), "src");

    expect(aliases["@"]).toBe(expectedSourcePath);
    expect(existsSync(aliases["@"])).toBe(true);
  });
});
