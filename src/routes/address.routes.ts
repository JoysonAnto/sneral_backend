import { Router } from 'express';
import { AddressController } from '../controllers/address.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();
const addressController = new AddressController();

// Use authentication for all address routes
router.use(authenticateToken);

/**
 * @route GET /api/v1/addresses
 * @desc Get all saved addresses for the current user
 */
router.get('/', addressController.getAddresses);

/**
 * @route POST /api/v1/addresses
 * @desc Create a new saved address
 */
router.post('/', addressController.createAddress);

/**
 * @route PATCH /api/v1/addresses/:id
 * @desc Update an existing saved address
 */
router.patch('/:id', addressController.updateAddress);

/**
 * @route DELETE /api/v1/addresses/:id
 * @desc Delete a saved address
 */
router.delete('/:id', addressController.deleteAddress);

export default router;
