import { z } from "zod";
export const directorSchema = z.object({
  inputMode: z.enum(["vision", "text"]).default("vision"),
  name: z.string().trim().min(1).max(48),
  model: z
    .string()
    .trim()
    .min(1)
    .max(160)
    .regex(/^[a-zA-Z0-9_.:/-]+$/),
  endpoint: z
    .string()
    .url()
    .max(600)
    .refine((s) => {
      const u = new URL(s);
      return (
        u.protocol === "https:" &&
        !u.username &&
        !u.password &&
        !u.search &&
        !u.hash
      );
    }),
});
export type DirectorConfig = z.infer<typeof directorSchema>;
export const designSchema = z.object({
  breed: z.string().min(1).max(60),
  appearance: z.string().min(1).max(250),
  expression: z.string().min(1).max(160),
  headPose: z.string().min(1).max(160),
  accessories: z.string().min(1).max(240),
  preserve: z.array(z.string().min(1).max(120)).min(1).max(8),
  changes: z.array(z.string().min(1).max(120)).max(6),
  summary: z.string().min(1).max(400),
});
export type DesignPlan = z.infer<typeof designSchema>;
export const reviewSchema = z.object({
  verdict: z.enum(["pass", "revise", "uncertain"]),
  observations: z
    .array(
      z.object({
        area: z.string().max(60),
        finding: z.string().min(1).max(300),
        status: z.enum(["ok", "issue", "uncertain"]),
      }),
    )
    .min(1)
    .max(6),
  repair: z.string().max(600),
});
export type ImageReview = z.infer<typeof reviewSchema>;
export const agentHistorySchema = z.array(z.object({
  request: z.string().trim().min(1).max(1600),
  question: z.string().max(900).optional(),
})).max(6);
export type AgentHistory = z.infer<typeof agentHistorySchema>;
export type AgentEvent =
  | { type: "skill"; name: string; version: string; sha256: string }
  | { type: "status"; stage: string; message: string }
  | { type: "plan"; plan: DesignPlan }
  | {
      type: "result";
      result: import("../server/adapters").GenerationResult;
      prompt: string;
      iteration: number;
    }
  | { type: "review"; review: ImageReview; iteration: number }
  | { type: "message"; message: string; question?: boolean; choices?: string[] }
  | { type: "error"; message: string }
  | {
      type: "done";
      reason: "finished" | "question" | "limit";
      calls: number;
      renders: number;
    };
export const directorPresets: DirectorConfig[] = [
  {
    name: "OpenAI",
    inputMode: "vision",
    model: "gpt-4.1",
    endpoint: "https://api.openai.com/v1/chat/completions",
  },
  {
    name: "千问视觉",
    inputMode: "vision",
    model: "qwen3-vl-plus",
    endpoint:
      "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
  },
  {
    name: "Gemini 兼容接口",
    inputMode: "vision",
    model: "gemini-2.5-flash",
    endpoint:
      "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
  },
  { name: "DeepSeek", model: "deepseek-v4-flash-vision-exp", inputMode: "vision", endpoint: "https://api.deepseek.com/chat/completions" },
  { name: "智谱", model: "glm-4.6v-flash", inputMode: "vision", endpoint: "https://open.bigmodel.cn/api/paas/v4/chat/completions" },
  { name: "MiniMax", model: "MiniMax-M3", inputMode: "vision", endpoint: "https://api.minimax.cn/v1/chat/completions" },
  { name: "Kimi", model: "kimi-k3", inputMode: "vision", endpoint: "https://api.moonshot.cn/v1/chat/completions" },
];

export const directorCatalog = [
  { label: "OpenAI", docs: "https://platform.openai.com/docs/models/gpt-4.1", note: "GPT-4.1：图像理解与工具调用。", models: [{ id: "gpt-4.1", mode: "vision" }] },
  { label: "通义千问", docs: "https://help.aliyun.com/zh/model-studio/qwen-vl-compatible-with-openai", note: "Qwen3-VL：视觉理解，使用百炼兼容接口。", models: [{ id: "qwen3-vl-plus", mode: "vision" }] },
  { label: "Gemini", docs: "https://ai.google.dev/gemini-api/docs/openai", note: "Gemini 2.5 Flash：视觉理解，使用 OpenAI 兼容入口。", models: [{ id: "gemini-2.5-flash", mode: "vision" }] },
  { label: "DeepSeek", docs: "https://api-docs.deepseek.com/guides/vision/", note: "视觉实验版可看图；V4 Flash / Pro 仅用于文字策划。实验版可用性以账户权限为准。", models: [{ id: "deepseek-v4-flash-vision-exp", mode: "vision" }, { id: "deepseek-v4-flash", mode: "text" }, { id: "deepseek-v4-pro", mode: "text" }] },
  { label: "智谱", docs: "https://docs.bigmodel.cn/cn/guide/models/free/glm-4.6v-flash", note: "GLM-4.6V-Flash：图像理解与原生工具调用。", models: [{ id: "glm-4.6v-flash", mode: "vision" }] },
  { label: "MiniMax", docs: "https://platform.minimax.cn/docs/api-reference/text-openai-api", note: "M3 支持视觉输入；M2.7 / M2.5 用于文字策划。勿将 Coding Plan 专用地址混作通用接口。", models: [{ id: "MiniMax-M3", mode: "vision" }, { id: "MiniMax-M2.7", mode: "text" }, { id: "MiniMax-M2.5", mode: "text" }] },
  { label: "Kimi", docs: "https://platform.kimi.com/docs/get-api-key", note: "Kimi K3 / K2.6：视觉理解与工具调用，使用 Moonshot 通用接口。", models: [{ id: "kimi-k3", mode: "vision" }, { id: "kimi-k2.6", mode: "vision" }] },
] as const;

// Known models retain their documented ceiling even if a client changes the mode.
export function directorCanSee(config: DirectorConfig) {
  const known = directorCatalog.flatMap((p) => [...p.models]).find((m) => m.id === config.model);
  return config.inputMode !== "text" && known?.mode !== "text";
}
