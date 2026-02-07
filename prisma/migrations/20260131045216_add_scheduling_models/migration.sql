-- CreateTable
CREATE TABLE "business_hours" (
    "id" TEXT NOT NULL,
    "business_partner_id" TEXT,
    "service_partner_id" TEXT,
    "day_of_week" INTEGER NOT NULL,
    "open_time" TEXT NOT NULL,
    "close_time" TEXT NOT NULL,
    "is_closed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "business_hours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "availability_slots" (
    "id" TEXT NOT NULL,
    "business_partner_id" TEXT,
    "service_partner_id" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "max_bookings" INTEGER NOT NULL DEFAULT 1,
    "current_bookings" INTEGER NOT NULL DEFAULT 0,
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "availability_slots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "business_hours_business_partner_id_service_partner_id_day_o_key" ON "business_hours"("business_partner_id", "service_partner_id", "day_of_week");

-- CreateIndex
CREATE INDEX "availability_slots_date_idx" ON "availability_slots"("date");

-- CreateIndex
CREATE INDEX "availability_slots_business_partner_id_idx" ON "availability_slots"("business_partner_id");

-- CreateIndex
CREATE INDEX "availability_slots_service_partner_id_idx" ON "availability_slots"("service_partner_id");

-- AddForeignKey
ALTER TABLE "business_hours" ADD CONSTRAINT "business_hours_business_partner_id_fkey" FOREIGN KEY ("business_partner_id") REFERENCES "business_partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_hours" ADD CONSTRAINT "business_hours_service_partner_id_fkey" FOREIGN KEY ("service_partner_id") REFERENCES "service_partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability_slots" ADD CONSTRAINT "availability_slots_business_partner_id_fkey" FOREIGN KEY ("business_partner_id") REFERENCES "business_partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability_slots" ADD CONSTRAINT "availability_slots_service_partner_id_fkey" FOREIGN KEY ("service_partner_id") REFERENCES "service_partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;
