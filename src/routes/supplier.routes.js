import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { getSuppliers, getSupplier, createSupplier, updateSupplier, deleteSupplier } from '../controllers/supplier.controller.js';

const router = Router();

router.use(authenticate);

router.get('/', getSuppliers);
router.get('/:id', getSupplier);
router.post('/', authorize('ORG_ADMIN', 'ADMIN', 'PHARMACIST'), createSupplier);
router.put('/:id', authorize('ORG_ADMIN', 'ADMIN', 'PHARMACIST'), updateSupplier);
router.delete('/:id', authorize('ORG_ADMIN', 'ADMIN'), deleteSupplier);

export default router;
