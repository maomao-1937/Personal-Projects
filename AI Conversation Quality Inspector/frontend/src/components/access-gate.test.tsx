import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import { AccessGate } from "@/components/access-gate";


it("redeems a pilot invite without account language", async () => {
  const user = userEvent.setup();
  const onRedeem = vi.fn().mockResolvedValue(undefined);
  render(
    <AccessGate
      busy={false}
      error={null}
      onRedeem={onRedeem}
    />,
  );

  expect(
    screen.getByRole("heading", { name: "用邀请码进入工作台" }),
  ).toBeInTheDocument();
  expect(screen.queryByText(/注册|登录|密码/)).not.toBeInTheDocument();

  await user.type(screen.getByLabelText("邀请码"), "pilot_example_1234567890");
  await user.click(screen.getByRole("button", { name: "进入质检工作台" }));

  expect(onRedeem).toHaveBeenCalledWith("pilot_example_1234567890");
});


it("keeps the invite editable after a safe error", () => {
  render(
    <AccessGate
      busy={false}
      error="邀请码无效。"
      onRedeem={vi.fn().mockResolvedValue(undefined)}
    />,
  );

  expect(screen.getByRole("alert")).toHaveTextContent("邀请码无效。");
  expect(screen.getByLabelText("邀请码")).toBeEnabled();
});


it("shows only the essential invitation copy", () => {
  render(
    <AccessGate
      busy={false}
      error={null}
      onRedeem={vi.fn().mockResolvedValue(undefined)}
    />,
  );

  expect(
    screen.getByRole("heading", { name: "把判断，钉回原话。" }),
  ).toBeInTheDocument();
  expect(screen.queryByText(/六个维度不是一串孤立分数/)).not.toBeInTheDocument();
  expect(screen.queryByText(/每个邀请码可完成/)).not.toBeInTheDocument();
  expect(
    screen.queryByText(/原始聊天和完整报告不会保存/),
  ).not.toBeInTheDocument();
});
