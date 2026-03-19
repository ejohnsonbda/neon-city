import { Router } from 'express';
import {
  getEvents,
  getEvent,
  createEvent,
  updateEvent,
  deleteEvent,
  getSports,
} from '../controllers/eventsController';
import { authenticate, optionalAuth } from '../middleware/auth';

const router = Router();

// GET /api/events/sports  — list of distinct sports
router.get('/sports', getSports);

// GET /api/events  — public list with filtering
router.get('/', optionalAuth, getEvents);

// GET /api/events/:id  — single event
router.get('/:id', optionalAuth, getEvent);

// POST /api/events  — create (authenticated)
router.post('/', authenticate, createEvent);

// PUT /api/events/:id  — update (authenticated, owner or admin)
router.put('/:id', authenticate, updateEvent);

// DELETE /api/events/:id  — delete (authenticated, owner or admin)
router.delete('/:id', authenticate, deleteEvent);

export default router;
