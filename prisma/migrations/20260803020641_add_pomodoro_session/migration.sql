-- CreateTable
CREATE TABLE "PomodoroSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "phase" TEXT NOT NULL DEFAULT 'WORK',
    "plannedMin" INTEGER NOT NULL,
    "actualSec" INTEGER NOT NULL,
    "taskId" TEXT,
    "finishedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PomodoroSession_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "PomodoroSession_taskId_idx" ON "PomodoroSession"("taskId");

-- CreateIndex
CREATE INDEX "PomodoroSession_finishedAt_idx" ON "PomodoroSession"("finishedAt");
