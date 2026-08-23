"""Render MeetingMemo's core UI states at acceptance breakpoints."""

import json
import sys
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import Route, sync_playwright


OUTPUT_DIR = Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/meetingmemo-ui-qa")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

MEETING = {
    "id": "meeting-1",
    "title": "产品体验复盘",
    "meeting_at": "2026-08-23T02:00:00Z",
    "timezone": "Asia/Shanghai",
    "source": "manual",
    "language": "zh-CN",
    "status": "ready",
    "created_at": "2026-08-23T02:00:00Z",
    "updated_at": "2026-08-23T02:30:00Z",
}

DETAIL = {
    **MEETING,
    "segments": [
        {
            "id": "seg-1",
            "sequence": 0,
            "start_ms": 0,
            "end_ms": 18000,
            "speaker": "林一",
            "text": "今天重点确认内测反馈和发布节奏，先看一下仍然影响用户完成任务的问题。",
        },
        {
            "id": "seg-2",
            "sequence": 1,
            "start_ms": 65000,
            "end_ms": 85000,
            "speaker": "周楠",
            "text": "确认周三发布，我来完成上线清单，并在发布前把最终版本同步到项目群。",
        },
        {
            "id": "seg-3",
            "sequence": 2,
            "start_ms": 102000,
            "end_ms": 124000,
            "speaker": "陈墨",
            "text": "移动端还需要再核验一次导出流程，完成后就可以关闭这轮内测。",
        },
    ],
}

SUMMARY = {
    "id": "summary-1",
    "meeting_id": "meeting-1",
    "version": 2,
    "schema_version": "1.0",
    "content": {
        "summary_version": "1.0",
        "headline": "团队确认周三发布，并在发布前完成移动端导出核验与上线清单。",
        "topics": [
            {
                "title": "发布节奏",
                "summary": "内测问题已经收敛，发布计划保持不变；上线前重点核对移动端导出和最终发布清单。",
                "source_segment_ids": ["seg-1", "seg-2", "seg-3"],
            },
            {
                "title": "内测收口",
                "summary": "移动端导出验证通过后，本轮内测即可关闭，最终结果同步到项目群。",
                "source_segment_ids": ["seg-3"],
            },
        ],
        "decisions": [
            {
                "text": "本周三正式发布。",
                "source_segment_ids": ["seg-2"],
                "confidence": "high",
            }
        ],
        "action_items": [
            {
                "task": "完成上线清单并发到项目群。",
                "owner": "周楠",
                "due_date": "2026-08-26",
                "source_segment_ids": ["seg-2"],
                "confidence": "high",
            },
            {
                "task": "核验移动端导出流程。",
                "owner": "陈墨",
                "due_date": None,
                "source_segment_ids": ["seg-3"],
                "confidence": "medium",
            },
        ],
        "open_questions": [],
        "quality_flags": [],
    },
    "quality_flags": [],
    "status": "draft",
    "parent_version_id": "summary-0",
    "created_source": "user",
    "created_at": "2026-08-23T02:32:00Z",
}


def json_response(route: Route, body: object, status: int = 200) -> None:
    route.fulfill(status=status, content_type="application/json", body=json.dumps(body, ensure_ascii=False))


def authenticated_api(route: Route) -> None:
    request = route.request
    path = urlparse(request.url).path
    if path == "/api/v1/access/session":
        return json_response(
            route,
            {
                "authenticated": True,
                "session_id": "session-visual-qa",
                "expires_at": "2026-09-22T00:00:00Z",
            },
        )
    if path == "/api/v1/meetings" and request.method == "GET":
        return json_response(route, {"items": [MEETING]})
    if path == "/api/v1/integrations":
        return json_response(
            route,
            {
                "slack": {"status": "not_configured"},
                "email": {"status": "configured"},
                "zoom": {"status": "not_configured"},
                "google_meet": {"status": "not_configured"},
            },
        )
    if path == "/api/v1/meetings/meeting-1":
        return json_response(route, DETAIL)
    if path == "/api/v1/meetings/meeting-1/summaries":
        return json_response(route, {"items": [SUMMARY]})
    return json_response(route, {"error": {"code": "NOT_MOCKED", "message": path}}, 404)


def assert_no_overflow(page, width: int) -> None:
    scroll_width = page.evaluate("document.documentElement.scrollWidth")
    if scroll_width > width:
        raise AssertionError(f"horizontal overflow at {width}px: {scroll_width}px")


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    errors: list[str] = []

    invite_page = browser.new_page(viewport={"width": 1440, "height": 960})
    invite_page.route(
        "**/api/v1/access/session",
        lambda route: json_response(
            route,
            {"error": {"code": "ACCESS_REQUIRED", "message": "需要邀请码访问"}},
            401,
        ),
    )
    invite_page.goto("http://127.0.0.1:3200")
    invite_page.wait_for_load_state("networkidle")
    invite_page.get_by_label("邀请码").wait_for()
    invite_page.screenshot(path=OUTPUT_DIR / "invite-1440.png", full_page=True)
    assert_no_overflow(invite_page, 1440)
    invite_page.close()

    for width, height in ((1440, 960), (1280, 900), (768, 900), (390, 844)):
        page = browser.new_page(viewport={"width": width, "height": height})
        page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.route("**/api/v1/**", authenticated_api)
        page.goto("http://127.0.0.1:3200")
        page.wait_for_load_state("networkidle")
        page.get_by_role("heading", name="产品体验复盘", exact=True).wait_for()
        assert_no_overflow(page, width)
        page.screenshot(path=OUTPUT_DIR / f"workspace-{width}.png", full_page=True)

        if width in (1440, 390):
            page.get_by_role("button", name="编辑摘要").click()
            page.get_by_role("dialog", name="编辑会议摘要").wait_for()
            page.screenshot(path=OUTPUT_DIR / f"editor-{width}.png", full_page=True)
            page.keyboard.press("Escape")

        if width == 768:
            page.get_by_role("button", name="打开会议洞察").click()
            page.get_by_text("完成上线清单并发到项目群。").wait_for()
            page.wait_for_function(
                "getComputedStyle(document.querySelector('.insight-pane')).transform === 'matrix(1, 0, 0, 1, 0, 0)'"
            )
            page.screenshot(path=OUTPUT_DIR / "insights-768.png", full_page=True)
        if width == 390:
            page.get_by_role("button", name="打开会议列表").click()
            page.screenshot(path=OUTPUT_DIR / "meetings-390.png", full_page=True)
            page.get_by_role("button", name="关闭会议列表").first.click()
            page.get_by_role("button", name="打开会议洞察").click()
            page.wait_for_function(
                "getComputedStyle(document.querySelector('.insight-pane')).transform === 'matrix(1, 0, 0, 1, 0, 0)'"
            )
            page.screenshot(path=OUTPUT_DIR / "insights-390.png", full_page=True)
        page.close()

    browser.close()
    if errors:
        raise AssertionError("browser errors:\n" + "\n".join(errors))

print(f"visual QA screenshots: {OUTPUT_DIR}")
