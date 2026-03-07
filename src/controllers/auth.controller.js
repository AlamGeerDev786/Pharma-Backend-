import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import prisma from '../config/database.js';
import { env } from '../config/env.js';
import { sendEmail, passwordResetEmail } from '../utils/email.js';

const registerSchema = z.object({
  pharmacyName: z.string().min(2),
  ownerName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  phone: z.string().optional(),
  address: z.string().optional(),
  plan: z.enum(['BASIC', 'PRO', 'ENTERPRISE']).default('BASIC'),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function generateTokens(user, organizationId) {
  const payload = { id: user.id, tenantId: user.tenantId, organizationId, role: user.role };
  const accessToken = jwt.sign(payload, env.JWT_SECRET, { expiresIn: '24h' });
  const refreshToken = jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
  return { accessToken, refreshToken };
}

export async function register(req, res, next) {
  try {
    const data = registerSchema.parse(req.body);
    const hashedPassword = await bcrypt.hash(data.password, 10);

    const result = await prisma.$transaction(async (tx) => {
      // Create organization first
      const organization = await tx.organization.create({
        data: {
          name: data.pharmacyName,
          phone: data.phone,
          email: data.email,
          address: data.address,
          plan: data.plan,
        },
      });

      // Create the main (first) branch
      const tenant = await tx.tenant.create({
        data: {
          organizationId: organization.id,
          name: data.pharmacyName + ' - Main Branch',
          phone: data.phone,
          email: data.email,
          address: data.address,
          isMain: true,
        },
      });

      // Create ORG_ADMIN user on the main branch
      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          name: data.ownerName,
          email: data.email,
          password: hashedPassword,
          role: 'ORG_ADMIN',
        },
      });

      // Create default categories for the main branch
      const defaultCategories = [
        'Tablets', 'Capsules', 'Syrups', 'Injections',
        'Ointments', 'Drops', 'Inhalers', 'Supplements',
      ];
      await tx.category.createMany({
        data: defaultCategories.map((name) => ({ tenantId: tenant.id, name })),
      });

      return { organization, tenant, user };
    });

    const tokens = generateTokens(result.user, result.organization.id);
    await prisma.user.update({
      where: { id: result.user.id },
      data: { refreshToken: tokens.refreshToken },
    });

    res.status(201).json({
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        role: result.user.role,
      },
      organization: {
        id: result.organization.id,
        name: result.organization.name,
        plan: result.organization.plan,
      },
      tenant: {
        id: result.tenant.id,
        name: result.tenant.name,
        isMain: result.tenant.isMain,
      },
      ...tokens,
    });
  } catch (err) {
    next(err);
  }
}

export async function login(req, res, next) {
  try {
    const data = loginSchema.parse(req.body);

    const user = await prisma.user.findFirst({
      where: { email: data.email, active: true },
      include: {
        tenant: {
          select: {
            id: true, name: true, isMain: true, organizationId: true,
            organization: { select: { id: true, name: true, plan: true, currency: true } },
          },
        },
      },
    });

    if (!user || !(await bcrypt.compare(data.password, user.password))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const orgId = user.tenant.organizationId;
    const tokens = generateTokens(user, orgId);
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: tokens.refreshToken },
    });

    // If ORG_ADMIN, also return all branches
    let branches = undefined;
    if (user.role === 'ORG_ADMIN') {
      branches = await prisma.tenant.findMany({
        where: { organizationId: orgId, active: true },
        select: { id: true, name: true, isMain: true, address: true },
        orderBy: { isMain: 'desc' },
      });
    }

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      organization: user.tenant.organization,
      tenant: {
        id: user.tenant.id,
        name: user.tenant.name,
        isMain: user.tenant.isMain,
      },
      branches,
      ...tokens,
    });
  } catch (err) {
    next(err);
  }
}

export async function refreshToken(req, res, next) {
  try {
    const { refreshToken: token } = req.body;
    if (!token) return res.status(401).json({ error: 'Refresh token required' });

    const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: {
        tenant: {
          select: {
            id: true, name: true, organizationId: true,
            organization: { select: { id: true, name: true, plan: true, currency: true } },
          },
        },
      },
    });

    if (!user || user.refreshToken !== token) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const tokens = generateTokens(user, user.tenant.organizationId);
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: tokens.refreshToken },
    });

    res.json(tokens);
  } catch {
    return res.status(401).json({ error: 'Invalid refresh token' });
  }
}

export async function getMe(req, res, next) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, name: true, email: true, role: true, phone: true, createdAt: true },
    });

    const tenant = await prisma.tenant.findUnique({
      where: { id: req.tenantId },
      select: {
        id: true, name: true, phone: true, email: true, address: true, license: true, isMain: true,
        organizationId: true,
      },
    });

    const organization = await prisma.organization.findUnique({
      where: { id: req.organizationId },
      select: { id: true, name: true, plan: true, currency: true, phone: true, email: true, address: true },
    });

    // If ORG_ADMIN, include all branches
    let branches = undefined;
    if (user.role === 'ORG_ADMIN') {
      branches = await prisma.tenant.findMany({
        where: { organizationId: req.organizationId, active: true },
        select: { id: true, name: true, isMain: true, address: true, phone: true },
        orderBy: { isMain: 'desc' },
      });
    }

    res.json({ user, tenant, organization, branches });
  } catch (err) {
    next(err);
  }
}

export async function forgotPassword(req, res, next) {
  try {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);

    const user = await prisma.user.findFirst({ where: { email, active: true } });

    // Always return success to prevent email enumeration
    if (!user) {
      return res.json({ message: 'If an account with that email exists, a reset link has been sent.' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3 * 60 * 1000); // 3 minutes

    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken, resetTokenExpiry },
    });

    const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    const { subject, html } = passwordResetEmail(resetUrl, user.name);

    // Send email in background — don't block the response
    sendEmail({ to: user.email, subject, html }).catch((err) => {
      console.error('Failed to send reset email:', err.message);
    });

    res.json({ message: 'If an account with that email exists, a reset link has been sent.' });
  } catch (err) {
    next(err);
  }
}

export async function resetPassword(req, res, next) {
  try {
    const { token, password } = z.object({
      token: z.string().min(1),
      password: z.string().min(6),
    }).parse(req.body);

    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: { gt: new Date() },
        active: true,
      },
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    res.json({ message: 'Password has been reset successfully. You can now log in.' });
  } catch (err) {
    next(err);
  }
}
