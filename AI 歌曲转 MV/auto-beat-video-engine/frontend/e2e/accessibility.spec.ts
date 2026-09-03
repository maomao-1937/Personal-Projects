import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

const aaPrimaryColors = {
  default: {
    computed: "rgb(109, 82, 243)",
    property: "--action-primary-default",
    token: "#6d52f3",
  },
  hover: {
    computed: "rgb(95, 69, 210)",
    property: "--action-primary-hover",
    token: "#5f45d2",
  },
  focus: {
    computed: "rgb(85, 57, 194)",
    property: "--action-primary-focus",
    token: "#5539c2",
  },
  focusRing: {
    computed: "rgb(181, 172, 255)",
    property: "--action-primary-focus-ring",
    token: "#b5acff",
  },
} as const;

const routes = [
  { label: "Storyboard", path: "/projects/demo/storyboard" },
  {
    label: "Shot Editor",
    path: "/projects/demo/storyboard/shots/shot-06",
  },
  { label: "Preview", path: "/projects/demo/preview" },
] as const;

const accessibilityViewports = [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
] as const;

async function openFixture(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}

async function expectNoSeriousAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  const seriousViolations = results.violations
    .filter((item) => ["serious", "critical"].includes(item.impact ?? ""))
    .map((item) => ({
      id: item.id,
      impact: item.impact,
      targets: item.nodes.map((node) => node.target.join(" > ")),
    }));
  const unresolvedColorContrast = results.incomplete
    .filter((item) => item.id === "color-contrast")
    .flatMap((item) => item.nodes.map((node) => node.target.join(" > ")));
  const unresolvedCriticalContrast = unresolvedColorContrast.filter((target) =>
    /_(skipLink|generateButton|primaryAction|exportButton|confirmExport)__/.test(target),
  );

  expect(seriousViolations).toEqual([]);
  expect(
    unresolvedCriticalContrast,
    "主 CTA / Skip Link 的 axe color-contrast incomplete 不能计为通过",
  ).toEqual([]);
  if (unresolvedColorContrast.length > 0) {
    await test.info().attach("axe-color-contrast-incomplete-manual-review", {
      body: JSON.stringify(unresolvedColorContrast, null, 2),
      contentType: "application/json",
    });
  }
}

async function expectNoRootOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));

  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
}

function channelToLinear(channel: number) {
  const normalized = channel / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function parseOpaqueRgb(color: string) {
  const channels = color.match(/[\d.]+/g)?.map(Number) ?? [];
  expect(channels.length).toBeGreaterThanOrEqual(3);
  if (channels.length >= 4) expect(channels[3]).toBe(1);
  return channels.slice(0, 3);
}

function contrastRatio(foreground: string, background: string) {
  const luminance = (color: string) => {
    const [red = 0, green = 0, blue = 0] = parseOpaqueRgb(color).map(channelToLinear);
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  };
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

async function expectPrimaryTokens(page: Page) {
  const tokens = await page.evaluate((properties) => {
    const styles = getComputedStyle(document.documentElement);
    return Object.fromEntries(
      properties.map((property) => [property, styles.getPropertyValue(property).trim()]),
    );
  }, Object.values(aaPrimaryColors).map(({ property }) => property));

  for (const { property, token } of Object.values(aaPrimaryColors)) {
    expect(tokens[property], `${property} 应为显式全局 token`).toBe(token);
  }
}

async function expectSolidWhiteContrast(
  locator: Locator,
  state: "default" | "hover" | "focus",
) {
  const styles = await locator.evaluate((element) => {
    const computed = getComputedStyle(element);
    return {
      backgroundColor: computed.backgroundColor,
      backgroundImage: computed.backgroundImage,
      color: computed.color,
      outlineColor: computed.outlineColor,
      outlineStyle: computed.outlineStyle,
    };
  });

  expect(styles.backgroundImage, `${state} 不得使用低对比渐变`).toBe("none");
  expect(styles.backgroundColor).toBe(aaPrimaryColors[state].computed);
  expect(styles.color).toBe("rgb(255, 255, 255)");
  expect(contrastRatio(styles.color, styles.backgroundColor)).toBeGreaterThanOrEqual(4.5);
  if (state === "focus") {
    expect(styles.outlineStyle).not.toBe("none");
    expect(styles.outlineColor).toBe(aaPrimaryColors.focusRing.computed);
  }
}

async function expectDefaultAndHoverContrast(page: Page, locator: Locator) {
  await expectSolidWhiteContrast(locator, "default");
  await locator.hover();
  await expectSolidWhiteContrast(locator, "hover");
}

async function beginKeyboardPath(page: Page) {
  const skipLink = page.getByRole("link", { name: "跳到主内容" });
  await page.keyboard.press("Tab");
  await expect(skipLink).toBeFocused();
  await expectSolidWhiteContrast(skipLink, "focus");
  return skipLink;
}

async function tabTo(page: Page, target: Locator, maximumTabs = 80) {
  const focusPath: string[] = [];
  for (let index = 0; index < maximumTabs; index += 1) {
    await page.keyboard.press("Tab");
    if (await target.evaluate((element) => element === document.activeElement)) return;
    focusPath.push(
      await page.evaluate(() => {
        const active = document.activeElement;
        if (!(active instanceof HTMLElement)) return "unknown";
        return active.getAttribute("aria-label") ?? active.textContent?.trim() ?? active.tagName;
      }),
    );
  }

  throw new Error(`连续 Tab 未到达目标；焦点路径：${focusPath.join(" → ")}`);
}

for (const route of routes) {
  for (const viewport of accessibilityViewports) {
    test(`${route.label} ${viewport.width}px axe serious / critical 为 0`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await openFixture(page, route.path);

      await expectNoSeriousAxeViolations(page);
    });

    test(`${route.label} ${viewport.width}px 等效缩小 layout viewport 近似 200% zoom 时根节点无横溢`, async ({
      page,
    }) => {
      await page.setViewportSize({
        width: Math.floor(viewport.width / 2),
        height: Math.floor(viewport.height / 2),
      });
      await openFixture(page, route.path);

      await expectNoRootOverflow(page);
    });
  }
}

test("Storyboard 从页面入口连续 Tab 到主 CTA，并用 Shift+Tab、Enter 完成操作", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openFixture(page, "/projects/demo/storyboard");
  await expectPrimaryTokens(page);

  const generateAll = page.getByRole("button", { name: "生成全部" });
  await expectDefaultAndHoverContrast(page, generateAll);
  await beginKeyboardPath(page);
  await tabTo(page, generateAll);
  await expect(generateAll).toBeFocused();
  await expectSolidWhiteContrast(generateAll, "focus");
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect(generateAll).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status")).toContainText("将处理 8 个镜头");

  const firstShot = page.getByRole("link", { name: "编辑镜头 01 · 雨夜站台" });
  await tabTo(page, firstShot);
  await expect(firstShot).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/projects\/demo\/storyboard\/shots\/shot-01$/);
});

test("Storyboard Quick Edit Sheet 闭环焦点并在 Escape 后恢复触发器", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openFixture(page, "/projects/demo/storyboard");

  const trigger = page.getByRole("link", { name: "编辑镜头 01 · 雨夜站台" });
  await trigger.click();

  const dialog = page.getByRole("dialog", { name: "快速编辑 · 镜头 01" });
  const closeButton = page.getByRole("button", { name: "关闭快速编辑 · 镜头 01" });
  const lastControl = dialog.getByRole("link", { name: "打开镜头编辑器" });
  await expect(dialog).toBeVisible();
  await expect(closeButton).toBeFocused();
  await expect(page.locator("body")).toHaveCSS("overflow", "hidden");
  await expectNoSeriousAxeViolations(page);

  await page.keyboard.press("Shift+Tab");
  await expect(lastControl).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(closeButton).toBeFocused();
  await page.keyboard.press("Escape");

  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
});

test("Storyboard 390px Retry 命中区至少 44px，且可连续 Tab 到达并用 Enter 重试", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openFixture(page, "/projects/demo/storyboard");

  const failedCard = page.getByRole("article", { name: /镜头 05/ });
  const retry = failedCard.getByRole("button", { name: "重试 Scene 05" });

  await beginKeyboardPath(page);
  await tabTo(page, retry);
  await expect(retry).toBeFocused();
  await expect(retry).toHaveCSS("min-height", "44px");
  const retryBox = await retry.boundingBox();
  expect(retryBox).not.toBeNull();
  expect(retryBox?.height ?? 0).toBeGreaterThanOrEqual(44);

  await page.keyboard.press("Enter");
  await expect(retry).toBeHidden();
  await expect(failedCard).toContainText("排队中");
  await expect(failedCard).not.toContainText("服务暂时不可用");
});

test("Shot Editor 从页面入口连续 Tab 到主 CTA 和 Stage，再执行 Enter、Space 与方向键", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openFixture(page, "/projects/demo/storyboard/shots/shot-01");
  await expectPrimaryTokens(page);

  const generateTake = page.getByRole("button", { name: "生成新版本" });
  await expectDefaultAndHoverContrast(page, generateTake);
  await beginKeyboardPath(page);
  await tabTo(page, generateTake);
  await expect(generateTake).toBeFocused();
  await expectSolidWhiteContrast(generateTake, "focus");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Take 02" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  const stage = page.getByLabel("镜头预览 Stage");
  await tabTo(page, stage);
  await expect(stage).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByRole("button", { name: "Take 01" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("button", { name: "Take 02" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.keyboard.press("Space");
  await expect(stage).toHaveAttribute("data-playback", "playing");
});

test("Shot Editor 390x844 首屏保留 Stage、时间线与唯一主 CTA", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openFixture(page, "/projects/demo/storyboard/shots/shot-06");

  const stage = page.getByLabel("镜头预览 Stage");
  const timeline = page.getByLabel("只读时间线");
  const primaryAction = page.getByRole("button", { name: "生成新版本" });
  const mobileNav = page.getByRole("navigation", { name: "工作区" });
  const [stageBox, timelineBox, actionBox, navBox] = await Promise.all([
    stage.boundingBox(),
    timeline.boundingBox(),
    primaryAction.boundingBox(),
    mobileNav.boundingBox(),
  ]);

  expect(stageBox).not.toBeNull();
  expect(timelineBox).not.toBeNull();
  expect(actionBox).not.toBeNull();
  expect(navBox).not.toBeNull();
  if (!stageBox || !timelineBox || !actionBox || !navBox) return;

  expect(stageBox.y + stageBox.height).toBeLessThanOrEqual(timelineBox.y);
  expect(timelineBox.y + timelineBox.height).toBeLessThanOrEqual(actionBox.y);
  expect(actionBox.height).toBeGreaterThanOrEqual(44);
  expect(actionBox.y + actionBox.height).toBeLessThanOrEqual(navBox.y);
  expect(navBox.y + navBox.height).toBeLessThanOrEqual(844);
});

test("Preview 从页面入口连续 Tab 到导出 CTA 和 Stage，并验证状态色、Sheet 与 Space", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openFixture(page, "/projects/demo/preview");
  await expectPrimaryTokens(page);

  const trigger = page.getByRole("button", { name: "导出", exact: true });
  await expectDefaultAndHoverContrast(page, trigger);
  await beginKeyboardPath(page);
  await tabTo(page, trigger);
  await expect(trigger).toBeFocused();
  await expectSolidWhiteContrast(trigger, "focus");
  await page.keyboard.press("Enter");

  const dialog = page.getByRole("dialog", { name: "导出设置" });
  const closeButton = page.getByRole("button", { name: "关闭导出设置" });
  const lastControl = dialog.getByRole("button", {
    name: "保存导出设置",
  });
  await expectDefaultAndHoverContrast(page, lastControl);
  await expect(closeButton).toBeFocused();
  await expectNoSeriousAxeViolations(page);
  await page.keyboard.press("Shift+Tab");
  await expect(lastControl).toBeFocused();
  await expectSolidWhiteContrast(lastControl, "focus");
  await page.keyboard.press("Tab");
  await expect(closeButton).toBeFocused();
  await page.keyboard.press("Escape");

  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  const stage = page.getByLabel("整片预览 Stage");
  await tabTo(page, stage);
  await expect(stage).toBeFocused();
  await page.keyboard.press("Space");
  await expect(stage).toHaveAttribute("data-playback", "playing");
});
