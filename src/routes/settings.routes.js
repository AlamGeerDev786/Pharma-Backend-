import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import {
  updatePharmacy, getUsers, createUser, updateUser, updateProfile,
  getCustomers, createCustomer,
} from '../controllers/settings.controller.js';

const router = Router();

router.use(authenticate);

// Pharmacy settings (admin only)
router.put('/pharmacy', authorize('ADMIN'), updatePharmacy);

// Profile (any logged-in user)
router.put('/profile', updateProfile);

// Team management (admin only)
router.get('/users', getUsers);
router.post('/users', authorize('ADMIN'), createUser);
router.put('/users/:id', authorize('ADMIN'), updateUser);

// Customers (all roles)
router.get('/customers', getCustomers);
router.post('/customers', createCustomer);

export default router;
