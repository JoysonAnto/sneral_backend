import * as h3 from 'h3-js';
import logger from './logger';

export class SpatialHexHelper {
    /**
     * Default H3 resolution: 7 corresponds to ~1.2 km edge length / ~5.16 km² area
     * Resolution 8 is ~461m edge length / ~0.73 km² area
     */
    public static readonly DEFAULT_RESOLUTION = 7;

    /**
     * Convert Latitude & Longitude to Hexagonal Grid Index
     */
    public static latLngToHex(lat: number, lng: number, resolution = SpatialHexHelper.DEFAULT_RESOLUTION): string {
        try {
            return h3.latLngToCell(lat, lng, resolution);
        } catch (error) {
            logger.warn(`Failed to compute H3 hex index for (${lat}, ${lng}):`, error);
            // Fallback pseudo-hex indexing based on 0.015 degree quantization (~1.6 km)
            const q = Math.round(lat / 0.015);
            const r = Math.round(lng / 0.015);
            return `hex_${resolution}_${q}_${r}`;
        }
    }

    /**
     * Get the Hexagonal cell plus neighboring concentric rings of hexagons (k-ring disk)
     */
    public static getHexNeighbors(hexIndex: string, ringSize = 1): string[] {
        try {
            if (h3.isValidCell(hexIndex)) {
                return h3.gridDisk(hexIndex, ringSize);
            }
        } catch (error) {
            logger.warn(`Failed to compute grid disk for ${hexIndex}:`, error);
        }
        return [hexIndex];
    }

    /**
     * Destination Mode / "Go to Home Location" Check:
     * Returns true if taking this booking brings the partner closer to their home
     * or is within an acceptable detour radius towards home.
     */
    public static isTowardsHome(
        currentLat: number,
        currentLng: number,
        bookingLat: number,
        bookingLng: number,
        homeLat: number,
        homeLng: number
    ): boolean {
        const currentToHome = SpatialHexHelper.haversineDistance(currentLat, currentLng, homeLat, homeLng);
        const bookingToHome = SpatialHexHelper.haversineDistance(bookingLat, bookingLng, homeLat, homeLng);
        const currentToBooking = SpatialHexHelper.haversineDistance(currentLat, currentLng, bookingLat, bookingLng);

        // If booking is within 3 km of partner and closer to home than current location, or within 2 km of home
        if (bookingToHome <= currentToHome + 1.0) {
            return true;
        }

        // Triangle check: (current -> booking + booking -> home) should not add more than 30% detour
        const detour = (currentToBooking + bookingToHome) - currentToHome;
        return detour <= 2.5; // Max 2.5 km detour allowed on the way home
    }

    /**
     * Standard Haversine distance in kilometers
     */
    public static haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
        const R = 6371; // km
        const dLat = (lat2 - lat1) * (Math.PI / 180);
        const dLon = (lon2 - lon1) * (Math.PI / 180);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * (Math.PI / 180)) *
            Math.cos(lat2 * (Math.PI / 180)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }
}
