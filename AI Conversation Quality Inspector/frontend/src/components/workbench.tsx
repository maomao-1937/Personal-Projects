"use client";

import {
  ArrowRight,
  BriefcaseBusiness,
  Eraser,
  Headphones,
  LogOut,
  Sparkles,
} from "lucide-react";
import { FormEvent, useState } from "react";

import { BrandMark } from "@/components/brand-mark";
import type { FeedbackPayload } from "@/components/feedback-control";
import { ReportPanel } from "@/components/report-panel";
import type {
  AccessStatus,
  AnalysisRequest,
  AnalysisResponse,
  PublicConfig,
} from "@/lib/api";


const examples = {
  sales:
    "客户：这个价格有些贵，我还要和其他方案比较一下。\n销售：理解。方便说说您主要担心整体预算，还是暂时不确定这个方案带来的价值？",
  customer_service:
    "客户：退款已经申请三天了，什么时候能到账？\n客服：我现在帮您核实订单和退款进度，确认后告诉您预计到账时间。",
} satisfies Record<AnalysisRequest["qa_type"], string>;


type WorkbenchProps = {
  access: AccessStatus;
  analyzing: boolean;
  config: PublicConfig;
  error: string | null;
  report: AnalysisResponse | null;
  onAnalyze: (request: AnalysisRequest) => Promise<void>;
  onFeedback?: (payload: FeedbackPayload) => Promise<void>;
  onLeave: () => Promise<void>;
};


export function Workbench({
  access,
  analyzing,
  config,
  error,
  report,
  onAnalyze,
  onFeedback,
  onLeave,
}: WorkbenchProps) {
  const [qaType, setQaType] = useState<AnalysisRequest["qa_type"]>("sales");
  const [transcript, setTranscript] = useState("");
  const charCount = transcript.length;
  const canAnalyze =
    !analyzing &&
    access.remaining_uses > 0 &&
    charCount >= config.min_transcript_chars &&
    charCount <= config.max_transcript_chars;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canAnalyze) return;
    await onAnalyze({ qa_type: qaType, transcript });
  }

  return (
    <div className="workbench-page">
      <header className="app-header">
        <BrandMark />
        <div className="header-actions">
          <button className="icon-button" onClick={() => void onLeave()} type="button">
            <LogOut aria-hidden="true" size={16} />
            <span>退出访问</span>
          </button>
        </div>
      </header>

      <main className="workbench-grid" id="main-content">
        <section className="input-panel" aria-labelledby="input-title">
          <div className="panel-heading">
            <div>
              <p className="panel-index">01 · INPUT</p>
              <h1 id="input-title">对话输入</h1>
            </div>
          </div>

          <form className="analysis-form" onSubmit={handleSubmit}>
            <fieldset className="scene-fieldset">
              <legend>选择质检场景</legend>
              <div className="scene-switch">
                <label>
                  <input
                    aria-label="销售质检"
                    checked={qaType === "sales"}
                    name="qa-type"
                    onChange={() => setQaType("sales")}
                    type="radio"
                    value="sales"
                  />
                  <span>
                    <BriefcaseBusiness aria-hidden="true" size={16} />
                    <b>销售质检</b>
                    <small>异议与低压力推进</small>
                  </span>
                </label>
                <label>
                  <input
                    aria-label="客服质检"
                    checked={qaType === "customer_service"}
                    name="qa-type"
                    onChange={() => setQaType("customer_service")}
                    type="radio"
                    value="customer_service"
                  />
                  <span>
                    <Headphones aria-hidden="true" size={16} />
                    <b>客服质检</b>
                    <small>解决路径与服务收尾</small>
                  </span>
                </label>
              </div>
            </fieldset>

            <div className="transcript-field">
              <div className="field-label-row">
                <label htmlFor="transcript">聊天记录</label>
                <span>每行使用“角色：内容”</span>
              </div>
              <textarea
                aria-describedby="transcript-help"
                disabled={analyzing}
                id="transcript"
                maxLength={config.max_transcript_chars}
                onChange={(event) => setTranscript(event.target.value)}
                placeholder={
                  qaType === "sales"
                    ? "客户：这个价格有些贵…\n销售：可以说说您的预算和顾虑吗？"
                    : "客户：退款什么时候到账？\n客服：我现在帮您核实处理进度。"
                }
                spellCheck={false}
                value={transcript}
              />
              <div className="transcript-toolbar" id="transcript-help">
                <div>
                  <button
                    className="text-button"
                    disabled={analyzing}
                    onClick={() => setTranscript(examples[qaType])}
                    type="button"
                  >
                    <Sparkles aria-hidden="true" size={13} />
                    填入示例
                  </button>
                  <button
                    className="text-button"
                    disabled={analyzing || !transcript}
                    onClick={() => setTranscript("")}
                    type="button"
                  >
                    <Eraser aria-hidden="true" size={13} />
                    清空
                  </button>
                </div>
                <span className={charCount > config.max_transcript_chars ? "is-over" : ""}>
                  {charCount.toLocaleString("en-US")} / {config.max_transcript_chars.toLocaleString("en-US")}
                </span>
              </div>
            </div>

            <p className="input-guidance">
              至少 {config.min_transcript_chars} 个字符，包含一名客户和一名销售／客服的有效往返，最多 {config.max_turns} 轮。
            </p>

            <button className="analyze-button" disabled={!canAnalyze} type="submit">
              <span>
                {analyzing
                  ? "正在分析…"
                  : access.remaining_uses === 0
                    ? "额度已用完"
                    : "开始质检"}
              </span>
              {!analyzing && access.remaining_uses > 0 && (
                <ArrowRight aria-hidden="true" size={17} />
              )}
            </button>
          </form>
        </section>

        <ReportPanel
          analyzing={analyzing}
          error={error}
          onFeedback={onFeedback}
          report={report}
        />
      </main>
    </div>
  );
}
