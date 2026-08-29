from __future__ import annotations

import os

from app.core.database import Database
from app.domain.case_models import CaseSnapshot
from app.repositories.cases import CaseRepository


DYNAMIC_CASE_ID = "case_e2e_misaligned_receipt"


def build_dynamic_case() -> CaseSnapshot:
    return CaseSnapshot.model_validate(
        {
            "schemaVersion": 1,
            "caseId": DYNAMIC_CASE_ID,
            "caseCode": "CASE-E2E-DYNAMIC",
            "source": "llm",
            "modelName": "fake-e2e-generator",
            "title": "错位签收",
            "subtitle": "南岸展品仓库交接异常事件",
            "time": "2026 年 8 月 21 日，20:40–21:28",
            "location": "南岸展品仓库包装区",
            "summary": "一件待返还的非贵重展品模型在闭库前消失，系统留下了互相冲突的签收、门禁与包装记录。",
            "contentRating": "12+ 推理",
            "suspect": {
                "id": "S21",
                "name": "周祁",
                "age": 29,
                "role": "展品仓库交接员",
                "publicIdentity": "当晚负责包装区关闭与返还登记。",
                "demeanor": "表面配合，遇到具体时间点会转而强调流程。",
                "softSpot": "一直在弥补一次曾导致同事受处分的登记失误。",
                "softSpotKeywords": ["登记失误", "同事处分"],
                "softSpotAcknowledgement": "承认过去的登记错误使自己害怕再次连累同事。",
            },
            "initialStatement": "20:50 之后我一直在前台核对签收单，没有进入包装区，模型失踪与我无关。",
            "publicFacts": [
                "包装区电子锁没有损坏。",
                "交接员的工卡可在闭库前开启包装区。",
                "失踪物是用于展示的建筑模型，不含危险部件。",
            ],
            "evidence": [
                {"id": "E01", "name": "访客预约单", "description": "最后一名访客在 20:42 完成签退，之后没有新访客登记。", "source": "前台预约系统", "hint": "確认外部人员是否仍在现场。", "public": True},
                {"id": "E02", "name": "包装区门禁", "description": "21:14，周祁的工卡开启了包装区电子锁。", "source": "电子锁本地记录", "hint": "将开门时间与他声称的位置对照。", "public": True},
                {"id": "E03", "name": "包装台称重记录", "description": "21:17，包装台增加了与失踪模型相近的重量。", "source": "称重设备离线缓存", "hint": "这个重量为什么出现在闭库后？", "public": False},
                {"id": "E04", "name": "车辆离场记录", "description": "21:24，周祁登记的小型货车短暂离开地下车库。", "source": "车库出口记录", "hint": "车辆离场是日常流程吗？", "public": False},
                {"id": "E05", "name": "匿名代售截图", "description": "案发前一日，匿名账号发布了同款模型的代售信息并记录定金款项。", "source": "平台合规调取记录", "hint": "代售时间是否早于所谓的意外失踪？", "public": False},
            ],
            "lieNodes": [
                {"id": "L01", "claim": "20:50 后没有进入包装区", "evidenceId": "E02", "topics": ["时间", "门禁"], "defenseDelta": -18, "unlockEvidenceIds": ["E03", "E04"], "acknowledgement": "承认 21:14 用工卡进入包装区，但声称只是检查电子锁。"},
                {"id": "L02", "claim": "没有把任何物品放上包装台", "evidenceId": "E03", "topics": ["设备"], "defenseDelta": -19, "unlockEvidenceIds": ["E05"], "acknowledgement": "承认曾把展品模型放上包装台，但声称是为了重新登记。"},
                {"id": "L03", "claim": "代售定金与自己无关", "evidenceId": "E05", "topics": ["款项"], "defenseDelta": -24, "unlockEvidenceIds": [], "acknowledgement": "承认提前联系买家并收取定金，但声称原本打算归还模型。"},
            ],
            "truthOptions": [
                {"id": "V01", "label": "周祁提前联系买家，将模型带离并伪装成交接疏漏"},
                {"id": "V02", "label": "外部访客滞留后利用遗失工卡带走模型"},
                {"id": "V03", "label": "模型被其他展览临时调用，只是登记延迟"},
            ],
            "motiveOptions": [
                {"id": "M01", "label": "通过私下代售获取额外款项"},
                {"id": "M02", "label": "为同事掩盖交接单上的登记错误"},
                {"id": "M03", "label": "用失踪事件促使仓库更换系统"},
            ],
            "methodOptions": [
                {"id": "H01", "label": "用本人工卡进入包装区，装箱后随登记车辆带离"},
                {"id": "H02", "label": "修改访客预约记录，由外部人员从前台带离"},
                {"id": "H03", "label": "远程修改库存系统，但模型始终留在原位"},
            ],
            "truth": {
                "verdictId": "V01",
                "motiveId": "M01",
                "methodId": "H01",
                "coreEvidenceWeights": {"E02": 7, "E03": 7, "E05": 6},
                "summary": "周祁在案发前已联系买家。他用本人工卡进入包装区，将模型装箱后通过登记车辆带离，并试图让事件看起来像交接登记疏漏。",
                "timeline": ["20:42｜最后一名访客签退。", "20:50｜周祁开始处理闭库交接。", "21:14｜他的工卡开启包装区。", "21:17｜包装台记录与模型相近的重量。", "21:24｜登记货车短暂离场。", "21:28｜闭库核对发现模型缺失。"],
            },
            "replyTemplates": {
                "effective_L01": "门禁记录是我的。我进去检查了电子锁，但没有带走模型。",
                "effective_L02": "我把模型放上称重台重新登记过。之前没说，是因为这会让交接记录更难解释。",
                "effective_L03": "代售信息是我发的，定金也是我收的。我把模型带离了仓库。",
                "repeated": "这个问题你已经问过，我没有新的回答。",
                "irrelevant": "这份材料和你的问题没有直接关系，请把证据与具体时间点对上。",
                "pressure": "只有提高声音不能改变交接记录。",
                "empathy": "我不想再因为登记问题连累其他人，但这不等于我拿了模型。",
                "probing": "你问的时间点在系统里都有记录，我按交接流程工作。",
                "background": "我负责闭库前的签收和库区检查，那晚的工作流程没有特别之处。",
                "confession": "证据已经连起来了。我提前联系买家，装箱后用车把模型带离了。",
            },
        }
    )


def seed() -> None:
    database = Database(os.environ["DATABASE_URL"])
    repository = CaseRepository(database)
    if repository.get(DYNAMIC_CASE_ID) is None:
        repository.create(build_dynamic_case())


if __name__ == "__main__":
    seed()
