import { expect, test } from "@playwright/test";

test("只填写主题即可进入训练", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("学习资料可选")).toBeVisible();
  await page.getByRole("link", { name: "开始一次学习" }).click();
  await expect(
    page.getByText("输入一个想讲明白的主题；如有资料，也可以一并粘贴。"),
  ).toBeVisible();
  await page.getByLabel("学习主题").fill(`RAG 主题直练 ${Date.now()}`);
  await expect(page.getByLabel("学习资料（可选）")).toHaveValue("");
  await page.getByRole("button", { name: "生成学习地图" }).click();

  await expect(page).toHaveURL(/\/sessions\/[0-9a-f-]+$/);
  const concept = page.locator(".concept-row").first();
  await expect(concept).toBeVisible();
  await concept.click();

  await expect(page.getByLabel("你的解释")).toBeVisible();
  await expect(page.getByTestId("current-question")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
});
