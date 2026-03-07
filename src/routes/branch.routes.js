import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import {
  getBranches, getBranch, createBranch, updateBranch, toggleBranch,
  createTransfer, getTransfers, getTransfer,
  approveTransfer, completeTransfer, rejectTransfer,
} from '../controllers/branch.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ─── Branch CRUD (ORG_ADMIN only) ───
router.get('/', authorize('ORG_ADMIN'), getBranches);
router.get('/:id', authorize('ORG_ADMIN'), getBranch);
router.post('/', authorize('ORG_ADMIN'), createBranch);
router.put('/:id', authorize('ORG_ADMIN'), updateBranch);
router.put('/:id/toggle', authorize('ORG_ADMIN'), toggleBranch);

// ─── Stock Transfers ───
router.get('/transfers/list', authorize('ORG_ADMIN', 'ADMIN'), getTransfers);
router.get('/transfers/:id', authorize('ORG_ADMIN', 'ADMIN'), getTransfer);
router.post('/transfers', authorize('ORG_ADMIN', 'ADMIN'), createTransfer);
router.put('/transfers/:id/approve', authorize('ORG_ADMIN'), approveTransfer);
router.put('/transfers/:id/complete', authorize('ORG_ADMIN'), completeTransfer);
router.put('/transfers/:id/reject', authorize('ORG_ADMIN'), rejectTransfer);

export default router;
