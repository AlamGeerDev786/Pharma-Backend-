import { Router } from 'express';
import { authenticate, branchContext } from '../middleware/auth.js';
import { salesSummary, topSelling, inventoryHealth, expiryReport, profitReport } from '../controllers/report.controller.js';

const router = Router();

router.use(authenticate);
router.use(branchContext);

router.get('/sales-summary', salesSummary);
router.get('/top-selling', topSelling);
router.get('/inventory-health', inventoryHealth);
router.get('/expiry', expiryReport);
router.get('/profit', profitReport);

export default router;
