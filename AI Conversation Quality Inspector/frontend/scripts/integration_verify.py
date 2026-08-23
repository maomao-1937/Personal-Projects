from __future__ import annotations

from playwright.sync_api import sync_playwright


INVITE_CODE = "pilot_integration_no_key_123456"


def main() -> None:
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1280, "height": 900})
        page = context.new_page()
        unexpected_errors: list[str] = []
        page.on(
            "console",
            lambda message: unexpected_errors.append(message.text)
            if message.type == "error"
            and "status of 401 (Unauthorized)" not in message.text
            and "status of 503 (Service Unavailable)" not in message.text
            else None,
        )
        page.on("pageerror", lambda error: unexpected_errors.append(str(error)))

        page.goto("http://127.0.0.1:3010", wait_until="networkidle")
        page.get_by_role("heading", name="用邀请码进入工作台").wait_for()
        page.get_by_label("邀请码").fill(INVITE_CODE)
        page.get_by_role("button", name="进入质检工作台").click()
        page.get_by_role("heading", name="对话输入").wait_for()
        page.get_by_label("剩余 50 次").wait_for()

        page.get_by_role("button", name="填入示例").click()
        page.get_by_role("button", name="开始质检").click()
        page.get_by_role("heading", name="这次质检没有完成").wait_for()
        page.get_by_role("alert").filter(has_text="模型服务尚未配置。").wait_for()
        page.get_by_label("剩余 50 次").wait_for()

        if unexpected_errors:
            raise AssertionError(f"unexpected browser errors: {unexpected_errors}")
        context.close()
        browser.close()
    print("real frontend/backend no-key integration passed; remaining quota: 50")


if __name__ == "__main__":
    main()
