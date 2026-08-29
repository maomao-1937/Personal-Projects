export const AUTH_COOKIE_NAME = "ai_interrogation_access";

export function safeNextPath(value: string | string[] | undefined): string {
  if (typeof value !== "string") return "/";
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  if (value === "/access" || value.startsWith("/access?")) return "/";
  return value;
}
