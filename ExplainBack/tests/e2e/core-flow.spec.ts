import { expect, test } from "@playwright/test";

const ragSource = `RAG 会在生成答案前检索外部知识，并把相关资料作为上下文交给模型。
它用于补充模型参数中缺少、过时或属于私有领域的信息。检索阶段负责找到相关片段，生成阶段依据这些片段组织回答。
资料可以来自互联网，也可以来自企业内部知识库。Embedding 用于把查询和文本表示为向量，Chunk 决定检索片段的粒度，Reranking 用于重新排序候选结果。`;

test("完成从资料到 Mastered 的学习闭环并在刷新后保留", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("water-canvas")).toBeAttached();
  await page.getByRole("link", { name: "开始一次学习" }).click();

  await page.getByLabel("学习主题").fill(`RAG 浏览器验收 ${Date.now()}`);
  await page.getByLabel("学习资料").fill(ragSource);
  await page.getByRole("button", { name: "生成学习地图" }).click();

  await expect(page).toHaveURL(/\/sessions\/[0-9a-f-]+$/);
  const firstConcept = page.locator(".concept-row").first();
  await expect(firstConcept).toBeVisible();
  await firstConcept.click();

  const answer = page.getByLabel("你的解释");
  await expect(answer).toBeVisible();
  await answer.fill("RAG 就是搜索资料。");
  await page.getByRole("button", { name: "提交解释" }).click();

  await expect(page.getByText("还需想清楚")).toBeVisible();
  await expect(page.getByText("没有解释检索到的资料如何参与生成")).toBeVisible();

  await page.getByRole("button", { name: /Level 1/ }).click();
  await expect(page.getByRole("button", { name: /Level 2/ })).toBeVisible();
  await page.getByRole("button", { name: /Level 2/ }).click();
  await expect(page.getByRole("button", { name: /Level 3/ })).toBeVisible();
  await page.getByRole("button", { name: /Level 3/ }).click();

  await expect(page.getByText("现在请重新完整解释", { exact: true })).toBeVisible();
  await answer.fill(
    "先检索外部资料，再把资料放进上下文，让模型基于资料生成答案。",
  );
  await page.getByRole("button", { name: "提交重新解释" }).click();

  await expect(
    page.getByRole("heading", { name: "这个知识点已经讲明白了" }),
  ).toBeVisible();
  await expect(page.getByText("已修复漏洞")).toBeVisible();

  await page.reload();
  await expect(
    page.getByRole("heading", { name: "这个知识点已经讲明白了" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
});
