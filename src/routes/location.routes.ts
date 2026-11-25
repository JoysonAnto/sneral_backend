import { Router } from 'express';
import LocationController from '../controllers/location.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { authorize } from '../middleware/role.middleware';
import prisma from '../config/database';

const router = Router();

// All location routes require authentication and admin role
router.use(authenticateToken);
router.use(authorize('ADMIN', 'SUPER_ADMIN'));

// Waitlist / Notify Requests
router.get('/waitlist', async (req, res) => {
    try {
        const { status, pincode } = req.query;
        const where: any = {};
        if (status && status !== 'ALL') where.status = String(status);
        if (pincode) where.pincode = { contains: String(pincode) };

        const [requests, totalCount] = await Promise.all([
            prisma.pincodeNotification.findMany({
                where,
                orderBy: { created_at: 'desc' },
                include: {
                    user: {
                        select: {
                            id: true,
                            full_name: true,
                            email: true,
                            phone_number: true
                        }
                    }
                }
            }),
            prisma.pincodeNotification.count({ where })
        ]);

        // Demand aggregation by pincode
        const demandByPincode: { [key: string]: { count: number, area?: string, district?: string } } = {};
        for (const r of requests) {
            if (!demandByPincode[r.pincode]) {
                demandByPincode[r.pincode] = {
                    count: 0,
                    area: r.area_name || undefined,
                    district: r.district_name || undefined
                };
            }
            demandByPincode[r.pincode].count += 1;
        }

        const aggregatedDemand = Object.entries(demandByPincode)
            .map(([code, data]) => ({
                pincode: code,
                requestCount: data.count,
                area: data.area,
                district: data.district
            }))
            .sort((a, b) => b.requestCount - a.requestCount);

        return res.json({
            success: true,
            data: {
                requests,
                total: totalCount,
                aggregatedDemand
            }
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve pincode waitlist',
            error: error.message
        });
    }
});

router.patch('/waitlist/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        const updated = await prisma.pincodeNotification.update({
            where: { id: req.params.id },
            data: { status: String(status) }
        });
        return res.json({
            success: true,
            data: updated,
            message: 'Status updated successfully'
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: 'Failed to update waitlist item status',
            error: error.message
        });
    }
});

// States
router.get('/states', LocationController.getAllStates);
router.get('/states/:id', LocationController.getStateById);
router.post('/states', LocationController.createState);
router.put('/states/:id', LocationController.updateState);

// Districts
router.get('/districts', LocationController.getAllDistricts);
router.get('/districts/:id', LocationController.getDistrictById);
router.post('/districts', LocationController.createDistrict);
router.put('/districts/:id', LocationController.updateDistrict);

// Areas
router.get('/areas', LocationController.getAllAreas);
router.get('/areas/:id', LocationController.getAreaById);
router.post('/areas', LocationController.createArea);
router.put('/areas/:id', LocationController.updateArea);

// Hierarchy
router.get('/hierarchy', LocationController.getLocationHierarchy);

export default router;
