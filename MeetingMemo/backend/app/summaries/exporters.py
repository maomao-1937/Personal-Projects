import json

from app.summaries.schemas import SummaryPayload, SummaryVersionResponse


def _sources(source_segment_ids: list[str]) -> str:
    return ", ".join(f"[{item}]" for item in source_segment_ids)


def export_markdown(
    meeting_title: str,
    summary: SummaryVersionResponse,
) -> str:
    content = summary.content
    lines = [
        f"# {meeting_title}",
        "",
        f"> 摘要版本：v{summary.version}",
        "",
        "## 核心结论",
        "",
        content.headline,
        "",
        "## 讨论主题",
        "",
    ]
    for topic in content.topics:
        lines.extend(
            [
                f"### {topic.title}",
                "",
                topic.summary,
                "",
                f"来源：{_sources(topic.source_segment_ids)}",
                "",
            ]
        )
    lines.extend(["## 决策", ""])
    if content.decisions:
        for decision in content.decisions:
            lines.append(
                f"- {decision.text}（{decision.confidence}；"
                f"来源：{_sources(decision.source_segment_ids)}）"
            )
    else:
        lines.append("- 未提取到明确决策。")
    lines.extend(["", "## 待办", ""])
    if content.action_items:
        for action in content.action_items:
            owner = action.owner or "待分配"
            due_date = action.due_date or "未提及"
            lines.append(
                f"- {action.task}｜责任人：{owner}｜截止：{due_date}｜"
                f"来源：{_sources(action.source_segment_ids)}"
            )
    else:
        lines.append("- 未提取到明确待办。")
    lines.extend(["", "## 未决问题", ""])
    if content.open_questions:
        for question in content.open_questions:
            lines.append(f"- {question.text}（来源：{_sources(question.source_segment_ids)}）")
    else:
        lines.append("- 无。")
    lines.extend(["", "## 质量提示", ""])
    lines.extend(f"- {flag}" for flag in content.quality_flags)
    if not content.quality_flags:
        lines.append("- 无。")
    return "\n".join(lines).rstrip() + "\n"


def export_text(meeting_title: str, summary: SummaryVersionResponse) -> str:
    content: SummaryPayload = summary.content
    lines = [
        meeting_title,
        f"摘要版本：v{summary.version}",
        "",
        "核心结论",
        content.headline,
        "",
        "决策",
    ]
    lines.extend(
        f"- {item.text}（来源：{', '.join(item.source_segment_ids)}）" for item in content.decisions
    )
    if not content.decisions:
        lines.append("- 未提取到明确决策。")
    lines.extend(["", "待办"])
    lines.extend(
        f"- {item.task}｜责任人：{item.owner or '待分配'}｜"
        f"截止：{item.due_date or '未提及'}｜来源：{', '.join(item.source_segment_ids)}"
        for item in content.action_items
    )
    if not content.action_items:
        lines.append("- 未提取到明确待办。")
    return "\n".join(lines).rstrip() + "\n"


def export_json(
    meeting: dict[str, object],
    summary: SummaryVersionResponse,
) -> str:
    payload = {
        "meeting": meeting,
        "summary": summary.model_dump(mode="json"),
    }
    return json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
