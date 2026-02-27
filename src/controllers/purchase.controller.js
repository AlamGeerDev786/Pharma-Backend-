import { z } from 'zod';
import prisma from '../config/database.js';
import { paginate, paginatedResponse, generateInvoiceNo } from '../utils/helpers.js';

const createPurchaseSchema = z.object({
  supplierId: z.string(),
  notes: z.string().optional(),
  items: z.array(z.object({
    name: z.string(),
    quantity: z.number().int().min(1),
    costPrice: z.number().min(0),
  })).min(1),
});

const receivePurchaseSchema = z.object({
  items: z.array(z.object({
    purchaseItemId: z.string(),
    medicineId: z.string(),
    batchNo: z.string(),
    quantity: z.number().int().min(1),
    costPrice: z.number().min(0),
    sellPrice: z.number().min(0),
    expiryDate: z.string().transform((s) => new Date(s)),
  })).min(1),
});

// POST /api/purchases
export async function createPurchase(req, res, next) {
  try {
    const data = createPurchaseSchema.parse(req.body);
    const tid = req.tenantId;

    const items = data.items.map((i) => ({
      name: i.name,
      quantity: i.quantity,
      costPrice: i.costPrice,
      total: i.quantity * i.costPrice,
    }));
    const total = items.reduce((sum, i) => sum + i.total, 0);

    const purchase = await prisma.purchase.create({
      data: {
        tenantId: tid,
        supplierId: data.supplierId,
        invoiceNo: generateInvoiceNo('PO'),
        total,
        notes: data.notes,
        items: { create: items },
      },
      include: { items: true, supplier: { select: { name: true } } },
    });

    res.status(201).json(purchase);
  } catch (err) {
    next(err);
  }
}

// PUT /api/purchases/:id/receive — Receive goods & update stock
export async function receivePurchase(req, res, next) {
  try {
    const data = receivePurchaseSchema.parse(req.body);
    const tid = req.tenantId;

    const purchase = await prisma.purchase.findFirst({
      where: { id: req.params.id, tenantId: tid, status: 'PENDING' },
    });
    if (!purchase) return res.status(404).json({ error: 'Purchase not found or already received' });

    await prisma.$transaction(async (tx) => {
      for (const item of data.items) {
        const batch = await tx.batch.create({
          data: {
            tenantId: tid,
            medicineId: item.medicineId,
            batchNo: item.batchNo,
            quantity: item.quantity,
            costPrice: item.costPrice,
            sellPrice: item.sellPrice,
            expiryDate: item.expiryDate,
          },
        });

        await tx.purchaseItem.update({
          where: { id: item.purchaseItemId },
          data: { batchId: batch.id },
        });
      }

      await tx.purchase.update({
        where: { id: purchase.id },
        data: { status: 'RECEIVED' },
      });
    });

    res.json({ message: 'Purchase received, stock updated' });
  } catch (err) {
    next(err);
  }
}

// GET /api/purchases
export async function getPurchases(req, res, next) {
  try {
    const { skip, take, page, limit } = paginate(req.query);
    const { status, supplierId, from, to } = req.query;
    const tid = req.tenantId;

    const where = { tenantId: tid };
    if (status) where.status = status;
    if (supplierId) where.supplierId = supplierId;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to + 'T23:59:59Z');
    }

    const [purchases, total] = await Promise.all([
      prisma.purchase.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, invoiceNo: true, total: true, status: true, notes: true, createdAt: true,
          supplier: { select: { id: true, name: true } },
          _count: { select: { items: true } },
        },
      }),
      prisma.purchase.count({ where }),
    ]);

    res.json(paginatedResponse(purchases, total, page, limit));
  } catch (err) {
    next(err);
  }
}

// GET /api/purchases/:id
export async function getPurchase(req, res, next) {
  try {
    const purchase = await prisma.purchase.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
      include: { items: true, supplier: { select: { name: true, phone: true, email: true } } },
    });
    if (!purchase) return res.status(404).json({ error: 'Purchase not found' });
    res.json(purchase);
  } catch (err) {
    next(err);
  }
}
