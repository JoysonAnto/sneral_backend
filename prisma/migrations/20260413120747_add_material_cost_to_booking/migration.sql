-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "material_bill_image" TEXT,
ADD COLUMN     "material_cost" DOUBLE PRECISION NOT NULL DEFAULT 0;
