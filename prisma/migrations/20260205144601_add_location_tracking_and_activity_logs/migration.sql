-- CreateTable
CREATE TABLE "partner_location_history" (
    "id" TEXT NOT NULL,
    "partner_id" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "accuracy" DOUBLE PRECISION,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_online" BOOLEAN NOT NULL DEFAULT true,
    "booking_id" TEXT,
    "address" TEXT,

    CONSTRAINT "partner_location_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_activity_logs" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "actor_type" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "previous_status" "BookingStatus",
    "new_status" "BookingStatus",
    "location_lat" DOUBLE PRECISION,
    "location_lng" DOUBLE PRECISION,
    "details" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "partner_location_history_partner_id_recorded_at_idx" ON "partner_location_history"("partner_id", "recorded_at");

-- CreateIndex
CREATE INDEX "partner_location_history_booking_id_idx" ON "partner_location_history"("booking_id");

-- CreateIndex
CREATE INDEX "partner_location_history_recorded_at_idx" ON "partner_location_history"("recorded_at");

-- CreateIndex
CREATE INDEX "booking_activity_logs_booking_id_created_at_idx" ON "booking_activity_logs"("booking_id", "created_at");

-- CreateIndex
CREATE INDEX "booking_activity_logs_actor_id_idx" ON "booking_activity_logs"("actor_id");

-- CreateIndex
CREATE INDEX "booking_activity_logs_created_at_idx" ON "booking_activity_logs"("created_at");

-- AddForeignKey
ALTER TABLE "partner_location_history" ADD CONSTRAINT "partner_location_history_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "service_partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_location_history" ADD CONSTRAINT "partner_location_history_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_activity_logs" ADD CONSTRAINT "booking_activity_logs_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
