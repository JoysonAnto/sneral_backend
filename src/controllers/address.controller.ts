import { Request, Response, NextFunction } from 'express';
import { AddressService } from '../services/address.service';
import { successResponse } from '../utils/response';

export class AddressController {
    private addressService: AddressService;

    constructor() {
        this.addressService = new AddressService();
    }

    createAddress = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const address = await this.addressService.createAddress(req.user!.userId, req.body);
            res.status(201).json(successResponse(address, 'Address saved successfully'));
        } catch (error) {
            next(error);
        }
    };

    getAddresses = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const addresses = await this.addressService.getAddresses(req.user!.userId);
            res.json(successResponse(addresses, 'Addresses retrieved successfully'));
        } catch (error) {
            next(error);
        }
    };

    updateAddress = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const address = await this.addressService.updateAddress(req.params.id, req.user!.userId, req.body);
            res.json(successResponse(address, 'Address updated successfully'));
        } catch (error) {
            next(error);
        }
    };

    deleteAddress = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await this.addressService.deleteAddress(req.params.id, req.user!.userId);
            res.json(successResponse(null, result.message));
        } catch (error) {
            next(error);
        }
    };
}
