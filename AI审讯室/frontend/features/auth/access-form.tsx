"use client";

import { ArrowRight, KeyRound, LoaderCircle } from "lucide-react";
import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { authApi } from "@/features/game/api";

export function AccessForm({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [accessToken, setAccessToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !accessToken.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await authApi.login(accessToken.trim());
      router.replace(nextPath);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "访问令牌核验失败，请重试。");
      setBusy(false);
      window.requestAnimationFrame(() => inputRef.current?.focus());
    }
  }

  return (
    <form className="access-form" onSubmit={submit} noValidate>
      <label htmlFor="access-token">访问令牌</label>
      <div className="access-input">
        <KeyRound aria-hidden="true" size={17} />
        <input
          ref={inputRef}
          id="access-token"
          name="access-token"
          type="password"
          value={accessToken}
          onChange={(event) => setAccessToken(event.target.value)}
          aria-invalid={error ? "true" : "false"}
          aria-describedby={error ? "access-error" : "access-help"}
          autoComplete="off"
          maxLength={512}
          spellCheck={false}
          autoFocus
        />
      </div>
      <p id="access-help" className="access-help">
        令牌仅用于本次准入核验，不会显示在页面或审讯记录中。
      </p>
      {error ? (
        <p id="access-error" className="field-error" role="alert">
          {error}
        </p>
      ) : null}
      <Button type="submit" variant="dark" fullWidth disabled={busy || !accessToken.trim()}>
        {busy ? "正在核验" : "进入审讯室"}
        {busy ? (
          <LoaderCircle className="button-spinner" aria-hidden="true" size={17} />
        ) : (
          <ArrowRight aria-hidden="true" size={17} />
        )}
      </Button>
    </form>
  );
}
