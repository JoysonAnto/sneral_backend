import { Client, TravelMode, UnitSystem } from '@googlemaps/google-maps-services-js';
import { logger } from '../utils/logger';

interface Location {
    latitude: number;
    longitude: number;
}

interface GeocodeResponse {
    latitude: number;
    longitude: number;
    formattedAddress: string;
    placeId: string;
    addressComponents: any[];
}

interface DistanceResult {
    distance: {
        text: string;
        value: number; // meters
    };
    duration: {
        text: string;
        value: number; // seconds
    };
}

class GoogleMapsService {
    private client: Client;
    private apiKey: string;

    constructor() {
        this.apiKey = process.env.GOOGLE_MAPS_API_KEY || '';

        if (!this.apiKey) {
            logger.warn('Google Maps API key not configured');
        }

        this.client = new Client({});
    }

    /**
     * Geocode an address to get coordinates
     */
    async geocodeAddress(address: string): Promise<GeocodeResponse | null> {
        if (!this.apiKey) {
            throw new Error('Google Maps API key not configured');
        }

        try {
            const response = await this.client.geocode({
                params: {
                    address,
                    key: this.apiKey,
                },
            });

            if (response.data.results && response.data.results.length > 0) {
                const result = response.data.results[0];

                return {
                    latitude: result.geometry.location.lat,
                    longitude: result.geometry.location.lng,
                    formattedAddress: result.formatted_address,
                    placeId: result.place_id,
                    addressComponents: result.address_components,
                };
            }

            return null;
        } catch (error) {
            logger.error('Geocoding error:', error);
            throw new Error('Failed to geocode address');
        }
    }

    /**
     * Reverse geocode coordinates to get address
     */
    async reverseGeocode(latitude: number, longitude: number): Promise<string | null> {
        if (!this.apiKey) {
            throw new Error('Google Maps API key not configured');
        }

        try {
            const response = await this.client.reverseGeocode({
                params: {
                    latlng: { lat: latitude, lng: longitude },
                    key: this.apiKey,
                },
            });

            if (response.data.results && response.data.results.length > 0) {
                return response.data.results[0].formatted_address;
            }

            return null;
        } catch (error) {
            logger.error('Reverse geocoding error:', error);
            throw new Error('Failed to reverse geocode coordinates');
        }
    }

    /**
     * Calculate distance and duration between two locations
     */
    async calculateDistance(
        origin: Location,
        destination: Location
    ): Promise<DistanceResult | null> {
        if (!this.apiKey) {
            throw new Error('Google Maps API key not configured');
        }

        try {
            const response = await this.client.distancematrix({
                params: {
                    origins: [`${origin.latitude},${origin.longitude}`],
                    destinations: [`${destination.latitude},${destination.longitude}`],
                    key: this.apiKey,
                    mode: TravelMode.driving,
                    units: UnitSystem.metric,
                },
            });

            if (
                response.data.rows &&
                response.data.rows.length > 0 &&
                response.data.rows[0].elements &&
                response.data.rows[0].elements.length > 0
            ) {
                const element = response.data.rows[0].elements[0];

                if (element.status === 'OK') {
                    return {
                        distance: element.distance,
                        duration: element.duration,
                    };
                }
            }

            return null;
        } catch (error) {
            logger.error('Distance calculation error:', error);
            throw new Error('Failed to calculate distance');
        }
    }

    /**
     * Calculate distances from one origin to multiple destinations
     */
    async calculateMultipleDistances(
        origin: Location,
        destinations: Location[]
    ): Promise<DistanceResult[]> {
        if (!this.apiKey) {
            throw new Error('Google Maps API key not configured');
        }

        try {
            const destStrings = destinations.map(
                (dest) => `${dest.latitude},${dest.longitude}`
            );

            const response = await this.client.distancematrix({
                params: {
                    origins: [`${origin.latitude},${origin.longitude}`],
                    destinations: destStrings,
                    key: this.apiKey,
                    mode: TravelMode.driving,
                    units: UnitSystem.metric,
                },
            });

            const results: DistanceResult[] = [];

            if (response.data.rows && response.data.rows.length > 0) {
                const elements = response.data.rows[0].elements;

                elements.forEach((element) => {
                    if (element.status === 'OK') {
                        results.push({
                            distance: element.distance,
                            duration: element.duration,
                        });
                    }
                });
            }

            return results;
        } catch (error) {
            logger.error('Multiple distance calculation error:', error);
            throw new Error('Failed to calculate distances');
        }
    }

    /**
     * Validate and normalize an address
     */
    async validateAddress(address: string): Promise<{
        isValid: boolean;
        suggestion?: string;
        geocoded?: GeocodeResponse;
    }> {
        try {
            const geocoded = await this.geocodeAddress(address);

            if (geocoded) {
                return {
                    isValid: true,
                    suggestion: geocoded.formattedAddress,
                    geocoded,
                };
            }

            return { isValid: false };
        } catch (error) {
            return { isValid: false };
        }
    }

    /**
     * Get place details by Place ID
     */
    async getPlaceDetails(placeId: string): Promise<any> {
        if (!this.apiKey) {
            throw new Error('Google Maps API key not configured');
        }

        try {
            const response = await this.client.placeDetails({
                params: {
                    place_id: placeId,
                    key: this.apiKey,
                },
            });

            return response.data.result;
        } catch (error) {
            logger.error('Place details error:', error);
            throw new Error('Failed to get place details');
        }
    }

    /**
     * Calculate approximate travel time in minutes
     */
    async getTravelTime(origin: Location, destination: Location): Promise<number> {
        const result = await this.calculateDistance(origin, destination);

        if (result) {
            // Convert seconds to minutes and round up
            return Math.ceil(result.duration.value / 60);
        }

        return 0;
    }
}

export default new GoogleMapsService();
