import { Router } from 'express';
import { login, getMe, logout } from '../controllers/authController';
import { authenticate } from '../middleware/auth';

const router = Router();

// POST /api/auth/login
router.post('/login', login);

// GET /api/auth/me  (requires token)
router.get('/me', authenticate, getMe);

// POST /api/auth/logout
router.post('/logout', authenticate, logout);

export default router;
