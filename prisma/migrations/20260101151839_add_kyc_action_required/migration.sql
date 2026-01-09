-- CreateEnum
CREATE TYPE "RecurringFrequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "RecurringStatus" AS ENUM ('ACTIVE', 'PAUSED', 'CANCELLED', 'EXPIRED');

-- AlterEnum
ALTER TYPE "KycStatus" ADD VALUE 'ACTION_REQUIRED';

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'KYC_ACTION_REQUIRED';

-- AlterTable
ALTER TABLE "business_partners" ADD COLUMN     "category_id" TEXT,
ALTER COLUMN "business_type" DROP NOT NULL;

-- AlterTable
ALTER TABLE "offline_invoices" ADD COLUMN     "recurring_invoice_id" TEXT;

-- AlterTable
ALTER TABLE "service_partners" ADD COLUMN     "category_id" TEXT;

-- CreateTable
CREATE TABLE "recurring_invoices" (
    "id" TEXT NOT NULL,
    "business_partner_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "frequency" "RecurringFrequency" NOT NULL,
    "interval" INTEGER NOT NULL DEFAULT 1,
    "next_invoice_date" TIMESTAMP(3) NOT NULL,
    "last_generated_date" TIMESTAMP(3),
    "template_name" TEXT NOT NULL,
    "description" TEXT,
    "notes" TEXT,
    "terms_conditions" TEXT,
    "payment_instructions" TEXT,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "tax_rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tax_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discount_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_amount" DOUBLE PRECISION NOT NULL,
    "status" "RecurringStatus" NOT NULL DEFAULT 'ACTIVE',
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3),
    "max_occurrences" INTEGER,
    "occurrences_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT NOT NULL,

    CONSTRAINT "recurring_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_invoice_items" (
    "id" TEXT NOT NULL,
    "recurring_invoice_id" TEXT NOT NULL,
    "service_id" TEXT,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price" DOUBLE PRECISION NOT NULL,
    "total_price" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "recurring_invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recurring_invoices_business_partner_id_idx" ON "recurring_invoices"("business_partner_id");

-- CreateIndex
CREATE INDEX "recurring_invoices_customer_id_idx" ON "recurring_invoices"("customer_id");

-- CreateIndex
CREATE INDEX "recurring_invoices_status_idx" ON "recurring_invoices"("status");

-- CreateIndex
CREATE INDEX "recurring_invoices_next_invoice_date_idx" ON "recurring_invoices"("next_invoice_date");

-- CreateIndex
CREATE INDEX "recurring_invoice_items_recurring_invoice_id_idx" ON "recurring_invoice_items"("recurring_invoice_id");

-- CreateIndex
CREATE INDEX "offline_invoices_recurring_invoice_id_idx" ON "offline_invoices"("recurring_invoice_id");

-- AddForeignKey
ALTER TABLE "service_partners" ADD CONSTRAINT "service_partners_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_partners" ADD CONSTRAINT "business_partners_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offline_invoices" ADD CONSTRAINT "offline_invoices_recurring_invoice_id_fkey" FOREIGN KEY ("recurring_invoice_id") REFERENCES "recurring_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_invoices" ADD CONSTRAINT "recurring_invoices_business_partner_id_fkey" FOREIGN KEY ("business_partner_id") REFERENCES "business_partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_invoices" ADD CONSTRAINT "recurring_invoices_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "offline_customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_invoice_items" ADD CONSTRAINT "recurring_invoice_items_recurring_invoice_id_fkey" FOREIGN KEY ("recurring_invoice_id") REFERENCES "recurring_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_invoice_items" ADD CONSTRAINT "recurring_invoice_items_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;
