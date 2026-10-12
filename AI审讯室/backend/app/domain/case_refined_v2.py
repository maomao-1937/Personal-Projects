from __future__ import annotations

from app.domain.case_models import CaseSnapshot


# Original curated story for the v2 multi-suspect investigation loop.  It is
# intentionally stored as an immutable snapshot so sessions remain replayable.
REFINED_CASE_V2 = CaseSnapshot.model_validate(
    {
        "schemaVersion": 2,
        "caseId": "refined-001-v2",
        "caseCode": "IR-26-071",
        "source": "manual_fallback",
        "title": "零点校样",
        "subtitle": "发布前夜，一份未公开的城市导览方案被替换",
        "time": "2026 年 9 月 6 日，22:10–23:05",
        "location": "临江文化中心三层联合工作室",
        "summary": (
            "城市夜游项目将在次日评审，但服务器中的最终导览方案被换成了旧稿，"
            "唯一的离线校样也不见了。三名仍在楼内的项目成员给出了彼此矛盾的时间线。"
        ),
        "contentRating": "12+ 推理",
        "suspect": {
            "id": "S01",
            "name": "程野",
            "age": 31,
            "role": "路线策划",
            "publicIdentity": "最终方案的主笔，也是最后一位提交修改的人。",
            "demeanor": "语速平稳，习惯把责任归因于流程混乱。",
            "softSpot": "担心自己擅自承诺的合作预算被追责。",
            "softSpotKeywords": ["预算承诺", "追责", "合作预算"],
            "softSpotAcknowledgement": "承认自己在预算压力下做过未经确认的决定。",
            "initialStatement": (
                "我在会议室整理讲稿，离开前只提交过一次最终稿。版本被换掉以后，"
                "我也和所有人一样着急。"
            ),
        },
        "initialStatement": (
            "我在会议室整理讲稿，离开前只提交过一次最终稿。版本被换掉以后，"
            "我也和所有人一样着急。"
        ),
        "suspects": [
            {
                "id": "S01",
                "name": "程野",
                "age": 31,
                "role": "路线策划",
                "publicIdentity": "最终方案的主笔，也是最后一位提交修改的人。",
                "demeanor": "语速平稳，习惯把责任归因于流程混乱。",
                "softSpot": "担心自己擅自承诺的合作预算被追责。",
                "softSpotKeywords": ["预算承诺", "追责", "合作预算"],
                "softSpotAcknowledgement": "承认自己在预算压力下做过未经确认的决定。",
                "initialStatement": (
                    "我在会议室整理讲稿，离开前只提交过一次最终稿。版本被换掉以后，"
                    "我也和所有人一样着急。"
                ),
            },
            {
                "id": "S02",
                "name": "林澄",
                "age": 28,
                "role": "视觉设计师",
                "publicIdentity": "负责导览图与离线校样，拥有工作室打印权限。",
                "demeanor": "回答直接，对被怀疑篡改文件表现出明显不耐。",
                "softSpot": "害怕一次未登记的设备外借影响个人信用。",
                "softSpotKeywords": ["设备外借", "未登记", "个人信用"],
                "softSpotAcknowledgement": "承认自己曾绕过登记流程处理工作设备。",
                "initialStatement": (
                    "我在打印间核对色样，二十二点半前就把校样放回文件柜。"
                    "之后我没有再碰服务器，也没见过程野。"
                ),
            },
            {
                "id": "S03",
                "name": "周叙",
                "age": 36,
                "role": "项目协调人",
                "publicIdentity": "管理工作室门禁、共享账号和次日评审安排。",
                "demeanor": "措辞严谨，经常用制度规定代替个人记忆。",
                "softSpot": "正在隐瞒一次越权借用共享账号的管理失误。",
                "softSpotKeywords": ["共享账号", "越权", "管理失误"],
                "softSpotAcknowledgement": "承认自己没有严格遵守账号管理要求。",
                "initialStatement": (
                    "我一直在一层接待外部评审助理，直到二十三点才回工作室。"
                    "共享账号按规定锁定，我没有远程操作过方案。"
                ),
            },
        ],
        "publicFacts": [
            "被替换的文件没有损坏，修改者使用了有效账号。",
            "离线校样与服务器最终稿原本应当内容一致。",
            "22:10 以后只有三名项目成员仍保有工作室权限。",
        ],
        "evidence": [
            {
                "id": "E01",
                "name": "打印队列记录",
                "description": "22:34，林澄的工作站向三层打印机发送过一份名为“旧稿比对”的文件。",
                "source": "工作室打印服务日志",
                "hint": "她声称何时结束打印工作？",
                "public": True,
            },
            {
                "id": "E02",
                "name": "会议室感应记录",
                "description": "22:41–22:52，会议室无人，程野的工位感应器却持续有人活动。",
                "source": "楼层节能系统",
                "hint": "程野声称自己一直在哪里？",
                "public": True,
            },
            {
                "id": "E03",
                "name": "共享账号登录记录",
                "description": "22:46，共享账号从周叙的平板登录，并下载了最终方案。",
                "source": "项目文件服务器",
                "hint": "共享账号是否真的处于锁定状态？",
                "public": False,
            },
            {
                "id": "E04",
                "name": "版本覆盖记录",
                "description": "22:49，程野的工位将旧稿覆盖为最终文件，并关闭了自动版本保留。",
                "source": "文件服务器审计记录",
                "hint": "谁的设备完成了真正的替换？",
                "public": False,
            },
            {
                "id": "E05",
                "name": "评审改期邮件",
                "description": "周叙在 22:28 收到评审提前的通知，却到 23:02 才转发给团队。",
                "source": "项目公共邮箱",
                "hint": "延迟的信息是否造成了误判或掩护？",
                "public": False,
            },
            {
                "id": "E06",
                "name": "校样封套残留",
                "description": "程野工位的资料袋中留有离线校样封套的编号标签，正文校样已被取出。",
                "source": "工作室物品清点记录",
                "hint": "缺失校样最后到了谁的工位？",
                "public": False,
            },
        ],
        "lieNodes": [
            {
                "id": "L01",
                "suspectId": "S02",
                "claim": "22:30 前已经结束打印，之后没有再操作文件",
                "evidenceId": "E01",
                "topics": ["时间", "文件"],
                "defenseDelta": -14,
                "unlockEvidenceIds": ["E03"],
                "acknowledgement": "承认 22:34 又打印过旧稿，但称只是替程野做临时比对。",
            },
            {
                "id": "L02",
                "suspectId": "S01",
                "claim": "整晚都在会议室整理讲稿",
                "evidenceId": "E02",
                "topics": ["时间", "位置"],
                "defenseDelta": -16,
                "unlockEvidenceIds": ["E04"],
                "acknowledgement": "承认 22:41 后回到过工位，但否认自己替换了方案。",
            },
            {
                "id": "L03",
                "suspectId": "S03",
                "claim": "共享账号已经锁定，自己没有远程操作",
                "evidenceId": "E03",
                "topics": ["权限", "设备"],
                "defenseDelta": -15,
                "unlockEvidenceIds": ["E05"],
                "acknowledgement": "承认用平板登录并下载文件，但称只是确认评审材料。",
            },
            {
                "id": "L04",
                "suspectId": "S01",
                "claim": "只提交过一次最终稿，没有关闭版本保留",
                "evidenceId": "E04",
                "topics": ["文件", "设备"],
                "defenseDelta": -24,
                "unlockEvidenceIds": ["E06"],
                "acknowledgement": "承认在自己工位覆盖了文件，并取走离线校样。",
            },
        ],
        "truthOptions": [
            {"id": "V01", "label": "程野主动替换最终方案，并取走离线校样"},
            {"id": "V02", "label": "林澄误用旧稿打印，系统自动覆盖了最终文件"},
            {"id": "V03", "label": "周叙利用共享账号远程替换方案以推迟评审"},
        ],
        "motiveOptions": [
            {"id": "M01", "label": "掩盖未经批准的路线与预算承诺，避免次日被追责"},
            {"id": "M02", "label": "报复团队否决自己的视觉方案"},
            {"id": "M03", "label": "制造混乱以争取更多项目准备时间"},
        ],
        "methodOptions": [
            {"id": "H01", "label": "借旧稿比对制造掩护，在个人工位覆盖文件并取走校样"},
            {"id": "H02", "label": "盗用共享账号从平板远程删除最终稿"},
            {"id": "H03", "label": "篡改打印服务，让旧稿自动同步到服务器"},
        ],
        "truth": {
            "verdictId": "V01",
            "motiveId": "M01",
            "methodId": "H01",
            "coreEvidenceWeights": {"E02": 5, "E04": 9, "E06": 6},
            "summary": (
                "程野为掩盖未经批准的路线与预算承诺，借口准备讲稿离开会议室，"
                "让林澄打印旧稿制造比对痕迹，随后在个人工位关闭版本保留、覆盖最终方案，"
                "并取走唯一的离线校样。周叙违规登录共享账号，但不是替换文件的人。"
            ),
            "timeline": [
                "22:28｜周叙收到评审提前通知，没有立即转发。",
                "22:34｜林澄按程野要求打印旧稿用于比对。",
                "22:41｜程野离开会议室并返回个人工位。",
                "22:46｜周叙违规登录共享账号下载最终方案。",
                "22:49｜程野关闭版本保留并用旧稿覆盖最终文件。",
                "22:52｜程野取走离线校样，封套标签留在工位。",
                "23:05｜团队发现服务器文件与评审目录不一致。",
            ],
        },
        "replyTemplates": {
            "effective_L01": "打印记录的时间没错，我确实又打了一份旧稿。那是程野临时让我做比对，我没有改服务器里的文件。",
            "effective_L02": "我后来回过工位，但只是拿充电器。感应记录只能说明有人在那里，不能说明文件就是我改的。",
            "effective_L03": "共享账号没有锁死，我用平板登录过。那是为了确认评审材料，我没有上传或覆盖任何文件。",
            "effective_L04": "覆盖操作来自我的工位，我也拿走了校样。路线和预算一旦被看见，我明天就解释不清，所以我想先换回旧稿。",
            "repeated": "这个问题你已经问过了，我的回答没有改变。请拿出新的事实。",
            "irrelevant": "这份证据与刚才的问题对不上。你可以继续怀疑，但先说明它究竟证明什么。",
            "pressure": "提高语气不会补上证据缺口。问具体的时间、设备或文件，我会回答。",
            "empathy": "我确实承受着工作之外的压力，也做过不合规的决定。但这不等于你的结论已经成立。",
            "probing": "你问到的环节确实值得核对，但我不会替你补齐缺失的证据。把时间和记录对起来再问。",
            "background": "当晚大家都在为评审收尾，临时操作很多。请告诉我你要核对的是哪一个时间点。",
            "confession": "记录已经能说明问题，我继续否认没有意义。我覆盖了最终方案，也取走了校样，原因都在那份未经确认的承诺里。",
        },
    }
)
