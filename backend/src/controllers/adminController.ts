import { Request, Response } from 'express';
import prisma from '../config/database';

// ─── Dashboard Stats ──────────────────────────────────────────────────────────
export const getStats = async (_req: Request, res: Response): Promise<void> => {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const thisMonthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

  const [
    totalEvents,
    publishedEvents,
    upcomingEvents,
    thisMonthEvents,
    totalOrganizations,
    activeOrganizations,
    recentEvents,
    sportBreakdown,
    orgBreakdown,
  ] = await Promise.all([
    prisma.event.count(),
    prisma.event.count({ where: { isPublished: true } }),
    prisma.event.count({ where: { isPublished: true, date: { gte: todayStr } } }),
    prisma.event.count({ where: { isPublished: true, date: { gte: thisMonthStart } } }),
    prisma.organization.count(),
    prisma.organization.count({ where: { isActive: true } }),
    prisma.event.findMany({
      where: { isPublished: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, title: true, date: true, sport: true, organizationName: true, createdAt: true },
    }),
    prisma.event.groupBy({
      by: ['sport'],
      where: { isPublished: true, sport: { not: null } },
      _count: { sport: true },
      orderBy: { _count: { sport: 'desc' } },
      take: 10,
    }),
    prisma.event.groupBy({
      by: ['organizationName'],
      where: { isPublished: true },
      _count: { organizationName: true },
      orderBy: { _count: { organizationName: 'desc' } },
      take: 10,
    }),
  ]);

  res.json({
    data: {
      events: {
        total: totalEvents,
        published: publishedEvents,
        upcoming: upcomingEvents,
        thisMonth: thisMonthEvents,
      },
      organizations: {
        total: totalOrganizations,
        active: activeOrganizations,
      },
      recentEvents,
      sportBreakdown: sportBreakdown.map((s) => ({
        sport: s.sport,
        count: s._count.sport,
      })),
      orgBreakdown: orgBreakdown.map((o) => ({
        organization: o.organizationName,
        count: o._count.organizationName,
      })),
    },
  });
};

// ─── Audit Logs ───────────────────────────────────────────────────────────────
export const getAuditLogs = async (req: Request, res: Response): Promise<void> => {
  const { page = '1', limit = '50', action, entityType } = req.query;

  const pageNum = Math.max(1, parseInt(page as string, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10)));
  const skip = (pageNum - 1) * limitNum;

  const where: Record<string, unknown> = {};
  if (action) where.action = action;
  if (entityType) where.entityType = entityType;

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limitNum,
    }),
    prisma.auditLog.count({ where }),
  ]);

  res.json({
    data: logs,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
    },
  });
};

// ─── All Events (including unpublished) ───────────────────────────────────────
export const getAllEvents = async (req: Request, res: Response): Promise<void> => {
  const { page = '1', limit = '50' } = req.query;
  const pageNum = Math.max(1, parseInt(page as string, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10)));
  const skip = (pageNum - 1) * limitNum;

  const [events, total] = await Promise.all([
    prisma.event.findMany({
      orderBy: { createdAt: 'desc' },
      skip,
      take: limitNum,
    }),
    prisma.event.count(),
  ]);

  res.json({
    data: events,
    pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
  });
};

// ─── All Organizations (with access codes for admin) ─────────────────────────
export const getAllOrganizations = async (_req: Request, res: Response): Promise<void> => {
  const orgs = await prisma.organization.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { events: true } } },
  });

  res.json({ data: orgs });
};

// ─── Toggle Event Published ───────────────────────────────────────────────────
export const toggleEventPublished = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  const event = await prisma.event.findUnique({ where: { id } });
  if (!event) {
    res.status(404).json({ error: 'Event not found.' });
    return;
  }

  const updated = await prisma.event.update({
    where: { id },
    data: { isPublished: !event.isPublished },
  });

  res.json({ data: updated, message: `Event ${updated.isPublished ? 'published' : 'unpublished'}.` });
};
