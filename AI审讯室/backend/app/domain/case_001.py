from __future__ import annotations

CASE_001 = {
    "case_id": "001",
    "case_code": "CASE-001",
    "title": "静默备份",
    "subtitle": "城北档案中心资料异常事件",
    "time": "2026 年 8 月 17 日，21:05–21:26",
    "location": "城北档案中心 B2 数字化室",
    "summary": (
        "一份即将提交审计的旧城改造合同备份在夜间消失。现场没有暴力痕迹，"
        "监控恰好中断 35 分钟。负责当晚系统检修的许沉坚持自己从未离开档案室。"
    ),
    "content_rating": "12+ 推理",
    "suspect": {
        "id": "S01",
        "name": "许沉",
        "age": 34,
        "role": "档案中心系统维护员",
        "public_identity": "当晚唯一拥有监控维护权限的值班人员。",
        "demeanor": "克制、谨慎，习惯用技术细节回避直接回答。",
        "soft_spot": "妹妹许澄背负高额医疗债务。",
        "soft_spot_keywords": ["妹妹", "医疗债务", "还债"],
        "soft_spot_acknowledgement": "承认家庭医疗债务让自己长期承受压力。",
    },
    "initial_statement": (
        "21 点以后我一直在档案室修复索引。监控中断是例行升级，备份盘丢失和我没有关系。"
    ),
    "public_facts": [
        "B2 数字化室没有破门或撬锁痕迹。",
        "只有值班维护员能暂停该区域的监控采集。",
        "丢失的备份盘保存着一份待审计的旧城改造补充合同。",
    ],
    "evidence": [
        {
            "id": "E01",
            "name": "监控检修单",
            "description": "系统记录显示 B2 监控于 20:55 被维护账户手动暂停，21:30 恢复。",
            "source": "档案中心运维日志",
            "hint": "检修窗口是谁设置的？它与事件时间是否重叠？",
            "public": True,
        },
        {
            "id": "E02",
            "name": "侧门门禁记录",
            "description": "21:17，许沉的个人门禁卡打开了连接档案室与数字化室的侧门。",
            "source": "门禁控制器离线缓存",
            "hint": "将刷卡时间与许沉声称的位置放在一起看。",
            "public": True,
        },
        {
            "id": "E03",
            "name": "手机信号记录",
            "description": "21:12–21:24，许沉的工作手机连接到数字化室北侧的室内基站。",
            "source": "内部通信系统",
            "hint": "设备位置不等于本人位置，但能检验他的解释。",
            "public": False,
        },
        {
            "id": "E04",
            "name": "备份盘触点残留",
            "description": "备用读写器缓存的触点样本与许沉的值班登记样本一致。",
            "source": "设备维护取样记录",
            "hint": "他是否接触过自己声称没见过的设备？",
            "public": False,
        },
        {
            "id": "E05",
            "name": "撤回转账记录",
            "description": "案发前两天，一笔 18 万元款项汇入许沉妹妹的债务账户，次日被原路撤回。",
            "source": "内部审计授权材料",
            "hint": "款项与失踪合同中的顾问方有何联系？",
            "public": False,
        },
    ],
    "lie_nodes": [
        {
            "id": "L01",
            "claim": "21 点以后一直没有离开档案室",
            "evidence_id": "E02",
            "topics": ["时间", "门禁"],
            "defense_delta": -16,
            "unlock_evidence_ids": ["E03", "E04"],
            "acknowledgement": "承认 21:17 曾经过侧门，但声称只是检查线路。",
        },
        {
            "id": "L02",
            "claim": "从未接触丢失的备份盘",
            "evidence_id": "E04",
            "topics": ["设备"],
            "defense_delta": -18,
            "unlock_evidence_ids": ["E05"],
            "acknowledgement": "承认曾把备份盘接入读写器，但声称是例行校验。",
        },
        {
            "id": "L03",
            "claim": "妹妹账户的款项只是普通借款，与合同无关",
            "evidence_id": "E05",
            "topics": ["款项"],
            "defense_delta": -24,
            "unlock_evidence_ids": [],
            "acknowledgement": "承认受顾问方要挟，暂停监控并取走备份盘。",
        },
    ],
    "truth_options": [
        {"id": "V01", "label": "许沉取走备份盘，并把事件伪装成系统故障"},
        {"id": "V02", "label": "外部人员利用许沉的权限远程盗取了资料"},
        {"id": "V03", "label": "备份盘只是被误放，现场不存在人为隐瞒"},
    ],
    "motive_options": [
        {"id": "M01", "label": "为妹妹偿还医疗债务，并掩盖顾问方的利益输送"},
        {"id": "M02", "label": "报复长期压榨他的直属主管"},
        {"id": "M03", "label": "替竞争公司窃取旧城改造商业资料"},
    ],
    "method_options": [
        {"id": "H01", "label": "用维护权限暂停监控、刷开侧门并调包备份盘"},
        {"id": "H02", "label": "从档案室远程入侵服务器并删除原文件"},
        {"id": "H03", "label": "把门禁卡交给第三方，由对方进入数字化室"},
    ],
    "truth": {
        "verdict_id": "V01",
        "motive_id": "M01",
        "method_id": "H01",
        "core_evidence_weights": {"E02": 7, "E04": 7, "E05": 6},
        "summary": (
            "许沉因妹妹的医疗债务受合同顾问方要挟。他利用维护权限暂停监控，"
            "在 21:17 刷开侧门进入数字化室，将备份盘接入读写器后取走，"
            "试图让事件看起来像一次普通系统故障。"
        ),
        "timeline": [
            "20:55｜许沉使用维护账户暂停 B2 监控。",
            "21:12｜他的工作手机连接数字化室北侧基站。",
            "21:17｜个人门禁卡打开数字化室侧门。",
            "21:19｜备份盘被接入备用读写器并留下触点样本。",
            "21:26｜待审计备份盘从保管柜中消失。",
            "21:30｜监控恢复，许沉继续在档案室值班。",
        ],
    },
    "reply_templates": {
        "effective_L01": "门禁记录不会错，我确实在 21:17 经过侧门。那时线路报警，我只出去看了不到两分钟。把这件事说成偷窃，太牵强了。",
        "effective_L02": "我接触过那块盘，但只是把它接到备用读写器上做校验。值班人员做这种操作很正常。我之前不说，是因为这会让所有怀疑都落到我身上。",
        "effective_L03": "那笔钱不是普通借款，他们拿我妹妹的债务逼我配合。我暂停了监控，也取走了备份盘。但我没有伤害任何人，盘也没有被销毁。",
        "repeated": "这个问题你刚才已经问过了。我的回答没有改变。重复施压不会让记录变成另一回事。",
        "irrelevant": "这份材料和你刚问的事情没有直接关系。你可以怀疑我，但至少先把证据和问题对上。别把每张纸都当成答案。",
        "pressure": "提高声音不会改变事实。我已经说明了当晚的工作安排。如果你有具体记录，就拿出来。",
        "empathy": "我不想把家里的事带进这里。妹妹确实欠着医疗费，但这不代表我做了你说的事。你可以问，但别替我下结论。",
        "probing": "你问到了当晚的时间安排。我按检修单处理系统，细节都应该在记录里。除此之外，我没有什么需要补充的。",
        "background": "我负责夜间系统维护，通常一个人值班。那晚的流程和以前没有不同。你想确认哪一个具体时间点？",
        "confession": "门禁、备份盘和那笔钱已经连在一起了，我没有必要再否认。我暂停监控并取走了备份盘，是因为他们拿妹妹的债务逼我配合。盘还在旧设备柜的夹层里，这就是全部。",
    },
}


EVIDENCE_BY_ID = {item["id"]: item for item in CASE_001["evidence"]}
LIE_NODE_BY_ID = {item["id"]: item for item in CASE_001["lie_nodes"]}


def public_case() -> dict:
    private_suspect_fields = {
        "soft_spot",
        "soft_spot_keywords",
        "soft_spot_acknowledgement",
    }
    public_suspect = {
        key: value
        for key, value in CASE_001["suspect"].items()
        if key not in private_suspect_fields
    }
    return {
        "case_id": CASE_001["case_id"],
        "case_code": CASE_001["case_code"],
        "title": CASE_001["title"],
        "subtitle": CASE_001["subtitle"],
        "time": CASE_001["time"],
        "location": CASE_001["location"],
        "summary": CASE_001["summary"],
        "content_rating": CASE_001["content_rating"],
        "suspect": public_suspect,
        "initial_statement": CASE_001["initial_statement"],
        "public_facts": CASE_001["public_facts"],
        "evidence": [item for item in CASE_001["evidence"] if item["public"]],
        "truth_options": CASE_001["truth_options"],
        "motive_options": CASE_001["motive_options"],
        "method_options": CASE_001["method_options"],
    }


# The handcrafted case remains the stable fallback, but it participates in the
# same immutable snapshot contract as generated cases.
from app.domain.case_models import snapshot_from_legacy

MANUAL_CASE = snapshot_from_legacy(CASE_001)
