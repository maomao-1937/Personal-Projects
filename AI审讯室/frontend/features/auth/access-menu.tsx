"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { authApi } from "@/features/game/api";
import { clearSessionId } from "@/features/game/session";

export function AccessMenu() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function logout() {
    if (busy) return;
    setBusy(true);
    try {
      await authApi.logout();
    } finally {
      clearSessionId();
      router.replace("/access");
      router.refresh();
    }
  }

  return (
    <button className="access-menu" type="button" onClick={() => void logout()} disabled={busy}>
      <LogOut aria-hidden="true" size={13} />
      {busy ? "正在退出" : "退出"}
    </button>
  );
}
