import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AccessForm } from "@/features/auth/access-form";
import { authApi, AppError } from "@/features/game/api";

const replace = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh }),
}));

describe("AccessForm", () => {
  beforeEach(() => {
    replace.mockReset();
    refresh.mockReset();
    vi.restoreAllMocks();
  });

  it("submits the access token and enters the requested page", async () => {
    vi.spyOn(authApi, "login").mockResolvedValue(undefined);
    render(<AccessForm nextPath="/case/001/briefing" />);

    fireEvent.change(screen.getByLabelText("访问令牌"), {
      target: { value: "ONE-TOKEN" },
    });
    fireEvent.click(screen.getByRole("button", { name: "进入审讯室" }));

    await waitFor(() => {
      expect(authApi.login).toHaveBeenCalledWith("ONE-TOKEN");
      expect(replace).toHaveBeenCalledWith("/case/001/briefing");
      expect(refresh).toHaveBeenCalledTimes(1);
    });
  });

  it("keeps the token editable and gives a useful rejection message", async () => {
    vi.spyOn(authApi, "login").mockRejectedValue(
      new AppError("INVALID_ACCESS_TOKEN", "访问令牌不正确。", 401),
    );
    render(<AccessForm nextPath="/" />);
    const input = screen.getByLabelText("访问令牌");

    fireEvent.change(input, { target: { value: "WRONG" } });
    fireEvent.click(screen.getByRole("button", { name: "进入审讯室" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("访问令牌不正确");
    expect(input).toHaveValue("WRONG");
    expect(input).toHaveFocus();
  });
});
