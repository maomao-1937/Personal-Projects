import type Database from "better-sqlite3";

export type TransactionRunner = <T>(operation: () => T) => T;

export function createTransactionRunner(
  db: Database.Database,
): TransactionRunner {
  return <T>(operation: () => T) => db.transaction(operation)();
}

