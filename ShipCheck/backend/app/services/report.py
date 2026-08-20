"""汇总 Job 报告,写入 job.result_json。"""
from pathlib import Path

from app.services.fix_prompt import build_fix_tasks


def _evidence_url(e) -> str | None:
    """截图绝对路径 → /screenshots/<filename> URL,供前端展示。"""
    if e.kind == "screenshot" and e.path:
        return f"/screenshots/{Path(e.path).name}"
    return None


def build_acceptance_report(job) -> dict:
    """job: Job ORM(session 内,关系可懒加载)。"""
    items = job.checklist_items
    passed = sum(1 for i in items if i.status == "passed")
    failed = sum(1 for i in items if i.status == "failed")
    skipped = sum(1 for i in items if i.status == "skipped")
    failed_items = [i for i in items if i.status == "failed"]
    return {
        "summary": {
            "total": len(items),
            "passed": passed,
            "failed": failed,
            "skipped": skipped,
        },
        "checklist": [
            {
                "id": i.id,
                "seq": i.seq,
                "description": i.description,
                "expected": i.expected,
                "destructive": i.destructive,
                "status": i.status,
                "judge_result": i.judge_result,
                "judge_reason": i.judge_reason,
                "evidence": [
                    {
                        "kind": e.kind,
                        "url": _evidence_url(e),
                        "content": (
                            e.content[:300] if e.content else None
                        ),
                    }
                    for e in i.evidence
                ],
            }
            for i in items
        ],
        "fix_tasks": build_fix_tasks(failed_items),
    }


def build_review_report(findings_data: list[dict]) -> dict:
    """findings_data: list[dict](来自 prd_review)。"""
    return {
        "summary": {
            "total_findings": len(findings_data),
            "high": sum(
                1 for f in findings_data if f.get("severity") == "high"
            ),
            "medium": sum(
                1 for f in findings_data if f.get("severity") == "medium"
            ),
            "low": sum(
                1 for f in findings_data if f.get("severity") == "low"
            ),
        },
        "findings": [
            {
                "severity": f.get("severity", "medium"),
                "category": f.get("category", "logic_gap"),
                "message": f["message"],
                "suggestion": f["suggestion"],
            }
            for f in findings_data
        ],
    }
