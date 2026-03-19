import { Request, Response } from 'express';
import prisma from '../config/database';

// ─── List Events ─────────────────────────────────────────────────────────────
export const getEvents = async (req: Request, res: Response): Promise<void> => {
  const {
    sport,
    organization,
    search,
    from,
    to,
    page = '1',
    limit = '50',
    sort = 'date_asc',
  } = req.query;

  const pageNum = Math.max(1, parseInt(page as string, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10)));
  const skip = (pageNum - 1) * limitNum;

  // Build where clause
  const where: Record<string, unknown> = { isPublished: true };

  if (sport && sport !== 'All Sports') {
    where.sport = sport as string;
  }

  if (organization) {
    where.organizationId = organization as string;
  }

  if (search) {
    where.OR = [
      { title: { contains: search as string } },
      { description: { contains: search as string } },
      { location: { contains: search as string } },
      { organizationName: { contains: search as string } },
    ];
  }

  if (from || to) {
    where.date = {};
    if (from) (where.date as Record<string, string>).gte = from as string;
    if (to) (where.date as Record<string, string>).lte = to as string;
  }

  // Build order by
  let orderBy: Record<string, string> = { date: 'asc' };
  if (sort === 'date_desc') orderBy = { date: 'desc' };
  else if (sort === 'created_desc') orderBy = { createdAt: 'desc' };
  else if (sort === 'created_asc') orderBy = { createdAt: 'asc' };
  else if (sort === 'title_asc') orderBy = { title: 'asc' };

  const [events, total] = await Promise.all([
    prisma.event.findMany({
      where,
      orderBy,
      skip,
      take: limitNum,
    }),
    prisma.event.count({ where }),
  ]);

  res.json({
    data: events,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
      hasNext: pageNum * limitNum < total,
      hasPrev: pageNum > 1,
    },
  });
};

// ─── Get Single Event ─────────────────────────────────────────────────────────
export const getEvent = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  const event = await prisma.event.findUnique({ where: { id } });

  if (!event) {
    res.status(404).json({ error: 'Event not found.' });
    return;
  }

  res.json({ data: event });
};

// ─── Create Event ─────────────────────────────────────────────────────────────
export const createEvent = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  const {
    title,
    description,
    date,
    time,
    location,
    imageUrl,
    sport,
    organizationName,
  } = req.body;

  if (!title || !date) {
    res.status(400).json({ error: 'Title and date are required.' });
    return;
  }

  // Admins can post on behalf of any org; regular users post for their own org
  const isAdmin = req.user.role === 'admin' || req.user.role === 'super_admin';
  const orgId = isAdmin ? (req.body.organizationId || req.user.organizationId) : req.user.organizationId;
  const orgName = isAdmin ? (organizationName || req.user.organizationName) : req.user.organizationName;

  // Verify organization exists (skip for super_admin virtual org)
  if (orgId !== 'super_admin') {
    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) {
      res.status(400).json({ error: 'Organization not found.' });
      return;
    }
  }

  const event = await prisma.event.create({
    data: {
      title: title.trim(),
      description: description?.trim() || null,
      date,
      time: time || null,
      location: location?.trim() || null,
      organizationId: orgId,
      organizationName: orgName,
      imageUrl: imageUrl || null,
      sport: sport || null,
      isPublished: true,
    },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      action: 'CREATE',
      entityType: 'event',
      entityId: event.id,
      actorId: req.user.userId,
      actorOrg: req.user.organizationName,
      details: JSON.stringify({ title: event.title }),
      ipAddress: req.ip,
    },
  });

  res.status(201).json({ data: event, message: 'Event created successfully.' });
};

// ─── Update Event ─────────────────────────────────────────────────────────────
export const updateEvent = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  const { id } = req.params;
  const existing = await prisma.event.findUnique({ where: { id } });

  if (!existing) {
    res.status(404).json({ error: 'Event not found.' });
    return;
  }

  // Check ownership or admin
  const isAdmin = req.user.role === 'admin' || req.user.role === 'super_admin';
  const isOwner = existing.organizationId === req.user.organizationId;

  if (!isAdmin && !isOwner) {
    res.status(403).json({ error: 'You do not have permission to edit this event.' });
    return;
  }

  const {
    title,
    description,
    date,
    time,
    location,
    imageUrl,
    sport,
    organizationName,
    isPublished,
  } = req.body;

  const updated = await prisma.event.update({
    where: { id },
    data: {
      ...(title !== undefined && { title: title.trim() }),
      ...(description !== undefined && { description: description?.trim() || null }),
      ...(date !== undefined && { date }),
      ...(time !== undefined && { time: time || null }),
      ...(location !== undefined && { location: location?.trim() || null }),
      ...(imageUrl !== undefined && { imageUrl: imageUrl || null }),
      ...(sport !== undefined && { sport: sport || null }),
      ...(organizationName !== undefined && isAdmin && { organizationName }),
      ...(isPublished !== undefined && isAdmin && { isPublished }),
    },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      action: 'UPDATE',
      entityType: 'event',
      entityId: id,
      actorId: req.user.userId,
      actorOrg: req.user.organizationName,
      details: JSON.stringify({ title: updated.title }),
      ipAddress: req.ip,
    },
  });

  res.json({ data: updated, message: 'Event updated successfully.' });
};

// ─── Delete Event ─────────────────────────────────────────────────────────────
export const deleteEvent = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  const { id } = req.params;
  const existing = await prisma.event.findUnique({ where: { id } });

  if (!existing) {
    res.status(404).json({ error: 'Event not found.' });
    return;
  }

  const isAdmin = req.user.role === 'admin' || req.user.role === 'super_admin';
  const isOwner = existing.organizationId === req.user.organizationId;

  if (!isAdmin && !isOwner) {
    res.status(403).json({ error: 'You do not have permission to delete this event.' });
    return;
  }

  await prisma.event.delete({ where: { id } });

  // Audit log
  await prisma.auditLog.create({
    data: {
      action: 'DELETE',
      entityType: 'event',
      entityId: id,
      actorId: req.user.userId,
      actorOrg: req.user.organizationName,
      details: JSON.stringify({ title: existing.title }),
      ipAddress: req.ip,
    },
  });

  res.json({ message: 'Event deleted successfully.' });
};

// ─── Get Sports List ──────────────────────────────────────────────────────────
export const getSports = async (_req: Request, res: Response): Promise<void> => {
  const sports = await prisma.event.findMany({
    where: { isPublished: true, sport: { not: null } },
    select: { sport: true },
    distinct: ['sport'],
    orderBy: { sport: 'asc' },
  });

  res.json({
    data: ['All Sports', ...sports.map((s) => s.sport).filter(Boolean)],
  });
};
