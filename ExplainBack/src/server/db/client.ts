import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

import Database from "better-sqlite3";

import { runMigrations } from "@/server/db/migrations";

type DatabaseCache = typeof globalThis & {
  __explainBackDatabase?: Database.Database;
  __explainBackDatabasePath?: string;
};

const cache = globalThis as DatabaseCache;

export function createDatabase(path: string): Database.Database {
  if (path !== ":memory:") {
    mkdirSync(dirname(resolve(path)), { recursive: true });
  }

  const db = new Database(path);
  db.pragma("foreign_keys = ON");
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 5000");
  runMigrations(db);
  return db;
}

export function getDatabase(): Database.Database {
  const path = process.env.DATABASE_PATH ?? "data/explainback.db";

  if (
    cache.__explainBackDatabase?.open &&
    cache.__explainBackDatabasePath === path
  ) {
    return cache.__explainBackDatabase;
  }

  cache.__explainBackDatabase = createDatabase(path);
  cache.__explainBackDatabasePath = path;
  return cache.__explainBackDatabase;
}

