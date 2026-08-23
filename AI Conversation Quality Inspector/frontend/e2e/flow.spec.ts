import { expect, test } from "@playwright/test";


const dimensions = [
  "需求理解",
  "情绪与语气",
  "信息准确性",
  "异议处理",
  "推进能力",
  "风险话术",
].map((name) => ({
  name,
  status: "scored",
  score: 72,
  summary: "结论已绑定到可定位的原文证据。",
  evidence: [
    {
      type: "missed_opportunity",
      turn_ids: ["t1", "t2"],
      quotes: ["这个价格有些贵", "我们已经是最低价格了"],
      rationale: "客户提出价格异议后，销售没有先澄清预算或价值顾虑。",
    },
  ],
  improvement: "先追问预算或价值顾虑，再提供可核验的信息。",
  confidence: "high",
}));


const analysis = {
  analysis_id: "analysis-e2e-1",
  qa_type: "sales",
  analysis_status: "scored",
  total_score: 72,
  scored_dimension_count: 6,
  confidence: "high",
  risk_level: "medium",
  risk_flags: ["绝对化价格承诺"],
  rubric_version: "qa-rubric-v1",
  prompt_version: "qa-analysis-v1",
  model_version: "fixture-model-v1",
  dimensions,
  major_issues: [
    {
      severity: "high",
      dimension: "信息准确性",
      title: "绝对化价格承诺",
      reason: "缺少产品政策支持最低价结论。",
      evidence_turn_ids: ["t2"],
    },
  ],
  suggested_reply: "理解您的顾虑，方便说说主要是在比较预算还是方案价值吗？",
  limitations: ["缺少企业价格政策，无法核验最低价说法。"],
  remaining_uses: 49,
};


test("invite to evidence report and feedback", async ({ page }, testInfo) => {
  let accessed = false;
  const browserErrors: string[] = [];
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      !message.text().includes("status of 401 (Unauthorized)")
    ) {
      browserErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));

  await page.route("**/backend-api/**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (pathname.endsWith("/public/config")) {
      await route.fulfill({
        status: 200,
        json: {
          min_transcript_chars: 20,
          max_transcript_chars: 12_000,
          max_turns: 200,
          invite_usage_limit: 50,
          rubric_version: "qa-rubric-v1",
        },
      });
      return;
    }
    if (pathname.endsWith("/access/status")) {
      if (!accessed) {
        await route.fulfill({
          status: 401,
          json: {
            error: {
              code: "ACCESS_TOKEN_INVALID",
              message: "访问凭证无效，请重新输入邀请码。",
              request_id: "e2e-access",
              retryable: false,
            },
          },
        });
        return;
      }
      await route.fulfill({
        status: 200,
        json: {
          authenticated: true,
          remaining_uses: 50,
          expires_at: "2026-08-23T00:00:00Z",
          csrf_token: "e2e-csrf",
        },
      });
      return;
    }
    if (pathname.endsWith("/access/redeem")) {
      accessed = true;
      await route.fulfill({
        status: 200,
        json: {
          remaining_uses: 50,
          expires_at: "2026-08-23T00:00:00Z",
          csrf_token: "e2e-csrf",
        },
      });
      return;
    }
    if (pathname.endsWith("/analyses") && request.method() === "POST") {
      await route.fulfill({ status: 200, json: analysis });
      return;
    }
    if (pathname.endsWith("/feedback") && request.method() === "PUT") {
      await route.fulfill({
        status: 200,
        json: { helpful: true, reason_code: null },
      });
      return;
    }
    await route.abort();
  });

  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "用邀请码进入工作台" }),
  ).toBeVisible();
  await page.getByLabel("邀请码").fill("pilot_e2e_1234567890");
  await page.getByRole("button", { name: "进入质检工作台" }).click();

  await expect(page.getByRole("heading", { name: "对话输入" })).toBeVisible();
  await page.getByRole("button", { name: "填入示例" }).click();
  await page.getByRole("button", { name: "开始质检" }).click();

  await expect(page.getByTestId("total-score")).toContainText("72");
  await expect(page.getByText("绝对化价格承诺").first()).toBeVisible();
  await expect(page.getByText("“我们已经是最低价格了”").first()).toBeVisible();
  await expect(page.getByLabel("剩余 49 次")).toHaveCount(0);
  await expect(page.getByText("不保存原文", { exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "有用" }).click();
  await expect(page.getByText("反馈已记录")).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath(`report-${testInfo.project.name}.png`),
    fullPage: true,
  });
  expect(browserErrors).toEqual([]);
});
