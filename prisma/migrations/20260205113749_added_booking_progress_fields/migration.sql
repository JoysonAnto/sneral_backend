-- AlterEnum
ALTER TYPE "BookingStatus" ADD VALUE 'ARRIVED';

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "after_service_images" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "before_service_images" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "completion_otp" TEXT,
ADD COLUMN     "customer_signature" TEXT,
ADD COLUMN     "service_notes" TEXT;
