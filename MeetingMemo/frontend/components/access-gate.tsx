"use client";

import { type FormEvent, type ReactNode, useEffect, useState } from "react";

import { ACCESS_REVOKED_EVENT, api, type ApiClient } from "@/lib/api/client";

type AccessState = "checking" | "denied" | "granted" | "unavailable";

interface AccessGateProps {
  children: ReactNode;
  client?: Pick<ApiClient, "getSession" | "redeemInvite">;
}

function AccessCard({
  error,
  pending,
  onSubmit,
}: {
  error: string | null;
  pending: boolean;
  onSubmit: (inviteCode: string) => Promise<void>;
}) {
  const [inviteCode, setInviteCode] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = inviteCode.trim();
    if (normalized.length < 8) return;
    await onSubmit(normalized);
  }

  return (
    <main className="access-page">
      <section className="access-card" aria-labelledby="access-title">
        <div className="brand-mark" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <p className="eyebrow">仅限受邀成员</p>
        <h1 id="access-title">MeetingMemo</h1>
        <p className="access-intro">
          把会议转写整理成清晰的结论、决策和下一步行动。
        </p>
        <form className="access-form" onSubmit={handleSubmit}>
          <label htmlFor="invite-code">邀请码</label>
          <input
            id="invite-code"
            name="invite_code"
            autoComplete="one-time-code"
            placeholder="输入你的邀请码"
            minLength={8}
            maxLength={128}
            required
            value={inviteCode}
            onChange={(event) => setInviteCode(event.target.value)}
            aria-describedby={error ? "access-error" : "access-help"}
          />
          {error ? (
            <p className="form-error" id="access-error" role="alert">
              {error}
            </p>
          ) : null}
          <button type="submit" disabled={pending}>
            {pending ? "正在验证…" : "进入 MeetingMemo"}
          </button>
        </form>
        <p className="access-note" id="access-help">
          一次兑换会在这台设备上保留访问状态。
        </p>
      </section>
    </main>
  );
}

export function AccessGate({ children, client = api }: AccessGateProps) {
  const [state, setState] = useState<AccessState>("checking");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let active = true;
    const revoke = () => {
      if (!active) return;
      setError("访问状态已失效，请重新输入邀请码。");
      setState("denied");
    };
    window.addEventListener(ACCESS_REVOKED_EVENT, revoke);
    client
      .getSession()
      .then(() => {
        if (active) setState("granted");
      })
      .catch((cause: unknown) => {
        if (!active) return;
        const status =
          typeof cause === "object" && cause !== null && "status" in cause
            ? Number(cause.status)
            : 0;
        setState(status === 401 ? "denied" : "unavailable");
      });
    return () => {
      active = false;
      window.removeEventListener(ACCESS_REVOKED_EVENT, revoke);
    };
  }, [client]);

  async function redeem(inviteCode: string) {
    setPending(true);
    setError(null);
    try {
      await client.redeemInvite(inviteCode);
      setState("granted");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "邀请码验证失败，请重试");
    } finally {
      setPending(false);
    }
  }

  if (state === "granted") return children;

  if (state === "checking") {
    return (
      <main className="access-page" aria-busy="true">
        <section className="access-card access-card--checking">
          <div className="brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <h1>MeetingMemo</h1>
          <div className="access-status">
            <span className="status-dot status-dot--processing" aria-hidden="true" />
            正在确认访问权限…
          </div>
        </section>
      </main>
    );
  }

  return (
    <AccessCard
      error={
        error ??
        (state === "unavailable" ? "暂时无法连接服务，你仍可重新验证邀请码。" : null)
      }
      pending={pending}
      onSubmit={redeem}
    />
  );
}
