import { expect, test } from "@playwright/test";

const source =
  "RAG 会先检索相关外部资料，再把资料加入当前上下文，让模型基于资料生成答案，而不是重新训练模型参数。".repeat(
    3,
  );

test("AI 服务失败后刷新仍保留回答，重试且不重复 Attempt", async ({
  page,
}) => {
  await page.goto("/sessions/new");
  await page.getByLabel("学习主题").fill(`失败恢复验收 ${Date.now()}`);
  await page.getByLabel("学习资料").fill(source);
  await page.getByRole("button", { name: "生成学习地图" }).click();
  await page.locator(".concept-row").first().click();

  const answerText = `RAG 就是搜索资料。【模拟服务端失败】${Date.now()}`;
  const answer = page.getByLabel("你的解释");
  await answer.fill(answerText);
  await page.getByRole("button", { name: "提交解释" }).click();

  await expect(page.locator(".form-alert")).toContainText("回答已保存");
  await expect(answer).toHaveValue(answerText);
  await page.reload();
  await expect(answer).toHaveValue(answerText);
  await expect(page.getByRole("button", { name: "重试这次判断" })).toBeVisible();
  await page.getByRole("button", { name: "重试这次判断" }).click();

  await expect(page.getByText("还需想清楚")).toBeVisible();
  await expect(page.getByText("1 次回答")).toBeVisible();
  await page.reload();
  await expect(page.getByText("1 次回答")).toBeVisible();
  await expect(page.getByText("还需想清楚")).toBeVisible();
});
