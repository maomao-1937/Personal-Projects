"use client";

import { ArrowRight, FileCog, LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useCaseLaunch } from "../use-case-launch";

export function StartCaseButton({
  label = "进入精修案件",
  variant = "light",
  mode = "fallback",
}: {
  label?: string;
  variant?: "light" | "dark" | "ghost" | "danger";
  mode?: "fallback" | "generated";
}) {
  const launch = useCaseLaunch();

  return (
    <div className="cta-stack">
      <Button
        variant={variant}
        onClick={() => void (mode === "fallback" ? launch.startFallback() : launch.startGenerated())}
        disabled={launch.busy}
      >
        {launch.busy ? `${launch.phaseText}…` : label}
        {launch.busy ? <LoaderCircle className="button-spinner" aria-hidden="true" size={17} /> : <ArrowRight aria-hidden="true" size={17} />}
      </Button>
      {launch.busy ? (
        <div className="generation-status" role="status">
          <FileCog aria-hidden="true" size={15} />
          <span>{mode === "fallback" ? "正在打开精修案卷…" : "DeepSeek 正在生成案件，通常需要 30–90 秒。请保持页面开启。"}</span>
        </div>
      ) : null}
      {launch.error ? (
        <div className="generation-fallback" role="alert">
          <p className="field-error">{launch.error}</p>
          {mode === "generated" ? <button type="button" onClick={() => void launch.startFallback()}>改用精修案件继续体验</button> : null}
        </div>
      ) : null}
    </div>
  );
}
