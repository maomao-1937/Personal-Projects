import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { runAgent, agentRequestSchema, compileDesign } from "../server/agent";
import { breeds, breedExpressions, compilePrompt } from "../shared/breeds";
import {
  directorSchema,
  directorPresets,
  directorCanSee,
  type AgentEvent,
  type DesignPlan,
} from "../shared/agent";
import { validateTarget, type Transport } from "../server/network";
import { createApp } from "../server/app";
const png = await sharp({
  create: { width: 16, height: 16, channels: 3, background: "#e6e8ea" },
})
  .png()
  .toBuffer();
const image = `data:image/png;base64,${png.toString("base64")}`;
const input = agentRequestSchema.parse({
  director: {
    name: "test",
    model: "test-vision",
    endpoint: "https://api.openai.com/v1/chat/completions",
  },
  directorKey: "test-understanding-key",
  renderer: {
    provider: "openai",
    model: "test-image",
    endpoint: "https://api.openai.com/v1/images/edits",
  },
  rendererKey: "test-renderer-key",
  image,
  request: "保留服装，眼神拽一点",
  preferredBreed: "柴犬",
});
const plan: DesignPlan = {
  breed: "柴犬",
  appearance: "赤白短毛、三角立耳",
  expression: "略带得意",
  headPose: "保留原图朝向",
  accessories: "保留已有眼镜，不添加",
  preserve: ["衣服", "身体", "背景"],
  changes: ["头部犬化"],
  summary: "保留服装和背景，以自然光的柴犬头呈现得意的神态。",
};
const review = {
  verdict: "pass",
  observations: [{ area: "服装", finding: "与原图一致", status: "ok" }],
  repair: "",
};
const result = {
  image,
  mimeType: "image/png" as const,
  width: 16,
  height: 16,
  durationMs: 10,
  inputHash: "test-hash",
  parameters: { n: 1 },
};
const tc = (name: string, args: unknown = {}) => ({
  content: null,
  tool_calls: [
    {
      id: crypto.randomUUID(),
      type: "function",
      function: { name, arguments: JSON.stringify(args) },
    },
  ],
});
function script(steps: unknown[], seen: unknown[] = []): Transport {
  return async (_url, init) => {
    seen.push(JSON.parse(init.body as string));
    assert.ok(steps.length, "unexpected understanding call");
    return {
      status: 200,
      contentType: "application/json",
      body: Buffer.from(
        JSON.stringify({ choices: [{ message: steps.shift() }] }),
      ),
    };
  };
}
async function execute(steps: unknown[], options: Partial<typeof input> = {}) {
  const events: AgentEvent[] = [];
  const renders: unknown[] = [];
  const seen: unknown[] = [];
  await runAgent(
    { ...input, ...options },
    new AbortController().signal,
    (e) => events.push(e),
    {
      send: script(steps, seen),
      render: async (r) => {
        renders.push(r);
        return result;
      },
    },
  );
  return { events, renders, seen };
}
test("24 distinct breed descriptions, custom breed and explicit head detail overrides", () => {
  assert.equal(breeds.length, 24);
  assert.equal(new Set(breeds.map((b) => b.appearance)).size, 24);
  assert.match(compilePrompt("husky", "去掉眼镜"), /黑白面罩/);
  assert.match(compilePrompt("husky", "去掉眼镜"), /替换对应默认约束/);
  assert.match(
    compilePrompt("custom", "", {
      customBreed: "中华田园犬",
      style: "toon",
      freedom: "scene",
    }),
    /中华田园犬/,
  );
  assert.match(
    compileDesign(plan, input),
    /身体、人类手部、姿势、服装、背景与构图必须保持原样/,
  );
});
test("all breeds carry distinct mouth suggestions into the actual editing prompt", () => {
  assert.equal(new Set(Object.values(breedExpressions)).size, 24);
  for (const breed of breeds) assert.ok(compilePrompt(breed.id, "").includes(breedExpressions[breed.id]));
  const override = compilePrompt("husky", "闭嘴，不露舌头");
  assert.match(override, /用户本次明确要求最高/);
  assert.match(override, /【本次要求】闭嘴，不露舌头/);
});
test("official director presets pass the network boundary; unknown domains still require allowlisting", () => {
  assert.equal(directorPresets.length, 7);
  for (const preset of directorPresets) {
    assert.ok(directorSchema.safeParse(preset).success);
    assert.doesNotThrow(() => validateTarget(preset.endpoint));
  }
  assert.throws(() => validateTarget("https://not-allowed.example/v1/chat/completions"));
  assert.throws(() => validateTarget("https://api.deepseek.com.attacker.example/chat/completions"));
  assert.equal(directorSchema.parse({ name: "legacy", model: "gpt-4.1", endpoint: directorPresets[0].endpoint }).inputMode, "vision");
  assert.equal(directorCanSee({ ...directorPresets[5], model: "MiniMax-M2.7", inputMode: "vision" }), false);
});
test("text-only director never receives images or inspection tools and cannot draw twice", async () => {
  const r = await execute([
    tc("propose_design", plan), tc("generate_image"), tc("inspect_result"),
    tc("generate_image", { repair: "pretend defect" }), tc("finish", { message: "虚构检查通过" }),
  ], { director: { ...directorPresets[5], model: "MiniMax-M2.7", inputMode: "vision" }, maxRenders: 2 });
  assert.equal(r.renders.length, 1);
  assert.equal((r.renders[0] as { image: string }).image, image);
  assert.ok(!JSON.stringify(r.seen).includes("image_url"));
  assert.ok(!JSON.stringify(r.seen).includes("data:image"));
  assert.equal(typeof (r.seen[0] as { messages: { content: unknown }[] }).messages[1].content, "string");
  for (const request of r.seen as { tools: { function: { name: string } }[] }[]) {
    assert.ok(!request.tools.some(t => t.function.name === "inspect_result"));
  }
  assert.ok(!r.events.some(e => e.type === "review"));
  assert.ok(!JSON.stringify(r.events).includes("虚构检查通过"));
  assert.match(JSON.stringify(r.events), /没有读取照片或检查结果/);
  assert.deepEqual(r.events.at(-1), { type: "done", reason: "finished", calls: 5, renders: 1 });
});
test("thinking and signed tool metadata are round-tripped internally but never emitted", async () => {
  const first = tc("propose_design", plan);
  const extra = { google: { thought_signature: "test-signature" } };
  const r = await execute([
    { ...first, reasoning_content: "private-reasoning", reasoning_details: [{ type: "reasoning.text", text: "private-detail" }], tool_calls: first.tool_calls.map(t => ({ ...t, extra_content: extra })) },
    tc("generate_image"), tc("finish", { message: "done" }),
  ], { director: { ...directorPresets[5], model: "MiniMax-M2.7", inputMode: "text" } });
  const second = r.seen[1] as { reasoning_split: boolean; messages: Record<string, unknown>[] };
  assert.equal(second.reasoning_split, true);
  const prior = second.messages.find(m => m.role === "assistant")!;
  assert.equal(prior.reasoning_content, "private-reasoning");
  assert.deepEqual(prior.reasoning_details, [{ type: "reasoning.text", text: "private-detail" }]);
  assert.ok(JSON.stringify(prior.tool_calls).includes("test-signature"));
  assert.ok(!JSON.stringify(r.events).includes("private-reasoning"));
  assert.ok(!JSON.stringify(r.events).includes("private-detail"));
});
test("Agent performs real tool dispatch, image rendering, two-image inspection and finish", async () => {
  const { events, renders, seen } = await execute([
    tc("lookup_breeds", { query: "柴犬" }),
    tc("propose_design", plan),
    tc("generate_image"),
    tc("inspect_result"),
    { content: JSON.stringify(review) },
    tc("finish", { message: "作品已生成并检查。" }),
  ]);
  assert.equal(renders.length, 1);
  assert.equal((renders[0] as { image: string }).image, image);
  const inspection = seen[4] as { messages: { content: unknown[] }[] };
  assert.equal(inspection.messages[1].content.length, 3);
  assert.equal(events.filter((e) => e.type === "result").length, 1);
  assert.equal(events.filter((e) => e.type === "review").length, 1);
  assert.deepEqual(events.at(-1), {
    type: "done",
    reason: "finished",
    calls: 6,
    renders: 1,
  });
  assert.ok(!JSON.stringify(events).includes(input.directorKey));
});
test("Ambiguous intent can ask a question without any drawing call", async () => {
  const r = await execute([
    tc("ask_user", { message: "眼镜要保留，还是去掉？" }),
  ]);
  assert.equal(r.renders.length, 0);
  assert.equal(r.events.at(-1)?.type, "done");
  assert.ok(r.events.some((e) => e.type === "message" && e.question));
});
test("clarification returns actionable choices without drawing", async () => {
  const choices = ["保留眼镜", "去掉眼镜"];
  const r = await execute([tc("ask_user", { message: "眼镜怎么处理？", choices })]);
  assert.equal(r.renders.length, 0);
  const question = r.events.find(e => e.type === "message" && e.question);
  assert.deepEqual(question, { type: "message", message: "眼镜怎么处理？", question: true, choices });
});
test("an answer includes the original request and question, and repeated questions are rejected", async () => {
  const history = [{ request: "变成柴犬，戴眼镜", question: "眼镜怎么处理？" }];
  const r = await execute([
    tc("ask_user", { message: "眼镜怎么处理？" }),
    tc("propose_design", plan), tc("generate_image"), tc("finish", { message: "完成" }),
  ], { history, request: "保留眼镜", director: { ...input.director, inputMode: "text" } });
  const sent = (r.seen[0] as { messages: { content: string }[] }).messages[1].content;
  const context = JSON.parse(sent);
  assert.equal(context.request, "保留眼镜");
  assert.deepEqual(context.最近对话, history);
  assert.ok(!r.events.some(e => e.type === "message" && e.question));
  assert.equal(r.renders.length, 1);
  assert.match(JSON.stringify(r.seen[1]), /这个问题已经问过/);
});
test("conversation input is bounded and strips unsupported fields", () => {
  const safe = agentRequestSchema.parse({ ...input, history: [{ request: "柴犬", question: "眼镜？", apiKey: "never-persist" }] });
  assert.deepEqual(safe.history, [{ request: "柴犬", question: "眼镜？" }]);
  assert.equal(agentRequestSchema.safeParse({ ...input, history: Array(7).fill({ request: "x" }) }).success, false);
  assert.equal(agentRequestSchema.safeParse({ ...input, history: [{ request: "x".repeat(1601) }] }).success, false);
});
test("A second draw is denied at the default budget even after a revise review", async () => {
  const r = await execute([
    tc("propose_design", plan),
    tc("generate_image"),
    tc("inspect_result"),
    {
      content: JSON.stringify({
        ...review,
        verdict: "revise",
        repair: "恢复原图服装",
      }),
    },
    tc("generate_image", { repair: "恢复原图服装" }),
    tc("finish", { message: "保留当前作品，需要你决定是否继续。" }),
  ]);
  assert.equal(r.renders.length, 1);
});
test("One repair is allowed only following a concrete review, with explicit two-draw budget", async () => {
  const r = await execute(
    [
      tc("propose_design", plan),
      tc("generate_image"),
      tc("inspect_result"),
      {
        content: JSON.stringify({
          ...review,
          verdict: "revise",
          repair: "恢复原图服装",
        }),
      },
      tc("generate_image", { repair: "恢复原图服装" }),
      tc("inspect_result"),
      { content: JSON.stringify(review) },
      tc("finish", { message: "修正完成。" }),
    ],
    { maxRenders: 2 },
  );
  assert.equal(r.renders.length, 2);
  assert.match(
    (r.renders[1] as { prompt: string }).prompt,
    /本轮修正：恢复原图服装/,
  );
});
test("Broken review preserves the image and does not authorize a paid retry", async () => {
  const r = await execute(
    [
      tc("propose_design", plan),
      tc("generate_image"),
      tc("inspect_result"),
      { content: "invalid JSON" },
      tc("generate_image", { repair: "try again" }),
      tc("finish", { message: "检查不可用，作品可下载。" }),
    ],
    { maxRenders: 2 },
  );
  assert.equal(r.renders.length, 1);
  assert.ok(
    r.events.some(
      (e) => e.type === "message" && e.message.includes("未能完成检查"),
    ),
  );
  assert.ok(!r.events.some((e) => e.type === "review"));
});
test("User selected breed cannot silently be replaced by model preference", async () => {
  const r = await execute([
    tc("propose_design", { ...plan, breed: "金毛" }),
    tc("generate_image"),
    tc("ask_user", { message: "请确认犬种。" }),
  ]);
  assert.equal(r.renders.length, 0);
  assert.ok(!r.events.some((e) => e.type === "plan"));
});
test("Finishing before inspection is denied and real inspection is still required", async () => {
  const r = await execute([
    tc("propose_design", plan),
    tc("generate_image"),
    tc("finish", { message: "看起来很好" }),
    tc("inspect_result"),
    { content: JSON.stringify(review) },
    tc("finish", { message: "检查完毕" }),
  ]);
  assert.equal(r.events.filter((e) => e.type === "done").length, 1);
  assert.ok(r.events.some((e) => e.type === "review"));
});
test("Credential fields are stripped from persisted director config; invalid endpoint and budgets rejected", () => {
  assert.ok(
    !JSON.stringify(
      directorSchema.parse({ ...input.director, key: "secret" }),
    ).includes("secret"),
  );
  assert.equal(
    agentRequestSchema.safeParse({ ...input, maxRenders: 3 }).success,
    false,
  );
  assert.equal(
    directorSchema.safeParse({
      ...input.director,
      endpoint: "https://api.openai.com/a?key=secret",
    }).success,
    false,
  );
});
test("Abort stops before any model or drawing call", async () => {
  const abort = new AbortController();
  abort.abort();
  await assert.rejects(
    runAgent(input, abort.signal, () => {}, {
      send: async () => {
        assert.fail("must not call");
      },
      render: async () => {
        assert.fail("must not render");
      },
    }),
    /停止/,
  );
});
test("executed skill identities are exported and text mode does not claim a review skill", async () => {
  const vision = await execute([
    tc("propose_design", plan), tc("generate_image"), tc("inspect_result"),
    { content: JSON.stringify(review) }, tc("finish", { message: "已完成" }),
  ]);
  const identities = vision.events.filter(e => e.type === "skill");
  assert.deepEqual(identities.map(e => e.name), ["creation-workflow", "portrait-director", "portrait-review"]);
  for (const identity of identities) {
    assert.match(identity.sha256, /^[a-f0-9]{64}$/);
    assert.match(identity.version, /^\d+\.\d+\.\d+$/);
    assert.deepEqual(Object.keys(identity).sort(), ["name", "sha256", "type", "version"]);
  }
  assert.ok(JSON.stringify(vision.seen[0]).includes("accepted 后直接调用 generate_image"));
  const text = await execute([
    tc("propose_design", plan), tc("generate_image"), tc("finish", { message: "已生成" }),
  ], { director: { ...input.director, inputMode: "text" } });
  assert.deepEqual(text.events.filter(e => e.type === "skill").map(e => e.name), ["creation-workflow", "portrait-director"]);
});
test("Agent HTTP route streams actual events with no-store and rejects malformed input", async () => {
  const app = createApp(undefined, async (_input, _signal, emit) => {
    emit({ type: "message", message: "请补充想法", question: true });
    emit({ type: "done", reason: "question", calls: 1, renders: 0 });
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", r));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const url = `http://127.0.0.1:${address.port}/api/agent`;
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    assert.equal(r.status, 200);
    assert.match(r.headers.get("content-type") || "", /ndjson/);
    assert.equal(r.headers.get("cache-control"), "no-store");
    assert.equal((await r.text()).trim().split("\n").length, 2);
    assert.equal(
      (
        await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        })
      ).status,
      400,
    );
  } finally {
    server.closeAllConnections();
    await new Promise<void>((r) => server.close(() => r()));
  }
});

test('editing a selected result sends that image as the drawing input and preserves the requested delta', async () => {
  const edited = await sharp({ create: { width: 16, height: 16, channels: 3, background: '#8c6249' } }).png().toBuffer();
  const selected = `data:image/png;base64,${edited.toString('base64')}`;
  const tested = await execute([tc('propose_design', plan), tc('generate_image'), tc('inspect_result'), { content: JSON.stringify(review) }, tc('finish', { message: '已修改' })], { image: selected, task: 'edit', request: '嘴巴闭上，保留眼镜' });
  const drawing = tested.renders[0] as { image: string; prompt: string };
  assert.equal(drawing.image, selected); assert.notEqual(drawing.image, image);
  assert.match(drawing.prompt, /现有狗头人作品/); assert.match(drawing.prompt, /嘴巴闭上，保留眼镜/);
  assert.match(drawing.prompt, /身体、人类手部、姿势、服装、背景与构图必须保持原样/);
});
