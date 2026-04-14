import prisma from '../config/database';
import logger from '../utils/logger';

/**
 * Keys stored in platform_settings table
 */
export const SETTINGS_KEYS = {
    COMMISSION_RATE: 'commission_rate',       // e.g. "0.15" = 15%
    GST_RATE: 'gst_rate',                     // e.g. "0.18" = 18%
    GST_ENABLED: 'gst_enabled',              // "true" | "false"
    COMMISSION_LABEL: 'commission_label',     // Display label, e.g. "Platform Commission"
    GST_LABEL: 'gst_label',                  // Display label, e.g. "GST (18%)"
} as const;

const DEFAULTS: Record<string, string> = {
    [SETTINGS_KEYS.COMMISSION_RATE]: '0.15',
    [SETTINGS_KEYS.GST_RATE]: '0.18',
    [SETTINGS_KEYS.GST_ENABLED]: 'true',
    [SETTINGS_KEYS.COMMISSION_LABEL]: 'Platform Commission (15%)',
    [SETTINGS_KEYS.GST_LABEL]: 'GST (18%)',
};

export class PlatformSettingsService {

    /**
     * Get all platform settings as a key-value map
     */
    async getAllSettings(): Promise<Record<string, string>> {
        const rows = await prisma.platformSettings.findMany();
        const map: Record<string, string> = { ...DEFAULTS };
        rows.forEach(r => { map[r.key] = r.value; });
        return map;
    }

    /**
     * Get a single numeric setting (returns default if not set)
     */
    async getNumeric(key: string): Promise<number> {
        const row = await prisma.platformSettings.findUnique({ where: { key } });
        const val = row ? row.value : DEFAULTS[key] ?? '0';
        return parseFloat(val);
    }

    /**
     * Get a boolean setting
     */
    async getBool(key: string): Promise<boolean> {
        const row = await prisma.platformSettings.findUnique({ where: { key } });
        const val = row ? row.value : DEFAULTS[key] ?? 'true';
        return val === 'true';
    }

    /**
     * Get the commission and GST config used in earnings distribution
     */
    async getEarningsConfig(): Promise<{
        commissionRate: number;
        gstRate: number;
        gstEnabled: boolean;
    }> {
        const [commissionRate, gstRate, gstEnabled] = await Promise.all([
            this.getNumeric(SETTINGS_KEYS.COMMISSION_RATE),
            this.getNumeric(SETTINGS_KEYS.GST_RATE),
            this.getBool(SETTINGS_KEYS.GST_ENABLED),
        ]);
        return { commissionRate, gstRate, gstEnabled };
    }

    /**
     * Upsert a single setting
     */
    async upsertSetting(key: string, value: string, updatedBy: string, description?: string) {
        return prisma.platformSettings.upsert({
            where: { key },
            create: { key, value, description, updated_by: updatedBy },
            update: { value, description, updated_by: updatedBy },
        });
    }

    /**
     * Bulk update settings — used by admin panel
     */
    async updateSettings(
        updates: { key: string; value: string; description?: string }[],
        updatedBy: string
    ) {
        const results = await Promise.all(
            updates.map(u => this.upsertSetting(u.key, u.value, updatedBy, u.description))
        );
        logger.info(`Platform settings updated by ${updatedBy}: ${updates.map(u => u.key).join(', ')}`);
        return results;
    }

    /**
     * Seed defaults into DB if not already present (called on server boot)
     */
    async seedDefaults() {
        const existingKeys = await prisma.platformSettings.findMany({ select: { key: true } });
        const existing = new Set(existingKeys.map(r => r.key));

        const toCreate = Object.entries(DEFAULTS)
            .filter(([key]) => !existing.has(key))
            .map(([key, value]) => ({
                id: require('crypto').randomUUID(),
                key,
                value,
                description: `Default ${key.replace(/_/g, ' ')}`,
                updated_by: 'system',
            }));

        if (toCreate.length > 0) {
            await prisma.platformSettings.createMany({ data: toCreate });
            logger.info(`Seeded ${toCreate.length} default platform settings`);
        }
    }
}
