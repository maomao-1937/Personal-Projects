import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StoryboardWorkspace } from "./storyboard-workspace";

describe("StoryboardWorkspace shell", () => {
  it("renders the approved project, progress, audio, and scene hierarchy", () => {
    render(<StoryboardWorkspace />);

    expect(screen.getByRole("banner")).toHaveTextContent("声画");
    expect(screen.getByLabelText("项目进度")).toHaveTextContent("镜头");
    expect(screen.getByLabelText("音频波形")).toHaveTextContent("BPM 124");
    expect(screen.getByRole("navigation", { name: "场景" })).toHaveTextContent(
      "霁虹街区",
    );
  });
});
