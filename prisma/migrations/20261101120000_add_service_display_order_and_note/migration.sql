-- AlterTable: Add display_order and note to services safely without affecting existing data
ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "display_order" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "note" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "services_display_order_idx" ON "services"("display_order");
