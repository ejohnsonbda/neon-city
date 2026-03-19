-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "date" TEXT NOT NULL,
    "time" TEXT,
    "location" TEXT,
    "organizationId" TEXT,
    "organizationName" TEXT NOT NULL,
    "imageUrl" TEXT,
    "sport" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "events_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_events" ("createdAt", "date", "description", "id", "imageUrl", "isPublished", "location", "organizationId", "organizationName", "sport", "time", "title", "updatedAt") SELECT "createdAt", "date", "description", "id", "imageUrl", "isPublished", "location", "organizationId", "organizationName", "sport", "time", "title", "updatedAt" FROM "events";
DROP TABLE "events";
ALTER TABLE "new_events" RENAME TO "events";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
