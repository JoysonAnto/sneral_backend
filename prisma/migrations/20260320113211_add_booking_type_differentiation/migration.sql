-- CreateEnum
CREATE TYPE "BookingType" AS ENUM ('INSTANT', 'SCHEDULED');

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "booking_type" "BookingType" NOT NULL DEFAULT 'INSTANT',
ADD COLUMN     "is_scheduled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "scheduled_date_time" TIMESTAMP(3);
