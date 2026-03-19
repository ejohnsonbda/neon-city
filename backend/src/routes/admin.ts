import { Router } from 'express';
import {
  getStats,
  getAuditLogs,
  getAllEvents,
  getAllOrganizations,
  toggleEventPublished,
} from '../controllers/adminController';
import { authenticate, requireAdmin } from '../middleware/auth';

const router = Router();

// All admin routes require authentication + admin role
router.use(authenticate, requireAdmin);

// GET /api/admin/stats
router.get('/stats', getStats);

// GET /api/admin/audit-logs
router.get('/audit-logs', getAuditLogs);

// GET /api/admin/events  — all events including unpublished
router.get('/events', getAllEvents);

// GET /api/admin/organizations  — with access codes
router.get('/organizations', getAllOrganizations);

// PATCH /api/admin/events/:id/toggle-published
router.patch('/events/:id/toggle-published', toggleEventPublished);

export default router;
