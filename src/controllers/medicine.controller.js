import { z } from 'zod';
import prisma from '../config/database.js';
import { paginate, paginatedResponse } from '../utils/helpers.js';

const medicineSchema = z.object({
  name: z.string().min(1),
  genericName: z.string().optional(),
  categoryId: z.string().optional(),
  barcode: z.string().optional(),
  supplierId: z.string().optional(),
  unit: z.string().default('pcs'),
  minStock: z.number().int().min(0).default(10),
  description: z.string().optional(),
});

const batchSchema = z.object({
  batchNo: z.string().min(1),
  quantity: z.number().int().min(1),
  costPrice: z.number().min(0),
  sellPrice: z.number().min(0),
  expiryDate: z.string().transform((s) => new Date(s)),
});

// GET /api/medicines
export async function getMedicines(req, res, next) {
  try {
    const { skip, take, page, limit } = paginate(req.query);
    const { search, categoryId, supplierId, status } = req.query;
    const tid = req.tenantId;

    const where = { tenantId: tid, active: true };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { genericName: { contains: search, mode: 'insensitive' } },
        { barcode: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (categoryId) where.categoryId = categoryId;
    if (supplierId) where.supplierId = supplierId;

    const [medicines, total] = await Promise.all([
      prisma.medicine.findMany({
        where,
        skip,
        take,
        orderBy: { name: 'asc' },
        select: {
          id: true, name: true, genericName: true, barcode: true, unit: true, minStock: true,
          category: { select: { id: true, name: true } },
          supplier: { select: { id: true, name: true } },
          batches: {
            where: { quantity: { gt: 0 } },
            select: { id: true, batchNo: true, quantity: true, costPrice: true, sellPrice: true, expiryDate: true },
            orderBy: { expiryDate: 'asc' },
          },
        },
      }),
      prisma.medicine.count({ where }),
    ]);

    // Compute stock totals
    const data = medicines.map((m) => {
      const totalStock = m.batches.reduce((sum, b) => sum + b.quantity, 0);
      const nearestExpiry = m.batches[0]?.expiryDate || null;
      let stockStatus = 'in-stock';
      if (totalStock === 0) stockStatus = 'out-of-stock';
      else if (totalStock <= m.minStock) stockStatus = 'low-stock';

      if (status && stockStatus !== status) return null;

      return { ...m, totalStock, nearestExpiry, stockStatus };
    }).filter(Boolean);

    res.json(paginatedResponse(data, total, page, limit));
  } catch (err) {
    next(err);
  }
}

// GET /api/medicines/:id
export async function getMedicine(req, res, next) {
  try {
    const medicine = await prisma.medicine.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
      include: {
        category: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
        batches: {
          where: { quantity: { gt: 0 } },
          orderBy: { expiryDate: 'asc' },
        },
      },
    });
    if (!medicine) return res.status(404).json({ error: 'Medicine not found' });
    res.json(medicine);
  } catch (err) {
    next(err);
  }
}

// POST /api/medicines
export async function createMedicine(req, res, next) {
  try {
    const data = medicineSchema.parse(req.body);
    const batches = req.body.batches?.map((b) => batchSchema.parse(b)) || [];

    const medicine = await prisma.medicine.create({
      data: {
        ...data,
        tenantId: req.tenantId,
        batches: batches.length
          ? { create: batches.map((b) => ({ ...b, tenantId: req.tenantId })) }
          : undefined,
      },
      include: {
        category: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
        batches: true,
      },
    });
    res.status(201).json(medicine);
  } catch (err) {
    next(err);
  }
}

// PUT /api/medicines/:id
export async function updateMedicine(req, res, next) {
  try {
    const data = medicineSchema.partial().parse(req.body);
    const medicine = await prisma.medicine.updateMany({
      where: { id: req.params.id, tenantId: req.tenantId },
      data,
    });
    if (medicine.count === 0) return res.status(404).json({ error: 'Medicine not found' });

    const updated = await prisma.medicine.findUnique({
      where: { id: req.params.id },
      include: {
        category: { select: { id: true, name: true } },
        batches: { where: { quantity: { gt: 0 } }, orderBy: { expiryDate: 'asc' } },
      },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

// DELETE /api/medicines/:id  (soft delete)
export async function deleteMedicine(req, res, next) {
  try {
    const result = await prisma.medicine.updateMany({
      where: { id: req.params.id, tenantId: req.tenantId },
      data: { active: false },
    });
    if (result.count === 0) return res.status(404).json({ error: 'Medicine not found' });
    res.json({ message: 'Medicine deleted' });
  } catch (err) {
    next(err);
  }
}

// ─── Batch management ───

// POST /api/medicines/:id/batches
export async function addBatch(req, res, next) {
  try {
    const data = batchSchema.parse(req.body);
    const med = await prisma.medicine.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
    });
    if (!med) return res.status(404).json({ error: 'Medicine not found' });

    const batch = await prisma.batch.create({
      data: { ...data, medicineId: req.params.id, tenantId: req.tenantId },
    });
    res.status(201).json(batch);
  } catch (err) {
    next(err);
  }
}

// ─── Categories ───

// GET /api/categories
export async function getCategories(req, res, next) {
  try {
    const categories = await prisma.category.findMany({
      where: { tenantId: req.tenantId },
      orderBy: { name: 'asc' },
      select: {
        id: true, name: true,
        _count: { select: { medicines: true } },
      },
    });
    res.json(categories);
  } catch (err) {
    next(err);
  }
}

// POST /api/categories
export async function createCategory(req, res, next) {
  try {
    const { name } = z.object({ name: z.string().min(1) }).parse(req.body);
    const category = await prisma.category.create({
      data: { name, tenantId: req.tenantId },
    });
    res.status(201).json(category);
  } catch (err) {
    next(err);
  }
}
