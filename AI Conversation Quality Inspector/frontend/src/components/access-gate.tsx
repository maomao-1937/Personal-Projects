"use client";

import { ArrowRight, KeyRound } from "lucide-react";
import { FormEvent, useState } from "react";

import { BrandMark } from "@/components/brand-mark";


type AccessGateProps = {
  busy: boolean;
  error: string | null;
  onRedeem: (code: string) => Promise<void>;
};


export function AccessGate({ busy, error, onRedeem }: AccessGateProps) {
  const [code, setCode] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedCode = code.trim();
    if (!trimmedCode || busy) return;
    await onRedeem(trimmedCode);
  }

  return (
    <main className="access-page" id="main-content">
      <header className="access-header">
        <BrandMark />
        <span className="pilot-label">PRIVATE PILOT · 受邀内测</span>
      </header>

      <section className="access-layout" aria-labelledby="access-title">
        <div className="access-thesis">
          <p className="eyebrow">AI 客服／销售对话质检</p>
          <h1 id="access-title">
            把判断，<span>钉回原话。</span>
          </h1>

          <div className="evidence-preview" aria-label="证据轨道示例">
            <div className="preview-rail" aria-hidden="true" />
            <div className="preview-row">
              <span className="turn-node">t12</span>
              <div>
                <small>客户 · 价格异议</small>
                <p>“这个价格有些贵，我还需要比较一下。”</p>
              </div>
            </div>
            <div className="preview-row preview-result">
              <span className="turn-node is-result">✓</span>
              <div>
                <small>证据对应的改进动作</small>
                <p>先澄清预算或价值顾虑，再提供可核验的信息。</p>
              </div>
            </div>
          </div>
        </div>

        <div className="access-card-wrap">
          <div className="corner-mark corner-top" aria-hidden="true" />
          <div className="access-card">
            <div className="access-icon" aria-hidden="true">
              <KeyRound size={20} strokeWidth={1.8} />
            </div>
            <p className="card-kicker">PILOT ACCESS</p>
            <h2>用邀请码进入工作台</h2>

            <form onSubmit={handleSubmit} noValidate>
              <label htmlFor="invite-code">邀请码</label>
              <input
                autoComplete="off"
                autoFocus
                disabled={busy}
                id="invite-code"
                maxLength={256}
                onChange={(event) => setCode(event.target.value)}
                placeholder="粘贴邀请码"
                spellCheck={false}
                value={code}
              />
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              <button className="primary-button" disabled={busy || !code.trim()} type="submit">
                <span>{busy ? "正在验证…" : "进入质检工作台"}</span>
                {!busy && <ArrowRight aria-hidden="true" size={17} />}
              </button>
            </form>
          </div>
          <div className="corner-mark corner-bottom" aria-hidden="true" />
        </div>
      </section>
    </main>
  );
}
