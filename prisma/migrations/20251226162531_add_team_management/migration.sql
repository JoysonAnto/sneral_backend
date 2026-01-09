-- CreateEnum
CREATE TYPE "TeamMemberRole" AS ENUM ('LEAD', 'MEMBER', 'TRAINEE', 'SPECIALIST');

-- CreateEnum
CREATE TYPE "TeamMemberStatus" AS ENUM ('PENDING', 'ACTIVE', 'INACTIVE', 'LEFT');

-- AlterTable
ALTER TABLE "business_partners" ADD COLUMN     "team_management_enabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "partner_associations" (
    "id" TEXT NOT NULL,
    "business_partner_id" TEXT NOT NULL,
    "service_partner_id" TEXT NOT NULL,
    "role" "TeamMemberRole" NOT NULL DEFAULT 'MEMBER',
    "status" "TeamMemberStatus" NOT NULL DEFAULT 'PENDING',
    "commission_split" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "invited_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "joined_at" TIMESTAMP(3),
    "left_at" TIMESTAMP(3),
    "notes" TEXT,
    "invitation_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partner_associations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "partner_associations_business_partner_id_idx" ON "partner_associations"("business_partner_id");

-- CreateIndex
CREATE INDEX "partner_associations_service_partner_id_idx" ON "partner_associations"("service_partner_id");

-- CreateIndex
CREATE INDEX "partner_associations_status_idx" ON "partner_associations"("status");

-- CreateIndex
CREATE UNIQUE INDEX "partner_associations_business_partner_id_service_partner_id_key" ON "partner_associations"("business_partner_id", "service_partner_id");

-- AddForeignKey
ALTER TABLE "partner_associations" ADD CONSTRAINT "partner_associations_business_partner_id_fkey" FOREIGN KEY ("business_partner_id") REFERENCES "business_partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_associations" ADD CONSTRAINT "partner_associations_service_partner_id_fkey" FOREIGN KEY ("service_partner_id") REFERENCES "service_partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;
