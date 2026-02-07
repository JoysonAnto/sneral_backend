-- AlterTable
ALTER TABLE "areas" ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "place_id" TEXT;

-- AlterTable
ALTER TABLE "districts" ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "place_id" TEXT;

-- AlterTable
ALTER TABLE "service_partners" ADD COLUMN     "last_location_update" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "states" ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "place_id" TEXT;
