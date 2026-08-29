"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import {
  API_AUTH_REQUIRED_EVENT,
  type AuthRequiredEvent,
} from "@/features/game/api";
import { clearSessionId } from "@/features/game/session";
import { safeNextPath } from "./constants";

export function AuthExpiryListener() {
  const router = useRouter();

  useEffect(() => {
    const handleAuthRequired = (event: Event) => {
      const nextPath = safeNextPath((event as AuthRequiredEvent).detail?.nextPath);
      clearSessionId();
      router.replace(`/access?next=${encodeURIComponent(nextPath)}`);
    };
    window.addEventListener(API_AUTH_REQUIRED_EVENT, handleAuthRequired);
    return () => window.removeEventListener(API_AUTH_REQUIRED_EVENT, handleAuthRequired);
  }, [router]);

  return null;
}
