import { z } from 'zod';
import prisma from '../config/database.js';
import { paginate, paginatedResponse } from '../utils/helpers.js';

// ─── Branch Management (ORG_ADMIN only) ───

const createBranchSchema = z.object({
  name: z.string().min(2),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().optional(),
  license: z.string().optional(),
});

// GET /api/branches — List all branches in the organization
export async function getBranches(req, res, next) {
  try {
    const branches = await prisma.tenant.findMany({
      where: { organizationId: req.organizationId },
      orderBy: [{ isMain: 'desc' }, { name: 'asc' }],
      select: {
        id: true, name: true, phone: true, email: true, address: true,
        license: true, isMain: true, active: true, createdAt: true,
        _count: { select: { users: true, medicines: true, sales: true } },
      },
    });
    res.json(branches);
  } catch (err) {
    next(err);
  }
}

// GET /api/branches/:id — Get single branch details
export async function getBranch(req, res, next) {
  try {
    const branch = await prisma.tenant.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId },
      select: {
        id: true, name: true, phone: true, email: true, address: true,
        license: true, isMain: true, active: true, createdAt: true,
        _count: { select: { users: true, medicines: true, sales: true, purchases: true, suppliers: true } },
      },
    });
    if (!branch) return res.status(404).json({ error: 'Branch not found' });
    res.json(branch);
  } catch (err) {
    next(err);
  }
}

// POST /api/branches — Create a new branch
export async function createBranch(req, res, next) {
  try {
    const data = createBranchSchema.parse(req.body);

    const branch = await prisma.$transaction(async (tx) => {
      const newBranch = await tx.tenant.create({
        data: {
          organizationId: req.organizationId,
          ...data,
          isMain: false,
        },
      });

      // Copy default categories from the main branch
      const mainBranch = await tx.tenant.findFirst({
        where: { organizationId: req.organizationId, isMain: true },
      });
      if (mainBranch) {
        const categories = await tx.category.findMany({
          where: { tenantId: mainBranch.id },
          select: { name: true },
        });
        if (categories.length > 0) {
          await tx.category.createMany({
            data: categories.map((c) => ({ tenantId: newBranch.id, name: c.name })),
          });
        }
      }

      return newBranch;
    });

    res.status(201).json(branch);
  } catch (err) {
    next(err);
  }
}

// PUT /api/branches/:id — Update a branch
export async function updateBranch(req, res, next) {
  try {
    const data = createBranchSchema.partial().parse(req.body);
    const result = await prisma.tenant.updateMany({
      where: { id: req.params.id, organizationId: req.organizationId },
      data,
    });
    if (result.count === 0) return res.status(404).json({ error: 'Branch not found' });

    const branch = await prisma.tenant.findUnique({
      where: { id: req.params.id },
      select: { id: true, name: true, phone: true, email: true, address: true, license: true, isMain: true, active: true },
    });
    res.json(branch);
  } catch (err) {
    next(err);
  }
}

// PUT /api/branches/:id/toggle — Activate/deactivate a branch
export async function toggleBranch(req, res, next) {
  try {
    const branch = await prisma.tenant.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId },
    });
    if (!branch) return res.status(404).json({ error: 'Branch not found' });
    if (branch.isMain) return res.status(400).json({ error: 'Cannot deactivate the main branch' });

    await prisma.tenant.update({
      where: { id: branch.id },
      data: { active: !branch.active },
    });
    res.json({ message: `Branch ${branch.active ? 'deactivated' : 'activated'}` });
  } catch (err) {
    next(err);
  }
}

// ─── Stock Transfers (Inter-Branch) ───

const createTransferSchema = z.object({
  toBranchId: z.string().min(1),
  notes: z.string().optional(),
  items: z.array(z.object({
    medicineName: z.string().min(1),
    batchNo: z.string().min(1),
    quantity: z.number().int().min(1),
    costPrice: z.number().min(0),
  })).min(1),
});

// POST /api/branches/transfers — Request a stock transfer
export async function createTransfer(req, res, next) {
  try {
    const data = createTransferSchema.parse(req.body);

    // Validate destination branch belongs to same org
    const toBranch = await prisma.tenant.findFirst({
      where: { id: data.toBranchId, organizationId: req.organizationId, active: true },
    });
    if (!toBranch) return res.status(400).json({ error: 'Destination branch not found in your organization' });

    const transfer = await prisma.stockTransfer.create({
      data: {
        organizationId: req.organizationId,
        fromBranchId: req.tenantId,
        toBranchId: data.toBranchId,
        requestedBy: req.user.id,
        notes: data.notes,
        items: { create: data.items },
      },
      include: {
        items: true,
        fromBranch: { select: { name: true } },
        toBranch: { select: { name: true } },
      },
    });

    res.status(201).json(transfer);
  } catch (err) {
    next(err);
  }
}

// GET /api/branches/transfers — List transfers for the organization
export async function getTransfers(req, res, next) {
  try {
    const { skip, take, page, limit } = paginate(req.query);
    const { status } = req.query;

    const where = { organizationId: req.organizationId };
    if (status) where.status = status;

    // Non-org-admins only see their own branch transfers
    if (req.user.role !== 'ORG_ADMIN') {
      where.OR = [
        { fromBranchId: req.tenantId },
        { toBranchId: req.tenantId },
      ];
    }

    const [transfers, total] = await Promise.all([
      prisma.stockTransfer.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, status: true, notes: true, createdAt: true,
          fromBranch: { select: { id: true, name: true } },
          toBranch: { select: { id: true, name: true } },
          _count: { select: { items: true } },
        },
      }),
      prisma.stockTransfer.count({ where }),
    ]);

    res.json(paginatedResponse(transfers, total, page, limit));
  } catch (err) {
    next(err);
  }
}

// GET /api/branches/transfers/:id — Get transfer details
export async function getTransfer(req, res, next) {
  try {
    const transfer = await prisma.stockTransfer.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId },
      include: {
        items: true,
        fromBranch: { select: { id: true, name: true } },
        toBranch: { select: { id: true, name: true } },
      },
    });
    if (!transfer) return res.status(404).json({ error: 'Transfer not found' });
    res.json(transfer);
  } catch (err) {
    next(err);
  }
}

// PUT /api/branches/transfers/:id/approve — ORG_ADMIN approves a transfer
export async function approveTransfer(req, res, next) {
  try {
    const transfer = await prisma.stockTransfer.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId, status: 'PENDING' },
      include: { items: true },
    });
    if (!transfer) return res.status(404).json({ error: 'Transfer not found or not pending' });

    await prisma.stockTransfer.update({
      where: { id: transfer.id },
      data: { status: 'APPROVED', approvedBy: req.user.id },
    });

    res.json({ message: 'Transfer approved' });
  } catch (err) {
    next(err);
  }
}

// PUT /api/branches/transfers/:id/complete — Complete transfer (move stock)
export async function completeTransfer(req, res, next) {
  try {
    const transfer = await prisma.stockTransfer.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId, status: 'APPROVED' },
      include: { items: true },
    });
    if (!transfer) return res.status(404).json({ error: 'Transfer not found or not approved' });

    await prisma.$transaction(async (tx) => {
      for (const item of transfer.items) {
        // Deduct from source branch: find matching batch
        const sourceBatch = await tx.batch.findFirst({
          where: {
            tenantId: transfer.fromBranchId,
            batchNo: item.batchNo,
            quantity: { gte: item.quantity },
          },
          include: { medicine: { select: { name: true, id: true } } },
        });

        if (!sourceBatch) {
          throw Object.assign(
            new Error(`Insufficient stock for ${item.medicineName} (Batch: ${item.batchNo}) in source branch`),
            { status: 400 }
          );
        }

        // Deduct from source
        await tx.batch.update({
          where: { id: sourceBatch.id },
          data: { quantity: { decrement: item.quantity } },
        });

        // Find or create matching medicine in destination branch
        let destMedicine = await tx.medicine.findFirst({
          where: { tenantId: transfer.toBranchId, name: item.medicineName },
        });

        if (!destMedicine) {
          destMedicine = await tx.medicine.create({
            data: {
              tenantId: transfer.toBranchId,
              name: item.medicineName,
              genericName: sourceBatch.medicine.name,
            },
          });
        }

        // Create batch in destination branch
        await tx.batch.create({
          data: {
            tenantId: transfer.toBranchId,
            medicineId: destMedicine.id,
            batchNo: item.batchNo,
            quantity: item.quantity,
            costPrice: item.costPrice,
            sellPrice: sourceBatch.sellPrice,
            expiryDate: sourceBatch.expiryDate,
          },
        });
      }

      await tx.stockTransfer.update({
        where: { id: transfer.id },
        data: { status: 'COMPLETED' },
      });
    });

    res.json({ message: 'Stock transfer completed. Inventory updated in both branches.' });
  } catch (err) {
    next(err);
  }
}

// PUT /api/branches/transfers/:id/reject — Reject a transfer
export async function rejectTransfer(req, res, next) {
  try {
    const transfer = await prisma.stockTransfer.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId, status: 'PENDING' },
    });
    if (!transfer) return res.status(404).json({ error: 'Transfer not found or not pending' });

    await prisma.stockTransfer.update({
      where: { id: transfer.id },
      data: { status: 'REJECTED' },
    });

    res.json({ message: 'Transfer rejected' });
  } catch (err) {
    next(err);
  }
}
