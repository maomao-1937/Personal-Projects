import express from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { generate, generationSchema } from "./adapters";
import { PublicError } from "./network";
import { agentRequestSchema, runAgent } from "./agent";

import { connectionStore, installConnections } from "./connections";

import { installPromptWriter, writePrompt } from "./prompt-writer";

export function createApp(run = generate, agentRun = runAgent, promptRun = writePrompt) {
  const app = express();
  app.disable("x-powered-by");
  if (process.env.TRUST_PROXY_HOPS)
    app.set("trust proxy", Number(process.env.TRUST_PROXY_HOPS));
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "blob:"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          connectSrc: ["'self'"],
          upgradeInsecureRequests:
            process.env.NODE_ENV === "production" ? [] : null,
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use("/api", (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  app.get("/api/health", (_req, res) =>
    res.json({ status: "ok", mode: "bring-your-own-key" }),
  );
  app.use(
    "/api/generate",
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 20,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: { error: "本轮请求较多，请稍后再试。" },
    }),
  );
  const store = connectionStore();
  const resolveConnections = installConnections(app, store);
  installPromptWriter(app, store, promptRun);
  let active = 0;
  app.post(
    "/api/agent",
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 8,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: { error: "Agent 调用较多，请稍后再试。" },
    }),
    (req, res, next) => {
      if (req.get("sec-fetch-site") === "cross-site") {
        res.status(403).json({ error: "请从工坊页面发起请求。" });
        return;
      }
      if (active >= 6) {
        res.status(503).json({ error: "工坊当前请求较多，请稍后重试。" });
        return;
      }
      active++;
      res.once("close", () => {
        active--;
      });
      next();
    },
    express.json({ limit: "16mb" }),
    async (req, res) => {
      let body;
      try { body = await resolveConnections(req.body, true); } catch (e) { res.status(e instanceof PublicError ? e.status : 503).json({ error: e instanceof PublicError ? e.message : "无法读取模型连接。" }); return; }
      const parsed = agentRequestSchema.safeParse(body);
      if (!parsed.success) {
        res
          .status(400)
          .json({ error: "请检查照片、创作要求及理解/绘图模型配置。" });
        return;
      }
      try { resolveConnections.reserve(req.body, true); } catch (e) { res.status(e instanceof PublicError ? e.status : 503).json({ error: e instanceof PublicError ? e.message : "站点额度不可用。" }); return; }
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 420_000);
      res.once("close", () => controller.abort());
      res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders();
      const emit = (event: import("../shared/agent").AgentEvent) => {
        if (!res.destroyed) res.write(JSON.stringify(event) + "\n");
      };
      try {
        await agentRun(parsed.data, controller.signal, emit);
      } catch (error) {
        emit({
          type: "error",
          message:
            error instanceof PublicError
              ? error.message
              : controller.signal.aborted
                ? "等待时间过长，已有结果已保留；请检查供应商记录。"
                : "Agent 暂时无法连接服务，请检查模型配置。",
        });
      } finally {
        clearTimeout(timeout);
        res.end();
      }
    },
  );
  app.post(
    "/api/generate",
    (req, res, next) => {
      if (req.get("sec-fetch-site") === "cross-site") {
        res.status(403).json({ error: "请从工坊页面发起请求。" });
        return;
      }
      if (active >= 6) {
        res.status(503).json({ error: "工坊当前请求较多，请稍后重试。" });
        return;
      }
      active++;
      let released = false;
      res.once("close", () => {
        if (!released) {
          active--;
          released = true;
        }
      });
      next();
    },
    express.json({ limit: "15mb" }),
    async (req, res) => {
      let body;
      try { body = await resolveConnections(req.body, false); } catch (e) { res.status(e instanceof PublicError ? e.status : 503).json({ error: e instanceof PublicError ? e.message : "无法读取模型连接。" }); return; }
      const parsed = generationSchema.safeParse(body);
      if (!parsed.success) {
        res
          .status(400)
          .json({ error: "请检查图片格式、提示词、API Key 和模型配置。" });
        return;
      }
      try { resolveConnections.reserve(req.body, false); } catch (e) { res.status(e instanceof PublicError ? e.status : 503).json({ error: e instanceof PublicError ? e.message : "站点额度不可用。" }); return; }
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 180_000);
      res.once("close", () => controller.abort());
      try {
        const result = await run(parsed.data, controller.signal);
        if (!res.destroyed) res.json(result);
      } catch (error) {
        if (res.destroyed) return;
        if (error instanceof PublicError)
          res.status(error.status).json({ error: error.message });
        else
          res
            .status(502)
            .json({
              error: controller.signal.aborted
                ? "等待超过 3 分钟。供应商可能仍在处理，请检查供应商记录后再决定是否重试。"
                : "暂时无法连接模型服务，请检查接口地址与服务端网络后重试。",
            });
      } finally {
        clearTimeout(timeout);
      }
    },
  );
  app.use("/api", (_req, res) =>
    res.status(404).json({ error: "接口不存在。" }),
  );
  app.use(
    (
      err: { type?: string },
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      res
        .status(err.type === "entity.too.large" ? 413 : 400)
        .json({
          error:
            err.type === "entity.too.large"
              ? "上传内容过大，请选择 10 MB 以内的图片。"
              : "请求内容无法读取，请检查后重试。",
        });
    },
  );
  return app;
}
