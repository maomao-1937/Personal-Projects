"""Exercise the complete browser flow against a running real FastAPI backend."""

import os
from pathlib import Path

from playwright.sync_api import sync_playwright


BASE_URL = os.environ.get("MEETINGMEMO_BASE_URL", "http://localhost:3000").rstrip("/")
INVITE_CODE = os.environ.get("MEETINGMEMO_INVITE_CODE", "").strip()

if not INVITE_CODE:
    raise SystemExit("MEETINGMEMO_INVITE_CODE is required")

TRANSCRIPT = """林一：今天确认封闭测试上线范围，用户应从转写快速得到可编辑的会议摘要。
周楠：本周三完成发布，我负责整理上线清单并同步到项目群。
陈墨：移动端需要核验摘要编辑和 Markdown 导出，完成后关闭本轮内测。
林一：最终决定保持邀请码访问，不做注册登录。"""


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 960}, accept_downloads=True)
    console_errors: list[str] = []
    page.on(
        "console",
        lambda message: console_errors.append(message.text) if message.type == "error" else None,
    )
    page.on("pageerror", lambda error: console_errors.append(str(error)))

    page.goto(BASE_URL, wait_until="networkidle")
    page.get_by_label("邀请码").fill(INVITE_CODE)
    page.get_by_role("button", name="进入 MeetingMemo").click()
    page.get_by_role("button", name="新建会议").wait_for(timeout=10_000)
    page.get_by_role("button", name="新建会议").click()
    page.get_by_label("会议标题").fill("MeetingMemo 真实主链路核验")
    page.get_by_label("粘贴转写文本").fill(TRANSCRIPT)
    page.get_by_role("button", name="创建并生成摘要").click()
    page.get_by_role("heading", name="MeetingMemo 真实主链路核验", exact=True).wait_for(
        timeout=10_000
    )
    page.wait_for_function(
        "!document.querySelector('button[aria-label=\"编辑摘要\"]')?.disabled",
        timeout=20_000,
    )

    page.get_by_role("button", name="编辑摘要").click()
    page.get_by_label("摘要标题").fill("真实后端主链路已完成生成、编辑、审批与导出核验。")
    page.get_by_role("button", name="保存为新版本").click()
    page.get_by_text("v2", exact=True).wait_for(timeout=10_000)
    page.get_by_role("button", name="确认摘要").click()
    page.get_by_role("button", name="已审批此版本").wait_for(timeout=10_000)

    page.locator(".export-menu > summary").click()
    with page.expect_download(timeout=10_000) as download_info:
        page.get_by_role("menuitem", name="Markdown").click()
    export_path = Path("/tmp/meetingmemo-real-acceptance.md")
    download_info.value.save_as(export_path)
    exported = export_path.read_text(encoding="utf-8")
    if "真实后端主链路已完成" not in exported or "摘要版本：v2" not in exported:
        raise AssertionError("approved v2 export content mismatch")

    unexpected = [item for item in console_errors if "401 (Unauthorized)" not in item]
    if unexpected:
        raise AssertionError("unexpected browser console errors: " + " | ".join(unexpected))
    if page.evaluate("document.documentElement.scrollWidth") > 1440:
        raise AssertionError("desktop has horizontal overflow")

    page.screenshot(path="/tmp/meetingmemo-real-acceptance.png", full_page=True)
    print("REAL_BROWSER_ACCEPTANCE_OK")
    print(f"BASE_URL={BASE_URL}")
    print("VERSION=v2")
    print("STATUS=approved")
    print(f"EXPORT={export_path}")
    browser.close()
