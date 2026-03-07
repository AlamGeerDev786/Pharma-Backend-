import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import {
  updateOrganization, updatePharmacy, getUsers, createUser, updateUser, updateProfile,
  getCustomers, createCustomer,
} from '../controllers/settings.controller.js';

const router = Router();

router.use(authenticate);

// Organization settings (ORG_ADMIN only)
router.put('/organization', authorize('ORG_ADMIN'), updateOrganization);

// Branch/Pharmacy settings (admin + org_admin)
router.put('/pharmacy', authorize('ORG_ADMIN', 'ADMIN'), updatePharmacy);

// Profile (any logged-in user)
router.put('/profile', updateProfile);

// Team management (admin + org_admin)
router.get('/users', getUsers);
router.post('/users', authorize('ORG_ADMIN', 'ADMIN'), createUser);
router.put('/users/:id', authorize('ORG_ADMIN', 'ADMIN'), updateUser);

// Customers (all roles)
router.get('/customers', getCustomers);
router.post('/customers', createCustomer);

export default router;
