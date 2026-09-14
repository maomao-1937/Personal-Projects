# 素材与设计概念记录

## 2026-09-13 犬种表情改版

- `public/images/breed-atlas-v3.png`：本轮内置 image_gen 新生成并复制到项目的 24 犬种摄影参考图，6 列 × 4 行；按 `shared/breeds.ts` 的目录顺序展示。完整精确提示词见同目录 `breed-atlas-v3.prompt.txt`。旧版 v2 保留作历史资料，当前 UI 使用 v3。
- 参考中区分闭嘴、嘴唇微分、微露舌尖、短圆舌、长舌、偏侧舌和头部角度。表达是创作建议，不能当作犬种固有性格或生物学分类。生成图不保证逐项遵循精确方向；实际提示词以用户要求为最高优先级。
- 使用内置工具，没有调用用户供应商密钥。页面持续标为 AI 创作参考；不计入任何模型实测。

所有图像通过本次会话的内置 image_gen 工具生成，没有使用付费 API Key。人物为虚构成年人，不代表真实个人。

- `studio-concept.png`：完整桌面工作台概念，1586 × 992；作为内部选定视觉参考，没有额外要求用户进行人工批准。
- `../../public/images/example-person.png`：原始示例人像，1536 × 1024。
- `../../public/images/example-dog.png`：以前一张为编辑目标，只替换为柴犬头部，1536 × 1024。

## 实际提示词核心约束

概念稿：Chinese web application 狗头人工坊，单一深绿 #246B48、中性灰白 #F7F8F7、石墨文字 #202622；顶栏创作工坊/模型对比/模型接入，左侧上传与犬种、模型、提示词和生成按钮，右侧大幅狗头人照片与原图小图；无渐变、假指标、装饰徽章或卡片堆砌；所有交互和文字后续由原生代码实现。

原图：fictional East Asian adult man about 28, short tousled black hair, dark forest green overshirt over white t-shirt, jeans, seated with forearms on a raised knee; sunlit subdued gray photography studio, plant far left, furniture far right, natural skin detail, no text or UI. 3:2 editorial photograph.

编辑：replace ONLY the entire human head with a photorealistic orange Shiba Inu head; preserve human body, skin forearms, hands, pose, wardrobe, chair, room, camera framing and sunlight; natural dog expression and fur, anatomically coherent neck connection; no paws, no dog body, no added text, no UI.

生产页面明确标注“示例由 AI 创作，不代表已接入模型的实测效果”。这些图片用于解释产品与提供可重复输入，不计入供应商模型实测。

## V2 素材与字体

- `studio-v2-concept.png`：独立摄影工作台概念，冷白、石墨、钴蓝。只作为视觉批评参考；其中未实际产生的版本、账户信息等没有搬进产品。
- `../../public/images/breed-atlas-v2.png`：内置 image_gen 生成的 4 × 2 犬种参考图，1774 × 887；柴犬、哈士奇、金毛、边牧、柯基、萨摩耶、法斗、贵宾。CSS 定位展示单个犬种，没有把照片冒充实测效果。
- 所有生产图片与两版概念的精确生成提示已从本次工具调用提取，保存在同目录对应 `.prompt.txt`，并嵌入 PNG；`embed-prompt --scan public/images` 返回 3 rasters, 0 missing。上方“核心约束”仅为摘要，精确文本以这些文件为准。
- `../../public/fonts/studio-heading.ttf`：Google Fonts 的 Noto Sans SC 600 标题文字子集，页面自托管，无运行时第三方字体请求。上游 CSS 原文见 `font-source.css`，许可证在 `../../public/fonts/OFL.txt`。修改标题需补充子集；缺字回退本地字体。
- 参考网站截图只用于设计依据，不作为产品图片发布；所有运行时界面为真实 HTML/React 控件，未将概念截图铺成页面。
