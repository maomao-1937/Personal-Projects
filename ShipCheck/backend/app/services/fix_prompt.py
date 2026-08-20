"""从失败的 checklist item 生成修复任务。MVP 用模板,不调 LLM。"""


def build_fix_tasks(failed_items) -> list[dict]:
    """failed_items: list[ChecklistItem ORM]。返回修复任务列表。"""
    tasks: list[dict] = []
    for it in failed_items:
        reason = it.judge_reason or "未提供理由"
        tasks.append(
            {
                "item_id": it.id,
                "seq": it.seq,
                "description": it.description,
                "expected": it.expected,
                "reason": reason,
                "fix": (
                    f"修复'{it.description}'相关实现;"
                    f"期望:{it.expected};判定理由:{reason}"
                ),
            }
        )
    return tasks
