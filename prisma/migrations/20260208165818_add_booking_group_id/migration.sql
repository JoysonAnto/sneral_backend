-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "group_id" TEXT;

-- CreateIndex
CREATE INDEX "bookings_group_id_idx" ON "bookings"("group_id");
