import os
from pathlib import Path

from playwright.sync_api import sync_playwright

OUTPUT_DIR = Path("/tmp/inspiration-constellation-ui")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
BASE_URL = os.getenv("UI_BASE_URL", "http://127.0.0.1:8765")


def connect(page) -> None:
    page.locator("#accessToken").fill("ui-test-secret")
    page.get_by_role("button", name="连接星库", exact=True).click()
    page.wait_for_selector("#connectionButton.connected")


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    desktop = browser.new_page(viewport={"width": 1440, "height": 1000})
    console_errors: list[str] = []
    desktop.on(
        "console",
        lambda message: (
            console_errors.append(message.text) if message.type == "error" else None
        ),
    )
    desktop.goto(BASE_URL)
    desktop.wait_for_load_state("networkidle")
    connect(desktop)
    assert (
        desktop.locator(".hero-nowrap").evaluate(
            "el => getComputedStyle(el).whiteSpace"
        )
        == "nowrap"
    )
    assert desktop.locator(".hero-galaxy").is_visible()
    assert desktop.locator(".galaxy-wing").count() == 2
    assert (
        desktop.locator(".galaxy-wing-a").evaluate(
            "el => getComputedStyle(el).animationDuration"
        )
        == "48s"
    )
    desktop.screenshot(path=OUTPUT_DIR / "hero-galaxy-desktop.png", full_page=False)
    assert desktop.locator("#generateHypothesisButton").is_disabled()
    desktop.locator("#loadDemoButton").click()
    desktop.wait_for_selector(".material-card:nth-child(3)")
    desktop.locator(".material-card").first.click()
    desktop.wait_for_selector("#materialDialog[open]")
    desktop.locator("#editMaterialTitle").fill("可编辑的收藏问题")
    desktop.locator("#materialEditForm button[type=submit]").click()
    desktop.wait_for_function(
        "document.querySelector('#materialInlineStatus').textContent.includes('保存完成')"
    )
    assert desktop.locator("#materialDialog").get_attribute("open") is not None
    assert desktop.locator("#organizedMaterialContent").inner_text()
    desktop.screenshot(path=OUTPUT_DIR / "material-dialog.png", full_page=False)
    desktop.locator("#reanalyzeMaterialButton").click()
    desktop.wait_for_function(
        "document.querySelector('#materialInlineStatus').textContent.includes('重新分析完成')"
    )
    desktop.locator('[data-close-dialog="materialDialog"]').click()
    assert "可编辑的收藏问题" in desktop.locator(".material-card").first.inner_text()
    desktop.locator("#projectSeedButton").click()
    desktop.locator(".seed-option").first.click()
    assert desktop.locator("#generateHypothesisButton").is_enabled()
    assert "以此为核心" in desktop.locator("#projectSeedHint").inner_text()
    desktop.locator("#generateHypothesisButton").click()
    desktop.wait_for_selector(".hypothesis-card")
    assert "收藏" in desktop.locator(".hypothesis-card").inner_text()
    desktop.screenshot(path=OUTPUT_DIR / "desktop.png", full_page=True)

    mobile_context = browser.new_context(viewport={"width": 390, "height": 844})
    mobile = mobile_context.new_page()
    mobile.goto(BASE_URL)
    mobile.wait_for_load_state("networkidle")
    connect(mobile)
    mobile.wait_for_selector(".material-card")
    assert mobile.locator(".hero-galaxy").is_visible()
    has_overflow = mobile.locator("body").evaluate(
        "el => el.scrollWidth > window.innerWidth"
    )
    overflow = []
    if has_overflow:
        overflow = mobile.locator("body").evaluate(
            """el => [...el.querySelectorAll('*')]
              .map(node => ({name: node.tagName + '.' + node.className, right: node.getBoundingClientRect().right}))
              .filter(item => item.right > window.innerWidth + 1)"""
        )
    assert not has_overflow, overflow
    mobile.screenshot(path=OUTPUT_DIR / "mobile.png", full_page=True)

    assert console_errors == [], console_errors
    mobile_context.close()
    browser.close()
