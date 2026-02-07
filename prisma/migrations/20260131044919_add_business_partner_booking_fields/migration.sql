-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "BookingStatus" ADD VALUE 'PARTNER_NOT_FOUND';
ALTER TYPE "BookingStatus" ADD VALUE 'PENDING_ASSIGNMENT';

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "business_partner_id" TEXT,
ADD COLUMN     "commission_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "platform_fee" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_business_partner_id_fkey" FOREIGN KEY ("business_partner_id") REFERENCES "business_partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;
