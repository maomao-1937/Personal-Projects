import "@testing-library/jest-dom/vitest";

import { afterEach } from "vitest";

afterEach(() => {
  if (typeof document !== "undefined") {
    document.body.innerHTML = "";
  }
});
