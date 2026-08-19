from pathlib import Path

from playwright.sync_api import ConsoleMessage, sync_playwright


BASE_URL = "http://127.0.0.1:3000"
OUTPUT_DIR = Path(__file__).resolve().parents[2] / "test-results" / "visual"


def capture_console_error(errors: list[str], message: ConsoleMessage) -> None:
    if message.type == "error":
        errors.append(message.text)


def assert_no_horizontal_overflow(page) -> None:
    sizes = page.evaluate(
        """() => ({
          viewport: window.innerWidth,
          document: document.documentElement.scrollWidth,
          body: document.body.scrollWidth,
        })"""
    )
    assert sizes["document"] <= sizes["viewport"], sizes
    assert sizes["body"] <= sizes["viewport"], sizes


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    console_errors: list[str] = []

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)

        desktop = browser.new_context(viewport={"width": 1440, "height": 960})
        page = desktop.new_page()
        page.on("console", lambda message: capture_console_error(console_errors, message))
        page.goto(BASE_URL, wait_until="networkidle")
        page.get_by_test_id("water-canvas").wait_for(state="visible")
        assert_no_horizontal_overflow(page)

        before_pointer = page.get_by_test_id("water-background").evaluate(
            "element => getComputedStyle(element).getPropertyValue('--water-x')"
        )
        page.mouse.move(250, 320)
        page.wait_for_timeout(240)
        after_pointer = page.get_by_test_id("water-background").evaluate(
            "element => getComputedStyle(element).getPropertyValue('--water-x')"
        )
        assert before_pointer != after_pointer, (before_pointer, after_pointer)
        page.screenshot(path=OUTPUT_DIR / "home-desktop.png", full_page=True)
        desktop.close()

        mobile = browser.new_context(
            viewport={"width": 360, "height": 800},
            device_scale_factor=2,
            is_mobile=True,
            has_touch=True,
        )
        page = mobile.new_page()
        page.on("console", lambda message: capture_console_error(console_errors, message))
        page.goto(f"{BASE_URL}/sessions/new", wait_until="networkidle")
        page.locator(".session-form").wait_for(state="visible")
        assert_no_horizontal_overflow(page)
        page.screenshot(path=OUTPUT_DIR / "new-session-mobile.png", full_page=True)
        mobile.close()

        browser.close()

    assert not console_errors, console_errors
    print(
        "视觉巡检通过：桌面端水纹跟随有效，360px 页面无横向溢出，浏览器控制台无错误。"
    )


if __name__ == "__main__":
    main()
