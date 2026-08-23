import { render, screen } from "@testing-library/react";

import Home from "@/app/page";

describe("MeetingMemo entry", () => {
  it("presents the product while the access boundary initializes", async () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", { level: 1, name: "MeetingMemo" }),
    ).toBeInTheDocument();
    expect(screen.getByText("正在确认访问权限…")).toBeInTheDocument();
    expect(await screen.findByLabelText("邀请码")).toBeInTheDocument();
  });
});
