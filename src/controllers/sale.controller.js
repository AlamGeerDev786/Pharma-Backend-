import { z } from 'zod';
import prisma from '../config/database.js';
import { paginate, paginatedResponse, generateInvoiceNo } from '../utils/helpers.js';

const createSaleSchema = z.object({
  customerId: z.string().optional(),
  discount: z.number().min(0).default(0),
  tax: z.number().min(0).default(0),
  paymentMethod: z.enum(['CASH', 'CARD', 'MOBILE']).default('CASH'),
  items: z.array(z.object({
    batchId: z.string(),
    name: z.string(),
    quantity: z.number().int().min(1),
    price: z.number().min(0),
  })).min(1),
});

// POST /api/sales — Create sale from POS
export async function createSale(req, res, next) {
  try {
    const data = createSaleSchema.parse(req.body);
    const tid = req.tenantId;

    const sale = await prisma.$transaction(async (tx) => {
      // Validate stock and compute totals
      let subtotal = 0;
      const items = [];

      for (const item of data.items) {
        const batch = await tx.batch.findFirst({
          where: { id: item.batchId, tenantId: tid },
        });
        if (!batch) throw Object.assign(new Error(`Batch ${item.batchId} not found`), { status: 404 });
        if (batch.quantity < item.quantity) {
          throw Object.assign(new Error(`Insufficient stock for ${item.name}. Available: ${batch.quantity}`), { status: 400 });
        }

        const total = item.price * item.quantity;
        subtotal += total;
        items.push({ ...item, total });

        // Deduct stock
        await tx.batch.update({
          where: { id: item.batchId },
          data: { quantity: { decrement: item.quantity } },
        });
      }

      const total = subtotal - data.discount + data.tax;

      return tx.sale.create({
        data: {
          tenantId: tid,
          userId: req.user.id,
          customerId: data.customerId || null,
          invoiceNo: generateInvoiceNo('INV'),
          subtotal,
          discount: data.discount,
          tax: data.tax,
          total,
          paymentMethod: data.paymentMethod,
          items: { create: items },
        },
        include: {
          items: true,
          user: { select: { name: true } },
          customer: { select: { name: true, phone: true } },
        },
      });
    });

    res.status(201).json(sale);
  } catch (err) {
    next(err);
  }
}

// GET /api/sales
export async function getSales(req, res, next) {
  try {
    const { skip, take, page, limit } = paginate(req.query);
    const { from, to, paymentMethod } = req.query;
    const tid = req.tenantId;

    const where = { tenantId: tid };
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to + 'T23:59:59Z');
    }
    if (paymentMethod) where.paymentMethod = paymentMethod;

    const [sales, total] = await Promise.all([
      prisma.sale.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, invoiceNo: true, subtotal: true, discount: true, tax: true,
          total: true, paymentMethod: true, status: true, createdAt: true,
          user: { select: { name: true } },
          customer: { select: { name: true } },
          _count: { select: { items: true } },
        },
      }),
      prisma.sale.count({ where }),
    ]);

    res.json(paginatedResponse(sales, total, page, limit));
  } catch (err) {
    next(err);
  }
}

// GET /api/sales/:id
export async function getSale(req, res, next) {
  try {
    const sale = await prisma.sale.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId },
      include: {
        items: true,
        user: { select: { name: true } },
        customer: { select: { name: true, phone: true } },
      },
    });
    if (!sale) return res.status(404).json({ error: 'Sale not found' });
    res.json(sale);
  } catch (err) {
    next(err);
  }
}

// POST /api/sales/:id/refund
export async function refundSale(req, res, next) {
  try {
    const sale = await prisma.sale.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId, status: 'COMPLETED' },
      include: { items: true },
    });
    if (!sale) return res.status(404).json({ error: 'Sale not found or already refunded' });

    await prisma.$transaction(async (tx) => {
      // Restore stock
      for (const item of sale.items) {
        await tx.batch.update({
          where: { id: item.batchId },
          data: { quantity: { increment: item.quantity } },
        });
      }
      await tx.sale.update({
        where: { id: sale.id },
        data: { status: 'REFUNDED' },
      });
    });

    res.json({ message: 'Sale refunded successfully' });
  } catch (err) {
    next(err);
  }
}
