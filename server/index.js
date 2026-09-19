/**
 * Plawminary Express Server (MySQL Backend)
 * Runs on port 3001 (Vite dev proxy forwards /api/* here)
 *
 * Start: node server/index.js
 * Dev:   npm run dev (from project root)
 */

const path     = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express  = require('express');
const session  = require('express-session');
const cors     = require('cors');
const { initDb, getPool, config } = require('./db');

// ─── Config ────────────────────────────────────────────────────────────────
const PORT    = process.env.PORT || 3001;
const SESSION_SECRET = process.env.SESSION_SECRET || 'plawminary-dev-secret-change-in-prod';

async function startServer() {
  // ─── Init DB ───────────────────────────────────────────────────────────────
  let db;
  try {
    db = await initDb();
  } catch (err) {
    console.error('⚠️  Database initialization failed. Server starting in limited mode.');
    console.error('   Please ensure MySQL is running and your .env credentials are correct.');
    db = await getPool();
  }

  // ─── App ───────────────────────────────────────────────────────────────────
  const app = express();

  // CORS — allow Vite dev server
  app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175'],
    credentials: true,
  }));

  // Handbook import can carry 170+ enriched policy objects; raise the limit for
  // that specific route only — the global limit stays at 100 KB everywhere else.
  app.use(
    '/api/admin/handbook/import',
    express.json({ limit: '25mb' }),
    express.urlencoded({ extended: true, limit: '25mb' })
  );

  app.use(express.json());            // 100 KB global default
  app.use(express.urlencoded({ extended: true }));

  // Session
  app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,          // set true in production with HTTPS
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 8, // 8 hours
    },
  }));

  // ─── Routes ───────────────────────────────────────────────────────────────
  app.use('/api/auth',           require('./routes/auth')(db));
  app.use('/api/ordinances',     require('./routes/ordinances')(db));
  app.use('/api/comments',       require('./routes/comments')(db));
  app.use('/api/progress',       require('./routes/progress')(db));
  app.use('/api/admin/students', require('./routes/students')(db));
  app.use('/api/admin/handbook', require('./routes/handbook')(db));
  app.use('/api/admin',          require('./routes/admin')(db));
  app.use('/api/handbook',       require('./routes/handbook')(db));
  app.use('/api/page-views',     require('./routes/pageviews')(db));
  app.use('/api/ai',             require('./routes/ai')(db));

  // Health check
  app.get('/api/health', async (req, res) => {
    try {
      await db.query('SELECT 1');
      res.json({
        status: 'ok',
        database: 'mysql',
        host: config.host,
        name: config.database,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      res.status(500).json({
        status: 'error',
        database: 'mysql',
        error: err.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  // ─── 404 handler for API routes ───────────────────────────────────────────
  app.use('/api/*', (req, res) => {
    res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
  });

  // ─── Static Files & SPA Fallback ──────────────────────────────────────────
  const distPath = path.join(__dirname, '../dist');

  // Service Worker endpoint with explicit headers for reliable PWA registration & updates
  app.get('/sw.js', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Service-Worker-Allowed', '/');
    res.sendFile(path.join(distPath, 'sw.js'));
  });

  app.use(express.static(distPath));

  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });

  // ─── Error handler ─────────────────────────────────────────────────────────
  app.use((err, req, res, next) => {
    // Payload too large (express body-parser limit exceeded)
    if (err.type === 'entity.too.large' || err.status === 413) {
      return res.status(413).json({
        error: 'Request payload too large.',
        detail: `The uploaded data exceeds the allowed limit for this endpoint. Please reduce the request size and try again.`,
      });
    }
    console.error('[Error]', err);
    res.status(500).json({ error: 'Internal server error', detail: err.message });
  });

  // ─── Start ─────────────────────────────────────────────────────────────────
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🏛️  Plawminary API running at http://0.0.0.0:${PORT}`);
    console.log(`   Database: MySQL (${config.host}:${config.port}/${config.database})`);
    console.log(`   Health:   http://localhost:${PORT}/api/health`);
    console.log(`\n   Endpoints:`);
    console.log(`   POST /api/auth/login`);
    console.log(`   POST /api/auth/register`);
    console.log(`   GET  /api/ordinances`);
    console.log(`   GET  /api/comments?ordinanceId=1`);
    console.log(`   GET  /api/progress  (auth required)`);
    console.log(`   GET  /api/admin/stats (admin only)`);
    console.log(`   POST /api/ai/search`);
    console.log(`   POST /api/ai/explain\n`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
});
