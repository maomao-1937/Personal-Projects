import { describe, expect, it } from "vitest";
import { resolvePlaywrightPort } from "./playwright-port";

describe("resolvePlaywrightPort", () => {
  it("uses an explicit valid port", () => {
    expect(resolvePlaywrightPort("3100")).toBe(3100);
  });

  it("falls back to port 3000 when unset", () => {
    expect(resolvePlaywrightPort(undefined)).toBe(3000);
  });
});
