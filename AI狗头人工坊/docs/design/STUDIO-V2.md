# 创作工作台 V2

用户已同意独立思考后的方向。模式 Operate，照片、想法和可继续修改的作品为中心。参考网站只贡献轻松的创作意愿，不锁定视觉形式。

## Direction contract

THESIS：把“选片”变成创作的主场。用户的照片和版本是主角，一句话意图与 Agent 的可执行方案紧邻画布。

OWN-WORLD：冷白画布、石墨文字、钴蓝操作，统一无衬线中文，克制的摄影工作台边界。图像本身提供色彩；无爪印背景、发光、渐变或装饰徽章。

STORY：看到变身示例 → 放入自己的照片 → 选择或描述犬种与气质 → 手动生成或让 Agent 理解、调用、检查 → 查看版本并继续修改。

FIRST VIEWPORT：64px 顶栏；简短 36px 标题；约 3:2 的画布与创作控制区，画布内完整前后对照，控制区包含一句话、可展开犬种目录与单一主操作。1440px 下工作区最大 1280px；手机 20px 留白，先提供上传与输入，结果随后。

FORM：摄影选片桌。已运行 concept-seed（90f58484），用户先前确认的照片与创作意图方向优先于随机分配；不引入终端、闪烁数据场或舞台光效等与本产品任务不合的挑战形式。保留它们要求的状态明确和视觉聚焦纪律。

FINISH：unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## 行为约定

手动模式保持已有直接生成能力。Agent 模式使用独立的视觉理解/工具调用模型，调用上限在主操作附近说明，是否允许一次自动修正在绘图设置中调整。流式展示实际工具事件；模型可提出澄清或提前结束；不得伪造检查结果。

初始作品是有标签的示例。犬种目录参考图只帮助理解外观，不代表上传图的预先结果。所有出站请求沿用服务端网络校验；密钥不落盘。

## 运行证据

concept-seed 原始工具输出摘录保存在 `concept-seed-output.txt`，从本次会话执行记录提取，包含 key 90f58484 与 assigned index 7。用户已选摄影工作台优先于随机方向。
