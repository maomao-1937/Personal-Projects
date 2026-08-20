"""Job 执行器。验收 + 审查两条主链路。后台线程跑,状态持久化,可恢复。"""
import uuid
from datetime import datetime

from app.core.errors import AppError
from app.core.logger import logger
from app.db import init_db, session_scope
from app.models.models import ChecklistItem, Evidence, Finding, Job
from app.services import (
    case_generator,
    executor,
    judge,
    prd_parser,
    prd_review,
    report,
)


def run_job(job_id: str) -> None:
    """主入口。从 DB 读 Job,执行,写结果。可重启续跑(已 passed 的 item 不重跑)。"""
    init_db()  # 幂等建表
    with session_scope() as s:
        job = s.get(Job, job_id)
        if not job:
            logger.error("Job not found: %s", job_id)
            return
        job.status = "running"
        job.started_at = datetime.utcnow()
        job_type = job.type
        prd_text = job.prd_text
        target_url = job.target_url or ""
        allow_destructive = job.allow_destructive
        existing_items = (
            s.query(ChecklistItem)
            .filter(ChecklistItem.job_id == job_id)
            .count()
        )
    try:
        if job_type == "acceptance":
            _run_acceptance(
                job_id, prd_text, target_url, allow_destructive, existing_items
            )
        elif job_type == "review":
            _run_review(job_id, prd_text)
        else:
            raise AppError("invalid_job", f"未知 Job 类型: {job_type}", 400)
        with session_scope() as s:
            job = s.get(Job, job_id)
            job.status = "done"
            job.finished_at = datetime.utcnow()
    except AppError as e:
        _fail_job(job_id, e.message)
    except Exception as e:  # noqa: BLE001
        logger.exception("Job %s unexpected error", job_id)
        _fail_job(job_id, f"内部错误: {type(e).__name__}")


def _fail_job(job_id: str, message: str) -> None:
    with session_scope() as s:
        job = s.get(Job, job_id)
        if job:
            job.status = "failed"
            job.error_message = message
            job.finished_at = datetime.utcnow()


def _run_acceptance(
    job_id, prd_text, target_url, allow_destructive, existing_items: int
) -> None:
    # 若是重启续跑(items 已存在),跳过解析+生成
    if existing_items == 0:
        features = prd_parser.parse_prd(prd_text)
        checklist_data = case_generator.generate_checklist(features)
        with session_scope() as s:
            for seq, c in enumerate(checklist_data, 1):
                s.add(
                    ChecklistItem(
                        id=str(uuid.uuid4()),
                        job_id=job_id,
                        seq=seq,
                        description=c["description"],
                        expected=c["expected"],
                        destructive=bool(c.get("destructive", False)),
                        status="pending",
                    )
                )
    # 逐条执行 + 判定(已 passed 跳过)
    with session_scope() as s:
        item_ids = [
            i.id
            for i in s.query(ChecklistItem)
            .filter(ChecklistItem.job_id == job_id)
            .order_by(ChecklistItem.seq)
            .all()
        ]
    for item_id in item_ids:
        _run_one_item(item_id, target_url, allow_destructive)
    # 汇总报告
    with session_scope() as s:
        job = s.get(Job, job_id)
        job.result_json = report.build_acceptance_report(job)


def _run_one_item(item_id: str, target_url: str, allow_destructive: bool) -> None:
    with session_scope() as s:
        item = s.get(ChecklistItem, item_id)
        if not item:
            return
        if item.status == "passed":  # 重启续跑跳过
            return
        if item.destructive and not allow_destructive:
            item.status = "skipped"
            item.judge_result = "skipped"
            item.judge_reason = "破坏性检查未执行(allow_destructive=false)"
            return
        item.status = "running"
        description = item.description
        expected = item.expected

    # 执行(浏览器耗时,独立 session)
    try:
        ev_list = executor.execute_item(target_url, allow_destructive)
    except AppError as e:
        with session_scope() as s:
            item = s.get(ChecklistItem, item_id)
            item.status = "failed"
            item.judge_result = "fail"
            item.judge_reason = f"执行失败: {e.message}"
        return

    # 判定
    result, reason = judge.judge_item(description, expected, ev_list)

    # 持久化证据 + 结果
    with session_scope() as s:
        item = s.get(ChecklistItem, item_id)
        for ev in ev_list:
            ev.item_id = item_id
            s.add(ev)
        item.status = "passed" if result == "pass" else "failed"
        item.judge_result = result
        item.judge_reason = reason


def _run_review(job_id: str, prd_text: str) -> None:
    findings_data = prd_review.review_prd(prd_text)
    with session_scope() as s:
        for f in findings_data:
            s.add(
                Finding(
                    id=str(uuid.uuid4()),
                    job_id=job_id,
                    item_id=None,
                    severity=f.get("severity", "medium"),
                    category=f.get("category", "logic_gap"),
                    message=f["message"],
                    suggestion=f["suggestion"],
                )
            )
        job = s.get(Job, job_id)
        job.result_json = report.build_review_report(findings_data)
