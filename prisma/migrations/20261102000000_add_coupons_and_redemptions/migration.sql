-- Safe, non-destructive migration for Coupons and CouponRedemptions

-- 1. Create Enums if they do not exist
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DiscountType') THEN
        CREATE TYPE "DiscountType" AS ENUM ('FIXED', 'PERCENTAGE');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CouponRedemptionStatus') THEN
        CREATE TYPE "CouponRedemptionStatus" AS ENUM ('PENDING', 'REDEEMED', 'FAILED', 'CANCELLED');
    END IF;
END $$;

-- 2. Create coupons table
CREATE TABLE IF NOT EXISTS "coupons" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "discount_type" "DiscountType" NOT NULL DEFAULT 'FIXED',
    "discount_value" DOUBLE PRECISION NOT NULL,
    "max_discount" DOUBLE PRECISION,
    "min_order_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "start_date" TIMESTAMP(3) NOT NULL,
    "expiry_date" TIMESTAMP(3) NOT NULL,
    "total_usage_limit" INTEGER,
    "per_user_usage_limit" INTEGER NOT NULL DEFAULT 1,
    "new_user_only" BOOLEAN NOT NULL DEFAULT false,
    "applicable_services" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "terms_conditions" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "used_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

-- 3. Create unique index and lookup indexes on coupons
CREATE UNIQUE INDEX IF NOT EXISTS "coupons_code_key" ON "coupons"("code");
CREATE INDEX IF NOT EXISTS "coupons_code_idx" ON "coupons"("code");
CREATE INDEX IF NOT EXISTS "coupons_is_active_idx" ON "coupons"("is_active");
CREATE INDEX IF NOT EXISTS "coupons_expiry_date_idx" ON "coupons"("expiry_date");

-- 4. Add coupon columns to bookings table
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "coupon_id" TEXT;
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "discount_amount" DOUBLE PRECISION NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS "bookings_coupon_id_idx" ON "bookings"("coupon_id");

-- 5. Create coupon_redemptions table
CREATE TABLE IF NOT EXISTS "coupon_redemptions" (
    "id" TEXT NOT NULL,
    "coupon_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "booking_id" TEXT,
    "discount_amount" DOUBLE PRECISION NOT NULL,
    "order_amount" DOUBLE PRECISION NOT NULL,
    "status" "CouponRedemptionStatus" NOT NULL DEFAULT 'PENDING',
    "redeemed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coupon_redemptions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "coupon_redemptions_coupon_id_idx" ON "coupon_redemptions"("coupon_id");
CREATE INDEX IF NOT EXISTS "coupon_redemptions_user_id_idx" ON "coupon_redemptions"("user_id");
CREATE INDEX IF NOT EXISTS "coupon_redemptions_booking_id_idx" ON "coupon_redemptions"("booking_id");
CREATE INDEX IF NOT EXISTS "coupon_redemptions_status_idx" ON "coupon_redemptions"("status");

-- 6. Add Foreign Key Constraints if not exists
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'bookings_coupon_id_fkey'
    ) THEN
        ALTER TABLE "bookings" ADD CONSTRAINT "bookings_coupon_id_fkey" 
        FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'coupon_redemptions_coupon_id_fkey'
    ) THEN
        ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_coupon_id_fkey" 
        FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'coupon_redemptions_user_id_fkey'
    ) THEN
        ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_user_id_fkey" 
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'coupon_redemptions_booking_id_fkey'
    ) THEN
        ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_booking_id_fkey" 
        FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
