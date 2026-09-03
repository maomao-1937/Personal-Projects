import { expect, test, type Page } from "@playwright/test";

const shotEditorPath = "/projects/demo/storyboard/shots/shot-06";
const playableShotEditorPath = "/projects/demo/storyboard/shots/shot-01";

async function openShotEditor(
  page: Page,
  width: number,
  height: number,
  path = shotEditorPath,
) {
  await page.setViewportSize({ width, height });
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}

test("1440x900 下 Stage 保持 16:9 并可键盘聚焦", async ({ page }) => {
  await openShotEditor(page, 1440, 900, playableShotEditorPath);

  const stage = page.getByLabel("镜头预览 Stage");
  await expect(stage).toBeVisible();
  await stage.focus();
  await expect(stage).toBeFocused();

  const box = await stage.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;

  expect(Math.abs(box.width / box.height - 16 / 9) / (16 / 9)).toBeLessThanOrEqual(0.01);
  expect(box.width).toBeLessThanOrEqual(732);
  expect(box.height).toBeLessThanOrEqual(412);
  await expect(stage.locator("video")).toHaveCSS("object-fit", "contain");
});

test("Take 与 Stage 播放控件保留模块级高对比 hover 反馈", async ({ page }) => {
  await openShotEditor(page, 1440, 900, playableShotEditorPath);

  const play = page.getByRole("button", { name: "播放预览" });
  await play.hover();
  await expect(play).toHaveCSS("border-color", "rgb(181, 172, 255)");
  await expect(play).toHaveCSS("background-color", "rgba(33, 34, 41, 0.88)");

  const take = page.getByRole("button", { name: "Take 01" });
  await take.hover();
  await expect(take).toHaveCSS("border-color", "rgb(166, 154, 255)");
  await expect(take).toHaveCSS("color", "rgb(255, 255, 255)");
});

test("1024x768 下左右工作区均可见且根节点无横溢", async ({ page }) => {
  await openShotEditor(page, 1024, 768);

  const settings = page.getByRole("complementary", { name: "镜头设置" });
  const stage = page.getByLabel("镜头预览 Stage");
  const editor = page.getByLabel("只读时间线").locator("..");
  await expect(settings).toBeVisible();
  await expect(stage).toBeVisible();
  await expect(editor).toHaveCSS("overflow", "visible");

  const [settingsBox, stageBox, hasHorizontalOverflow] = await Promise.all([
    settings.boundingBox(),
    stage.boundingBox(),
    page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    ),
  ]);

  expect(hasHorizontalOverflow).toBe(false);
  expect(settingsBox).not.toBeNull();
  expect(stageBox).not.toBeNull();
  if (!settingsBox || !stageBox) return;
  expect(settingsBox.x).toBeGreaterThanOrEqual(64);
  expect(settingsBox.x + settingsBox.width).toBeLessThanOrEqual(1024);
  expect(stageBox.x).toBeGreaterThanOrEqual(64);
  expect(stageBox.x + stageBox.width).toBeLessThanOrEqual(1024);
  expect(settingsBox.width).toBeGreaterThan(0);
  expect(stageBox.width).toBeGreaterThan(0);
});

test("桌面通过 grid areas 恢复左设置右 Stage，时间线保持完整 204px", async ({ page }) => {
  await openShotEditor(page, 1440, 900);

  const settings = page.getByRole("complementary", { name: "镜头设置" });
  const stageRegion = page.getByRole("region", { name: "Take 预览" });
  const timeline = page.getByLabel("只读时间线");
  const [settingsBox, stageBox, timelineBox] = await Promise.all([
    settings.boundingBox(),
    stageRegion.boundingBox(),
    timeline.boundingBox(),
  ]);

  expect(settingsBox).not.toBeNull();
  expect(stageBox).not.toBeNull();
  expect(timelineBox).not.toBeNull();
  if (!settingsBox || !stageBox || !timelineBox) return;
  expect(settingsBox.x).toBeLessThan(stageBox.x);
  expect(timelineBox.height).toBe(204);
  await expect(page.getByLabel("时间标尺")).toHaveCSS("height", "28px");
  await expect(page.getByLabel("镜头轨")).toHaveCSS("height", "72px");
  await expect(page.getByLabel("音频波形")).toHaveCSS("height", "56px");
  await expect(page.getByLabel("时间线工具栏")).toHaveCSS("height", "32px");
});

test("390x844 的视觉顺序与 DOM/Tab 顺序一致，所有可见交互目标至少 44px", async ({ page }) => {
  await openShotEditor(page, 390, 844, playableShotEditorPath);

  const stageRegion = page.getByRole("region", { name: "Take 预览" });
  const timeline = page.getByLabel("只读时间线");
  const settings = page.getByRole("complementary", { name: "镜头设置" });
  const primaryAction = page.getByRole("button", { name: "生成新版本" });
  const prompt = page.getByLabel("Prompt");
  const [stageBox, timelineBox, settingsBox] = await Promise.all([
    stageRegion.boundingBox(),
    timeline.boundingBox(),
    settings.boundingBox(),
  ]);
  expect(stageBox).not.toBeNull();
  expect(timelineBox).not.toBeNull();
  expect(settingsBox).not.toBeNull();
  if (!stageBox || !timelineBox || !settingsBox) return;
  expect(stageBox.y + stageBox.height).toBeLessThanOrEqual(timelineBox.y);
  expect(timelineBox.y + timelineBox.height).toBeLessThanOrEqual(settingsBox.y);

  const domOrder = await page.evaluate(() => {
    const stage = document.querySelector('[aria-label="Take 预览"]');
    const settingsPanel = document.querySelector('[aria-label="镜头设置"]');
    const action = document.querySelector('button[class*="primaryAction"]');
    const promptField = document.querySelector('#shot-prompt');
    return {
      stageBeforeSettings: Boolean(stage && settingsPanel && (stage.compareDocumentPosition(settingsPanel) & Node.DOCUMENT_POSITION_FOLLOWING)),
      actionBeforePrompt: Boolean(action && promptField && (action.compareDocumentPosition(promptField) & Node.DOCUMENT_POSITION_FOLLOWING)),
    };
  });
  expect(domOrder).toEqual({ stageBeforeSettings: true, actionBeforePrompt: true });

  const undersized = await page.locator(
    'a:visible, button:visible:not(:disabled):not([aria-label="Open Next.js Dev Tools"]), select:visible, textarea:visible, summary:visible, label:has(input[type="radio"]) > span',
  ).evaluateAll((elements) =>
    elements
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return { label: element.getAttribute("aria-label") ?? element.textContent?.trim(), width: rect.width, height: rect.height };
      })
      .filter(({ width, height }) => width < 44 || height < 44),
  );
  expect(undersized).toEqual([]);

  await stageRegion.getByLabel("镜头预览 Stage").focus();
  await page.keyboard.press("Tab");
  await expect(stageRegion.getByRole("button", { name: "播放预览" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Take 01" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "返回故事板" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "下一镜·Scene 02" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(primaryAction).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(prompt).toBeFocused();
});
