-- AlterTable
ALTER TABLE "Project" ADD COLUMN "imageUrl" TEXT;
ALTER TABLE "Project" ADD COLUMN "imageStoredAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ProjectVersion" ADD COLUMN "imageUrl" TEXT;
