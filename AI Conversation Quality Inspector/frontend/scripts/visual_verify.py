from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from playwright.sync_api import Browser, Page, Route, sync_playwright


OUTPUT_DIR = Path("/tmp/aqi-frontend-visual")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

DIMENSIONS = [
    "需求理解",
    "情绪与语气",
    "信息准确性",
    "异议处理",
    "推进能力",
    "风险话术",
]

ANALYSIS = {
    "analysis_id": "analysis-visual-1",
    "qa_type": "sales",
    "analysis_status": "scored",
    "total_score": 72,
    "scored_dimension_count": 6,
    "confidence": "high",
    "risk_level": "medium",
    "risk_flags": ["绝对化价格承诺"],
    "rubric_version": "qa-rubric-v1",
    "prompt_version": "qa-analysis-v1",
    "model_version": "fixture-model-v1",
    "dimensions": [
        {
            "name": name,
            "status": "scored",
            "score": 72,
            "summary": "结论已绑定到可定位的原文证据。",
            "evidence": [
                {
                    "type": "missed_opportunity",
                    "turn_ids": ["t1", "t2"],
                    "quotes": ["这个价格有些贵", "我们已经是最低价格了"],
                    "rationale": "客户提出价格异议后，销售没有先澄清预算或价值顾虑。",
                }
            ],
            "improvement": "先追问预算或价值顾虑，再提供可核验的信息。",
            "confidence": "high",
        }
        for name in DIMENSIONS
    ],
    "major_issues": [
        {
            "severity": "high",
            "dimension": "信息准确性",
            "title": "绝对化价格承诺",
            "reason": "缺少产品政策支持最低价结论。",
            "evidence_turn_ids": ["t2"],
        }
    ],
    "suggested_reply": "理解您的顾虑，方便说说主要是在比较预算还是方案价值吗？",
    "limitations": ["缺少企业价格政策，无法核验最低价说法。"],
    "remaining_uses": 49,
}


def fulfill(route: Route, status: int, payload: dict[str, Any]) -> None:
    route.fulfill(
        status=status,
        content_type="application/json",
        body=json.dumps(payload, ensure_ascii=False),
    )


def install_api_fixture(page: Page) -> None:
    accessed = False

    def handle(route: Route) -> None:
        nonlocal accessed
        request = route.request
        path = request.url.split("?", 1)[0]
        if path.endswith("/public/config"):
            fulfill(
                route,
                200,
                {
                    "min_transcript_chars": 20,
                    "max_transcript_chars": 12_000,
                    "max_turns": 200,
                    "invite_usage_limit": 50,
                    "rubric_version": "qa-rubric-v1",
                },
            )
            return
        if path.endswith("/access/status"):
            if not accessed:
                fulfill(
                    route,
                    401,
                    {
                        "error": {
                            "code": "ACCESS_TOKEN_INVALID",
                            "message": "访问凭证无效，请重新输入邀请码。",
                            "request_id": "visual-access",
                            "retryable": False,
                        }
                    },
                )
                return
            fulfill(
                route,
                200,
                {
                    "authenticated": True,
                    "remaining_uses": 50,
                    "expires_at": "2026-08-23T00:00:00Z",
                    "csrf_token": "visual-csrf",
                },
            )
            return
        if path.endswith("/access/redeem"):
            accessed = True
            fulfill(
                route,
                200,
                {
                    "remaining_uses": 50,
                    "expires_at": "2026-08-23T00:00:00Z",
                    "csrf_token": "visual-csrf",
                },
            )
            return
        if path.endswith("/analyses") and request.method == "POST":
            fulfill(route, 200, ANALYSIS)
            return
        if path.endswith("/feedback") and request.method == "PUT":
            fulfill(route, 200, {"helpful": True, "reason_code": None})
            return
        route.abort()

    page.route("**/backend-api/**", handle)


def assert_no_horizontal_overflow(page: Page, label: str) -> None:
    dimensions = page.evaluate(
        """() => ({
          documentWidth: document.documentElement.scrollWidth,
          viewportWidth: document.documentElement.clientWidth,
          bodyWidth: document.body.scrollWidth,
        })"""
    )
    if dimensions["documentWidth"] > dimensions["viewportWidth"] + 1:
        raise AssertionError(f"{label} horizontal overflow: {dimensions}")


def run_viewport(browser: Browser, name: str, width: int, height: int) -> None:
    context = browser.new_context(
        viewport={"width": width, "height": height},
        reduced_motion="reduce",
        device_scale_factor=1,
    )
    page = context.new_page()
    browser_errors: list[str] = []
    page.on(
        "console",
        lambda message: browser_errors.append(message.text)
        if message.type == "error"
        and "status of 401 (Unauthorized)" not in message.text
        else None,
    )
    page.on("pageerror", lambda error: browser_errors.append(str(error)))
    install_api_fixture(page)

    page.goto("http://127.0.0.1:3010", wait_until="networkidle")
    page.get_by_role("heading", name="用邀请码进入工作台").wait_for()
    page.evaluate("window.scrollTo(0, 0)")
    assert_no_horizontal_overflow(page, f"{name} access")
    page.screenshot(path=OUTPUT_DIR / f"access-{name}.png")

    page.get_by_label("邀请码").fill("pilot_visual_1234567890")
    page.get_by_role("button", name="进入质检工作台").click()
    page.get_by_role("heading", name="对话输入").wait_for()
    page.get_by_role("button", name="填入示例").click()
    page.get_by_role("button", name="开始质检").click()
    page.get_by_test_id("total-score").wait_for()
    page.wait_for_load_state("networkidle")
    assert_no_horizontal_overflow(page, f"{name} report")

    page.locator(".result-panel").scroll_into_view_if_needed()
    page.screenshot(path=OUTPUT_DIR / f"report-{name}.png")
    page.get_by_text("“我们已经是最低价格了”").first.scroll_into_view_if_needed()
    page.screenshot(path=OUTPUT_DIR / f"evidence-{name}.png")
    page.get_by_text("这份报告对复盘有帮助吗？").scroll_into_view_if_needed()
    page.get_by_role("button", name="有用").click()
    page.get_by_text("反馈已记录").wait_for()
    page.screenshot(path=OUTPUT_DIR / f"feedback-{name}.png")

    page.locator("body").press("Home")
    page.keyboard.press("Tab")
    focused_tag = page.evaluate("document.activeElement?.tagName")
    if focused_tag == "BODY":
        raise AssertionError(f"{name} keyboard focus did not move")
    if browser_errors:
        raise AssertionError(f"{name} browser errors: {browser_errors}")
    context.close()


def main() -> None:
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        run_viewport(browser, "desktop", 1440, 1000)
        run_viewport(browser, "mobile", 390, 844)
        browser.close()
    print(f"visual verification passed; screenshots: {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
