import { Request, Response } from 'express';
import prisma from '../config/database';
import { signToken } from '../utils/jwt';

// ─── Organizations & Access Codes ────────────────────────────────────────────
// These are stored in the DB but seeded from the original data
// Super admin codes are checked first

const SUPER_ADMIN_CODES: Record<string, { name: string; role: 'super_admin' }> = {
  safehands: { name: 'Department of Sports & Recreation', role: 'super_admin' },
  juren: { name: 'UMIN Design', role: 'super_admin' },
};

// ─── Login ───────────────────────────────────────────────────────────────────
export const login = async (req: Request, res: Response): Promise<void> => {
  const { accessCode } = req.body;

  if (!accessCode || typeof accessCode !== 'string') {
    res.status(400).json({ error: 'Access code is required.' });
    return;
  }

  const trimmedCode = accessCode.trim();

  // Check super admin codes first
  if (SUPER_ADMIN_CODES[trimmedCode]) {
    const superAdmin = SUPER_ADMIN_CODES[trimmedCode];
    const token = signToken({
      userId: `super_admin_${trimmedCode}`,
      organizationId: 'super_admin',
      organizationName: superAdmin.name,
      role: superAdmin.role,
    });

    // Log the login
    await prisma.auditLog.create({
      data: {
        action: 'LOGIN',
        entityType: 'user',
        actorOrg: superAdmin.name,
        details: JSON.stringify({ role: superAdmin.role }),
        ipAddress: req.ip,
      },
    });

    res.json({
      token,
      user: {
        id: `super_admin_${trimmedCode}`,
        organizationId: 'super_admin',
        organizationName: superAdmin.name,
        role: superAdmin.role,
        isAdmin: true,
      },
    });
    return;
  }

  // Look up organization by access code
  const organization = await prisma.organization.findFirst({
    where: { accessCode: trimmedCode, isActive: true },
  });

  if (!organization) {
    res.status(401).json({ error: 'Invalid access code. Please check your credentials.' });
    return;
  }

  // Determine role
  const role = 'user';

  const token = signToken({
    userId: organization.id,
    organizationId: organization.id,
    organizationName: organization.name,
    role,
  });

  // Update last login
  await prisma.user.upsert({
    where: { id: organization.id },
    create: {
      id: organization.id,
      organizationId: organization.id,
      role,
      lastLogin: new Date(),
    },
    update: { lastLogin: new Date() },
  });

  // Log the login
  await prisma.auditLog.create({
    data: {
      action: 'LOGIN',
      entityType: 'user',
      actorId: organization.id,
      actorOrg: organization.name,
      details: JSON.stringify({ role }),
      ipAddress: req.ip,
    },
  });

  res.json({
    token,
    user: {
      id: organization.id,
      organizationId: organization.id,
      organizationName: organization.name,
      role,
      isAdmin: false,
    },
  });
};

// ─── Get Current User ────────────────────────────────────────────────────────
export const getMe = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated.' });
    return;
  }

  res.json({
    user: {
      id: req.user.userId,
      organizationId: req.user.organizationId,
      organizationName: req.user.organizationName,
      role: req.user.role,
      isAdmin: req.user.role === 'admin' || req.user.role === 'super_admin',
    },
  });
};

// ─── Logout ──────────────────────────────────────────────────────────────────
export const logout = async (req: Request, res: Response): Promise<void> => {
  // JWT is stateless — client simply discards the token
  // We log the logout for audit purposes
  if (req.user) {
    await prisma.auditLog.create({
      data: {
        action: 'LOGOUT',
        entityType: 'user',
        actorId: req.user.userId,
        actorOrg: req.user.organizationName,
        ipAddress: req.ip,
      },
    });
  }

  res.json({ message: 'Logged out successfully.' });
};
