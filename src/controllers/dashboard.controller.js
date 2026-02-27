import prisma from '../config/database.js';

// GET /api/dashboard/stats — Main dashboard numbers
export async function getStats(req, res, next) {
  try {
    const tid = req.tenantId;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [
      totalSales,
      monthlyRevenue,
      lowStockCount,
      expiredCount,
      expiringCount,
      totalMedicines,
      totalCustomers,
    ] = await Promise.all([
      prisma.sale.count({ where: { tenantId: tid, status: 'COMPLETED' } }),
      prisma.sale.aggregate({
        where: { tenantId: tid, status: 'COMPLETED', createdAt: { gte: startOfMonth } },
        _sum: { total: true },
      }),
      // Low stock: medicines where total batch qty <= minStock
      prisma.$queryRaw`
        SELECT COUNT(DISTINCT m.id)::int AS count
        FROM "Medicine" m
        LEFT JOIN "Batch" b ON b."medicineId" = m.id AND b.quantity > 0
        WHERE m."tenantId" = ${tid} AND m.active = true
        GROUP BY m.id, m."minStock"
        HAVING COALESCE(SUM(b.quantity), 0) <= m."minStock" AND COALESCE(SUM(b.quantity), 0) > 0
      `.then((rows) => rows.length),
      prisma.batch.count({
        where: { tenantId: tid, expiryDate: { lt: now }, quantity: { gt: 0 } },
      }),
      prisma.batch.count({
        where: { tenantId: tid, expiryDate: { gte: now, lte: thirtyDaysFromNow }, quantity: { gt: 0 } },
      }),
      prisma.medicine.count({ where: { tenantId: tid, active: true } }),
      prisma.customer.count({ where: { tenantId: tid } }),
    ]);

    res.json({
      totalSales,
      monthlyRevenue: monthlyRevenue._sum.total || 0,
      lowStockCount,
      expiredCount,
      expiringCount,
      totalMedicines,
      totalCustomers,
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/dashboard/revenue?period=weekly|monthly
export async function getRevenue(req, res, next) {
  try {
    const tid = req.tenantId;
    const period = req.query.period || 'weekly';

    let days = period === 'monthly' ? 30 : 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const sales = await prisma.sale.findMany({
      where: {
        tenantId: tid,
        status: 'COMPLETED',
        createdAt: { gte: startDate },
      },
      select: { total: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    // Group by date
    const grouped = {};
    for (let i = 0; i < days; i++) {
      const d = new Date();
      d.setDate(d.getDate() - (days - 1 - i));
      const key = d.toISOString().slice(0, 10);
      grouped[key] = 0;
    }
    for (const s of sales) {
      const key = s.createdAt.toISOString().slice(0, 10);
      if (grouped[key] !== undefined) grouped[key] += s.total;
    }

    const data = Object.entries(grouped).map(([date, revenue]) => ({ date, revenue: Math.round(revenue * 100) / 100 }));
    res.json(data);
  } catch (err) {
    next(err);
  }
}

// GET /api/dashboard/recent-sales
export async function getRecentSales(req, res, next) {
  try {
    const sales = await prisma.sale.findMany({
      where: { tenantId: req.tenantId },
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, invoiceNo: true, total: true, paymentMethod: true, status: true, createdAt: true,
        user: { select: { name: true } },
        customer: { select: { name: true } },
        _count: { select: { items: true } },
      },
    });
    res.json(sales);
  } catch (err) {
    next(err);
  }
}

// GET /api/dashboard/alerts
export async function getAlerts(req, res, next) {
  try {
    const tid = req.tenantId;
    const now = new Date();
    const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const ninetyDays = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

    const [expired, expiringSoon, outOfStock] = await Promise.all([
      prisma.batch.findMany({
        where: { tenantId: tid, expiryDate: { lt: now }, quantity: { gt: 0 } },
        take: 10,
        select: {
          id: true, batchNo: true, quantity: true, expiryDate: true,
          medicine: { select: { name: true } },
        },
      }),
      prisma.batch.findMany({
        where: { tenantId: tid, expiryDate: { gte: now, lte: ninetyDays }, quantity: { gt: 0 } },
        take: 10,
        orderBy: { expiryDate: 'asc' },
        select: {
          id: true, batchNo: true, quantity: true, expiryDate: true,
          medicine: { select: { name: true } },
        },
      }),
      prisma.$queryRaw`
        SELECT m.id, m.name, COALESCE(SUM(b.quantity), 0)::int AS stock
        FROM "Medicine" m
        LEFT JOIN "Batch" b ON b."medicineId" = m.id AND b.quantity > 0
        WHERE m."tenantId" = ${tid} AND m.active = true
        GROUP BY m.id
        HAVING COALESCE(SUM(b.quantity), 0) = 0
        LIMIT 10
      `,
    ]);

    const alerts = [
      ...expired.map((b) => ({
        type: 'expired',
        severity: 'danger',
        message: `${b.medicine.name} (Batch: ${b.batchNo}) has expired`,
        date: b.expiryDate,
      })),
      ...expiringSoon.map((b) => ({
        type: 'expiring',
        severity: b.expiryDate <= thirtyDays ? 'warning' : 'info',
        message: `${b.medicine.name} (Batch: ${b.batchNo}) expires on ${b.expiryDate.toISOString().slice(0, 10)}`,
        date: b.expiryDate,
      })),
      ...outOfStock.map((m) => ({
        type: 'out-of-stock',
        severity: 'danger',
        message: `${m.name} is out of stock`,
        date: null,
      })),
    ];

    res.json(alerts);
  } catch (err) {
    next(err);
  }
}
