-- Safe non-destructive migration for partner status management and enhancements

DO $$ BEGIN
    CREATE TYPE "PartnerStatus" AS ENUM ('PENDING', 'UNDER_REVIEW', 'APPROVED', 'ACTIVE', 'INACTIVE', 'REJECTED', 'SUSPENDED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Service Partners enhancements
ALTER TABLE "service_partners" ADD COLUMN IF NOT EXISTS "partner_status" "PartnerStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "service_partners" ADD COLUMN IF NOT EXISTS "experience_years" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "service_partners" ADD COLUMN IF NOT EXISTS "alternate_phone" TEXT;
ALTER TABLE "service_partners" ADD COLUMN IF NOT EXISTS "coverage_areas" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "service_partners" ADD COLUMN IF NOT EXISTS "address_line2" TEXT;
ALTER TABLE "service_partners" ADD COLUMN IF NOT EXISTS "upi_id" TEXT;
ALTER TABLE "service_partners" ADD COLUMN IF NOT EXISTS "bank_name" TEXT;

-- Business Partners enhancements
ALTER TABLE "business_partners" ADD COLUMN IF NOT EXISTS "partner_status" "PartnerStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "business_partners" ADD COLUMN IF NOT EXISTS "experience_years" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "business_partners" ADD COLUMN IF NOT EXISTS "alternate_phone" TEXT;
ALTER TABLE "business_partners" ADD COLUMN IF NOT EXISTS "coverage_areas" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "business_partners" ADD COLUMN IF NOT EXISTS "address_line2" TEXT;
ALTER TABLE "business_partners" ADD COLUMN IF NOT EXISTS "upi_id" TEXT;
ALTER TABLE "business_partners" ADD COLUMN IF NOT EXISTS "bank_name" TEXT;

-- Kyc Documents enhancements
ALTER TABLE "kyc_documents" ADD COLUMN IF NOT EXISTS "original_filename" TEXT;
ALTER TABLE "kyc_documents" ADD COLUMN IF NOT EXISTS "file_size" INTEGER;
ALTER TABLE "kyc_documents" ADD COLUMN IF NOT EXISTS "mime_type" TEXT;
ALTER TABLE "kyc_documents" ADD COLUMN IF NOT EXISTS "remarks" TEXT;

-- Partner Status History table
CREATE TABLE IF NOT EXISTS "partner_status_history" (
    "id" TEXT NOT NULL,
    "service_partner_id" TEXT,
    "business_partner_id" TEXT,
    "previous_status" TEXT,
    "new_status" TEXT NOT NULL,
    "remarks" TEXT,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_status_history_pkey" PRIMARY KEY ("id")
);

-- Foreign keys
DO $$ BEGIN
    ALTER TABLE "partner_status_history" ADD CONSTRAINT "partner_status_history_service_partner_id_fkey" 
    FOREIGN KEY ("service_partner_id") REFERENCES "service_partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "partner_status_history" ADD CONSTRAINT "partner_status_history_business_partner_id_fkey" 
    FOREIGN KEY ("business_partner_id") REFERENCES "business_partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS "partner_status_history_service_partner_id_idx" ON "partner_status_history"("service_partner_id");
CREATE INDEX IF NOT EXISTS "partner_status_history_business_partner_id_idx" ON "partner_status_history"("business_partner_id");
CREATE INDEX IF NOT EXISTS "service_partners_partner_status_idx" ON "service_partners"("partner_status");
CREATE INDEX IF NOT EXISTS "business_partners_partner_status_idx" ON "business_partners"("partner_status");
