import { expect, test, type Locator, type Page } from "@playwright/test";

const storyboardPath = "/projects/demo/storyboard";
const approvedViewports = [
  { width: 1440, height: 900, columns: 4 },
  { width: 1280, height: 800, columns: 4 },
  { width: 1279, height: 800, columns: 3 },
  { width: 1024, height: 768, columns: 3 },
  { width: 1023, height: 768, columns: 2 },
  { width: 768, height: 1024, columns: 2 },
  { width: 767, height: 1024, columns: 1 },
  { width: 390, height: 844, columns: 1 },
] as const;

async function expectNoRootOverflow(page: Page) {
  const metrics = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));

  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth);
}

async function getVisibleBox(locator: Locator) {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();

  expect(box).not.toBeNull();
  if (!box) throw new Error("可见元素缺少 bounding box");
  return box;
}

test("Storyboard 在五档宽度保持指定列数且根节点无横溢", async ({ page }) => {
  for (const viewport of approvedViewports) {
    await page.setViewportSize(viewport);
    await page.goto(storyboardPath);

    const workspace = page.getByRole("region", { name: "故事板工作区" });
    const grid = workspace.getByRole("group", { name: "故事板网格" });
    const cards = grid.getByRole("article", { name: /镜头 \d{2} ·/ });
    await expect(workspace).toBeVisible();
    await expect(cards).toHaveCount(8);

    const columns = await grid.evaluate((element) =>
      getComputedStyle(element).gridTemplateColumns.split(" ").filter(Boolean).length,
    );
    expect(columns).toBe(viewport.columns);
    await expectNoRootOverflow(page);
  }
});

test("390x844 首屏呈现首张画面、当前镜头与紧凑全局设置入口", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(storyboardPath);

  const workspace = page.getByRole("region", { name: "故事板工作区" });
  const grid = workspace.getByRole("group", { name: "故事板网格" });
  const firstShot = grid.getByRole("article", { name: "镜头 01 · 雨夜站台" });
  const firstFrame = firstShot.getByRole("img", { name: "雨夜站台" });
  const currentShot = firstShot.getByRole("heading", { name: "雨夜站台" });
  const globalSummary = page.getByLabel("全局生成摘要");
  const openGlobalControls = page.getByRole("button", { name: "打开全局生成设置" });
  const mobileNav = page.getByRole("navigation", { name: "工作区" });

  await expect
    .poll(() => firstFrame.evaluate((image: HTMLImageElement) => image.naturalWidth))
    .toBeGreaterThan(0);

  await expect(mobileNav).toHaveCSS("position", "fixed");
  await expect(page.getByLabel("全局生成控制")).toBeHidden();
  await expect(globalSummary).toContainText("720p");
  await expect(globalSummary).not.toContainText(
    /平衡档|经济档|质量档|¥|价格|成本|预计预算|Qwen|Wan|Kling|Vidu|Fixture|Local fixture|演示/,
  );

  const [frameBox, currentShotBox, summaryBox, buttonBox, navBox, cardBox] = await Promise.all([
    getVisibleBox(firstFrame),
    getVisibleBox(currentShot),
    getVisibleBox(globalSummary),
    getVisibleBox(openGlobalControls),
    getVisibleBox(mobileNav),
    getVisibleBox(firstShot),
  ]);

  expect(summaryBox.y + summaryBox.height).toBeLessThanOrEqual(frameBox.y);
  expect(currentShotBox.y + currentShotBox.height).toBeLessThanOrEqual(navBox.y);
  expect(buttonBox.height).toBeGreaterThanOrEqual(44);
  expect(navBox.y + navBox.height).toBeLessThanOrEqual(844);
  expect(cardBox.x).toBeCloseTo(16, 0);
  expect(cardBox.width).toBeCloseTo(358, 0);
  expect(390 - cardBox.x - cardBox.width).toBeCloseTo(16, 0);
  await expectNoRootOverflow(page);

  await openGlobalControls.click();
  const dialog = page.getByRole("dialog", { name: "全局生成设置" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("生成参数")).toContainText("720p");
  await expect(dialog.getByLabel("生成参数")).toContainText("约 60% 生成视频");
  await expect(dialog.getByLabel("生成参数")).toContainText("中高一致性");
  await expect(dialog).not.toContainText(
    /平衡档|经济档|质量档|¥|价格|成本|预计预算|Qwen|Wan|Kling|Vidu|Fixture|Local fixture|演示/,
  );
  await expect(dialog.getByRole("button", { name: "生成全部" })).toBeVisible();
});

test("390x844 末张卡可完整滚到底部导航上方", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(storyboardPath);

  const workspace = page.getByRole("region", { name: "故事板工作区" });
  const grid = workspace.getByRole("group", { name: "故事板网格" });
  const lastShot = grid.getByRole("article", { name: "镜头 08 · 黎明屋顶" });
  const mobileNav = page.getByRole("navigation", { name: "工作区" });

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);

  const [lastShotBox, navBox] = await Promise.all([
    getVisibleBox(lastShot),
    getVisibleBox(mobileNav),
  ]);
  expect(lastShotBox.y).toBeGreaterThanOrEqual(0);
  expect(lastShotBox.y + lastShotBox.height).toBeLessThanOrEqual(navBox.y);
});

test("Storyboard Enter 进入 Shot Editor 后可切镜头、Take 并用 Space 播放", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(storyboardPath);

  const firstShot = page.getByRole("link", { name: "编辑镜头 01 · 雨夜站台" });
  await firstShot.focus();
  await firstShot.press("Enter");
  await expect(page).toHaveURL(/\/projects\/demo\/storyboard\/shots\/shot-01$/);

  await page.getByRole("button", { name: "生成新版本" }).click();
  await expect(page.getByRole("button", { name: "Take 02" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Take 01" }).click();
  await expect(page.getByRole("button", { name: "Take 01" })).toHaveAttribute("aria-pressed", "true");

  const stage = page.getByLabel("镜头预览 Stage");
  await stage.focus();
  await stage.press("ArrowRight");
  await expect(page.getByRole("button", { name: "Take 02" })).toHaveAttribute("aria-pressed", "true");
  await expect(stage).toHaveAttribute("data-playback", "paused");
  await stage.press("Space");
  await expect(stage).toHaveAttribute("data-playback", "playing");

  await page.getByRole("link", { name: "下一镜·Scene 02" }).click();
  await expect(page).toHaveURL(/\/projects\/demo\/storyboard\/shots\/shot-02$/);
  await expect(page.getByRole("heading", { name: /Scene 02 · 离开站台/ })).toBeVisible();
});

test("Storyboard 双击合法整卡 Link 直接进入 Shot Editor", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(storyboardPath);

  await page.getByRole("link", { name: "编辑镜头 02 · 离开站台" }).dblclick();

  await expect(page).toHaveURL(/\/projects\/demo\/storyboard\/shots\/shot-02$/);
  await expect(page.getByRole("heading", { name: "Scene 02 · 离开站台" })).toBeVisible();
});

test("编辑跨工作区可见且 Provider 状态经 Link 切换后保持", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(storyboardPath);

  await page.getByRole("link", { name: "编辑镜头 01 · 雨夜站台" }).click();
  await page.getByLabel("画面描述").fill("跨工作区共享的雨夜站台");
  const applyQuickEdit = page.getByRole("button", { name: "应用到本地项目" });
  await applyQuickEdit.hover();
  await expect(applyQuickEdit).toHaveCSS("background-color", "rgb(95, 69, 210)");
  await expect(applyQuickEdit).toHaveCSS("color", "rgb(255, 255, 255)");
  await applyQuickEdit.click();
  await page.getByRole("link", { name: "打开镜头编辑器" }).click();

  await expect(page).toHaveURL(/\/projects\/demo\/storyboard\/shots\/shot-01$/);
  await expect(page.getByLabel("Prompt")).toHaveValue("跨工作区共享的雨夜站台");
  await page.getByRole("link", { name: "返回故事板" }).click();
  await page.getByRole("link", { name: "镜头编辑" }).click();

  await expect(page).toHaveURL(/\/projects\/demo\/storyboard\/shots\/shot-06$/);
  await expect(page.getByLabel("生成模型")).toHaveCount(0);
  await expect(page.getByLabel("生成模型档位")).toHaveCount(0);
});

test("Preview 生成缺失 Scene 06 后保留播放头且移除占位", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/projects/demo/preview?t=39");

  const missingStage = page.getByLabel("Scene 06 缺失片段");
  const repairLink = missingStage.getByRole("link", { name: "修复 Scene 06" });
  await expect(missingStage).toBeVisible();
  await expect(repairLink).toHaveCSS("min-height", "44px");
  const repairBox = await repairLink.boundingBox();
  expect(repairBox?.height).toBeGreaterThanOrEqual(44);

  await repairLink.click();
  await expect(page).toHaveURL(
    /\/projects\/demo\/storyboard\/shots\/shot-06\?returnTo=%2Fprojects%2Fdemo%2Fpreview%3Ft%3D39$/,
  );
  await page.getByRole("button", { name: "生成新版本" }).click();
  await expect(page.getByRole("button", { name: "Take 01" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("link", { name: "返回预览" }).click();
  await expect(page).toHaveURL(/\/projects\/demo\/preview\?t=39$/);
  await expect(page.getByLabel("Scene 06 缺失片段")).toHaveCount(0);
  await expect(page.locator("video")).toHaveCount(1);
  await expect(page.locator("video")).toHaveAttribute(
    "src",
    "/demo/after-rain/media/scene-06-preview.mp4",
  );
});

test("Preview → Scene 06 → Scene 07 → Preview 保留最多两位小数的 returnTo 播放头", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/projects/demo/preview?t=39.257");

  await page.getByRole("link", { name: "修复 Scene 06" }).first().click();
  const nextShot = page.getByRole("link", { name: "下一镜·Scene 07" });
  await expect(nextShot).toHaveAttribute(
    "href",
    "/projects/demo/storyboard/shots/shot-07?returnTo=%2Fprojects%2Fdemo%2Fpreview%3Ft%3D39.26",
  );
  await nextShot.click();
  await expect(page).toHaveURL(
    /\/projects\/demo\/storyboard\/shots\/shot-07\?returnTo=%2Fprojects%2Fdemo%2Fpreview%3Ft%3D39\.26$/,
  );
  await page.getByRole("link", { name: "返回预览" }).click();
  await expect(page).toHaveURL(/\/projects\/demo\/preview\?t=39\.26$/);
  await expect(page.getByLabel("播放头 00:39")).toHaveAttribute("data-time", "39.26");
});

test("Storyboard 稳定帧后读取最终 buffered LCP 与 CLS", async ({ page }) => {
  await page.addInitScript(() => {
    const metrics: {
      cls: number;
      lcp: null | {
        elementAlt: string | null;
        elementTag: string | null;
        entryType: string;
        startTime: number;
        url: string;
      };
    } = { cls: 0, lcp: null };
    const recordLcp = (entries: PerformanceEntry[]) => {
      for (const entry of entries) {
        const candidate = entry as PerformanceEntry & { element?: Element | null; url?: string };
        metrics.lcp = {
          elementAlt: candidate.element instanceof HTMLImageElement
            ? candidate.element.alt
            : null,
          elementTag: candidate.element?.tagName ?? null,
          entryType: entry.entryType,
          startTime: entry.startTime,
          url: candidate.url ?? "",
        };
      }
    };
    const recordCls = (entries: PerformanceEntry[]) => {
      for (const entry of entries as (PerformanceEntry & { hadRecentInput?: boolean; value?: number })[]) {
        if (!entry.hadRecentInput) metrics.cls += entry.value ?? 0;
      }
    };
    const lcpObserver = new PerformanceObserver((list) => recordLcp(list.getEntries()));
    const clsObserver = new PerformanceObserver((list) => recordCls(list.getEntries()));
    lcpObserver.observe({ type: "largest-contentful-paint", buffered: true });
    clsObserver.observe({ type: "layout-shift", buffered: true });
    Object.assign(window, {
      __task10Vitals: {
        clsObserver,
        flush() {
          recordLcp(lcpObserver.takeRecords());
          recordCls(clsObserver.takeRecords());
        },
        lcpObserver,
        metrics,
      },
    });
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(storyboardPath);

  const firstImage = page.getByRole("img", { name: "雨夜站台" });
  await expect.poll(() => firstImage.evaluate((image: HTMLImageElement) => ({
    complete: image.complete,
    currentSrc: image.currentSrc,
    naturalWidth: image.naturalWidth,
  }))).toEqual(expect.objectContaining({
    complete: true,
    currentSrc: expect.stringContaining("scene-01-400.webp"),
    naturalWidth: expect.any(Number),
  }));
  await expect(firstImage).toHaveAttribute("loading", "eager");
  await expect(firstImage).toHaveAttribute("fetchpriority", "high");
  await expect(page.getByRole("img", { name: "离开站台" })).toHaveAttribute("loading", "lazy");

  const snapshot = await page.evaluate(async () => {
    const image = document.querySelector<HTMLImageElement>('img[alt="雨夜站台"]');
    if (!image) throw new Error("缺少首张 Storyboard 图像");
    await document.fonts.ready;
    await image.decode();
    const before = image.getBoundingClientRect().toJSON();
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    const after = image.getBoundingClientRect().toJSON();
    const vitals = (
      window as typeof window & {
        __task10Vitals: {
          clsObserver: PerformanceObserver;
          flush: () => void;
          lcpObserver: PerformanceObserver;
          metrics: {
            cls: number;
            lcp: null | {
              elementAlt: string | null;
              elementTag: string | null;
              entryType: string;
              startTime: number;
              url: string;
            };
          };
        };
      }
    ).__task10Vitals;
    vitals.flush();
    vitals.lcpObserver.disconnect();
    vitals.clsObserver.disconnect();
    return {
      after,
      before,
      fontStatus: document.fonts.status,
      imageComplete: image.complete,
      metrics: vitals.metrics,
    };
  });

  expect(snapshot.fontStatus).toBe("loaded");
  expect(snapshot.imageComplete).toBe(true);
  expect(snapshot.after).toEqual(snapshot.before);
  expect(snapshot.metrics.lcp).toEqual(expect.objectContaining({
    elementAlt: "雨夜站台",
    elementTag: "IMG",
    entryType: "largest-contentful-paint",
    url: expect.stringContaining("scene-01-400.webp"),
  }));
  expect(snapshot.metrics.lcp?.startTime ?? 0).toBeGreaterThan(0);
  expect(snapshot.metrics.lcp?.startTime ?? Number.POSITIVE_INFINITY).toBeLessThan(2500);
  expect(snapshot.metrics.cls).toBeLessThan(0.1);
});

test("Storyboard hover 仅挂载一段视频且只发出一个媒体请求", async ({ page }) => {
  const videoRequests: string[] = [];
  page.on("request", (request) => {
    if (request.resourceType() === "media" && request.url().endsWith(".mp4")) {
      videoRequests.push(request.url());
    }
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(storyboardPath);

  expect(videoRequests).toHaveLength(0);
  await page.getByRole("link", { name: "编辑镜头 01 · 雨夜站台" }).hover();
  await expect(page.locator("video")).toHaveCount(1);
  await expect.poll(() => videoRequests).toHaveLength(1);
  expect(videoRequests[0]).toContain("scene-01-preview.mp4");

  await page.getByRole("link", { name: "编辑镜头 02 · 离开站台" }).hover();
  await expect(page.locator("video")).toHaveCount(0);
  expect(videoRequests).toHaveLength(1);
});
