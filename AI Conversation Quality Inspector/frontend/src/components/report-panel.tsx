"use client";

import {
  AlertCircle,
  ArrowUpRight,
  Check,
  ChevronDown,
  Copy,
  MessageSquareQuote,
  ScanSearch,
  ShieldAlert,
} from "lucide-react";
import { useState } from "react";

import {
  FeedbackControl,
  type FeedbackPayload,
} from "@/components/feedback-control";
import type { AnalysisResponse } from "@/lib/api";


const dimensions = [
  ["需求理解", "是否识别目的、约束与决策因素"],
  ["情绪与语气", "是否尊重、克制并回应客户情绪"],
  ["信息准确性", "是否一致、可支持且不过度承诺"],
  ["异议处理", "是否回应异议背后的真实原因"],
  ["推进能力", "是否给出符合场景的清晰下一步"],
  ["风险话术", "是否避免承诺、操纵与隐私风险"],
] as const;


type ReportPanelProps = {
  analyzing: boolean;
  error: string | null;
  report: AnalysisResponse | null;
  onFeedback?: (payload: FeedbackPayload) => Promise<void>;
};


const statusCopy = {
  scored: {
    label: "完整评分",
    description: "至少四个维度具备可核查证据，已生成确定性总分。",
  },
  partial: {
    label: "部分结果",
    description: "只有部分维度具备可靠证据，因此不显示总分。",
  },
  unable_to_score: {
    label: "无法可靠评分",
    description: "当前信息不足以支持可靠判断，请补充更完整的双角色对话后重试。",
  },
} as const;


const riskCopy = {
  none: "未发现明确通用风险",
  low: "发现低风险提示",
  medium: "发现需要复核的风险",
  high: "发现高风险话术",
  unknown: "风险信息不足",
} as const;

const confidenceCopy = {
  high: "高",
  medium: "中",
  low: "低",
} as const;


export function ReportPanel({
  analyzing,
  error,
  report,
  onFeedback,
}: ReportPanelProps) {
  if (analyzing) {
    return (
      <section className="result-panel is-analyzing" aria-live="polite" aria-busy="true">
        <div className="analysis-scan" aria-hidden="true" />
        <div className="state-center">
          <ScanSearch aria-hidden="true" size={28} strokeWidth={1.5} />
          <p className="state-kicker">ANALYZING EVIDENCE</p>
          <h2>正在逐轮核对证据</h2>
          <p>识别角色与轮次后，报告会校验六个维度、原文引用和安全建议。</p>
          <ol className="analysis-steps">
            <li className="is-current">解析角色与有效往返</li>
            <li>核对六维判断与原文证据</li>
            <li>计算报告状态与总分</li>
          </ol>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="result-panel" aria-live="assertive">
        <div className="state-center error-state">
          <AlertCircle aria-hidden="true" size={28} strokeWidth={1.5} />
          <p className="state-kicker">ANALYSIS STOPPED</p>
          <h2>这次质检没有完成</h2>
          <p role="alert">{error}</p>
          <span>修改左侧内容后，可重新开始质检；失败不会扣减次数。</span>
        </div>
      </section>
    );
  }

  if (report) {
    return <RenderedReport onFeedback={onFeedback} report={report} />;
  }

  return (
    <section className="result-panel idle-report" aria-labelledby="report-empty-title">
      <div className="result-intro">
        <div>
          <p className="state-kicker">EVIDENCE-LED QA</p>
          <h2 id="report-empty-title">质检结果会出现在这里</h2>
        </div>
        <ArrowUpRight aria-hidden="true" size={22} strokeWidth={1.5} />
      </div>
      <p className="result-intro-copy">
        得分不是起点。系统先判断维度是否可评分，再把结论连回聊天轮次和逐字原句。
      </p>
      <div className="dimension-map">
        {dimensions.map(([name, description], index) => (
          <div className="dimension-map-row" key={name}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <strong>{name}</strong>
            <p>{description}</p>
          </div>
        ))}
      </div>
      <div className="empty-privacy">
        <span aria-hidden="true">●</span>
        页面刷新后不保留对话与报告
      </div>
    </section>
  );
}


function RenderedReport({
  report,
  onFeedback,
}: {
  report: AnalysisResponse;
  onFeedback?: (payload: FeedbackPayload) => Promise<void>;
}) {
  const [copyState, setCopyState] = useState<{
    target: "reply" | "report";
    status: "success" | "error";
  } | null>(null);
  const status = statusCopy[report.analysis_status];
  const coverageSuffix =
    report.analysis_status === "scored" ? "参与总分" : "有可靠证据";

  async function copyText(text: string, target: "reply" | "report") {
    try {
      await navigator.clipboard.writeText(text);
      setCopyState({ target, status: "success" });
    } catch {
      setCopyState({ target, status: "error" });
    }
    window.setTimeout(() => setCopyState(null), 1600);
  }

  function copyLabel(target: "reply" | "report") {
    if (copyState?.target !== target) {
      return target === "report" ? "复制报告" : "复制回复";
    }
    return copyState.status === "success" ? "已复制" : "复制失败，请重试";
  }

  return (
    <section className="result-panel report-scroll" aria-labelledby="report-title">
      <div className="report-topline">
        <div>
          <p className="panel-index">02 · REPORT</p>
          <span className={`report-status status-${report.analysis_status}`}>
            {status.label}
          </span>
        </div>
        <button
          className="report-copy-button"
          onClick={() => void copyText(formatReport(report), "report")}
          type="button"
        >
          {copyState?.target === "report" && copyState.status === "success" ? (
            <Check aria-hidden="true" size={14} />
          ) : (
            <Copy aria-hidden="true" size={14} />
          )}
          {copyLabel("report")}
        </button>
      </div>

      <div className="report-overview">
        <div className="report-overview-copy">
          <h2 id="report-title">{status.label}</h2>
          <p>{status.description}</p>
          <div className="coverage-row">
            <span>
              {report.scored_dimension_count} / 6 个维度{coverageSuffix}
            </span>
            <div className="coverage-ticks" aria-hidden="true">
              {Array.from({ length: 6 }, (_, index) => (
                <i
                  className={index < report.scored_dimension_count ? "is-active" : ""}
                  key={index}
                />
              ))}
            </div>
          </div>
          <p className="overall-confidence">
            总体置信度：{confidenceCopy[report.confidence]}
          </p>
        </div>
        {report.analysis_status === "scored" && report.total_score !== null && (
          <div className="score-block" data-testid="total-score">
            <strong>{report.total_score}</strong>
            <span>/ 100</span>
            <small>总分</small>
          </div>
        )}
      </div>

      <div className={`risk-banner risk-${report.risk_level}`}>
        <ShieldAlert aria-hidden="true" size={18} strokeWidth={1.7} />
        <div>
          <strong>{riskCopy[report.risk_level]}</strong>
          <p>
            {report.risk_flags.length
              ? report.risk_flags.join(" · ")
              : "风险结论与平均分独立，请结合原对话复核。"}
          </p>
        </div>
        <span>{report.risk_level.toUpperCase()}</span>
      </div>

      {report.major_issues.length > 0 && (
        <section className="report-section" aria-labelledby="issues-title">
          <div className="section-heading">
            <div>
              <span>PRIORITY</span>
              <h3 id="issues-title">主要问题</h3>
            </div>
            <small>按影响程度排序</small>
          </div>
          <div className="issue-list">
            {report.major_issues.map((issue, index) => (
              <article className="issue-row" key={`${issue.title}-${index}`}>
                <span className={`severity-mark severity-${issue.severity}`}>
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <small>{issue.dimension}</small>
                  <h4>{issue.title}</h4>
                  <p>{issue.reason}</p>
                  <div className="turn-chips" aria-label="问题证据轮次">
                    {issue.evidence_turn_ids.map((turnId) => (
                      <span key={turnId}>{turnId}</span>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {report.suggested_reply && (
        <section className="suggested-reply" aria-labelledby="reply-title">
          <div className="reply-label">
            <MessageSquareQuote aria-hidden="true" size={17} />
            <h3 id="reply-title">建议回复</h3>
          </div>
          <blockquote>{report.suggested_reply}</blockquote>
          <button
            className="reply-copy-button"
            onClick={() => void copyText(report.suggested_reply ?? "", "reply")}
            type="button"
          >
            {copyState?.target === "reply" && copyState.status === "success" ? (
              <Check aria-hidden="true" size={13} />
            ) : (
              <Copy aria-hidden="true" size={13} />
            )}
            {copyLabel("reply")}
          </button>
        </section>
      )}

      <section className="report-section" aria-labelledby="dimensions-title">
        <div className="section-heading">
          <div>
            <span>EVIDENCE TRACK</span>
            <h3 id="dimensions-title">六维详情</h3>
          </div>
          <small>展开查看证据</small>
        </div>
        <div className="dimension-details">
          {report.dimensions.map((dimension, index) => (
            <details key={dimension.name} open={index === 0}>
              <summary>
                <span className="dimension-number">{String(index + 1).padStart(2, "0")}</span>
                <strong>{dimension.name}</strong>
                <span className="dimension-summary">{dimension.summary}</span>
                <span className="dimension-score">
                  {dimension.status === "scored" ? dimension.score : "—"}
                </span>
                <ChevronDown aria-hidden="true" size={15} />
              </summary>
              <div className="dimension-body">
                <div className="dimension-meta">
                  <span>{dimension.status.replaceAll("_", " ")}</span>
                  <span>置信度 {dimension.confidence}</span>
                </div>
                {dimension.evidence.map((evidence, evidenceIndex) => (
                  <div className="evidence-track" key={`${dimension.name}-${evidenceIndex}`}>
                    <div className="track-line" aria-hidden="true" />
                    {evidence.turn_ids.map((turnId, turnIndex) => (
                      <div className="evidence-turn" key={`${turnId}-${turnIndex}`}>
                        <span className="evidence-node">{turnId}</span>
                        <blockquote>“{evidence.quotes[turnIndex]}”</blockquote>
                      </div>
                    ))}
                    <p>{evidence.rationale}</p>
                  </div>
                ))}
                {dimension.improvement && (
                  <p className="dimension-improvement">
                    <strong>改进动作</strong>
                    {dimension.improvement}
                  </p>
                )}
              </div>
            </details>
          ))}
        </div>
      </section>

      {report.limitations.length > 0 && (
        <section className="limitations" aria-labelledby="limitations-title">
          <h3 id="limitations-title">本次分析限制</h3>
          <ul>
            {report.limitations.map((limitation) => (
              <li key={limitation}>{limitation}</li>
            ))}
          </ul>
        </section>
      )}

      {onFeedback && <FeedbackControl onFeedback={onFeedback} />}

      <footer className="report-meta">
        <span>{report.rubric_version}</span>
        <span>{report.model_version}</span>
        <span>ID {report.analysis_id.slice(0, 8)}</span>
      </footer>
    </section>
  );
}


export function formatReport(report: AnalysisResponse) {
  const status = statusCopy[report.analysis_status].label;
  const score = report.total_score === null ? "不显示总分" : `${report.total_score}/100`;
  const issueLines = report.major_issues.flatMap((issue, index) => [
    `${index + 1}. [${issue.severity}] ${issue.dimension}｜${issue.title}`,
    `   原因：${issue.reason}`,
    `   证据轮次：${issue.evidence_turn_ids.join("、")}`,
  ]);
  const dimensionLines = report.dimensions.flatMap((dimension) => {
    const evidenceLines = dimension.evidence.flatMap((evidence) => [
      ...evidence.turn_ids.map(
        (turnId, index) => `   - ${turnId}｜“${evidence.quotes[index]}”`,
      ),
      `   判断依据：${evidence.rationale}`,
    ]);
    return [
      `- ${dimension.name}：${dimension.score ?? "不计分"}｜${dimension.summary}`,
      ...evidenceLines,
      ...(dimension.improvement ? [`   改进动作：${dimension.improvement}`] : []),
    ];
  });
  return [
    `对话质检报告｜${status}`,
    `总分：${score}`,
    `覆盖度：${report.scored_dimension_count}/6`,
    `总体置信度：${confidenceCopy[report.confidence]}`,
    `风险：${riskCopy[report.risk_level]}`,
    ...(report.risk_flags.length ? [`风险明细：${report.risk_flags.join("、")}`] : []),
    "",
    "主要问题",
    ...(issueLines.length ? issueLines : ["无"]),
    "",
    "六维详情与证据",
    "",
    ...dimensionLines,
    "",
    report.suggested_reply ? `建议回复：${report.suggested_reply}` : "",
    ...report.limitations.map((item) => `限制：${item}`),
  ]
    .filter(Boolean)
    .join("\n");
}
