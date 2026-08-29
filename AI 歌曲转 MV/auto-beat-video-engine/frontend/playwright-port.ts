export function resolvePlaywrightPort(value: string | undefined): number {
  if (!value) return 3000;

  const port = Number.parseInt(value, 10);
  return Number.isInteger(port) && port > 0 && port <= 65535 ? port : 3000;
}
