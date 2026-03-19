import { Request, Response } from 'express';

export const notFound = (req: Request, res: Response): void => {
  res.status(404).json({
    error: `Route not found: ${req.method} ${req.originalUrl}`,
    availableRoutes: [
      'GET /health',
      'GET /api',
      'POST /api/auth/login',
      'POST /api/auth/logout',
      'GET /api/auth/me',
      'GET /api/events',
      'GET /api/events/:id',
      'POST /api/events',
      'PUT /api/events/:id',
      'DELETE /api/events/:id',
      'GET /api/organizations',
      'GET /api/admin/stats',
      'GET /api/admin/audit-logs',
    ],
  });
};
