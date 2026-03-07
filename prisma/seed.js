import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const hashedPassword = await bcrypt.hash('demo1234', 10);

  // ─── Create Organization ───
  const org = await prisma.organization.create({
    data: {
      name: 'Doctor Pharma',
      phone: '+1-555-0100',
      email: 'info@doctorpharma.com',
      address: '100 Healthcare Blvd, Medical City',
      plan: 'PRO',
    },
  });

  // ─── Create Main Branch ───
  const mainBranch = await prisma.tenant.create({
    data: {
      organizationId: org.id,
      name: 'Doctor Pharma - Main Branch',
      phone: '+1-555-0100',
      email: 'main@doctorpharma.com',
      address: '123 Health Street, Medical City',
      license: 'PH-2024-001',
      isMain: true,
    },
  });

  // ─── Create Second Branch ───
  const branch2 = await prisma.tenant.create({
    data: {
      organizationId: org.id,
      name: 'Doctor Pharma - Airport Road',
      phone: '+1-555-0110',
      email: 'airport@doctorpharma.com',
      address: '456 Airport Road, Medical City',
      license: 'PH-2024-002',
      isMain: false,
    },
  });

  // ─── Create Third Branch ───
  const branch3 = await prisma.tenant.create({
    data: {
      organizationId: org.id,
      name: 'Doctor Pharma - Mall Branch',
      phone: '+1-555-0120',
      email: 'mall@doctorpharma.com',
      address: '789 City Mall, 2nd Floor',
      license: 'PH-2024-003',
      isMain: false,
    },
  });

  // ─── Create Users ───

  // Organization Admin (on main branch)
  await prisma.user.create({
    data: {
      tenantId: mainBranch.id,
      name: 'Admin User',
      email: 'admin@demo.com',
      password: hashedPassword,
      role: 'ORG_ADMIN',
      phone: '+1-555-0101',
    },
  });

  // Branch Admin for branch 2
  await prisma.user.create({
    data: {
      tenantId: branch2.id,
      name: 'Branch 2 Manager',
      email: 'branch2@demo.com',
      password: hashedPassword,
      role: 'ADMIN',
      phone: '+1-555-0111',
    },
  });

  // Pharmacist on main branch
  await prisma.user.create({
    data: {
      tenantId: mainBranch.id,
      name: 'John Pharmacist',
      email: 'pharmacist@demo.com',
      password: hashedPassword,
      role: 'PHARMACIST',
      phone: '+1-555-0102',
    },
  });

  // Cashier on main branch
  await prisma.user.create({
    data: {
      tenantId: mainBranch.id,
      name: 'Sarah Cashier',
      email: 'cashier@demo.com',
      password: hashedPassword,
      role: 'CASHIER',
      phone: '+1-555-0103',
    },
  });

  // ─── Create Categories for all branches ───
  const categoryNames = [
    'Tablets', 'Capsules', 'Syrups', 'Injections',
    'Ointments', 'Drops', 'Inhalers', 'Supplements',
  ];

  const allBranches = [mainBranch, branch2, branch3];
  const categories = {};

  for (const branch of allBranches) {
    categories[branch.id] = {};
    for (const name of categoryNames) {
      const cat = await prisma.category.create({
        data: { tenantId: branch.id, name },
      });
      categories[branch.id][name] = cat.id;
    }
  }

  // ─── Create Suppliers for main branch ───
  const supplier1 = await prisma.supplier.create({
    data: {
      tenantId: mainBranch.id,
      name: 'MediSupply Co.',
      phone: '+1-555-0200',
      email: 'orders@medisupply.com',
      company: 'MediSupply Corporation',
      address: '456 Pharma Ave',
    },
  });

  const supplier2 = await prisma.supplier.create({
    data: {
      tenantId: mainBranch.id,
      name: 'HealthDist Ltd.',
      phone: '+1-555-0201',
      email: 'sales@healthdist.com',
      company: 'Health Distribution Ltd.',
      address: '789 Distribution Blvd',
    },
  });

  // Supplier for branch 2
  await prisma.supplier.create({
    data: {
      tenantId: branch2.id,
      name: 'MediSupply Co.',
      phone: '+1-555-0200',
      email: 'orders@medisupply.com',
      company: 'MediSupply Corporation',
      address: '456 Pharma Ave',
    },
  });

  // ─── Create Medicines for Main Branch ───
  const medicinesData = [
    { name: 'Paracetamol 500mg', genericName: 'Acetaminophen', category: 'Tablets', supplier: supplier1.id, minStock: 50, batches: [{ batchNo: 'BT-001', quantity: 200, costPrice: 0.5, sellPrice: 1.5, expiryDate: new Date('2027-06-15') }, { batchNo: 'BT-002', quantity: 150, costPrice: 0.5, sellPrice: 1.5, expiryDate: new Date('2026-12-30') }] },
    { name: 'Amoxicillin 250mg', genericName: 'Amoxicillin', category: 'Capsules', supplier: supplier1.id, minStock: 30, batches: [{ batchNo: 'BT-003', quantity: 100, costPrice: 2.0, sellPrice: 5.0, expiryDate: new Date('2027-03-20') }] },
    { name: 'Cough Syrup DM', genericName: 'Dextromethorphan', category: 'Syrups', supplier: supplier2.id, minStock: 20, batches: [{ batchNo: 'BT-004', quantity: 60, costPrice: 3.0, sellPrice: 8.0, expiryDate: new Date('2026-09-10') }] },
    { name: 'Ibuprofen 400mg', genericName: 'Ibuprofen', category: 'Tablets', supplier: supplier1.id, minStock: 40, batches: [{ batchNo: 'BT-005', quantity: 300, costPrice: 0.8, sellPrice: 2.5, expiryDate: new Date('2027-08-01') }] },
    { name: 'Metformin 500mg', genericName: 'Metformin HCL', category: 'Tablets', supplier: supplier2.id, minStock: 30, batches: [{ batchNo: 'BT-006', quantity: 180, costPrice: 1.2, sellPrice: 3.5, expiryDate: new Date('2027-01-15') }] },
    { name: 'Omeprazole 20mg', genericName: 'Omeprazole', category: 'Capsules', supplier: supplier1.id, minStock: 25, batches: [{ batchNo: 'BT-007', quantity: 120, costPrice: 1.5, sellPrice: 4.0, expiryDate: new Date('2027-04-22') }] },
    { name: 'Cetirizine 10mg', genericName: 'Cetirizine HCL', category: 'Tablets', supplier: supplier2.id, minStock: 30, batches: [{ batchNo: 'BT-008', quantity: 200, costPrice: 0.6, sellPrice: 2.0, expiryDate: new Date('2027-07-10') }] },
    { name: 'Vitamin C 1000mg', genericName: 'Ascorbic Acid', category: 'Supplements', supplier: supplier1.id, minStock: 40, batches: [{ batchNo: 'BT-009', quantity: 250, costPrice: 0.4, sellPrice: 1.8, expiryDate: new Date('2027-11-05') }] },
    { name: 'Eye Drops Moist', genericName: 'Carboxymethylcellulose', category: 'Drops', supplier: supplier2.id, minStock: 15, batches: [{ batchNo: 'BT-010', quantity: 40, costPrice: 4.0, sellPrice: 10.0, expiryDate: new Date('2026-08-20') }] },
    { name: 'Betamethasone Cream', genericName: 'Betamethasone', category: 'Ointments', supplier: supplier1.id, minStock: 10, batches: [{ batchNo: 'BT-011', quantity: 30, costPrice: 5.0, sellPrice: 12.0, expiryDate: new Date('2027-02-28') }] },
    { name: 'Azithromycin 500mg', genericName: 'Azithromycin', category: 'Tablets', supplier: supplier2.id, minStock: 20, batches: [{ batchNo: 'BT-012', quantity: 5, costPrice: 3.5, sellPrice: 8.0, expiryDate: new Date('2027-05-15') }] },
    { name: 'Diclofenac Gel', genericName: 'Diclofenac Sodium', category: 'Ointments', supplier: supplier1.id, minStock: 10, batches: [{ batchNo: 'BT-013', quantity: 25, costPrice: 3.0, sellPrice: 7.5, expiryDate: new Date('2026-04-01') }] },
  ];

  for (const med of medicinesData) {
    await prisma.medicine.create({
      data: {
        tenantId: mainBranch.id,
        name: med.name,
        genericName: med.genericName,
        categoryId: categories[mainBranch.id][med.category],
        supplierId: med.supplier,
        minStock: med.minStock,
        batches: {
          create: med.batches.map((b) => ({ ...b, tenantId: mainBranch.id })),
        },
      },
    });
  }

  // ─── Create some medicines for Branch 2 (smaller inventory) ───
  const branch2Meds = [
    { name: 'Paracetamol 500mg', genericName: 'Acetaminophen', category: 'Tablets', minStock: 30, batches: [{ batchNo: 'B2-001', quantity: 100, costPrice: 0.5, sellPrice: 1.5, expiryDate: new Date('2027-06-15') }] },
    { name: 'Amoxicillin 250mg', genericName: 'Amoxicillin', category: 'Capsules', minStock: 20, batches: [{ batchNo: 'B2-002', quantity: 50, costPrice: 2.0, sellPrice: 5.0, expiryDate: new Date('2027-03-20') }] },
    { name: 'Ibuprofen 400mg', genericName: 'Ibuprofen', category: 'Tablets', minStock: 25, batches: [{ batchNo: 'B2-003', quantity: 150, costPrice: 0.8, sellPrice: 2.5, expiryDate: new Date('2027-08-01') }] },
    { name: 'Vitamin C 1000mg', genericName: 'Ascorbic Acid', category: 'Supplements', minStock: 20, batches: [{ batchNo: 'B2-004', quantity: 80, costPrice: 0.4, sellPrice: 1.8, expiryDate: new Date('2027-11-05') }] },
  ];

  for (const med of branch2Meds) {
    await prisma.medicine.create({
      data: {
        tenantId: branch2.id,
        name: med.name,
        genericName: med.genericName,
        categoryId: categories[branch2.id][med.category],
        minStock: med.minStock,
        batches: {
          create: med.batches.map((b) => ({ ...b, tenantId: branch2.id })),
        },
      },
    });
  }

  // ─── Create Customers ───
  const customer1 = await prisma.customer.create({
    data: { tenantId: mainBranch.id, name: 'Ahmed Khan', phone: '+1-555-0300', email: 'ahmed@email.com' },
  });
  await prisma.customer.create({
    data: { tenantId: mainBranch.id, name: 'Sara Ali', phone: '+1-555-0301', email: 'sara@email.com' },
  });
  await prisma.customer.create({
    data: { tenantId: branch2.id, name: 'Mike Johnson', phone: '+1-555-0302' },
  });

  // ─── Create Sample Sales for Main Branch ───
  const user = await prisma.user.findFirst({ where: { tenantId: mainBranch.id, role: 'ORG_ADMIN' } });
  const seedBatches = await prisma.batch.findMany({ where: { tenantId: mainBranch.id }, take: 5 });

  for (let i = 0; i < 15; i++) {
    const daysAgo = Math.floor(Math.random() * 7);
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    date.setHours(Math.floor(Math.random() * 10) + 8);

    const batch = seedBatches[i % seedBatches.length];
    const qty = Math.floor(Math.random() * 5) + 1;
    const itemTotal = batch.sellPrice * qty;
    const discount = i % 3 === 0 ? Math.round(itemTotal * 0.1 * 100) / 100 : 0;
    const total = itemTotal - discount;

    await prisma.sale.create({
      data: {
        tenantId: mainBranch.id,
        userId: user.id,
        customerId: i % 2 === 0 ? customer1.id : null,
        invoiceNo: `INV-${date.toISOString().slice(0, 10).replace(/-/g, '')}-${String(i + 1).padStart(3, '0')}`,
        subtotal: itemTotal,
        discount,
        total,
        paymentMethod: ['CASH', 'CARD', 'MOBILE'][i % 3],
        createdAt: date,
        items: {
          create: [{
            batchId: batch.id,
            name: `Medicine ${i + 1}`,
            quantity: qty,
            price: batch.sellPrice,
            total: itemTotal,
          }],
        },
      },
    });
  }

  // ─── Create a Sample Stock Transfer ───
  await prisma.stockTransfer.create({
    data: {
      organizationId: org.id,
      fromBranchId: mainBranch.id,
      toBranchId: branch2.id,
      requestedBy: user.id,
      status: 'PENDING',
      notes: 'Branch 2 running low on Paracetamol',
      items: {
        create: [
          { medicineName: 'Paracetamol 500mg', batchNo: 'BT-001', quantity: 50, costPrice: 0.5 },
        ],
      },
    },
  });

  console.log('Seed completed!');
  console.log('───────────────────────────────────');
  console.log('Organization: Doctor Pharma (3 branches)');
  console.log('');
  console.log('Demo login credentials:');
  console.log('  Org Admin:     admin@demo.com / demo1234      (sees all branches)');
  console.log('  Branch Admin:  branch2@demo.com / demo1234    (Airport Road branch only)');
  console.log('  Pharmacist:    pharmacist@demo.com / demo1234 (Main branch only)');
  console.log('  Cashier:       cashier@demo.com / demo1234    (Main branch only)');
  console.log('───────────────────────────────────');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
