-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'SENT', 'PAID', 'PARTIALLY_PAID', 'OVERDUE', 'CANCELLED');

-- CreateTable
CREATE TABLE "offline_customers" (
    "id" TEXT NOT NULL,
    "business_partner_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone_number" TEXT NOT NULL,
    "alternate_phone" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postal_code" TEXT,
    "company_name" TEXT,
    "gst_number" TEXT,
    "total_invoices" INTEGER NOT NULL DEFAULT 0,
    "total_revenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "outstanding_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "offline_customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offline_invoices" (
    "id" TEXT NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "business_partner_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "invoice_date" TIMESTAMP(3) NOT NULL,
    "due_date" TIMESTAMP(3) NOT NULL,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "tax_rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tax_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discount_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_amount" DOUBLE PRECISION NOT NULL,
    "paid_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "balance_amount" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "terms_conditions" TEXT,
    "payment_instructions" TEXT,
    "sent_at" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "cancellation_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "offline_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offline_invoice_items" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "service_id" TEXT,
    "description" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unit_price" DOUBLE PRECISION NOT NULL,
    "total_price" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "offline_invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offline_payments" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "payment_method" "PaymentMethod" NOT NULL,
    "payment_date" TIMESTAMP(3) NOT NULL,
    "reference_number" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL,

    CONSTRAINT "offline_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "offline_customers_business_partner_id_idx" ON "offline_customers"("business_partner_id");

-- CreateIndex
CREATE INDEX "offline_customers_phone_number_idx" ON "offline_customers"("phone_number");

-- CreateIndex
CREATE INDEX "offline_customers_email_idx" ON "offline_customers"("email");

-- CreateIndex
CREATE UNIQUE INDEX "offline_customers_business_partner_id_phone_number_key" ON "offline_customers"("business_partner_id", "phone_number");

-- CreateIndex
CREATE UNIQUE INDEX "offline_invoices_invoice_number_key" ON "offline_invoices"("invoice_number");

-- CreateIndex
CREATE INDEX "offline_invoices_business_partner_id_idx" ON "offline_invoices"("business_partner_id");

-- CreateIndex
CREATE INDEX "offline_invoices_customer_id_idx" ON "offline_invoices"("customer_id");

-- CreateIndex
CREATE INDEX "offline_invoices_status_idx" ON "offline_invoices"("status");

-- CreateIndex
CREATE INDEX "offline_invoices_invoice_date_idx" ON "offline_invoices"("invoice_date");

-- CreateIndex
CREATE INDEX "offline_invoices_due_date_idx" ON "offline_invoices"("due_date");

-- CreateIndex
CREATE INDEX "offline_invoices_invoice_number_idx" ON "offline_invoices"("invoice_number");

-- CreateIndex
CREATE INDEX "offline_invoice_items_invoice_id_idx" ON "offline_invoice_items"("invoice_id");

-- CreateIndex
CREATE INDEX "offline_invoice_items_service_id_idx" ON "offline_invoice_items"("service_id");

-- CreateIndex
CREATE INDEX "offline_payments_invoice_id_idx" ON "offline_payments"("invoice_id");

-- CreateIndex
CREATE INDEX "offline_payments_payment_date_idx" ON "offline_payments"("payment_date");

-- AddForeignKey
ALTER TABLE "offline_customers" ADD CONSTRAINT "offline_customers_business_partner_id_fkey" FOREIGN KEY ("business_partner_id") REFERENCES "business_partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offline_invoices" ADD CONSTRAINT "offline_invoices_business_partner_id_fkey" FOREIGN KEY ("business_partner_id") REFERENCES "business_partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offline_invoices" ADD CONSTRAINT "offline_invoices_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "offline_customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offline_invoice_items" ADD CONSTRAINT "offline_invoice_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "offline_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offline_invoice_items" ADD CONSTRAINT "offline_invoice_items_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offline_payments" ADD CONSTRAINT "offline_payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "offline_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
