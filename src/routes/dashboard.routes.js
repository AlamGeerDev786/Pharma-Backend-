import { Router } from 'express';
import { authenticate, branchContext } from '../middleware/auth.js';
import { getStats, getRevenue, getRecentSales, getAlerts } from '../controllers/dashboard.controller.js';

const router = Router();

router.use(authenticate);
router.use(branchContext);

router.get('/stats', getStats);
router.get('/revenue', getRevenue);
router.get('/recent-sales', getRecentSales);
router.get('/alerts', getAlerts);

export default router;
