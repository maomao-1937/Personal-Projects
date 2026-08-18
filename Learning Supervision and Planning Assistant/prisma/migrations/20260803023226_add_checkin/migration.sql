-- CreateTable
CREATE TABLE "CheckIn" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" TEXT NOT NULL,
    "mood" TEXT NOT NULL DEFAULT 'OK',
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "CheckIn_date_key" ON "CheckIn"("date");

-- CreateIndex
CREATE INDEX "CheckIn_date_idx" ON "CheckIn"("date");
