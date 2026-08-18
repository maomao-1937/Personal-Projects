/*
  Warnings:

  - You are about to drop the column `actualSec` on the `PomodoroSession` table. All the data in the column will be lost.
  - Added the required column `plannedSec` to the `PomodoroSession` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PomodoroSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "phase" TEXT NOT NULL DEFAULT 'WORK',
    "plannedMin" INTEGER NOT NULL,
    "plannedSec" INTEGER NOT NULL,
    "taskId" TEXT,
    "finishedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PomodoroSession_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_PomodoroSession" ("finishedAt", "id", "phase", "plannedMin", "taskId") SELECT "finishedAt", "id", "phase", "plannedMin", "taskId" FROM "PomodoroSession";
DROP TABLE "PomodoroSession";
ALTER TABLE "new_PomodoroSession" RENAME TO "PomodoroSession";
CREATE INDEX "PomodoroSession_taskId_idx" ON "PomodoroSession"("taskId");
CREATE INDEX "PomodoroSession_finishedAt_idx" ON "PomodoroSession"("finishedAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
