import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import { FeedbackControl } from "@/components/feedback-control";


it("submits a helpful vote immediately", async () => {
  const user = userEvent.setup();
  const onFeedback = vi.fn().mockResolvedValue(undefined);
  render(<FeedbackControl onFeedback={onFeedback} />);

  await user.click(screen.getByRole("button", { name: "有用" }));

  expect(onFeedback).toHaveBeenCalledWith({ helpful: true, reason_code: null });
  expect(await screen.findByText("反馈已记录")) .toBeInTheDocument();
});


it("collects a reason for an unhelpful report", async () => {
  const user = userEvent.setup();
  const onFeedback = vi.fn().mockResolvedValue(undefined);
  render(<FeedbackControl onFeedback={onFeedback} />);

  await user.click(screen.getByRole("button", { name: "需改进" }));
  await user.click(screen.getByRole("radio", { name: "评分不公平" }));
  await user.click(screen.getByRole("button", { name: "提交反馈" }));

  expect(onFeedback).toHaveBeenCalledWith({
    helpful: false,
    reason_code: "score_unfair",
  });
});


it("keeps the report usable when feedback fails", async () => {
  const user = userEvent.setup();
  const onFeedback = vi.fn().mockRejectedValue(new Error("network"));
  render(<FeedbackControl onFeedback={onFeedback} />);

  await user.click(screen.getByRole("button", { name: "有用" }));

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "反馈暂时没有保存，请重试。",
  );
  expect(screen.getByRole("button", { name: "有用" })).toBeEnabled();
});
