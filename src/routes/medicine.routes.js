import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import {
  getMedicines, getMedicine, createMedicine, updateMedicine, deleteMedicine,
  addBatch, getCategories, createCategory,
} from '../controllers/medicine.controller.js';

const router = Router();

router.use(authenticate);

router.get('/', getMedicines);
router.get('/:id', getMedicine);
router.post('/', authorize('ADMIN', 'PHARMACIST'), createMedicine);
router.put('/:id', authorize('ADMIN', 'PHARMACIST'), updateMedicine);
router.delete('/:id', authorize('ADMIN'), deleteMedicine);
router.post('/:id/batches', authorize('ADMIN', 'PHARMACIST'), addBatch);

export default router;

// Category routes exported separately
export const categoryRouter = Router();
categoryRouter.use(authenticate);
categoryRouter.get('/', getCategories);
categoryRouter.post('/', authorize('ADMIN', 'PHARMACIST'), createCategory);
