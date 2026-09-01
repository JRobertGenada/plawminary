/**
 * routes/admin.js — Admin-only management endpoints
 */
const express = require('express');
const bcrypt  = require('bcrypt');
const router  = express.Router();
const { requireAdmin } = require('../middleware/auth');

module.exports = (db) => {

  // All routes in this file require admin
  router.use(requireAdmin);

  // ── Users ──────────────────────────────────────────────────────────────────

  // GET /api/admin/users
  router.get('/users', async (req, res, next) => {
    try {
      const [users] = await db.query('SELECT id, name, dept, role, created_at FROM users ORDER BY role DESC, name');
      res.json(users);
    } catch (err) {
      next(err);
    }
  });

  // POST /api/admin/users — add a new student
  router.post('/users', async (req, res, next) => {
    try {
      const { id, name, dept, role = 'user', password } = req.body;
      if (!id || !name || !password) {
        return res.status(400).json({ error: 'id, name, and password are required' });
      }

      const [existing] = await db.query('SELECT id FROM users WHERE id = ?', [id]);
      if (existing.length > 0) return res.status(409).json({ error: 'User ID already exists' });

      const hash = await bcrypt.hash(password, 10);
      await db.query(
        'INSERT INTO users (id, name, dept, role, password_hash) VALUES (?, ?, ?, ?, ?)',
        [id, name, dept || '', role, hash]
      );
      res.status(201).json({ success: true, id });
    } catch (err) {
      next(err);
    }
  });

  // DELETE /api/admin/users/:id — remove a student
  router.delete('/users/:id', async (req, res, next) => {
    try {
      if (req.params.id === 'admin') {
        return res.status(400).json({ error: 'Cannot delete the admin account' });
      }
      const [result] = await db.query('DELETE FROM users WHERE id = ?', [req.params.id]);
      if (result.affectedRows === 0) return res.status(404).json({ error: 'User not found' });
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  // PATCH /api/admin/users/:id/password — reset a student password
  router.patch('/users/:id/password', async (req, res, next) => {
    try {
      const { password } = req.body;
      if (!password) return res.status(400).json({ error: 'password is required' });

      const hash = await bcrypt.hash(password, 10);
      const [result] = await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.params.id]);
      if (result.affectedRows === 0) return res.status(404).json({ error: 'User not found' });
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  // ── Stats & Analytics ──────────────────────────────────────────────────────

  // GET /api/admin/stats — dashboard KPIs + analytics
  router.get('/stats', async (req, res, next) => {
    try {
      const [[ordCount]]  = await db.query("SELECT COUNT(*) as c FROM ordinances WHERE status != 'inactive'");
      const [[userCount]] = await db.query("SELECT COUNT(*) as c FROM users WHERE role='user'");
      const [[commCount]] = await db.query('SELECT COUNT(*) as c FROM comments');
      const [[progCount]] = await db.query('SELECT COUNT(*) as c FROM progress');
      const [[pendingCount]] = await db.query('SELECT COUNT(*) as c FROM comments WHERE resolved = 0');

      // Comments by type
      const [byType] = await db.query('SELECT type, COUNT(*) as count FROM comments GROUP BY type');

      // Recent comments (for suggestions panel)
      const [recent] = await db.query(`
        SELECT c.*, o.title as ordinance_title
        FROM comments c
        LEFT JOIN ordinances o ON o.id = c.ordinance_id
        ORDER BY c.created_at DESC LIMIT 10
      `);

      // ── Weekly page_views (last 5 weeks) ────────────────────────────────────
      const [weeklyViews] = await db.query(`
        SELECT
          YEARWEEK(viewed_at, 1)           AS yw,
          DATE_FORMAT(
            MIN(viewed_at), '%b %d'
          )                                AS week,
          COUNT(*)                         AS views
        FROM page_views
        WHERE viewed_at >= DATE_SUB(NOW(), INTERVAL 5 WEEK)
        GROUP BY yw
        ORDER BY yw ASC
        LIMIT 5
      `);

      // ── Department completion (from progress JOIN users) ──────────────────
      const [deptStats] = await db.query(`
        SELECT
          u.dept,
          COUNT(DISTINCT u.id)                AS students,
          COUNT(DISTINCT p.user_id)           AS completed,
          ROUND(
            COUNT(DISTINCT p.user_id) * 100.0 / NULLIF(COUNT(DISTINCT u.id), 0)
          , 0)                                AS pct
        FROM users u
        LEFT JOIN (
          SELECT DISTINCT user_id
          FROM progress
        ) p ON p.user_id = u.id
        WHERE u.role = 'user'
        GROUP BY u.dept
        ORDER BY pct DESC
      `);

      // ── Top sections by page_views ────────────────────────────────────────
      const [topSections] = await db.query(`
        SELECT
          target_id   AS sectionKey,
          COUNT(*)    AS views
        FROM page_views
        WHERE target_type = 'ordinance'
        GROUP BY target_id
        ORDER BY views DESC
        LIMIT 5
      `);

      // Compute maxViews for percentage bars on the frontend
      const maxViews = topSections.length > 0 ? topSections[0].views : 1;
      const topSectionsWithPct = topSections.map(s => ({
        ...s,
        pct: Math.round((s.views / maxViews) * 100),
      }));

      res.json({
        ordinanceCount:  ordCount.c,
        userCount:       userCount.c,
        commentCount:    commCount.c,
        progressCount:   progCount.c,
        pendingCount:    pendingCount.c,
        commentsByType:  byType,
        recentComments:  recent.map(parseAgrees),
        weeklyViews,
        deptStats,
        topSections: topSectionsWithPct,
      });
    } catch (err) {
      next(err);
    }
  });

  // ── Comments / Suggestions ─────────────────────────────────────────────────

  // GET /api/admin/comments — all comments with moderation
  router.get('/comments', async (req, res, next) => {
    try {
      const [rows] = await db.query(`
        SELECT c.*, o.title as ordinance_title
        FROM comments c
        LEFT JOIN ordinances o ON o.id = c.ordinance_id
        ORDER BY c.created_at DESC
      `);
      res.json(rows.map(parseAgrees));
    } catch (err) {
      next(err);
    }
  });

  // PATCH /api/admin/comments/:id/resolve — toggle resolved flag
  router.patch('/comments/:id/resolve', async (req, res, next) => {
    try {
      const [rows] = await db.query('SELECT id, resolved FROM comments WHERE id = ?', [req.params.id]);
      if (!rows.length) return res.status(404).json({ error: 'Comment not found' });

      const newState = rows[0].resolved ? 0 : 1;
      await db.query('UPDATE comments SET resolved = ? WHERE id = ?', [newState, req.params.id]);
      res.json({ success: true, resolved: !!newState });
    } catch (err) {
      next(err);
    }
  });

  // DELETE /api/admin/comments/:id — hard delete (admin only)
  router.delete('/comments/:id', async (req, res, next) => {
    try {
      const [result] = await db.query('DELETE FROM comments WHERE id = ?', [req.params.id]);
      if (result.affectedRows === 0) return res.status(404).json({ error: 'Comment not found' });
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  // ── Versions ───────────────────────────────────────────────────────────────

  // GET /api/admin/versions
  router.get('/versions', async (req, res, next) => {
    try {
      const [rows] = await db.query('SELECT * FROM versions ORDER BY release_date DESC');
      res.json(rows);
    } catch (err) {
      next(err);
    }
  });

  // POST /api/admin/versions — create a new version entry
  router.post('/versions', async (req, res, next) => {
    try {
      const { label, description, sections, releaseDate } = req.body;
      if (!label || !releaseDate) {
        return res.status(400).json({ error: 'label and releaseDate are required' });
      }

      // Set all others to inactive first
      await db.query("UPDATE versions SET status = 'inactive'");

      const [result] = await db.query(
        'INSERT INTO versions (label, description, sections, status, edited_by, release_date) VALUES (?, ?, ?, ?, ?, ?)',
        [label, description || '', sections || 0, 'active', req.session.user.name, releaseDate]
      );

      const [rows] = await db.query('SELECT * FROM versions WHERE id = ?', [result.insertId]);
      res.status(201).json(rows[0]);
    } catch (err) {
      next(err);
    }
  });

  // ── Helpers ────────────────────────────────────────────────────────────────

  function parseAgrees(r) {
    let agrees = [];
    if (typeof r.agrees === 'string') {
      try { agrees = JSON.parse(r.agrees || '[]'); } catch { agrees = []; }
    } else if (Array.isArray(r.agrees)) {
      agrees = r.agrees;
    }
    return { ...r, agrees };
  }

  return router;
};
