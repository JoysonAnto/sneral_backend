-- AlterTable: Add GDPR Compliance fields to users table
ALTER TABLE "users" ADD COLUMN "marketing_consent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "data_processing_consent" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "users" ADD COLUMN "cookie_consent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "consent_updated_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "is_deleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "deleted_at" TIMESTAMP(3);

-- AlterTable: Update audit_logs table structure
ALTER TABLE "audit_logs" RENAME COLUMN "entity_type" TO "resource_type";
ALTER TABLE "audit_logs" RENAME COLUMN "entity_id" TO "resource_id";
ALTER TABLE "audit_logs" DROP COLUMN "old_values";
ALTER TABLE "audit_logs" DROP COLUMN "new_values";
ALTER TABLE "audit_logs" ADD COLUMN "details" JSONB;
ALTER TABLE "audit_logs" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'SUCCESS';
ALTER TABLE "audit_logs" ADD COLUMN "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "audit_logs_action_idx" ON "audit_logs"("action");
CREATE INDEX IF NOT EXISTS "audit_logs_timestamp_idx" ON "audit_logs"("timestamp");
CREATE INDEX IF NOT EXISTS "audit_logs_resource_type_idx" ON "audit_logs"("resource_type");
