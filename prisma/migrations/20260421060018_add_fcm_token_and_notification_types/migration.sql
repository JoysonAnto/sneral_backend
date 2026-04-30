-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'NEW_BOOKING';
ALTER TYPE "NotificationType" ADD VALUE 'BOOKING_CANCELLED';
ALTER TYPE "NotificationType" ADD VALUE 'PARTNER_ARRIVED';
ALTER TYPE "NotificationType" ADD VALUE 'BOOKING_STARTED';
ALTER TYPE "NotificationType" ADD VALUE 'PAYMENT_COMPLETED';
ALTER TYPE "NotificationType" ADD VALUE 'PAYOUT_PROCESSED';
ALTER TYPE "NotificationType" ADD VALUE 'TEAM_INVITATION';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "fcm_token" TEXT;
