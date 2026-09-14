import { loadAgentSkill, type AgentSkillId } from "./agent-skills";
import { z } from "zod";
import { breeds, breedExpressions } from "../shared/breeds";
import {
  directorSchema,
  agentHistorySchema,
  directorCanSee,
  designSchema,
  reviewSchema,
  type AgentEvent,
  type DesignPlan,
  type ImageReview,
} from "../shared/agent";
import {
  generate,
  generationSchema,
  normalizeImage,
  type GenerationResult,
} from "./adapters";
import {
  PublicError,
  transport,
  validateTarget,
  type Transport,
} from "./network";

export const agentRequestSchema = z.object({
  director: directorSchema,
  directorKey: generationSchema.shape.apiKey,
  renderer: generationSchema.shape.profile,
  rendererKey: generationSchema.shape.apiKey,
  image: generationSchema.shape.image,
  task: z.enum(["create", "edit"]).default("create"),
  request: z.string().trim().min(1).max(1600),
  preferredBreed: z.string().max(60).default(""),
  style: z.enum(["photo", "paint", "toon"]).default("photo"),
  freedom: z.enum(["head", "scene"]).default("head"),
  maxRenders: z.union([z.literal(1), z.literal(2)]).default(1),
  previousPlan: designSchema.optional(),
  history: agentHistorySchema.default([]),
});
export type AgentInput = z.infer<typeof agentRequestSchema>;
type Message = {
  role: "system" | "user" | "assistant" | "tool";
  content: unknown;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
  reasoning_content?: string | null;
  reasoning_details?: unknown[];
};
type ToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
  extra_content?: Record<string, unknown>;
};
const callSchema = z.object({
  extra_content: z.record(z.string(), z.unknown()).optional(),
  id: z.string().min(1),
  type: z.literal("function"),
  function: z.object({
    name: z.string().min(1),
    arguments: z.string().max(16000),
  }),
});
const messageSchema = z.object({
  reasoning_content: z.string().nullable().optional(),
  reasoning_details: z.array(z.unknown()).optional(),
  content: z.union([z.string(), z.null()]).optional(),
  tool_calls: z.array(callSchema).max(8).optional(),
});
const querySchema = z.object({ query: z.string().max(80) });
const noteSchema = z.object({ message: z.string().trim().min(1).max(900) });
const questionSchema = noteSchema.extend({
  choices: z.array(z.string().trim().min(1).max(100)).min(2).max(3).optional(),
});
const repairSchema = z.object({ repair: z.string().max(600).default("") });
const noArgs = z.object({});
const toolSchemas = {
  lookup_breeds: querySchema,
  propose_design: designSchema,
  generate_image: repairSchema,
  inspect_result: noArgs,
  ask_user: questionSchema,
  finish: noteSchema,
};
const descriptions = {
  lookup_breeds: "查询犬种名称、别名和外观。空 query 返回目录。",
  propose_design: "提交或修订明确的造型方案。在首次绘图前必须完成。",
  generate_image:
    "用当前方案和原始人像生成一张图。首次 repair 为空；修正时只能使用检查得出的具体建议。",
  inspect_result: "对照原始人像检查最新生成图，返回有证据的观察。",
  ask_user: "仅为目标人物不明或明确约束冲突提问，可附 2–3 个可直接执行的回答选项。普通造型细节自主决定，不请求方案批准。",
  finish: "结束并总结实际结果。没有生成作品不得声称完成。",
};
const tools = Object.entries(toolSchemas).map(([name, schema]) => ({
  type: "function",
  function: {
    name,
    description: descriptions[name as keyof typeof descriptions],
    parameters: z.toJSONSchema(schema),
  },
}));
export function compileDesign(
  plan: DesignPlan,
  input: Pick<AgentInput, "style" | "freedom"> & { task?: "create" | "edit"; request?: string },
  repair = "",
) {
  const look = {
    photo: "自然摄影，匹配原图镜头和光照",
    paint: "有体积感的绘画笔触，保留图像结构",
    toon: "精细 3D 角色质感，柔和材质与可信体积",
  }[input.style];
  return `${input.task === "edit" ? `编辑输入的现有狗头人作品，保持其已确定的视觉特征。用户本次修改：${input.request || ""}。仅改变本次明确要求的部分；不要从零重新设计。` : `编辑原始人像，只将主要人物头部替换为${plan.breed}犬头。`}\n外观：${plan.appearance}。表情：${plan.expression}。头部朝向：${plan.headPose}。配饰：${plan.accessories}。\n保留：${plan.preserve.join("；")}。允许修改：${plan.changes.join("；") || "仅头部及必要颈部融合"}。\n范围约束：${input.freedom === "head" ? "身体、人类手部、姿势、服装、背景与构图必须保持原样；不能扩大编辑区域。" : "仅按明确要求调整场景或配饰，其余身体和构图保持原样。"}\n质感：${look}。犬头比例与肩宽协调，毛发与颈部自然衔接；无残留人脸、额外耳朵或四足犬身体。${repair ? `\n本轮修正：${repair}。只修复这些问题，保持方案与其它已正确内容。` : ""}`;
}
export async function runAgent(
  input: AgentInput,
  signal: AbortSignal,
  emit: (event: AgentEvent) => void,
  deps: { send?: Transport; render?: typeof generate } = {},
) {
  const send = deps.send || transport;
  const render = deps.render || generate;
  const usedSkills = new Set<AgentSkillId>();
  const loadSkill = async (name: AgentSkillId) => {
    const { instructions, ...identity } = await loadAgentSkill(name);
    if (!usedSkills.has(name)) {
      emit({ type: "skill", ...identity });
      usedSkills.add(name);
    }
    return instructions;
  };
  validateTarget(input.director.endpoint);
  validateTarget(input.renderer.endpoint);
  const original = await normalizeImage(input.image);
  const canSee = directorCanSee(input.director);
  const renderLimit = canSee ? input.maxRenders : 1;
  const providerHost = new URL(input.director.endpoint).hostname;
  let calls = 0,
    renders = 0,
    plan: DesignPlan | undefined,
    latest: GenerationResult | undefined,
    review: ImageReview | undefined;
  let inspected = false;
  const checkAbort = () => {
    if (signal.aborted)
      throw new PublicError("已停止等待。供应商可能仍在处理本次请求。", 499);
  };
  const chat = async (messages: Message[], withTools = true) => {
    checkAbort();
    if (calls >= 10)
      throw new PublicError("已达到本轮理解调用上限，请查看已有结果后继续。");
    calls++;
    const reply = await send(
      input.director.endpoint,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${input.directorKey}`,
          "Content-Type": "application/json",
        },
        signal,
        body: JSON.stringify({
          model: input.director.model,
          messages,
          ...(["api.minimax.cn", "api.minimaxi.com", "api.minimax.io"].includes(providerHost) ? { reasoning_split: true } : {}),
          ...(withTools
            ? { tools: canSee ? tools : tools.filter(t => t.function.name !== "inspect_result"), tool_choice: "auto", parallel_tool_calls: false }
            : { response_format: { type: "json_object" } }),
        }),
      },
      2 * 1024 * 1024,
    );
    checkAbort();
    if (reply.status < 200 || reply.status >= 300)
      throw new PublicError(
        reply.status === 401 || reply.status === 403
          ? "理解模型密钥无效或没有权限，请在模型接入中检查。"
          : reply.status === 429
            ? "理解模型请求过多，请稍后重试。"
            : `理解模型调用失败，请检查模型 ID、${canSee ? "图像输入、" : ""}工具调用能力及接口参数。`,
        502,
      );
    let json;
    try {
      json = JSON.parse(Buffer.from(reply.body).toString("utf8"));
    } catch {
      throw new PublicError("理解模型未返回有效 JSON，请检查接口协议。", 502);
    }
    const parsed = messageSchema.safeParse(json?.choices?.[0]?.message);
    if (!parsed.success)
      throw new PublicError(
        "理解模型响应格式不兼容，请使用 Chat Completions 协议。",
        502,
      );
    return parsed.data;
  };
  emit({
    type: "status",
    stage: "understand",
    message: canSee ? "正在看照片，理解你的想法" : "正在根据文字要求制定方案（不读取照片）",
  });
  const messages: Message[] = [
    { role: "system", content: `${await loadSkill("creation-workflow")}\n\n${await loadSkill("portrait-director")}\n本轮输入模式：${canSee ? "视觉模式。可以根据实际图像做观察与检查。" : "文字模式。你没有收到任何图片，禁止描述照片观察或作品检查结论。不调用 inspect_result。方案保留原图姿势、衣服与背景的表述必须是编辑约束而非观察事实。首次绘图后直接 finish，不自动修正。"}` },
    {
      role: "user",
      content: [
        {
          type: "text",
          text: JSON.stringify({
            request: input.request,
            任务类型: input.task === "edit" ? "输入图片是用户选中的狗头作品；基于这张作品修改，保留未要求改变的细节。" : "输入是原始人像，转换为狗头人。",
            指定犬种: input.preferredBreed || "请根据要求推荐",
            画风: input.style,
            编辑范围:
              input.freedom === "head" ? "只换头" : "允许明确要求的场景变化",
            最多绘图次数: renderLimit,
            犬种表情参考: breeds.filter(b => b.label === input.preferredBreed).map(b => ({ breed: b.label, expression: breedExpressions[b.id] })),
            previousPlan: input.previousPlan,
            最近对话: input.history,
          }),
        },
        ...(canSee ? [{ type: "image_url", image_url: { url: original.dataUrl } }] : []),
      ],
    },
  ];
  // Text-only Chat Completions providers may reject multimodal content arrays,
  // even when the array contains only a text block.
  if (!canSee) messages[1].content = (messages[1].content as { text: string }[])[0].text;
  for (let step = 0; step < 8; step++) {
    checkAbort();
    const response = await chat(messages);
    const tc = response.tool_calls || [];
    if (!tc.length) {
      if (step < 7) {
        messages.push(
          { ...response, role: "assistant", content: response.content || "" },
          {
            role: "user",
            content:
              "请使用提供的工具继续。如果需要澄清调用 ask_user；已有结果则 finish。",
          },
        );
        continue;
      }
      break;
    }
    if (tc.length !== 1)
      throw new PublicError(
        "理解模型没有遵守单工具调用约定，请重试或更换理解模型。",
        502,
      );
    const call = tc[0];
    messages.push({
      ...response,
      role: "assistant",
      content: response.content ?? null,
      tool_calls: tc,
    });
    const name = call.function.name;
    let args: unknown;
    try {
      args = JSON.parse(call.function.arguments);
    } catch {
      args = null;
    }
    const schema = toolSchemas[name as keyof typeof toolSchemas];
    const parsed = schema?.safeParse(args);
    let output: unknown;
    if (!parsed?.success) {
      output = { error: "工具名或参数不合法，请按 schema 修正。" };
    } else if (name === "lookup_breeds") {
      const q = querySchema.parse(args).query.toLowerCase();
      emit({
        type: "status",
        stage: "breeds",
        message: "正在寻找合适的犬种特征",
      });
      output = breeds
        .filter(
          (b) =>
            !q ||
            `${b.label} ${b.english} ${b.aliases} ${b.appearance}`
              .toLowerCase()
              .includes(q),
        )
        .map(({ id, label, english, appearance }) => ({
          id,
          label,
          english,
          appearance,
          expressionSuggestion: breedExpressions[id],
        }));
    } else if (name === "propose_design") {
      const candidate = designSchema.parse(args);
      if (input.preferredBreed && candidate.breed !== input.preferredBreed)
        output = { error: `必须保留用户指定犬种：${input.preferredBreed}。` };
      else {
        plan = candidate;
        emit({ type: "plan", plan });
        output = { accepted: true };
      }
    } else if (name === "generate_image") {
      const repair = repairSchema.parse(args).repair;
      if (!plan) output = { error: "请先 propose_design。" };
      else if (renders >= renderLimit)
        output = { error: "达到绘图上限，请 finish，不再生成。" };
      else if (
        renders > 0 &&
        (!inspected || review?.verdict !== "revise" || !repair)
      )
        output = {
          error: "只有检查明确建议修复且写明具体 repair 才可再次生成。",
        };
      else {
        renders++;
        const prompt = compileDesign(plan, input, repair);
        if (prompt.length > 2400)
          throw new PublicError("造型方案过长，请简化要求后再试。");
        emit({
          type: "status",
          stage: "generate",
          message:
            renders === 1
              ? "方案就绪，正在绘制你的犬系分身"
              : "正在按检查发现的问题修正",
        });
        latest = await render(
          {
            profile: input.renderer,
            apiKey: input.rendererKey,
            image: input.image,
            prompt,
          },
          signal,
        );
        checkAbort();
        review = undefined;
        inspected = false;
        emit({ type: "result", result: latest, prompt, iteration: renders });
        output = {
          generated: true,
          iteration: renders,
          width: latest.width,
          height: latest.height,
          next: canSee ? "请 inspect_result，不能仅凭成功响应宣称效果合格。" : "请 finish。文字模式未检查作品，不得宣称效果合格。",
        };
      }
    } else if (name === "inspect_result") {
      if (!canSee) output = { error: "文字模式不支持图像检查，请 finish，不得重新绘图。" };
      else if (!latest || !plan) output = { error: "还没有生成图。" };
      else if (inspected)
        output = {
          review: review || null,
          note: "已检查当前版本，不重复调用。",
        };
      else {
        emit({
          type: "status",
          stage: "review",
          message: "正在对照原图，检查犬头、衣服与背景",
        });
        inspected = true;
        try {
          const reviewReply = await chat(
            [
              { role: "system", content: await loadSkill("portrait-review") },
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: JSON.stringify({
                      plan,
                      style: input.style,
                      freedom: input.freedom,
                      schema: z.toJSONSchema(reviewSchema),
                    }),
                  },
                  { type: "image_url", image_url: { url: original.dataUrl } },
                  { type: "image_url", image_url: { url: latest.image } },
                ],
              },
            ],
            false,
          );
          const raw = (reviewReply.content || "").replace(
            /^```(?:json)?\s*|\s*```$/g,
            "",
          );
          review = reviewSchema.parse(JSON.parse(raw));
          emit({ type: "review", review, iteration: renders });
          output = review;
        } catch (error) {
          checkAbort();
          review = undefined;
          output = {
            error:
              "检查服务未能给出有效判断；保留作品并结束，不因检查故障重新绘图。",
          };
          emit({
            type: "message",
            message: "作品已生成，但本次未能完成检查。你仍可以查看和下载作品。",
          });
        }
      }
    } else if (name === "ask_user") {
      const question = questionSchema.parse(args);
      const normalizeQuestion = (value: string) => value.replace(/[\s，。？！,.?!]/g, "");
      if (input.history.some(turn => turn.question && normalizeQuestion(turn.question) === normalizeQuestion(question.message))) {
        output = { error: "这个问题已经问过。请结合最近对话和本次回答继续；不得重复同一提问或请求方案批准。仍存在不同的关键冲突时，一次说明具体缺失信息。" };
      } else {
      emit({
        type: "message",
        message: question.message,
        question: true,
        ...(question.choices ? { choices: [...new Set(question.choices)] } : {}),
      });
      emit({ type: "done", reason: "question", calls, renders });
      return;
      }
    } else if (name === "finish") {
      if (!latest)
        output = {
          error:
            "没有生成图。若无法完成，请使用 ask_user 说明需要用户补充什么。",
        };
      else if (canSee && !inspected)
        output = { error: "请先 inspect_result，不能跳过检查宣称完成。" };
      else {
        emit({ type: "message", message: canSee ? noteSchema.parse(args).message : "已按文字方案生成作品。理解模型没有读取照片或检查结果，请自行查看效果；本轮不会自动修正。" });
        emit({ type: "done", reason: "finished", calls, renders });
        return;
      }
    }
    messages.push({
      role: "tool",
      tool_call_id: call.id,
      content: JSON.stringify(output),
    });
  }
  emit({
    type: "message",
    message: latest
      ? "本轮已达到步骤上限，已有作品已保留。可以查看结果后继续修改。"
      : "本轮达到步骤上限，尚未生成作品。请简化要求或检查理解模型。",
  });
  emit({ type: "done", reason: "limit", calls, renders });
}
