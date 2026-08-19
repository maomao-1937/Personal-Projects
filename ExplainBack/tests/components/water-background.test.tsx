import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { WaterBackground } from "@/components/water-background";

describe("WaterBackground", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    );
  });

  it("是纯装饰层，不接管点击和辅助技术焦点", () => {
    render(<WaterBackground />);

    expect(screen.getByTestId("water-background")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    expect(screen.getByTestId("water-canvas")).toHaveStyle({
      pointerEvents: "none",
    });
  });

  it("用户偏好减少动态效果时不启动动画帧", () => {
    const requestAnimationFrame = vi.fn();
    vi.stubGlobal("requestAnimationFrame", requestAnimationFrame);

    render(<WaterBackground />);

    expect(requestAnimationFrame).not.toHaveBeenCalled();
  });
});
