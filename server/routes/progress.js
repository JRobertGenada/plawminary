/**
 * routes/progress.js — Handbook reading progress per user
 */
const express = require('express');
const router  = express.Router();
const { requireAuth } = require('../middleware/auth');

module.exports = (db) => {

  // GET /api/progress — get all progress for the logged-in user
  router.get('/', requireAuth, async (req, res, next) => {
    try {
      const [rows] = await db.query('SELECT * FROM progress WHERE user_id = ?', [req.user.id]);
      // Return as an object keyed by section_key for easy lookup on frontend
      const result = {};
      for (const row of rows) {
        result[row.section_key] = { page: row.page, readAt: row.read_at };
      }
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // POST /api/progress — mark a section as read
  router.post('/', requireAuth, async (req, res, next) => {
    try {
      const { sectionKey, page } = req.body;
      if (!sectionKey || page == null) {
        return res.status(400).json({ error: 'sectionKey and page are required' });
      }

      await db.query(`
        INSERT INTO progress (user_id, section_key, page, read_at)
        VALUES (?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE page = VALUES(page), read_at = NOW()
      `, [req.user.id, sectionKey, page]);

      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  // DELETE /api/progress — reset all progress for the logged-in user
  router.delete('/', requireAuth, async (req, res, next) => {
    try {
      await db.query('DELETE FROM progress WHERE user_id = ?', [req.user.id]);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  return router;
};
