export function safeNextPath(value: string | null, fallback: string): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return fallback;
  if (value === '/access' || value.startsWith('/access?') || value === '/login' || value.startsWith('/login?') || value === '/register' || value.startsWith('/register?')) return fallback;
  return value;
}

export function withNext(path: string, next: string): string {
  return `${path}?next=${encodeURIComponent(next)}`;
}
