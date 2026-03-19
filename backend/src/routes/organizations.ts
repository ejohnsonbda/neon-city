import { Router } from 'express';
import {
  getOrganizations,
  getOrganization,
  createOrganization,
  updateOrganization,
  deleteOrganization,
} from '../controllers/organizationsController';
import { authenticate, requireAdmin, requireSuperAdmin } from '../middleware/auth';

const router = Router();

// GET /api/organizations  — public
router.get('/', getOrganizations);

// GET /api/organizations/:id  — public
router.get('/:id', getOrganization);

// POST /api/organizations  — admin only
router.post('/', authenticate, requireAdmin, createOrganization);

// PUT /api/organizations/:id  — admin only
router.put('/:id', authenticate, requireAdmin, updateOrganization);

// DELETE /api/organizations/:id  — super_admin only
router.delete('/:id', authenticate, requireSuperAdmin, deleteOrganization);

export default router;
