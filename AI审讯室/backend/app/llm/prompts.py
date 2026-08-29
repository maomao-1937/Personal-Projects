from __future__ import annotations


CONTROLLED_THEMES = {
    "urban_archive": "现代城市中的非暴力档案异常",
    "workplace_secret": "职场环境中的非暴力商业秘密事件",
    "missing_property": "公共场所中的非暴力财物失踪事件",
}


def generation_messages(prompt: str) -> list[dict[str, str]]:
    return [
        {
            "role": "system",
            "content": (
                "你是中国本土轻推理游戏的案件设计器。只输出合法 JSON，不输出 Markdown。"
                "案件必须为 12+、非血腥、固定真相、证据闭环且只有一个正确结论。"
            ),
        },
        {"role": "user", "content": prompt},
    ]


def review_messages(prompt: str) -> list[dict[str, str]]:
    return [
        {
            "role": "system",
            "content": (
                "你是案件自洽审校员。只输出 JSON："
                '{"passed":boolean,"issues":[string]}。不得改写案件。'
            ),
        },
        {"role": "user", "content": prompt},
    ]


def dialogue_messages(prompt: str) -> list[dict[str, str]]:
    return [
        {
            "role": "system",
            "content": "你是审讯游戏中的嫌疑人。严格遵守允许透露范围，不主动认罪。",
        },
        {"role": "user", "content": prompt},
    ]


def build_case_prompt(theme: str | None = None, difficulty: str = "standard") -> str:
    theme_line = CONTROLLED_THEMES.get(
        theme or "",
        "现代城市中的非暴力资料、财物或职场秘密事件",
    )
    return f"""
请生成一份完整案件 JSON。主题：{theme_line}；难度：{difficulty}。

硬性约束：
- 5 条证据，ID 固定为 E01–E05，恰好 2 条 public=true；
- 3 个谎言节点，ID 固定为 L01–L03，每个映射一条证据；
- 3 个真相、3 个动机、3 个手法选项，分别使用 V01–V03、M01–M03、H01–H03；
- 每个节点提供 topics、defense_delta、unlock_evidence_ids、acknowledgement；三个节点必须使用三条不同证据；
- 证据链必须从 2 条公开证据起步：至少一个谎言节点使用公开证据，之后只通过已命中节点的 unlock_evidence_ids 逐步解锁其余节点所需证据，不能形成不可进入的循环；
- 最终 5 条证据都必须可由公开证据或 unlock_evidence_ids 发现；
- topics 只能从这些受控中文概念中选择：时间、位置、门禁、设备、款项、监控、手机、身份、权限、文件；
- 真相时间线 5–7 条，核心证据权重总和不超过 20；
- reply_templates 必须包含 effective_L01、effective_L02、effective_L03、repeated、irrelevant、pressure、empathy、probing、background、confession；
- content_rating 必须精确写为“12+ 推理”；不能出现血腥细节、危险教学、真实人物或真实单位；不得使用现实公众人物、品牌或正式单位全称，场所只用虚构通用名称；
- 所有文案使用简体中文，输出完整合法 JSON。
- 输出前在内部检查时间线、证据映射和唯一正确答案；不要输出检查过程。

顶层字段：title、subtitle、time、location、summary、content_rating、suspect、initial_statement、public_facts、evidence、lie_nodes、truth_options、motive_options、method_options、truth、reply_templates。
suspect 必须包含 id、name、age、role、public_identity、demeanor、soft_spot、soft_spot_keywords、soft_spot_acknowledgement；后两者分别是 1–5 个长度为 2–16 字、玩家可自然说出的中文命中词，以及不复述 soft_spot 完整私密细节的局部承认。
这是 JSON 接口，请不要输出解释。
""".strip()


def build_review_prompt(case_json: str) -> str:
    return f"""
检查下面案件是否自洽，并重点验证：时间线无冲突、三个谎言均有证据、证据能唯一推出真相、干扰选项不产生第二个正确答案、内容符合 12+。
只返回 JSON 审校结论，不要修改案件。

案件 JSON：
{case_json}
""".strip()
