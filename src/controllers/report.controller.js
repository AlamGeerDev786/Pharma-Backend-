import prisma from '../config/database.js';

// GET /api/reports/sales-summary?from=&to=
export async function salesSummary(req, res, next) {
  try {
    const tid = req.tenantId;
    const from = req.query.from ? new Date(req.query.from) : new Date(new Date().setDate(new Date().getDate() - 30));
    const to = req.query.to ? new Date(req.query.to + 'T23:59:59Z') : new Date();

    const sales = await prisma.sale.findMany({
      where: { tenantId: tid, status: 'COMPLETED', createdAt: { gte: from, lte: to } },
      select: { total: true, discount: true, createdAt: true },
    });

    const totalRevenue = sales.reduce((s, r) => s + r.total, 0);
    const totalDiscount = sales.reduce((s, r) => s + r.discount, 0);
    const count = sales.length;

    // Group by date
    const daily = {};
    for (const s of sales) {
      const key = s.createdAt.toISOString().slice(0, 10);
      daily[key] = (daily[key] || 0) + s.total;
    }

    res.json({
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalDiscount: Math.round(totalDiscount * 100) / 100,
      totalTransactions: count,
      averageOrderValue: count ? Math.round((totalRevenue / count) * 100) / 100 : 0,
      daily: Object.entries(daily).map(([date, revenue]) => ({ date, revenue })).sort((a, b) => a.date.localeCompare(b.date)),
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/reports/top-selling?limit=10
export async function topSelling(req, res, next) {
  try {
    const tid = req.tenantId;
    const limit = parseInt(req.query.limit) || 10;

    const results = await prisma.$queryRaw`
      SELECT si.name, SUM(si.quantity)::int AS "totalQty", SUM(si.total)::float AS "totalRevenue"
      FROM "SaleItem" si
      JOIN "Sale" s ON s.id = si."saleId"
      WHERE s."tenantId" = ${tid} AND s.status = 'COMPLETED'
      GROUP BY si.name
      ORDER BY "totalQty" DESC
      LIMIT ${limit}
    `;

    res.json(results);
  } catch (err) {
    next(err);
  }
}

// GET /api/reports/inventory-health
export async function inventoryHealth(req, res, next) {
  try {
    const tid = req.tenantId;
    const now = new Date();
    const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const medicines = await prisma.medicine.findMany({
      where: { tenantId: tid, active: true },
      select: {
        id: true, name: true, minStock: true,
        category: { select: { name: true } },
        batches: {
          where: { quantity: { gt: 0 } },
          select: { quantity: true, costPrice: true, sellPrice: true, expiryDate: true },
        },
      },
    });

    let inStock = 0, lowStock = 0, outOfStock = 0, expiringSoon = 0;
    let totalStockValue = 0;

    const data = medicines.map((m) => {
      const totalQty = m.batches.reduce((s, b) => s + b.quantity, 0);
      const stockValue = m.batches.reduce((s, b) => s + b.quantity * b.costPrice, 0);
      totalStockValue += stockValue;

      const hasExpiring = m.batches.some((b) => b.expiryDate <= thirtyDays && b.expiryDate >= now);

      if (totalQty === 0) outOfStock++;
      else if (totalQty <= m.minStock) lowStock++;
      else inStock++;
      if (hasExpiring) expiringSoon++;

      return { name: m.name, category: m.category?.name, totalQty, stockValue: Math.round(stockValue * 100) / 100 };
    });

    res.json({
      summary: { inStock, lowStock, outOfStock, expiringSoon, totalStockValue: Math.round(totalStockValue * 100) / 100 },
      items: data.sort((a, b) => a.totalQty - b.totalQty).slice(0, 50),
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/reports/expiry
export async function expiryReport(req, res, next) {
  try {
    const tid = req.tenantId;
    const now = new Date();
    const ninetyDays = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

    const batches = await prisma.batch.findMany({
      where: { tenantId: tid, quantity: { gt: 0 }, expiryDate: { lte: ninetyDays } },
      orderBy: { expiryDate: 'asc' },
      select: {
        id: true, batchNo: true, quantity: true, costPrice: true, sellPrice: true, expiryDate: true,
        medicine: { select: { name: true, category: { select: { name: true } } } },
      },
    });

    const data = batches.map((b) => ({
      ...b,
      status: b.expiryDate < now ? 'expired' : 'expiring',
      lossValue: Math.round(b.quantity * b.costPrice * 100) / 100,
    }));

    const totalLoss = data.reduce((s, b) => s + b.lossValue, 0);

    res.json({ totalLoss: Math.round(totalLoss * 100) / 100, count: data.length, items: data });
  } catch (err) {
    next(err);
  }
}

// GET /api/reports/profit
export async function profitReport(req, res, next) {
  try {
    const tid = req.tenantId;
    const from = req.query.from ? new Date(req.query.from) : new Date(new Date().setDate(new Date().getDate() - 30));
    const to = req.query.to ? new Date(req.query.to + 'T23:59:59Z') : new Date();

    const sales = await prisma.sale.findMany({
      where: { tenantId: tid, status: 'COMPLETED', createdAt: { gte: from, lte: to } },
      include: {
        items: {
          include: { batch: { select: { costPrice: true } } },
        },
      },
    });

    let totalRevenue = 0;
    let totalCost = 0;

    for (const sale of sales) {
      totalRevenue += sale.total;
      for (const item of sale.items) {
        totalCost += (item.batch?.costPrice || 0) * item.quantity;
      }
    }

    const grossProfit = totalRevenue - totalCost;
    const margin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

    res.json({
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalCost: Math.round(totalCost * 100) / 100,
      grossProfit: Math.round(grossProfit * 100) / 100,
      profitMargin: Math.round(margin * 100) / 100,
      totalTransactions: sales.length,
    });
  } catch (err) {
    next(err);
  }
}
