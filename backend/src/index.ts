import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import path from 'path';
import dotenv from 'dotenv';
import { rateLimit } from 'express-rate-limit';

// Load environment variables
dotenv.config();

// Route imports
import authRoutes from './routes/auth';
import eventRoutes from './routes/events';
import organizationRoutes from './routes/organizations';
import adminRoutes from './routes/admin';
import uploadRoutes from './routes/upload';

// Middleware imports
import { errorHandler } from './middleware/errorHandler';
import { notFound } from './middleware/notFound';

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

// ─── Security Middleware ────────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// ─── CORS ───────────────────────────────────────────────────────────────────
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ─── Rate Limiting ──────────────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', limiter);

// Stricter limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many authentication attempts, please try again later.' },
});
app.use('/api/auth/', authLimiter);

// ─── Body Parsing ───────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(compression());

// ─── Logging ────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined'));
}

// ─── Static Files ───────────────────────────────────────────────────────────
const uploadsDir = process.env.UPLOAD_DIR || path.resolve(__dirname, '../uploads');
app.use('/uploads', express.static(uploadsDir));

// Serve the HTML frontend from /public
// Works both locally (../../public) and on Render (same relative path from dist/)
const publicDir = path.resolve(__dirname, '../../public');
app.use(express.static(publicDir, {
  maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0,
}));

// ─── Health Check ───────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'SportCal API',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// ─── API Routes ─────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/organizations', organizationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/upload', uploadRoutes);

// ─── API Info ───────────────────────────────────────────────────────────────
app.get('/api', (_req, res) => {
  res.json({
    name: 'SportCal API',
    version: '2.0.0',
    description: 'Bermuda Sports Events Calendar Backend',
    endpoints: {
      auth: '/api/auth',
      events: '/api/events',
      organizations: '/api/organizations',
      admin: '/api/admin',
      upload: '/api/upload',
    },
  });
});

// ─── SPA Fallback — serve index.html for all non-API routes ────────────────
app.get('*', (_req, res) => {
  const indexPath = path.resolve(__dirname, '../../public/index.html');
  res.sendFile(indexPath, err => {
    if (err) res.status(404).json({ error: 'Not found' });
  });
});

// ─── Error Handling ─────────────────────────────────────────────────────────
app.use(errorHandler);

// ─── Start Server ───────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════╗
║          SportCal API v2.0.0                 ║
║          Bermuda Sports Events Calendar      ║
╠══════════════════════════════════════════════╣
║  Server:  http://localhost:${PORT}              ║
║  Health:  http://localhost:${PORT}/health       ║
║  API:     http://localhost:${PORT}/api          ║
║  Env:     ${process.env.NODE_ENV}                    ║
╚══════════════════════════════════════════════╝
  `);
});

export default app;
