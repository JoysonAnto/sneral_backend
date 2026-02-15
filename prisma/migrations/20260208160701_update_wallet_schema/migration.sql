-- CreateEnum
CREATE TYPE "WalletType" AS ENUM ('CUSTOMER', 'PLATFORM', 'PROVIDER');

-- CreateEnum
CREATE TYPE "TransactionCategory" AS ENUM ('CREDIT', 'DEBIT', 'HOLD', 'RELEASE', 'REVERSAL');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TransactionType" ADD VALUE 'TAX_DEDUCTION';
ALTER TYPE "TransactionType" ADD VALUE 'PENALTY';

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "category" "TransactionCategory" NOT NULL DEFAULT 'CREDIT',
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "status" "TransactionStatus" NOT NULL DEFAULT 'COMPLETED';

-- AlterTable
ALTER TABLE "wallets" ADD COLUMN     "on_hold_balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "pending_payout" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "type" "WalletType" NOT NULL DEFAULT 'PROVIDER';

-- CreateIndex
CREATE INDEX "transactions_category_idx" ON "transactions"("category");
