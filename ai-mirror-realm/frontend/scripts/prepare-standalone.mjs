import { cpSync, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const standalone = resolve(root, ".next/standalone");

if (!existsSync(standalone)) {
  throw new Error("未找到 .next/standalone，请先运行 next build。");
}

// Next.js standalone 模式需要手动复制 public 和 .next/static
mkdirSync(resolve(standalone, ".next"), { recursive: true });
cpSync(resolve(root, "public"), resolve(standalone, "public"), { recursive: true });
cpSync(resolve(root, ".next/static"), resolve(standalone, ".next/static"), { recursive: true });
