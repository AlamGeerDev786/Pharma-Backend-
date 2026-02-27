import { z } from 'zod';
import prisma from '../config/database.js';
import { paginate, paginatedResponse } from '../utils/helpers.js';

const supplierSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().optional(),
  company: z.string().optional(),
});

// GET /api/suppliers
export async function getSuppliers(req, res, next) {
  try {
    const { skip, take, page, limit } = paginate(req.query);
    const { search } = req.query;
    const tid = req.tenantId;

    const where = { tenantId: tid, active: true };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { company: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [suppliers, total] = await Promise.all([
      prisma.supplier.findMany({
        where,
        skip,
        take,
        orderBy: { name: 'asc' },
        select: {
          id: true, name: true, phone: true, email: true, address: true, company: true,
          _count: { select: { purchases: true, medicines: true } },
        },
      }),
      prisma.supplier.count({ where }),
    ]);

    res.json(paginatedResponse(suppliers, total, page, limit));
  } catch (err) {
    next(err);
  }
}

// GET /api/suppliers/:id
export async function getSupplier(req, res, next) {
  try {
    const supplier = await prisma.supplier.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
      include: {
        purchases: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: { id: true, invoiceNo: true, total: true, status: true, createdAt: true },
        },
        _count: { select: { purchases: true, medicines: true } },
      },
    });
    if (!supplier) return res.status(404).json({ error: 'Supplier not found' });
    res.json(supplier);
  } catch (err) {
    next(err);
  }
}

// POST /api/suppliers
export async function createSupplier(req, res, next) {
  try {
    const data = supplierSchema.parse(req.body);
    const supplier = await prisma.supplier.create({
      data: { ...data, tenantId: req.tenantId },
    });
    res.status(201).json(supplier);
  } catch (err) {
    next(err);
  }
}

// PUT /api/suppliers/:id
export async function updateSupplier(req, res, next) {
  try {
    const data = supplierSchema.partial().parse(req.body);
    const result = await prisma.supplier.updateMany({
      where: { id: req.params.id, tenantId: req.tenantId },
      data,
    });
    if (result.count === 0) return res.status(404).json({ error: 'Supplier not found' });

    const supplier = await prisma.supplier.findUnique({ where: { id: req.params.id } });
    res.json(supplier);
  } catch (err) {
    next(err);
  }
}

// DELETE /api/suppliers/:id (soft delete)
export async function deleteSupplier(req, res, next) {
  try {
    const result = await prisma.supplier.updateMany({
      where: { id: req.params.id, tenantId: req.tenantId },
      data: { active: false },
    });
    if (result.count === 0) return res.status(404).json({ error: 'Supplier not found' });
    res.json({ message: 'Supplier deleted' });
  } catch (err) {
    next(err);
  }
}
