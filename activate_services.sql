-- Activate all services and categories
UPDATE "services" SET is_active = true WHERE is_active = false;
UPDATE "categories" SET is_active = true WHERE is_active = false;

-- Verify the changes
SELECT COUNT(*) as active_services FROM "services" WHERE is_active = true;
SELECT COUNT(*) as active_categories FROM "categories" WHERE is_active = true;
