"use client";

import { ArrowRight, FileCog, LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useCaseLaunch } from "../use-case-launch";

export function StartCaseButton({
  label = "开始免费案件",
  variant = "light",
}: {
  label?: string;
  variant?: "light" | "dark" | "ghost" | "danger";
}) {
  const launch = useCaseLaunch();

  return (
    <div className="cta-stack">
      <Button
        variant={variant}
        onClick={() => void launch.startGenerated()}
        disabled={launch.busy}
      >
        {launch.busy ? `${launch.phaseText}…` : label}
        {launch.busy ? <LoaderCircle className="button-spinner" aria-hidden="true" size={17} /> : <ArrowRight aria-hidden="true" size={17} />}
      </Button>
      {launch.busy ? (
        <div className="generation-status" role="status">
          <FileCog aria-hidden="true" size={15} />
          <span>AI 正在创建本局专属案件，通常需要 30–90 秒。请保持页面开启。</span>
        </div>
      ) : null}
      {launch.error ? (
        <div className="generation-fallback" role="alert">
          <p className="field-error">{launch.error}</p>
          <button type="button" onClick={() => void launch.startFallback()}>改用精修固定案继续体验</button>
        </div>
      ) : null}
    </div>
  );
}
