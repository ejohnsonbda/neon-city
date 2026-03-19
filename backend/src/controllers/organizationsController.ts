import { Request, Response } from 'express';
import prisma from '../config/database';

// ─── List Organizations (public, no access codes) ─────────────────────────────
export const getOrganizations = async (_req: Request, res: Response): Promise<void> => {
  const orgs = await prisma.organization.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      email: true,
      sport: true,
      logoUrl: true,
      createdAt: true,
    },
    orderBy: { name: 'asc' },
  });

  res.json({ data: orgs });
};

// ─── Get Single Organization ──────────────────────────────────────────────────
export const getOrganization = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  const org = await prisma.organization.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      sport: true,
      logoUrl: true,
      createdAt: true,
      events: {
        where: { isPublished: true },
        orderBy: { date: 'asc' },
        take: 10,
      },
    },
  });

  if (!org) {
    res.status(404).json({ error: 'Organization not found.' });
    return;
  }

  res.json({ data: org });
};

// ─── Create Organization (admin only) ────────────────────────────────────────
export const createOrganization = async (req: Request, res: Response): Promise<void> => {
  const { name, accessCode, email, sport, logoUrl } = req.body;

  if (!name || !accessCode || !email) {
    res.status(400).json({ error: 'Name, access code, and email are required.' });
    return;
  }

  // Check uniqueness
  const existing = await prisma.organization.findFirst({
    where: { OR: [{ name }, { accessCode }] },
  });

  if (existing) {
    res.status(409).json({ error: 'An organization with this name or access code already exists.' });
    return;
  }

  const org = await prisma.organization.create({
    data: { name, accessCode, email, sport: sport || null, logoUrl: logoUrl || null },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      action: 'CREATE',
      entityType: 'organization',
      entityId: org.id,
      actorId: req.user?.userId,
      actorOrg: req.user?.organizationName,
      details: JSON.stringify({ name: org.name }),
      ipAddress: req.ip,
    },
  });

  res.status(201).json({ data: org, message: 'Organization created successfully.' });
};

// ─── Update Organization (admin only) ────────────────────────────────────────
export const updateOrganization = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { name, email, sport, logoUrl, isActive } = req.body;

  const existing = await prisma.organization.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: 'Organization not found.' });
    return;
  }

  const updated = await prisma.organization.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(email !== undefined && { email }),
      ...(sport !== undefined && { sport }),
      ...(logoUrl !== undefined && { logoUrl }),
      ...(isActive !== undefined && { isActive }),
    },
  });

  res.json({ data: updated, message: 'Organization updated successfully.' });
};

// ─── Delete Organization (super_admin only) ───────────────────────────────────
export const deleteOrganization = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  const existing = await prisma.organization.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: 'Organization not found.' });
    return;
  }

  // Soft delete
  await prisma.organization.update({ where: { id }, data: { isActive: false } });

  res.json({ message: 'Organization deactivated successfully.' });
};
