# GDPR Compliance Migration Guide

## Migration: `add_gdpr_compliance`

### Summary
Adds GDPR compliance fields to the User model and enhances the AuditLog model for comprehensive tracking.

---

## Schema Changes

### 1. Users Table - New Fields

```sql
ALTER TABLE "users" ADD COLUMN "marketing_consent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "data_processing_consent" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "users" ADD COLUMN "cookie_consent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "consent_updated_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "is_deleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "deleted_at" TIMESTAMP(3);
```

**Fields Added**:
- `marketing_consent` - User opt-in for marketing communications
- `data_processing_consent` - User consent for data processing (defaults to true)
- `cookie_consent` - User consent for cookies
- `consent_updated_at` - Timestamp of last consent update
- `is_deleted` - Soft delete flag (30-day grace period)
- `deleted_at` - Timestamp of deletion request

###2. Audit Logs Table - Enhanced Structure

```sql
ALTER TABLE "audit_logs" RENAME COLUMN "entity_type" TO "resource_type";
ALTER TABLE "audit_logs" RENAME COLUMN "entity_id" TO "resource_id";
ALTER TABLE "audit_logs" DROP COLUMN "old_values";
ALTER TABLE "audit_logs" DROP COLUMN "new_values";
ALTER TABLE "audit_logs" ADD COLUMN "details" JSONB;
ALTER TABLE "audit_logs" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'SUCCESS';
ALTER TABLE "audit_logs" ADD COLUMN "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
```

**Changes**:
- Renamed `entity_type` → `resource_type`
- Renamed `entity_id` → `resource_id`
- Removed `old_values` and `new_values` (inflexible)
- Added `details` JSONB field (flexible data storage)
- Added `status` field (SUCCESS/FAILURE tracking)
- Added `timestamp` field (explicit event timing)

### 3. New Indexes

```sql
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");
CREATE INDEX "audit_logs_timestamp_idx" ON "audit_logs"("timestamp");
CREATE INDEX "audit_logs_resource_type_idx" ON "audit_logs"("resource_type");
```

---

## How to Apply Migration

### Option 1: Automatic (Recommended)

```bash
# Generate Prisma client
npx prisma generate

# Apply migration
npx prisma migrate deploy
```

### Option 2: Manual SQL

If you prefer to run SQL directly:

```bash
# Connect to your database
psql -U your_user -d your_database

# Run the migration file
\i prisma/migrations/add_gdpr_compliance.sql
```

### Option 3: Using Prisma Studio

```bash
# Open Prisma Studio
npx prisma studio

# Manually execute SQL in your database client
```

---

## Post-Migration Steps

### 1. Generate Prisma Client

```bash
npx prisma generate
```

### 2. Restart Server

```bash
npm run dev
```

### 3. Verify Migration

```bash
# Check database schema
npx prisma db pull

# Validate schema
npx prisma validate
```

### 4. Test GDPR Endpoints

```bash
# Get user consent
curl -X GET http://localhost:3000/api/v1/compliance/consent \
  -H "Authorization: Bearer {token}"

# Update consent
curl -X PUT http://localhost:3000/api/v1/compliance/consent \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"marketing_consent": false}'

# Export user data
curl -X GET http://localhost:3000/api/v1/compliance/export \
  -H "Authorization: Bearer {token}"
```

---

## Rollback Plan

If you need to rollback this migration:

```sql
-- Remove added columns from users
ALTER TABLE "users" DROP COLUMN "marketing_consent";
ALTER TABLE "users" DROP COLUMN "data_processing_consent";
ALTER TABLE "users" DROP COLUMN "cookie_consent";
ALTER TABLE "users" DROP COLUMN "consent_updated_at";
ALTER TABLE "users" DROP COLUMN "is_deleted";
ALTER TABLE "users" DROP COLUMN "deleted_at";

-- Revert audit_logs changes
ALTER TABLE "audit_logs" DROP COLUMN "details";
ALTER TABLE "audit_logs" DROP COLUMN "status";
ALTER TABLE "audit_logs" DROP COLUMN "timestamp";
ALTER TABLE "audit_logs" RENAME COLUMN "resource_type" TO "entity_type";
ALTER TABLE "audit_logs" RENAME COLUMN "resource_id" TO "entity_id";
ALTER TABLE "audit_logs" ADD COLUMN "old_values" JSONB;
ALTER TABLE "audit_logs" ADD COLUMN "new_values" JSONB;

-- Remove indexes
DROP INDEX IF EXISTS "audit_logs_action_idx";
DROP INDEX IF EXISTS "audit_logs_timestamp_idx";
DROP INDEX IF EXISTS "audit_logs_resource_type_idx";
```

---

## Data Impact

### Existing Users
- All will have `marketing_consent = false`
- All will have `data_processing_consent = true`
- All will have `cookie_consent = false`
- All will have `is_deleted = false`

### Existing Audit Logs
⚠️ **Warning**: The audit logs table structure changes are **destructive**. Existing audit logs will lose `old_values` and `new_values` data.

**Recommendation**: If you need to preserve old audit log data:
1. Backup the table first: `CREATE TABLE audit_logs_backup AS SELECT * FROM audit_logs;`
2. Run migration
3. Manually migrate critical old data if needed

---

## Compliance Checklist

After migration:

- [ ] Migration applied successfully
- [ ] Prisma client regenerated
- [ ] Server restarted
- [ ] GDPR endpoints tested
- [ ] Consent management working
- [ ] Data export functional
- [ ] Audit logging verified
- [ ] Privacy policy updated
- [ ] Cookie banner implemented (frontend)
- [ ] Users notified of new data policies

---

## Production Deployment

### Before Deploying

1. **Backup Database**:
   ```bash
   pg_dump -U user -d database > backup_before_gdpr_$(date +%Y%m%d).sql
   ```

2. **Test in Staging**:
   - Apply migration to staging environment
   - Run full test suite
   - Verify all GDPR features work

3. **Schedule Maintenance Window**:
   - Migration is fast but requires brief downtime
   - Recommended: Off-peak hours

### Deployment Steps

1. **Put application in maintenance mode**
2. **Backup production database**
3. **Apply migration**: `npx prisma migrate deploy`
4. **Restart application**
5. **Verify health**: Check `/api/v1/health`
6. **Test GDPR endpoints**
7. **Remove maintenance mode**

### Post-Deployment

1. Monitor error logs for 24 hours
2. Check audit log creation
3. Verify user consent updates
4. Monitor database performance

---

## Support

If migration fails:
1. Check database connection
2. Verify user permissions (CREATE, ALTER, INDEX)
3. Review error logs
4. Rollback if necessary
5. Contact database administrator

---

**Created**: December 14, 2025  
**Migration Type**: Schema Addition (Non-breaking)  
**Estimated Time**: < 1 minute  
**Risk Level**: Low (additive changes only for users table)
