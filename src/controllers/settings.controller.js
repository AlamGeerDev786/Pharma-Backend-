import { z } from 'zod';
import bcrypt from 'bcryptjs';
import prisma from '../config/database.js';

// ─── Tenant/Pharmacy Settings ───

const updateTenantSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  license: z.string().optional(),
  currency: z.string().optional(),
  locale: z.string().optional(),
});

// PUT /api/settings/pharmacy
export async function updatePharmacy(req, res, next) {
  try {
    const data = updateTenantSchema.parse(req.body);
    const tenant = await prisma.tenant.update({
      where: { id: req.tenantId },
      data,
      select: { id: true, name: true, phone: true, email: true, address: true, license: true, currency: true, locale: true, plan: true },
    });
    res.json(tenant);
  } catch (err) {
    next(err);
  }
}

// ─── User/Team Management ───

const createUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['ADMIN', 'PHARMACIST', 'CASHIER']).default('PHARMACIST'),
  phone: z.string().optional(),
});

const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  role: z.enum(['ADMIN', 'PHARMACIST', 'CASHIER']).optional(),
  phone: z.string().optional(),
  active: z.boolean().optional(),
});

// GET /api/settings/users
export async function getUsers(req, res, next) {
  try {
    const users = await prisma.user.findMany({
      where: { tenantId: req.tenantId },
      select: { id: true, name: true, email: true, role: true, phone: true, active: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    res.json(users);
  } catch (err) {
    next(err);
  }
}

// POST /api/settings/users
export async function createUser(req, res, next) {
  try {
    const data = createUserSchema.parse(req.body);
    const hashedPassword = await bcrypt.hash(data.password, 10);

    const user = await prisma.user.create({
      data: { ...data, password: hashedPassword, tenantId: req.tenantId },
      select: { id: true, name: true, email: true, role: true, phone: true, active: true, createdAt: true },
    });
    res.status(201).json(user);
  } catch (err) {
    next(err);
  }
}

// PUT /api/settings/users/:id
export async function updateUser(req, res, next) {
  try {
    const data = updateUserSchema.parse(req.body);
    const result = await prisma.user.updateMany({
      where: { id: req.params.id, tenantId: req.tenantId },
      data,
    });
    if (result.count === 0) return res.status(404).json({ error: 'User not found' });

    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: { id: true, name: true, email: true, role: true, phone: true, active: true },
    });
    res.json(user);
  } catch (err) {
    next(err);
  }
}

// PUT /api/settings/profile — Update own profile
export async function updateProfile(req, res, next) {
  try {
    const schema = z.object({
      name: z.string().min(2).optional(),
      phone: z.string().optional(),
      currentPassword: z.string().optional(),
      newPassword: z.string().min(6).optional(),
    });
    const data = schema.parse(req.body);

    if (data.newPassword) {
      if (!data.currentPassword) {
        return res.status(400).json({ error: 'Current password is required to change password' });
      }
      const user = await prisma.user.findUnique({ where: { id: req.user.id } });
      if (!(await bcrypt.compare(data.currentPassword, user.password))) {
        return res.status(400).json({ error: 'Current password is incorrect' });
      }
      data.password = await bcrypt.hash(data.newPassword, 10);
    }

    const { currentPassword, newPassword, ...updateData } = data;
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: updateData,
      select: { id: true, name: true, email: true, role: true, phone: true },
    });
    res.json(user);
  } catch (err) {
    next(err);
  }
}

// ─── Customers ───

// GET /api/customers
export async function getCustomers(req, res, next) {
  try {
    const { search } = req.query;
    const where = { tenantId: req.tenantId };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    const customers = await prisma.customer.findMany({
      where,
      take: 50,
      orderBy: { name: 'asc' },
      select: { id: true, name: true, phone: true, email: true },
    });
    res.json(customers);
  } catch (err) {
    next(err);
  }
}

// POST /api/customers
export async function createCustomer(req, res, next) {
  try {
    const schema = z.object({
      name: z.string().min(1),
      phone: z.string().optional(),
      email: z.string().email().optional().or(z.literal('')),
      address: z.string().optional(),
    });
    const data = schema.parse(req.body);
    const customer = await prisma.customer.create({
      data: { ...data, tenantId: req.tenantId },
    });
    res.status(201).json(customer);
  } catch (err) {
    next(err);
  }
}
