"use client";

import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

export function StartCaseButton({
  label = "开始免费案件",
  variant = "light",
}: {
  label?: string;
  variant?: "light" | "dark" | "ghost" | "danger";
}) {
  const router = useRouter();

  return (
    <div className="cta-stack">
      <Button
        variant={variant}
        onClick={() => router.push("/")}
      >
        {label}
        <ArrowRight aria-hidden="true" size={17} />
      </Button>
    </div>
  );
}
