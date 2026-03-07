import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { createSale, getSales, getSale, refundSale } from '../controllers/sale.controller.js';

const router = Router();

router.use(authenticate);

router.post('/', createSale);
router.get('/', getSales);
router.get('/:id', getSale);
router.post('/:id/refund', authorize('ORG_ADMIN', 'ADMIN'), refundSale);

export default router;
