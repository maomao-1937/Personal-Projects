import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { demoProject } from "../_lib/fixture";
import DemoLayout from "../layout";
import { DemoProjectProvider, useDemoProject } from "./demo-project-provider";

function WorkspaceHarness() {
  const [workspace, setWorkspace] = useState<"storyboard" | "editor">("storyboard");
  const { applyShotEdits, project } = useDemoProject();
  const shot = project.shots.find((item) => item.id === "shot-01");

  if (!shot) return null;

  if (workspace === "editor") {
    return (
      <section aria-label="镜头编辑工作区">
        <p>{shot.prompt}</p>
        <p>{shot.cameraMotion}</p>
      </section>
    );
  }

  return (
    <section aria-label="故事板工作区">
      <button
        onClick={() => {
          applyShotEdits("shot-01", {
            prompt: "Provider 中的雨夜站台",
            cameraMotion: "手持漂移",
          });
          setWorkspace("editor");
        }}
        type="button"
      >
        应用并导航
      </button>
    </section>
  );
}

describe("DemoProjectProvider", () => {
  it("在持久 layout 内切换工作区时保留项目编辑", async () => {
    const user = userEvent.setup();
    render(
      <DemoProjectProvider initialProject={demoProject}>
        <WorkspaceHarness />
      </DemoProjectProvider>,
    );

    await user.click(screen.getByRole("button", { name: "应用并导航" }));

    const editor = screen.getByRole("region", { name: "镜头编辑工作区" });
    expect(editor).toHaveTextContent("Provider 中的雨夜站台");
    expect(editor).toHaveTextContent("手持漂移");
  });

  it("由 demo layout 只挂载一个共享 Provider", () => {
    function ProjectTitle() {
      const { project } = useDemoProject();
      return <p>{project.title}</p>;
    }

    render(
      <DemoLayout>
        <ProjectTitle />
      </DemoLayout>,
    );

    expect(screen.getByText("After Rain")).toBeVisible();
  });
});
