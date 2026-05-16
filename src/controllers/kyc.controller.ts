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

            // Handle both camelCase and snake_case field names from Multer
            if (files.aadhaarFront) documents.aadhaarFront = files.aadhaarFront[0].filename;
            else if (files.aadhaar_front) documents.aadhaarFront = files.aadhaar_front[0].filename;

            if (files.aadhaarBack) documents.aadhaarBack = files.aadhaarBack[0].filename;
            else if (files.aadhaar_back) documents.aadhaarBack = files.aadhaar_back[0].filename;

            if (files.panCard) documents.panCard = files.panCard[0].filename;
            else if (files.pan_card) documents.panCard = files.pan_card[0].filename;

            if (files.photo) documents.photo = files.photo[0].filename;

            if (files.bankProof) documents.bankProof = files.bankProof[0].filename;
            else if (files.bank_proof) documents.bankProof = files.bank_proof[0].filename;
            else if (files.bank_passbook) documents.bankProof = files.bank_passbook[0].filename;

            if (files.businessLicense) documents.businessLicense = files.businessLicense[0].filename;
            if (files.gstCertificate) documents.gstCertificate = files.gstCertificate[0].filename;

            const result = await this.kycService.submitKYC(
                req.user!.userId,
                documents,
                req.user!.role as 'SERVICE_PARTNER' | 'BUSINESS_PARTNER'
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

    getPendingKYCs = async (_req: Request, res: Response, next: NextFunction) => {
        try {
            const partners = await this.kycService.getPendingKYCs();
            res.json(successResponse(partners, 'Pending partners retrieved successfully'));
        } catch (error) {
            next(error);
        }
    };

    getMyKYCStatus = async (req: Request, res: Response, next: NextFunction) => {
        try {
            // Use the authenticated user's ID as the partnerId (the service handles lookup by UserID)
            const status = await this.kycService.getKYCStatus(
                req.user!.userId,
                req.user!.userId,
                req.user!.role
            );
            res.json(successResponse(status, 'Your KYC status retrieved successfully'));
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

    approveDocument = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await this.kycService.verifyKYCDocument(
                req.params.id,
                'APPROVED',
                undefined,
                req.user!.userId
            );
            res.json(successResponse(result, 'Document approved successfully'));
        } catch (error) {
            next(error);
        }
    };

    rejectDocument = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { reason } = req.body;
            const result = await this.kycService.verifyKYCDocument(
                req.params.id,
                'REJECTED',
                reason,
                req.user!.userId
            );
            res.json(successResponse(result, 'Document rejected successfully'));
        } catch (error) {
            next(error);
        }
    };

    verifyEkoPan = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { panNumber, fullName } = req.body;
            const result = await this.kycService.verifyEkoPan(
                req.user!.userId,
                panNumber,
                fullName
            );
            res.json(successResponse(result, 'PAN verification processed'));
        } catch (error) {
            next(error);
        }
    };

    verifyEkoBank = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { accountNumber, ifscCode } = req.body;
            const result = await this.kycService.verifyEkoBank(
                req.user!.userId,
                accountNumber,
                ifscCode
            );
            res.json(successResponse(result, 'Bank verification processed (Penny Drop)'));
        } catch (error) {
            next(error);
        }
    };
}
