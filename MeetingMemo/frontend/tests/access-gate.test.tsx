import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AccessGate } from "@/components/access-gate";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

describe("AccessGate", () => {
  it("checks the cookie session before showing protected content", async () => {
    const session = deferred<{
      authenticated: true;
      session_id: string;
      expires_at: string;
    }>();
    const client = {
      getSession: () => session.promise,
      redeemInvite: vi.fn(),
    };

    render(
      <AccessGate client={client}>
        <div>会议工作台</div>
      </AccessGate>,
    );

    expect(screen.getByText("正在确认访问权限…")).toBeInTheDocument();
    session.resolve({
      authenticated: true,
      session_id: "session-1",
      expires_at: "2026-09-22T00:00:00Z",
    });
    expect(await screen.findByText("会议工作台")).toBeInTheDocument();
  });

  it("redeems an invite and enters the protected workspace", async () => {
    const user = userEvent.setup();
    const client = {
      getSession: vi.fn().mockRejectedValue({ status: 401 }),
      redeemInvite: vi.fn().mockResolvedValue({
        authenticated: true,
        remaining_redemptions: 12,
        expires_at: "2026-09-22T00:00:00Z",
      }),
    };

    render(
      <AccessGate client={client}>
        <div>会议工作台</div>
      </AccessGate>,
    );

    await user.type(await screen.findByLabelText("邀请码"), " BETA-1234 ");
    await user.click(screen.getByRole("button", { name: "进入 MeetingMemo" }));

    expect(client.redeemInvite).toHaveBeenCalledWith("BETA-1234");
    expect(await screen.findByText("会议工作台")).toBeInTheDocument();
  });

  it("keeps the invite form available after a rejected code", async () => {
    const user = userEvent.setup();
    const client = {
      getSession: vi.fn().mockRejectedValue({ status: 401 }),
      redeemInvite: vi
        .fn()
        .mockRejectedValue(new Error("邀请码无效或已经失效")),
    };

    render(
      <AccessGate client={client}>
        <div>会议工作台</div>
      </AccessGate>,
    );

    await user.type(await screen.findByLabelText("邀请码"), "WRONG-CODE");
    await user.click(screen.getByRole("button", { name: "进入 MeetingMemo" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "邀请码无效或已经失效",
    );
    expect(screen.getByLabelText("邀请码")).toHaveValue("WRONG-CODE");
  });

  it("returns to the invite boundary when a protected request becomes unauthorized", async () => {
    const client = {
      getSession: vi.fn().mockResolvedValue({
        authenticated: true,
        session_id: "session-1",
        expires_at: "2026-09-22T00:00:00Z",
      }),
      redeemInvite: vi.fn(),
    };

    render(
      <AccessGate client={client}>
        <div>会议工作台</div>
      </AccessGate>,
    );
    expect(await screen.findByText("会议工作台")).toBeInTheDocument();

    act(() => window.dispatchEvent(new Event("meetingmemo:unauthorized")));

    expect(await screen.findByLabelText("邀请码")).toBeInTheDocument();
    expect(screen.queryByText("会议工作台")).not.toBeInTheDocument();
  });
});
