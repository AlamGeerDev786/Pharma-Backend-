import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { createPurchase, receivePurchase, getPurchases, getPurchase } from '../controllers/purchase.controller.js';

const router = Router();

router.use(authenticate);

router.post('/', authorize('ORG_ADMIN', 'ADMIN', 'PHARMACIST'), createPurchase);
router.put('/:id/receive', authorize('ORG_ADMIN', 'ADMIN', 'PHARMACIST'), receivePurchase);
router.get('/', getPurchases);
router.get('/:id', getPurchase);

export default router;
