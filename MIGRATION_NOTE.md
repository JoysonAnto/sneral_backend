-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'BUSINESS_PARTNER', 'SERVICE_PARTNER', 'CUSTOMER');
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'SEARCHING_PARTNER', 'PARTNER_ASSIGNED', 'PARTNER_ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'RATED');
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REFUNDED');
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD', 'UPI', 'WALLET', 'NET_BANKING');
CREATE TYPE "KycStatus" AS ENUM ('PENDING', 'PENDING_VERIFICATION', 'APPROVED', 'REJECTED');
CREATE TYPE "PartnerAvailability" AS ENUM ('AVAILABLE', 'BUSY', 'OFFLINE');
CREATE TYPE "TransactionType" AS ENUM ('BOOKING_PAYMENT', 'REFUND', 'PAYOUT', 'WALLET_TOPUP', 'COMMISSION', 'CASHBACK');
CREATE TYPE "NotificationType" AS ENUM ('BOOKING_CREATED', 'BOOKING_ASSIGNED', 'BOOKING_COMPLETED', 'PAYMENT_RECEIVED', 'KYC_APPROVED', 'KYC_REJECTED', 'MESSAGE_RECEIVED', 'GENERAL');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "phone_number" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'CUSTOMER',
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "phone_verified" BOOLEAN NOT NULL DEFAULT false,
    "verification_otp" TEXT,
    "otp_expiry" TIMESTAMP(3),
    "reset_token" TEXT,
    "reset_token_expiry" TIMESTAMP(3),
    "last_login" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- Rest of tables would be here...
-- Note: The migration will be auto-generated when you run prisma migrate dev
