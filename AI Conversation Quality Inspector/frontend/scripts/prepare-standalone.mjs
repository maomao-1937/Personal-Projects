import { cpSync, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";


const root = resolve(import.meta.dirname, "..");
const standaloneRoot = resolve(root, ".next/standalone");

mkdirSync(resolve(standaloneRoot, ".next"), { recursive: true });
cpSync(resolve(root, ".next/static"), resolve(standaloneRoot, ".next/static"), {
  force: true,
  recursive: true,
});

const publicDirectory = resolve(root, "public");
if (existsSync(publicDirectory)) {
  cpSync(publicDirectory, resolve(standaloneRoot, "public"), {
    force: true,
    recursive: true,
  });
}
