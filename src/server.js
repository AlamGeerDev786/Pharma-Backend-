import express from 'express';
import cors from 'cors';
import compression from 'compression';
import { env } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';

// Route imports
import authRoutes from './routes/auth.routes.js';
import medicineRoutes, { categoryRouter } from './routes/medicine.routes.js';
import saleRoutes from './routes/sale.routes.js';
import purchaseRoutes from './routes/purchase.routes.js';
import supplierRoutes from './routes/supplier.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import reportRoutes from './routes/report.routes.js';
import settingsRoutes from './routes/settings.routes.js';
import branchRoutes from './routes/branch.routes.js';

const app = express();

// ─── Performance: Compress all responses ───
app.use(compression());

// ─── CORS ───
app.use(cors({
  origin: env.FRONTEND_URL,
  credentials: true,
}));

// ─── Body parsing ───
app.use(express.json({ limit: '10mb' }));

// ─── API Routes ───
app.use('/api/auth', authRoutes);
app.use('/api/medicines', medicineRoutes);
app.use('/api/categories', categoryRouter);
app.use('/api/sales', saleRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/branches', branchRoutes);

// ─── Health check ───
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Error handler (must be last) ───
app.use(errorHandler);

// ─── Start server (only in non-serverless environments) ───
if (env.NODE_ENV !== 'production') {
  app.listen(env.PORT, () => {
    console.log(`Server running on http://localhost:${env.PORT}`);
    console.log(`Environment: ${env.NODE_ENV}`);
  });
}

// ─── Export for Vercel serverless ───
export default app;
