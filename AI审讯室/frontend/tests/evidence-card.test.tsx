import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EvidenceCard } from "@/features/game/components/evidence-card";

const evidence = {
  id: "E02",
  name: "侧门门禁记录",
  description: "21:17，个人门禁卡打开侧门。",
  source: "门禁控制器",
  hint: "对照嫌疑人的位置证词。",
  public: true,
};

describe("EvidenceCard", () => {
  it("announces state in text and calls selection", () => {
    const onSelect = vi.fn();
    render(
      <EvidenceCard
        evidence={evidence}
        state="effective"
        selected={false}
        onSelect={onSelect}
      />,
    );

    expect(screen.getByText("已命中矛盾")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /选择证据 E02/ }));
    expect(onSelect).toHaveBeenCalledWith("E02");
  });
});

