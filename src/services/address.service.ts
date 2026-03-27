import prisma from '../config/database';
import { NotFoundError } from '../utils/errors';
import crypto from 'crypto';

export interface AddressData {
    id: string;
    type: string;
    address_line1: string;
    address_line2?: string;
    landmark?: string;
    city: string;
    state: string;
    postal_code: string;
    latitude?: number;
    longitude?: number;
    is_default: boolean;
    created_at: string;
}

export class AddressService {
    private async getProfile(userId: string) {
        let profile = await prisma.profile.findUnique({
            where: { user_id: userId }
        });

        if (!profile) {
            // Create a blank profile if it doesn't exist to store addresses
            profile = await prisma.profile.create({
                data: { user_id: userId }
            });
        }
        return profile;
    }

    private parseAddresses(addressField: string | null): AddressData[] {
        if (!addressField) return [];
        try {
            const parsed = JSON.parse(addressField);
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            // If existing data is a plain string (old format), convert to first entry
            return [{
                id: crypto.randomUUID(),
                type: 'Home',
                address_line1: addressField,
                city: 'Unknown',
                state: 'Unknown',
                postal_code: '000000',
                is_default: true,
                created_at: new Date().toISOString()
            }];
        }
    }

    async createAddress(userId: string, data: any) {
        const profile = await this.getProfile(userId);
        let addresses = this.parseAddresses(profile.address);

        if (data.is_default) {
            addresses = addresses.map(a => ({ ...a, is_default: false }));
        }

        const newAddress: AddressData = {
            id: crypto.randomUUID(),
            type: data.type || 'Home',
            address_line1: data.address_line1,
            address_line2: data.address_line2,
            landmark: data.landmark,
            city: data.city,
            state: data.state,
            postal_code: data.postal_code,
            latitude: data.latitude,
            longitude: data.longitude,
            is_default: data.is_default || addresses.length === 0,
            created_at: new Date().toISOString()
        };

        addresses.push(newAddress);

        await prisma.profile.update({
            where: { user_id: userId },
            data: { address: JSON.stringify(addresses) }
        });

        return newAddress;
    }

    async getAddresses(userId: string) {
        const profile = await this.getProfile(userId);
        return this.parseAddresses(profile.address).sort((a, b) => 
            a.is_default === b.is_default ? 0 : a.is_default ? -1 : 1
        );
    }

    async updateAddress(addressId: string, userId: string, data: any) {
        const profile = await this.getProfile(userId);
        let addresses = this.parseAddresses(profile.address);
        
        const index = addresses.findIndex(a => a.id === addressId);
        if (index === -1) throw new NotFoundError('Address not found');

        if (data.is_default) {
            addresses = addresses.map(a => ({ ...a, is_default: false }));
        }

        addresses[index] = {
            ...addresses[index],
            ...data
        };

        await prisma.profile.update({
            where: { user_id: userId },
            data: { address: JSON.stringify(addresses) }
        });

        return addresses[index];
    }

    async deleteAddress(addressId: string, userId: string) {
        const profile = await this.getProfile(userId);
        let addresses = this.parseAddresses(profile.address);
        
        const newAddresses = addresses.filter(a => a.id !== addressId);
        if (newAddresses.length === addresses.length) throw new NotFoundError('Address not found');

        // If we deleted a default, make the first one left the default
        if (addresses.find(a => a.id === addressId)?.is_default && newAddresses.length > 0) {
            newAddresses[0].is_default = true;
        }

        await prisma.profile.update({
            where: { user_id: userId },
            data: { address: JSON.stringify(newAddresses) }
        });

        return { message: 'Address removed successfully' };
    }
}
