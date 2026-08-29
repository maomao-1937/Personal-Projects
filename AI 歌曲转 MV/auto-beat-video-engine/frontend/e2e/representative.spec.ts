import { expect, test } from "@playwright/test";
import path from "node:path";

const viewports = [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
] as const;

test("representative workspace stays usable at all approved widths", async ({ page }) => {
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto("/projects/demo/storyboard");

    await expect(page.getByText("UI 预览数据", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: /霁虹街区/ })).toBeVisible();
    if (viewport.width === 768) {
      const inspectorToggle = page.getByRole("button", { name: "展开或收起 Cut 编辑面板" });
      await inspectorToggle.click();
      await expect(page.getByRole("complementary", { name: "Cut 编辑" })).toBeVisible();
      await inspectorToggle.click();
    }
    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalOverflow).toBe(false);

    const screenshotPath = path.resolve(
      process.cwd(),
      `../docs/frontend/screenshots/implementation-${viewport.width}x${viewport.height}.png`,
    );
    await page.screenshot({ path: screenshotPath, fullPage: false });
  }
});

test("local interaction keeps succeeded work and rebuilds a stale preview", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/projects/demo/storyboard");

  await page.getByRole("button", { name: "选择 Cut 06" }).click();
  await expect(page.getByRole("complementary", { name: "Cut 编辑" })).toContainText("生成失败");
  await page.getByRole("button", { name: "重试 Cut 06", exact: true }).click();
  await expect(page.getByTestId("cut-cut-06")).toContainText("排队中");
  await expect(page.getByTestId("cut-cut-04")).toContainText("已完成");

  const prompt = page.getByLabel("视频提示词");
  await prompt.fill("新的镜头提示词");
  await page.getByRole("button", { name: "保存修改" }).click();
  await expect(page.getByText("预览需要更新")).toBeVisible();
  await page.getByRole("button", { name: "重新构建预览" }).click();
  await expect(page.getByText("预览构建中")).toBeVisible();
});
