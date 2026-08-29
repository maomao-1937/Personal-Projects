from __future__ import annotations

import json
import os
import re
import sys
from http.cookiejar import CookieJar
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import HTTPCookieProcessor, Request, build_opener

from playwright.sync_api import Page, expect, sync_playwright


API_BASE = "http://127.0.0.1:8011/api/v1"
WEB_BASE = "http://127.0.0.1:3011"
DYNAMIC_CASE_ID = "case_e2e_misaligned_receipt"
ACCESS_TOKEN = os.environ.get("E2E_ACCESS_TOKEN", "ONE-TOKEN")
ARTIFACTS = Path(__file__).resolve().parents[1] / "artifacts" / "ui"
API_OPENER = build_opener(HTTPCookieProcessor(CookieJar()))
LANDING_PROMPT = "用 8 次提问，审讯一个会撒谎、却无法改写真相的 AI 嫌疑人。"


def api(method: str, path: str, payload: dict | None = None, expected: int = 200) -> dict:
    body = None if payload is None else json.dumps(payload).encode("utf-8")
    request = Request(
        f"{API_BASE}{path}",
        data=body,
        method=method,
        headers={"Content-Type": "application/json"},
    )
    try:
        with API_OPENER.open(request, timeout=10) as response:
            assert response.status == expected, (path, response.status, expected)
            raw = response.read()
            return json.loads(raw) if raw else {}
    except HTTPError as error:
        if error.code != expected:
            raise
        raw = error.read()
        return json.loads(raw) if raw else {}


def authenticate_api() -> None:
    invalid = api(
        "POST",
        "/auth/login",
        {"accessToken": "WRONG"},
        expected=401,
    )
    assert invalid["error"]["code"] == "INVALID_ACCESS_TOKEN"
    api("POST", "/auth/login", {"accessToken": ACCESS_TOKEN}, expected=204)


def create_session(case_id: str = "001") -> dict:
    return api("POST", "/sessions", {"caseId": case_id}, expected=201)


def turn(session_id: str, message: str, tactic: str = "calm", evidence_id: str | None = None) -> dict:
    return api(
        "POST",
        f"/sessions/{session_id}/turns",
        {"message": message, "tactic": tactic, "evidenceId": evidence_id},
    )


def unlock_report() -> dict:
    state = create_session()
    session_id = state["sessionId"]
    state = turn(session_id, "21:17 当晚你离开档案室去侧门做什么？", evidence_id="E02")
    state = turn(session_id, "你接触过备份盘或备用读写器吗？", evidence_id="E04")
    state = turn(session_id, "妹妹账户的转账款项与你的动机有什么关系？", evidence_id="E05")
    assert state["canSubmitReport"] is True
    return state


def assert_no_horizontal_overflow(page: Page) -> None:
    dimensions = page.evaluate(
        "() => ({ width: window.innerWidth, scroll: document.documentElement.scrollWidth })"
    )
    assert dimensions["scroll"] <= dimensions["width"], dimensions


def assert_cage_contains_suspect(page: Page) -> None:
    cage = page.locator(".containment-frame").bounding_box()
    suspect = page.locator(".suspect-seat").bounding_box()
    assert cage and suspect, (cage, suspect)
    assert cage["x"] <= suspect["x"], (cage, suspect)
    assert cage["y"] <= suspect["y"], (cage, suspect)
    assert cage["x"] + cage["width"] >= suspect["x"] + suspect["width"], (cage, suspect)
    assert cage["y"] + cage["height"] >= suspect["y"] + suspect["height"], (cage, suspect)


def assert_production_copy(page: Page) -> None:
    copy = page.locator("body").inner_text()
    for forbidden in (
        "Demo",
        "MVP",
        "测试版",
        "内测版",
        "最小可行",
        "v0",
        "v1",
    ):
        assert forbidden not in copy, (forbidden, copy)


def assert_minimal_landing(page: Page) -> None:
    expect(page.get_by_label(LANDING_PROMPT)).to_be_visible()
    expect(page.get_by_role("button", name="生成案件")).to_be_visible()
    expect(page.get_by_role("button", name="退出")).to_be_visible()
    copy = page.locator("body").inner_text()
    for forbidden in (
        "CASE SYSTEM / 12+",
        "INTERROGATION READY",
        "CASE-001",
        "EVIDENCE",
        "三步完成一次审讯",
    ):
        assert forbidden not in copy, (forbidden, copy)


def authenticate_browser(page: Page) -> None:
    page.goto(WEB_BASE)
    page.wait_for_url(re.compile(r"/access\?next="))
    assert_production_copy(page)
    token_input = page.get_by_label("访问令牌")
    token_input.fill("WRONG")
    page.get_by_role("button", name="进入审讯室").click()
    expect(page.locator("#access-error")).to_contain_text("访问令牌不正确")
    expect(token_input).to_have_value("WRONG")
    token_input.fill(ACCESS_TOKEN)
    page.get_by_role("button", name="进入审讯室").click()
    page.wait_for_url(WEB_BASE + "/")


def submit_question(page: Page, evidence_id: str, question: str, expected_feedback: str) -> None:
    page.get_by_role("button", name=re.compile(rf"选择证据 {evidence_id}\b")).click()
    page.get_by_role("textbox", name="向嫌疑人提问").fill(question)
    page.get_by_role("button", name="发送问题").click()
    expect(page.get_by_text(expected_feedback, exact=False)).to_be_visible(timeout=10_000)


def verify_main_ui_flow(context) -> None:
    page = context.new_page()
    console_errors: list[str] = []
    api_responses: list[str] = []
    failed_responses: list[str] = []
    page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
    page.on(
        "response",
        lambda response: api_responses.append(f"{response.status} {response.url}")
        if "/api/v1/" in response.url
        else None,
    )
    page.on(
        "response",
        lambda response: failed_responses.append(f"{response.status} {response.url}")
        if response.status >= 400
        else None,
    )
    authenticate_browser(page)
    console_errors.clear()
    page.wait_for_load_state("networkidle")
    assert_minimal_landing(page)
    assert_production_copy(page)
    assert_no_horizontal_overflow(page)
    page.screenshot(path=str(ARTIFACTS / "1440-landing.png"), full_page=True)

    page.get_by_role("button", name="生成案件").click()
    scene = page.get_by_role("region", name="AI 嫌疑人案件生成场景")
    expect(scene).to_have_attribute("data-launch-state", "CEREMONY")
    page.wait_for_timeout(2_850)
    assert_cage_contains_suspect(page)
    expect(page.get_by_text("新案件暂时无法生成", exact=False)).to_be_visible(timeout=7_000)
    page.get_by_role("button", name="改用精修固定案继续体验").click()
    page.wait_for_timeout(1_000)
    if "/case/001/briefing?session=" not in page.url:
        visible_errors = page.locator("[role='alert']").all_text_contents()
        button_text = page.get_by_role("button", name=re.compile("案件")).inner_text()
        raise AssertionError(
            f"start case did not navigate: url={page.url}, errors={visible_errors}, "
            f"button={button_text!r}, responses={api_responses}, failed={failed_responses}, "
            f"console={console_errors}"
        )
    page.wait_for_url(re.compile(r"/case/001/briefing\?session="))
    expect(page.get_by_role("heading", name="静默备份")).to_be_visible()
    assert_production_copy(page)
    page.get_by_role("button", name=re.compile("开始审讯")).click()
    page.wait_for_url(re.compile(r"/case/001/interrogate\?session="))
    report_button = page.get_by_role("button", name=re.compile("提交结案"))
    expect(report_button).to_be_disabled()
    assert_production_copy(page)

    submit_question(page, "E02", "21:17 当晚你离开档案室去侧门做什么？", "有效对质")
    expect(report_button).to_be_disabled()
    submit_question(page, "E04", "你接触过备份盘或备用读写器吗？", "有效对质")
    expect(report_button).to_be_disabled()
    submit_question(page, "E05", "妹妹账户的转账款项与你的动机有什么关系？", "有效对质")
    expect(report_button).to_be_enabled()
    page.screenshot(path=str(ARTIFACTS / "1440-workbench-hit.png"), full_page=True)

    report_button.click()
    page.wait_for_url(re.compile(r"/case/001/report\?session="))
    page.get_by_role("button", name=re.compile("V01")).click()
    page.get_by_role("button", name=re.compile("下一步")).click()
    for evidence_id in ("E02", "E04", "E05"):
        page.get_by_role("button", name=re.compile(rf"{evidence_id}\b")).click()
    page.get_by_role("button", name=re.compile("下一步")).click()
    page.get_by_role("button", name=re.compile("M01")).click()
    page.get_by_role("button", name=re.compile("H01")).click()
    page.get_by_role("button", name=re.compile("核对并提交")).click()
    expect(page.get_by_role("dialog")).to_be_visible()
    page.get_by_role("button", name="确认结案").click()
    page.wait_for_url(re.compile(r"/case/001/result\?session="))
    expect(page.get_by_text("100", exact=True)).to_be_visible()
    expect(page.get_by_role("heading", name="真相时间线")).to_be_visible()
    expect(page.get_by_role("button", name=re.compile("重新审讯"))).to_be_visible()
    expect(page.get_by_role("button", name=re.compile("生成下一案"))).to_be_visible()
    assert_production_copy(page)
    page.screenshot(path=str(ARTIFACTS / "1440-result-s.png"), full_page=True)

    dynamic_case = api("GET", f"/cases/{DYNAMIC_CASE_ID}")
    generation_job_id = "gen_e2e_dynamic_case"
    page.route(
        "**/api/v1/case-generation-jobs",
        lambda route: route.fulfill(
            status=202,
            content_type="application/json",
            body=json.dumps(
                {
                    "jobId": generation_job_id,
                    "status": "pending",
                    "case": None,
                    "error": None,
                },
                ensure_ascii=False,
            ),
        ),
    )
    page.route(
        f"**/api/v1/case-generation-jobs/{generation_job_id}",
        lambda route: route.fulfill(
            status=200,
            content_type="application/json",
            body=json.dumps(
                {
                    "jobId": generation_job_id,
                    "status": "completed",
                    "case": dynamic_case,
                    "error": None,
                },
                ensure_ascii=False,
            ),
        ),
    )
    page.get_by_role("button", name=re.compile("生成下一案")).click()
    page.wait_for_url(
        re.compile(rf"/case/{DYNAMIC_CASE_ID}/briefing\?session="),
        timeout=10_000,
    )
    expect(page.get_by_role("heading", name="错位签收")).to_be_visible()
    assert_production_copy(page)
    unexpected_console_errors = [
        message for message in console_errors if "503 (Service Unavailable)" not in message
    ]
    assert unexpected_console_errors == [], console_errors
    page.close()


def verify_landing_viewports(context) -> None:
    for width, height, name in (
        (1440, 900, "1440-landing"),
        (1280, 800, "1280-landing"),
        (1024, 768, "1024-landing"),
        (768, 1024, "768-landing"),
        (390, 844, "390-landing"),
    ):
        page = context.new_page()
        page.set_viewport_size({"width": width, "height": height})
        page.goto(WEB_BASE)
        page.wait_for_load_state("networkidle")
        assert_minimal_landing(page)
        expect(page.get_by_role("region", name="AI 嫌疑人案件生成场景")).to_have_attribute(
            "data-launch-state", "IDLE"
        )
        assert_production_copy(page)
        assert_no_horizontal_overflow(page)
        dimensions = page.evaluate(
            "() => ({ height: window.innerHeight, scroll: document.documentElement.scrollHeight })"
        )
        assert dimensions["scroll"] <= dimensions["height"] + 1, dimensions
        button_box = page.get_by_role("button", name="生成案件").bounding_box()
        assert button_box and button_box["height"] >= 44, button_box
        page.screenshot(path=str(ARTIFACTS / f"{name}.png"), full_page=True)
        page.close()


def verify_dynamic_case_flow(context) -> None:
    session_id = create_session(DYNAMIC_CASE_ID)["sessionId"]
    page = context.new_page()
    page.goto(f"{WEB_BASE}/case/{DYNAMIC_CASE_ID}/briefing?session={session_id}")
    page.wait_for_load_state("networkidle")
    expect(page.get_by_role("heading", name="错位签收")).to_be_visible()
    assert_production_copy(page)
    page.get_by_role("button", name=re.compile("开始审讯")).click()
    page.wait_for_url(re.compile(rf"/case/{DYNAMIC_CASE_ID}/interrogate\?session="))

    submit_question(page, "E02", "21:14 的门禁时间怎么解释？", "有效对质")
    submit_question(page, "E03", "包装台称重设备为什么有记录？", "有效对质")
    submit_question(page, "E05", "代售定金款项和你有什么关系？", "有效对质")
    page.get_by_role("button", name=re.compile("提交结案")).click()
    page.wait_for_url(re.compile(rf"/case/{DYNAMIC_CASE_ID}/report\?session="))
    page.get_by_role("button", name=re.compile(r"V01")).click()
    page.get_by_role("button", name=re.compile("下一步")).click()
    for evidence_id in ("E02", "E03", "E05"):
        page.get_by_role("button", name=re.compile(rf"{evidence_id}\b")).click()
    page.get_by_role("button", name=re.compile("下一步")).click()
    page.get_by_role("button", name=re.compile(r"M01")).click()
    page.get_by_role("button", name=re.compile(r"H01")).click()
    page.get_by_role("button", name=re.compile("核对并提交")).click()
    page.get_by_role("button", name="确认结案").click()
    page.wait_for_url(re.compile(rf"/case/{DYNAMIC_CASE_ID}/result\?session="))
    expect(page.get_by_text("100", exact=True)).to_be_visible()

    page.get_by_role("button", name=re.compile("重新审讯")).click()
    page.wait_for_url(re.compile(rf"/case/{DYNAMIC_CASE_ID}/briefing\?session="))
    expect(page.get_by_role("heading", name="错位签收")).to_be_visible()
    page.close()


def verify_rule_edges() -> str:
    unrelated = create_session()
    initial_defense = unrelated["defense"]
    unrelated = turn(unrelated["sessionId"], "你昨晚去了哪里？", evidence_id="E01")
    assert unrelated["evidenceEffect"] == "used_ineffective"
    assert unrelated["defense"] == initial_defense

    repeated = create_session()
    repeated = turn(repeated["sessionId"], "你当晚在哪里？")
    defense_after_first = repeated["defense"]
    repeated = turn(repeated["sessionId"], "你当晚在哪里？")
    assert repeated["isRepeated"] is True
    assert repeated["defense"] == defense_after_first

    locked = create_session()
    locked = turn(locked["sessionId"], "21:17 当晚你离开档案室去侧门做什么？", evidence_id="E02")
    assert locked["turnCount"] == 1 and locked["canSubmitReport"] is False
    api(
        "POST",
        f"/sessions/{locked['sessionId']}/reports",
        {"verdictId": "V01", "evidenceIds": ["E02"], "motiveId": "M01", "methodId": "H01"},
        expected=409,
    )

    forced = create_session()
    for index in range(8):
        forced = turn(forced["sessionId"], f"请介绍你的第 {index + 1} 项日常工作。")
    assert forced["forceReport"] is True
    assert forced["stage"] == "report_required"
    return forced["sessionId"]


def verify_viewports_and_failure(context, forced_session_id: str) -> None:
    unlocked = unlock_report()
    session_id = unlocked["sessionId"]

    page = context.new_page()
    page.set_viewport_size({"width": 1366, "height": 768})
    page.goto(f"{WEB_BASE}/case/001/report?session={session_id}")
    page.wait_for_load_state("networkidle")
    page.get_by_role("button", name=re.compile("V02")).click()
    page.get_by_role("button", name=re.compile("下一步")).click()
    page.get_by_role("button", name=re.compile(r"E01\b")).click()
    page.get_by_role("button", name=re.compile("下一步")).click()
    page.get_by_role("button", name=re.compile("M02")).click()
    page.get_by_role("button", name=re.compile("H02")).click()
    page.get_by_role("button", name=re.compile("核对并提交")).click()
    dialog = page.get_by_role("dialog")
    expect(dialog).to_be_visible()
    box = dialog.bounding_box()
    assert box and box["y"] >= 0 and box["y"] + box["height"] <= 768, box
    page.screenshot(path=str(ARTIFACTS / "1366-report-confirm.png"), full_page=True)
    page.get_by_role("button", name="确认结案").click()
    page.wait_for_url(re.compile(r"/case/001/result\?session="))
    expect(page.get_by_role("heading", name="真相时间线")).to_be_visible()
    assert_production_copy(page)
    expect(page.get_by_text("20:55｜许沉使用维护账户暂停 B2 监控。", exact=True)).to_be_visible()
    page.close()

    page = context.new_page()
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(f"{WEB_BASE}/case/001/interrogate?session={forced_session_id}")
    page.wait_for_url(re.compile(r"/case/001/report\?session="), timeout=5_000)
    expect(page.get_by_role("heading", name="结案报告")).to_be_visible()
    page.screenshot(path=str(ARTIFACTS / "390-forced-report.png"), full_page=True)
    page.close()

    mobile_session = create_session()["sessionId"]
    for width, height, route, name in (
        (390, 844, f"/case/001/interrogate?session={mobile_session}", "390-workbench"),
        (360, 800, f"/case/001/result?session={session_id}", "360-result-failure"),
    ):
        page = context.new_page()
        page.set_viewport_size({"width": width, "height": height})
        page.goto(f"{WEB_BASE}{route}")
        page.wait_for_load_state("networkidle")
        assert_production_copy(page)
        assert_no_horizontal_overflow(page)
        page.screenshot(path=str(ARTIFACTS / f"{name}.png"), full_page=True)
        page.close()


def verify_logout(context) -> None:
    page = context.new_page()
    page.goto(WEB_BASE)
    page.get_by_role("button", name="退出").click()
    page.wait_for_url(WEB_BASE + "/access")
    expect(page.get_by_role("heading", name="出示访问凭据")).to_be_visible()
    page.close()


def main() -> int:
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    authenticate_api()
    health = api("GET", "/health")
    assert health == {"status": "ok"}
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True, args=["--no-proxy-server"])
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        verify_main_ui_flow(context)
        verify_landing_viewports(context)
        verify_dynamic_case_flow(context)
        forced_session_id = verify_rule_edges()
        verify_viewports_and_failure(context, forced_session_id)
        verify_logout(context)
        context.close()
        browser.close()
    print("web-smoke: main flow, rule edges, accessibility-critical layouts, and 5 landing viewports passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
