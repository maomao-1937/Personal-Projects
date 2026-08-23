import { expect, test, type Page, type Route } from "@playwright/test";

const meeting = {
  id: "meeting-1",
  title: "产品体验复盘",
  meeting_at: "2026-08-23T02:00:00Z",
  timezone: "Asia/Shanghai",
  source: "manual",
  language: "zh-CN",
  status: "ready",
  created_at: "2026-08-23T02:00:00Z",
  updated_at: "2026-08-23T02:30:00Z",
};

const detail = {
  ...meeting,
  segments: [
    {
      id: "seg-1",
      sequence: 0,
      start_ms: 0,
      end_ms: 18000,
      speaker: "林一",
      text: "今天重点确认内测反馈和发布节奏。",
    },
    {
      id: "seg-2",
      sequence: 1,
      start_ms: 65000,
      end_ms: 85000,
      speaker: "周楠",
      text: "确认周三发布，我来完成上线清单。",
    },
  ],
};

const summary = {
  id: "summary-1",
  meeting_id: "meeting-1",
  version: 1,
  schema_version: "1.0",
  content: {
    summary_version: "1.0",
    headline: "团队确认周三发布，并在发布前完成最后一轮体验核验。",
    topics: [
      {
        title: "发布节奏",
        summary: "内测问题已收敛，发布计划保持不变。",
        source_segment_ids: ["seg-1", "seg-2"],
      },
    ],
    decisions: [
      {
        text: "本周三正式发布。",
        source_segment_ids: ["seg-2"],
        confidence: "high",
      },
    ],
    action_items: [
      {
        task: "完成上线清单并发到项目群。",
        owner: "周楠",
        due_date: "2026-08-26",
        source_segment_ids: ["seg-2"],
        confidence: "high",
      },
    ],
    open_questions: [],
    quality_flags: [],
  },
  quality_flags: [],
  status: "draft",
  parent_version_id: null,
  created_source: "ai",
  created_at: "2026-08-23T02:32:00Z",
};

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

async function mockApi(page: Page) {
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    if (path === "/api/v1/access/session") {
      return fulfillJson(route, {
        authenticated: true,
        session_id: "session-1",
        expires_at: "2026-09-22T00:00:00Z",
      });
    }
    if (path === "/api/v1/meetings" && request.method() === "GET") {
      return fulfillJson(route, { items: [meeting] });
    }
    if (path === "/api/v1/integrations") {
      return fulfillJson(route, {
        slack: { status: "not_configured" },
        email: { status: "configured" },
        zoom: { status: "not_configured" },
        google_meet: { status: "not_configured" },
      });
    }
    if (path === "/api/v1/meetings/meeting-1") return fulfillJson(route, detail);
    if (path === "/api/v1/meetings/meeting-1/summaries") {
      return fulfillJson(route, { items: [summary] });
    }
    if (path === "/api/v1/summaries/summary-1/revisions") {
      const payload = request.postDataJSON();
      return fulfillJson(
        route,
        {
          ...summary,
          id: "summary-2",
          version: 2,
          parent_version_id: "summary-1",
          created_source: "user",
          content: payload.content,
        },
        201,
      );
    }
    return fulfillJson(route, { error: { code: "NOT_MOCKED", message: path } }, 404);
  });
}

test("desktop review flow remains traceable and editable", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await page.setViewportSize({ width: 1440, height: 960 });
  await mockApi(page);
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  await expect(page.getByRole("heading", { level: 1, name: "产品体验复盘" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "会议导航" })).toBeVisible();
  await expect(page.getByRole("complementary", { name: "会议洞察" })).toBeVisible();
  await page.getByRole("button", { name: "查看来源 01:05" }).first().click();
  await expect(page.getByRole("tab", { name: "转写" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("确认周三发布，我来完成上线清单。")).toBeVisible();

  await page.getByRole("button", { name: "编辑摘要" }).click();
  await page.getByLabel("摘要标题").fill("团队确认周三发布，移动端核验通过后上线。");
  await page.getByRole("button", { name: "保存为新版本" }).click();
  await expect(page.getByText("v2", { exact: true })).toBeVisible();
  await expect(page.evaluate(() => document.documentElement.scrollWidth)).resolves.toBeLessThanOrEqual(1440);
  expect(consoleErrors).toEqual([]);
});

test("mobile layout exposes meetings and insights through compact drawers", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await mockApi(page);
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  const insightButtonBox = await page
    .getByRole("button", { name: "打开会议洞察" })
    .boundingBox();
  const editButtonBox = await page.getByRole("button", { name: "编辑摘要" }).boundingBox();
  const exportButtonBox = await page.locator(".export-menu > summary").boundingBox();
  const menuButtonBox = await page.getByRole("button", { name: "打开会议列表" }).boundingBox();
  expect(insightButtonBox?.width).toBeLessThanOrEqual(46);
  expect(exportButtonBox?.width).toBeLessThanOrEqual(46);
  for (const box of [menuButtonBox, insightButtonBox, editButtonBox, exportButtonBox]) {
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  }
  expect(
    await page.locator(".document-kicker").evaluate((element) =>
      element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true);
  expect(
    await page.locator(".document-kicker").evaluate((element) =>
      Array.from(element.children).every((child) => child.getBoundingClientRect().height <= 20),
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "打开会议列表" }).click();
  await expect(page.getByRole("navigation", { name: "会议导航" })).toBeVisible();
  await page.getByRole("button", { name: "关闭会议列表" }).first().click();
  await page.getByRole("button", { name: "打开会议洞察" }).click();
  await expect(page.getByRole("complementary", { name: "会议洞察" })).toBeVisible();
  await expect(page.getByText("完成上线清单并发到项目群。")).toBeVisible();
  await page.getByRole("button", { name: "关闭会议洞察" }).last().click();
  await expect(page.evaluate(() => document.documentElement.scrollWidth)).resolves.toBeLessThanOrEqual(390);
  expect(consoleErrors).toEqual([]);
});

test("tablet header keeps the title and all document actions readable", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await mockApi(page);
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  const insightBox = await page.getByRole("button", { name: "打开会议洞察" }).boundingBox();
  const editBox = await page.getByRole("button", { name: "编辑摘要" }).boundingBox();
  const exportBox = await page.locator(".export-menu > summary").boundingBox();
  expect(insightBox?.width).toBeLessThanOrEqual(46);
  expect(editBox?.width).toBeLessThanOrEqual(46);
  expect(exportBox?.width).toBeLessThanOrEqual(46);
  expect(
    await page.getByRole("heading", { level: 1 }).evaluate((element) =>
      element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true);
});

test("invite, import, running job, approval and download form one browser flow", async ({ page }) => {
  let authenticated = false;
  let created = false;
  let jobPolls = 0;
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === "/api/v1/access/session") {
      return authenticated
        ? fulfillJson(route, {
            authenticated: true,
            session_id: "session-flow",
            expires_at: "2026-09-22T00:00:00Z",
          })
        : fulfillJson(route, { error: { code: "ACCESS_REQUIRED", message: "需要邀请码" } }, 401);
    }
    if (path === "/api/v1/access/redeem") {
      authenticated = true;
      return fulfillJson(route, {
        authenticated: true,
        remaining_redemptions: 49,
        expires_at: "2026-09-22T00:00:00Z",
      });
    }
    if (path === "/api/v1/integrations") {
      return fulfillJson(route, {
        slack: { status: "not_configured" },
        email: { status: "not_configured" },
        zoom: { status: "not_configured" },
        google_meet: { status: "not_configured" },
      });
    }
    if (path === "/api/v1/meetings" && request.method() === "GET") {
      return fulfillJson(route, { items: created ? [meeting] : [] });
    }
    if (path === "/api/v1/meetings" && request.method() === "POST") {
      created = true;
      return fulfillJson(route, meeting, 201);
    }
    if (path === "/api/v1/meetings/meeting-1/transcript") {
      return fulfillJson(route, { meeting_id: "meeting-1", segment_count: 2 });
    }
    if (path === "/api/v1/meetings/meeting-1/summary-jobs") {
      return fulfillJson(
        route,
        {
          id: "job-flow",
          meeting_id: "meeting-1",
          job_type: "summary",
          status: "queued",
          attempts: 0,
          max_attempts: 3,
          error: null,
          created_at: "2026-08-23T02:31:00Z",
          updated_at: "2026-08-23T02:31:00Z",
        },
        202,
      );
    }
    if (path === "/api/v1/jobs/job-flow") {
      jobPolls += 1;
      return fulfillJson(route, {
        id: "job-flow",
        meeting_id: "meeting-1",
        job_type: "summary",
        status: jobPolls < 2 ? "running" : "succeeded",
        attempts: 1,
        max_attempts: 3,
        error: null,
        created_at: "2026-08-23T02:31:00Z",
        updated_at: "2026-08-23T02:31:03Z",
      });
    }
    if (path === "/api/v1/meetings/meeting-1") return fulfillJson(route, detail);
    if (path === "/api/v1/meetings/meeting-1/summaries") {
      return fulfillJson(route, { items: jobPolls >= 2 ? [summary] : [] });
    }
    if (path === "/api/v1/summaries/summary-1/approve") {
      return fulfillJson(route, { ...summary, status: "approved" });
    }
    if (path === "/api/v1/summaries/summary-1/export") {
      return route.fulfill({
        status: 200,
        body: "# 产品体验复盘\n\n团队确认周三发布。",
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          "Content-Disposition": 'attachment; filename="meeting-1-v1.md"',
        },
      });
    }
    return fulfillJson(route, { error: { code: "NOT_MOCKED", message: path } }, 404);
  });

  await page.goto("/");
  await page.getByLabel("邀请码").fill("MM-FLOW-12345678");
  await page.getByRole("button", { name: "进入 MeetingMemo" }).click();
  await page.getByRole("button", { name: "导入一次会议" }).click();
  await page.getByLabel("会议标题").fill("产品体验复盘");
  await page.getByLabel("粘贴转写文本").fill("林一：确认周三发布。周楠：我来完成上线清单。");
  await page.getByRole("button", { name: "创建并生成摘要" }).click();

  await expect(page.getByText("AI 处理中")).toBeVisible({ timeout: 5_000 });
  await expect(page.getByText(summary.content.headline).first()).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "确认摘要" }).click();
  await expect(page.getByRole("button", { name: "已审批此版本" })).toBeVisible();
  await page.locator(".export-menu > summary").click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("menuitem", { name: "Markdown" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("meeting-1-v1.md");
  expect(consoleErrors.filter((message) => !message.includes("401 (Unauthorized)"))).toEqual([]);
});
