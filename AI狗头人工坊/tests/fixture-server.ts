// Dedicated local QA origin. Not imported by the production entry point.
// Exercises the real adapters against labelled fixture responses; makes NO vendor calls.
import express from "express";
import { readFile, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createApp } from "../server/app";
import { generate } from "../server/adapters";
import { runAgent } from "../server/agent";
import { directorCanSee } from "../shared/agent";
process.env.STUDIO_DATA_DIR = await mkdtemp(path.join(tmpdir(), "goutou-browser-qa-"));
const image = await readFile("public/images/example-dog.png");
const render: typeof generate = (input, signal) =>
  generate(input, signal, async () => {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, 1500);
      signal.addEventListener(
        "abort",
        () => {
          clearTimeout(timer);
          reject(new Error("Aborted"));
        },
        { once: true },
      );
    });
    if (input.profile.model === "qa-error")
      return {
        status: 401,
        contentType: "application/json",
        body: Buffer.from("{}"),
      };
    return {
      status: 200,
      contentType: "application/json",
      body: Buffer.from(
        JSON.stringify({ data: [{ b64_json: image.toString("base64") }] }),
      ),
    };
  });
const app = createApp(render, (input, signal, emit) => {
  let step = 0;
  const plan = {
    breed: input.preferredBreed || "柴犬",
    appearance: "赤白短毛、三角立耳",
    expression: "自然微笑",
    headPose: "保留原图朝向",
    accessories: "保留原图配饰",
    preserve: ["身体", "服装", "背景"],
    changes: ["犬头"],
    summary: "本地测试方案：保留原图，验证工具调用和状态。",
  };
  const tool = (name: string, args: unknown = {}) => ({
    content: null,
    tool_calls: [
      {
        id: crypto.randomUUID(),
        type: "function",
        function: { name, arguments: JSON.stringify(args) },
      },
    ],
  });
  const messages = [
    tool("propose_design", plan),
    tool("generate_image"),
    tool("inspect_result"),
    {
      content: JSON.stringify({
        verdict: "uncertain",
        observations: [
          {
            area: "测试说明",
            finding: "这是固定测试图片，仅验证流程，不代表真实模型判断。",
            status: "uncertain",
          },
        ],
        repair: "",
      }),
    },
    tool("finish", { message: "本地测试流程完成，未调用真实供应商。" }),
  ];
  if (!directorCanSee(input.director)) messages.splice(2, 2);
  if (input.request.includes("QA提问") && !input.history.length) {
    messages.splice(0, messages.length, tool("ask_user", {
      message: "本地测试问题：眼镜要保留，还是去掉？",
      choices: ["保留眼镜，直接生成", "去掉眼镜，直接生成"],
    }));
  }
  return runAgent(input, signal, emit, {
    render,
    send: async () => ({
      status: 200,
      contentType: "application/json",
      body: Buffer.from(
        JSON.stringify({ choices: [{ message: messages[step++] }] }),
      ),
    }),
  });
}, async (input, signal) => {
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, 500);
    signal.addEventListener('abort', () => { clearTimeout(timer); reject(new Error('cancelled')); }, { once: true });
  });
  if (input.idea.includes('QA失败')) throw new Error('local failure');
  return { model: input.model, prompt: '【本地流程测试，非 DeepSeek 实测】编辑输入人像，将头部替换为柴犬头，闭嘴微笑，保留原有眼镜。保持人类身体、姿势、穿搭、手部、背景和光照不变。犬头比例自然，颈部衔接真实，不添加四足犬身体。' };
});
app.use(express.static(path.resolve("dist")));
app.get("/{*path}", (_req, res) =>
  res.sendFile(path.resolve("dist/index.html")),
);
app.listen(8788, "127.0.0.1", () =>
  console.log("LOCAL FIXTURE QA ONLY: http://127.0.0.1:8788 — no vendor calls"),
);
