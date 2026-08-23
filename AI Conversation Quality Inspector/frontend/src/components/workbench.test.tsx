import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import { Workbench } from "@/components/workbench";


const access = {
  authenticated: true as const,
  remaining_uses: 50,
  expires_at: "2026-08-23T00:00:00Z",
  csrf_token: "csrf-token",
};

const publicConfig = {
  min_transcript_chars: 20,
  max_transcript_chars: 12_000,
  max_turns: 200,
  invite_usage_limit: 50,
  rubric_version: "qa-rubric-v1",
};


it("submits the selected scene and transcript once", async () => {
  const user = userEvent.setup();
  const onAnalyze = vi.fn().mockResolvedValue(undefined);
  render(
    <Workbench
      access={access}
      analyzing={false}
      config={publicConfig}
      error={null}
      onAnalyze={onAnalyze}
      onLeave={vi.fn().mockResolvedValue(undefined)}
      report={null}
    />,
  );

  await user.click(screen.getByRole("radio", { name: "客服质检" }));
  await user.type(
    screen.getByLabelText("聊天记录"),
    "客户：退款什么时候能到账？\n客服：我现在帮您核实订单和处理进度。",
  );
  await user.click(screen.getByRole("button", { name: "开始质检" }));

  expect(onAnalyze).toHaveBeenCalledTimes(1);
  expect(onAnalyze).toHaveBeenCalledWith({
    qa_type: "customer_service",
    transcript: "客户：退款什么时候能到账？\n客服：我现在帮您核实订单和处理进度。",
  });
});


it("shows the input boundary and disables duplicate submission", async () => {
  const user = userEvent.setup();
  const onAnalyze = vi.fn().mockResolvedValue(undefined);
  const view = render(
    <Workbench
      access={access}
      analyzing={false}
      config={publicConfig}
      error={null}
      onAnalyze={onAnalyze}
      onLeave={vi.fn().mockResolvedValue(undefined)}
      report={null}
    />,
  );

  await user.type(screen.getByLabelText("聊天记录"), "客户：你好");
  expect(screen.getByText("5 / 12,000")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "开始质检" })).toBeDisabled();

  view.rerender(
    <Workbench
      access={access}
      analyzing
      config={publicConfig}
      error={null}
      onAnalyze={onAnalyze}
      onLeave={vi.fn().mockResolvedValue(undefined)}
      report={null}
    />,
  );
  expect(screen.getByRole("button", { name: "正在分析…" })).toBeDisabled();
});


it("can fill and clear a correctly formatted example", async () => {
  const user = userEvent.setup();
  render(
    <Workbench
      access={access}
      analyzing={false}
      config={publicConfig}
      error={null}
      onAnalyze={vi.fn().mockResolvedValue(undefined)}
      onLeave={vi.fn().mockResolvedValue(undefined)}
      report={null}
    />,
  );

  await user.click(screen.getByRole("button", { name: "填入示例" }));
  const transcript = screen.getByLabelText("聊天记录") as HTMLTextAreaElement;
  expect(transcript.value).toContain("客户：");
  await user.click(screen.getByRole("button", { name: "清空" }));
  expect(screen.getByLabelText("聊天记录")).toHaveValue("");
});


it("hides quota and transcript retention labels", () => {
  render(
    <Workbench
      access={access}
      analyzing={false}
      config={publicConfig}
      error={null}
      onAnalyze={vi.fn().mockResolvedValue(undefined)}
      onLeave={vi.fn().mockResolvedValue(undefined)}
      report={null}
    />,
  );

  expect(screen.queryByText("剩余额度")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("剩余 50 次")).not.toBeInTheDocument();
  expect(screen.queryByText("不保存原文")).not.toBeInTheDocument();
});


it("prevents submissions after the invitation quota is exhausted", async () => {
  const user = userEvent.setup();
  const onAnalyze = vi.fn().mockResolvedValue(undefined);
  render(
    <Workbench
      access={{ ...access, remaining_uses: 0 }}
      analyzing={false}
      config={publicConfig}
      error={null}
      onAnalyze={onAnalyze}
      onLeave={vi.fn().mockResolvedValue(undefined)}
      report={null}
    />,
  );

  await user.click(screen.getByRole("button", { name: "填入示例" }));

  expect(screen.getByRole("button", { name: "额度已用完" })).toBeDisabled();
  await user.click(screen.getByRole("button", { name: "额度已用完" }));
  expect(onAnalyze).not.toHaveBeenCalled();
});
