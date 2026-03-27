/*
  Warnings:

  - The values [ARRIVED] on the enum `BookingStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "BookingStatus_new" AS ENUM ('PENDING', 'SEARCHING_PARTNER', 'PARTNER_ASSIGNED', 'PARTNER_ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'RATED', 'PARTNER_NOT_FOUND', 'PENDING_ASSIGNMENT', 'PARTNER_ARRIVED');
ALTER TABLE "bookings" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "bookings" ALTER COLUMN "status" TYPE "BookingStatus_new" USING ("status"::text::"BookingStatus_new");
ALTER TABLE "booking_status_history" ALTER COLUMN "status" TYPE "BookingStatus_new" USING ("status"::text::"BookingStatus_new");
ALTER TABLE "booking_activity_logs" ALTER COLUMN "previous_status" TYPE "BookingStatus_new" USING ("previous_status"::text::"BookingStatus_new");
ALTER TABLE "booking_activity_logs" ALTER COLUMN "new_status" TYPE "BookingStatus_new" USING ("new_status"::text::"BookingStatus_new");
ALTER TYPE "BookingStatus" RENAME TO "BookingStatus_old";
ALTER TYPE "BookingStatus_new" RENAME TO "BookingStatus";
DROP TYPE "BookingStatus_old";
ALTER TABLE "bookings" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;
