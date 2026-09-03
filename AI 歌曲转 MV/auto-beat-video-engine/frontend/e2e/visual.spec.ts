import { expect, test, type Page } from "@playwright/test";

const storyboardViewports = [
  { width: 1440, height: 900 },
  { width: 1280, height: 800 },
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
] as const;

const workspaceViewports = [
  { width: 1440, height: 900 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
] as const;

const visualWorkspaces = [
  {
    label: "shot-editor",
    path: "/projects/demo/storyboard/shots/shot-06",
  },
  { label: "preview", path: "/projects/demo/preview" },
] as const;

test.use({
  colorScheme: "dark",
  locale: "zh-CN",
  timezoneId: "Asia/Shanghai",
});

async function openStableFixture(page: Page, path: string) {
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation: none !important;
        caret-color: transparent !important;
        transition: none !important;
      }
      nextjs-portal { display: none !important; }
    `,
  });
  await page.evaluate(async () => {
    await document.fonts.ready;
    for (const video of document.querySelectorAll("video")) video.pause();
  });

  const visibleImages = page.locator("img:visible");
  const imageCount = await visibleImages.count();
  for (let index = 0; index < imageCount; index += 1) {
    await expect
      .poll(() =>
        visibleImages.nth(index).evaluate((image: HTMLImageElement) => ({
          complete: image.complete,
          naturalWidth: image.naturalWidth,
        })),
      )
      .toEqual(expect.objectContaining({ complete: true }));
    await expect
      .poll(() =>
        visibleImages.nth(index).evaluate((image: HTMLImageElement) => image.naturalWidth),
      )
      .toBeGreaterThan(0);
  }
}

async function expectVisualBaseline(
  page: Page,
  name: string,
  viewport: { width: number; height: number },
) {
  await expect(page).toHaveScreenshot(`${name}-${viewport.width}x${viewport.height}.png`, {
    animations: "disabled",
    caret: "hide",
    maxDiffPixelRatio: 0.01,
  });
}

for (const viewport of storyboardViewports) {
  test(`Storyboard ${viewport.width}x${viewport.height} 视觉基线`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openStableFixture(page, "/projects/demo/storyboard");

    await expectVisualBaseline(page, "storyboard", viewport);
  });
}

for (const workspace of visualWorkspaces) {
  for (const viewport of workspaceViewports) {
    test(`${workspace.label} ${viewport.width}x${viewport.height} 视觉基线`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await openStableFixture(page, workspace.path);

      await expectVisualBaseline(page, workspace.label, viewport);
    });
  }
}
