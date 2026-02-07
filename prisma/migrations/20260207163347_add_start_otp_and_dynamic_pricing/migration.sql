-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "actual_duration" INTEGER,
ADD COLUMN     "dynamic_multiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
ADD COLUMN     "estimated_duration" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "overtime_charge" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "start_otp" TEXT;
