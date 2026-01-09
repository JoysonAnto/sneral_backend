import { Request, Response, NextFunction } from 'express';
import { KYCService } from '../services/kyc.service';
import { successResponse } from '../utils/response';

export class KYCController {
    private kycService: KYCService;

    constructor() {
        this.kycService = new KYCService();
    }

    submitKYC = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const files = req.files as { [fieldname: string]: Express.Multer.File[] };

            const documents: any = {};

            if (files.aadhaarFront) documents.aadhaarFront = files.aadhaarFront[0].filename;
            if (files.aadhaarBack) documents.aadhaarBack = files.aadhaarBack[0].filename;
            if (files.panCard) documents.panCard = files.panCard[0].filename;
            if (files.photo) documents.photo = files.photo[0].filename;
            if (files.bankProof) documents.bankProof = files.bankProof[0].filename;
            if (files.businessLicense) documents.businessLicense = files.businessLicense[0].filename;
            if (files.gstCertificate) documents.gstCertificate = files.gstCertificate[0].filename;

            const result = await this.kycService.submitKYC(
                req.user!.userId,
                documents,
                req.user!.role
            );

            res.status(201).json(successResponse(result, result.message));
        } catch (error) {
            next(error);
        }
    };

    getKYCStatus = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const status = await this.kycService.getKYCStatus(
                req.params.partnerId,
                req.user!.userId,
                req.user!.role
            );
            res.json(successResponse(status, 'KYC status retrieved successfully'));
        } catch (error) {
            next(error);
        }
    };

    verifyKYC = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { status, reason } = req.body;
            const result = await this.kycService.verifyKYC(
                req.params.partnerId,
                status,
                reason,
                req.user!.userId
            );
            res.json(successResponse(result, result.message));
        } catch (error) {
            next(error);
        }
    };
}
