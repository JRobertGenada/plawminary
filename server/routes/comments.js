/**
 * routes/comments.js — Student feedback comments for ordinances and handbook sections
 */
const express = require('express');
const router  = express.Router();
const { requireAuth } = require('../middleware/auth');

module.exports = (db) => {

  function parseComment(row) {
    if (!row) return null;

    let agrees = [];
    if (typeof row.agrees === 'string') {
      try { agrees = JSON.parse(row.agrees || '[]'); } catch { agrees = []; }
    } else if (Array.isArray(row.agrees)) {
      agrees = row.agrees;
    }

    return {
      id:           row.id,
      ordinanceId:  row.ordinance_id,
      userId:       row.user_id,
      userName:     row.user_name,
      userDept:     row.user_dept,
      type:         row.type,
      body:         row.body,
      agrees,
      createdAt:    row.created_at,
    };
  }

  // GET /api/comments?ordinanceId=1 — list comments for an ordinance
  router.get('/', async (req, res, next) => {
    try {
      const { ordinanceId } = req.query;
      if (!ordinanceId) return res.status(400).json({ error: 'ordinanceId is required' });

      const [rows] = await db.query(
        'SELECT * FROM comments WHERE ordinance_id = ? ORDER BY created_at DESC',
        [ordinanceId]
      );
      res.json(rows.map(parseComment));
    } catch (err) {
      next(err);
    }
  });

  // POST /api/comments — create a comment (auth required)
  router.post('/', requireAuth, async (req, res, next) => {
    try {
      const { ordinanceId, type, body } = req.body;
      const { id: userId, name: userName, dept: userDept } = req.user;

      if (!ordinanceId || !body?.trim()) {
        return res.status(400).json({ error: 'ordinanceId and body are required' });
      }
      const validTypes = ['question', 'revision', 'policy'];
      const safeType = validTypes.includes(type) ? type : 'question';

      const [result] = await db.query(`
        INSERT INTO comments (ordinance_id, user_id, user_name, user_dept, type, body, agrees)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [ordinanceId, userId, userName, userDept, safeType, body.trim(), JSON.stringify([])]);

      const [rows] = await db.query('SELECT * FROM comments WHERE id = ?', [result.insertId]);
      res.status(201).json(parseComment(rows[0]));
    } catch (err) {
      next(err);
    }
  });

  // POST /api/comments/:id/agree — toggle agree (auth required)
  router.post('/:id/agree', requireAuth, async (req, res, next) => {
    try {
      const [rows] = await db.query('SELECT * FROM comments WHERE id = ?', [req.params.id]);
      if (!rows.length) return res.status(404).json({ error: 'Comment not found' });
      const comment = rows[0];

      let agrees = [];
      if (typeof comment.agrees === 'string') {
        try { agrees = JSON.parse(comment.agrees || '[]'); } catch { agrees = []; }
      } else if (Array.isArray(comment.agrees)) {
        agrees = comment.agrees;
      }

      const uid = req.user.id;
      const idx = agrees.indexOf(uid);

      if (idx === -1) agrees.push(uid);
      else agrees.splice(idx, 1);

      await db.query('UPDATE comments SET agrees = ? WHERE id = ?', [JSON.stringify(agrees), comment.id]);
      res.json({ agrees });
    } catch (err) {
      next(err);
    }
  });

  // DELETE /api/comments/:id — delete (admin or own comment)
  router.delete('/:id', requireAuth, async (req, res, next) => {
    try {
      const [rows] = await db.query('SELECT * FROM comments WHERE id = ?', [req.params.id]);
      if (!rows.length) return res.status(404).json({ error: 'Comment not found' });
      const comment = rows[0];

      if (req.user.role !== 'admin' && comment.user_id !== req.user.id) {
        return res.status(403).json({ error: 'Not allowed to delete this comment' });
      }

      await db.query('DELETE FROM comments WHERE id = ?', [req.params.id]);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  return router;
};
