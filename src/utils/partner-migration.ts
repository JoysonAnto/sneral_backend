import prisma from '../config/database';
import { logger } from './logger';

export async function runPartnerMigration() {
    try {
        logger.info('🚀 Running partner migration check...');

        // 1. Enum
        try {
            await prisma.$executeRawUnsafe(`
                DO $$ BEGIN
                    CREATE TYPE "PartnerStatus" AS ENUM ('PENDING', 'UNDER_REVIEW', 'APPROVED', 'ACTIVE', 'INACTIVE', 'REJECTED', 'SUSPENDED');
                EXCEPTION
                    WHEN duplicate_object THEN null;
                END $$;
            `);
        } catch (e: any) {
            logger.warn('PartnerStatus enum creation note: ' + e.message);
        }

        // 2. Service partners columns
        const servicePartnerColumns = [
            `ALTER TABLE "service_partners" ADD COLUMN IF NOT EXISTS "partner_status" "PartnerStatus" NOT NULL DEFAULT 'PENDING';`,
            `ALTER TABLE "service_partners" ADD COLUMN IF NOT EXISTS "experience_years" INTEGER NOT NULL DEFAULT 0;`,
            `ALTER TABLE "service_partners" ADD COLUMN IF NOT EXISTS "alternate_phone" TEXT;`,
            `ALTER TABLE "service_partners" ADD COLUMN IF NOT EXISTS "coverage_areas" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];`,
            `ALTER TABLE "service_partners" ADD COLUMN IF NOT EXISTS "address_line2" TEXT;`,
            `ALTER TABLE "service_partners" ADD COLUMN IF NOT EXISTS "upi_id" TEXT;`,
            `ALTER TABLE "service_partners" ADD COLUMN IF NOT EXISTS "bank_name" TEXT;`,
        ];

        for (const query of servicePartnerColumns) {
            try {
                await prisma.$executeRawUnsafe(query);
            } catch (e: any) {
                logger.warn('Service partner column alter note: ' + e.message);
            }
        }

        // 3. Business partners columns
        const businessPartnerColumns = [
            `ALTER TABLE "business_partners" ADD COLUMN IF NOT EXISTS "partner_status" "PartnerStatus" NOT NULL DEFAULT 'PENDING';`,
            `ALTER TABLE "business_partners" ADD COLUMN IF NOT EXISTS "experience_years" INTEGER NOT NULL DEFAULT 0;`,
            `ALTER TABLE "business_partners" ADD COLUMN IF NOT EXISTS "alternate_phone" TEXT;`,
            `ALTER TABLE "business_partners" ADD COLUMN IF NOT EXISTS "coverage_areas" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];`,
            `ALTER TABLE "business_partners" ADD COLUMN IF NOT EXISTS "address_line2" TEXT;`,
            `ALTER TABLE "business_partners" ADD COLUMN IF NOT EXISTS "upi_id" TEXT;`,
            `ALTER TABLE "business_partners" ADD COLUMN IF NOT EXISTS "bank_name" TEXT;`,
        ];

        for (const query of businessPartnerColumns) {
            try {
                await prisma.$executeRawUnsafe(query);
            } catch (e: any) {
                logger.warn('Business partner column alter note: ' + e.message);
            }
        }

        // 4. Kyc documents columns
        const kycColumns = [
            `ALTER TABLE "kyc_documents" ADD COLUMN IF NOT EXISTS "original_filename" TEXT;`,
            `ALTER TABLE "kyc_documents" ADD COLUMN IF NOT EXISTS "file_size" INTEGER;`,
            `ALTER TABLE "kyc_documents" ADD COLUMN IF NOT EXISTS "mime_type" TEXT;`,
            `ALTER TABLE "kyc_documents" ADD COLUMN IF NOT EXISTS "remarks" TEXT;`,
        ];

        for (const query of kycColumns) {
            try {
                await prisma.$executeRawUnsafe(query);
            } catch (e: any) {
                logger.warn('KYC document column alter note: ' + e.message);
            }
        }

        // 5. Partner status history table
        try {
            await prisma.$executeRawUnsafe(`
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
            `);
        } catch (e: any) {
            logger.warn('Partner status history table note: ' + e.message);
        }

        // 6. Constraints and indices
        const constraints = [
            `DO $$ BEGIN
                ALTER TABLE "partner_status_history" ADD CONSTRAINT "partner_status_history_service_partner_id_fkey" 
                FOREIGN KEY ("service_partner_id") REFERENCES "service_partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;`,
            `DO $$ BEGIN
                ALTER TABLE "partner_status_history" ADD CONSTRAINT "partner_status_history_business_partner_id_fkey" 
                FOREIGN KEY ("business_partner_id") REFERENCES "business_partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;`,
            `CREATE INDEX IF NOT EXISTS "partner_status_history_service_partner_id_idx" ON "partner_status_history"("service_partner_id");`,
            `CREATE INDEX IF NOT EXISTS "partner_status_history_business_partner_id_idx" ON "partner_status_history"("business_partner_id");`,
            `CREATE INDEX IF NOT EXISTS "service_partners_partner_status_idx" ON "service_partners"("partner_status");`,
            `CREATE INDEX IF NOT EXISTS "business_partners_partner_status_idx" ON "business_partners"("partner_status");`
        ];

        for (const query of constraints) {
            try {
                await prisma.$executeRawUnsafe(query);
            } catch (e: any) {
                logger.warn('Constraint/Index note: ' + e.message);
            }
        }

        logger.info('✅ Partner migration check completed successfully');
    } catch (error) {
        logger.error('Error during partner migration:', error);
    }
}
