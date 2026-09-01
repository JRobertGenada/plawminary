/**
 * routes/ordinances.js — CRUD endpoints for campus ordinances
 */
const express = require('express');
const router  = express.Router();
const { requireAdmin } = require('../middleware/auth');

module.exports = (db) => {

  // Helper: parse stored JSON columns back into arrays
  function parseOrdinance(row) {
    if (!row) return null;

    let steps = [];
    if (typeof row.steps === 'string') {
      try { steps = JSON.parse(row.steps || '[]'); } catch { steps = []; }
    } else if (Array.isArray(row.steps)) {
      steps = row.steps;
    }

    let related = [];
    if (typeof row.related === 'string') {
      try { related = JSON.parse(row.related || '[]'); } catch { related = []; }
    } else if (Array.isArray(row.related)) {
      related = row.related;
    }

    return {
      id:        row.id,
      ref:       row.ref,
      catK:      row.cat_key,
      cat:       row.cat,
      title:     row.title,
      desc:      row.desc,
      summary:   row.summary,
      full:      row.full_text,
      steps,
      related,
      handbookSectionId: row.handbook_section_id,
      status:    row.status || 'published',
      updatedBy: row.updated_by || '',
      updatedAt: row.updated_at,
    };
  }

  // GET /api/ordinances — list all (optionally filter by catK or search)
  // Admin sees all statuses; public only sees 'published'.
  router.get('/', async (req, res, next) => {
    try {
      const { cat, q } = req.query;
      const isAdmin = req.session?.user?.role === 'admin';
      const statusFilter = isAdmin ? '' : "AND status = 'published'";
      let rows;

      if (q) {
        const like = `%${q}%`;
        [rows] = await db.query(`
          SELECT * FROM ordinances
          WHERE (title LIKE ? OR summary LIKE ? OR \`desc\` LIKE ? OR full_text LIKE ?)
          ${statusFilter}
          ORDER BY id
        `, [like, like, like, like]);
      } else if (cat) {
        [rows] = await db.query(`SELECT * FROM ordinances WHERE cat_key = ? ${statusFilter} ORDER BY id`, [cat]);
      } else {
        [rows] = await db.query(`SELECT * FROM ordinances WHERE 1=1 ${statusFilter} ORDER BY id`);
      }

      res.json(rows.map(parseOrdinance));
    } catch (err) {
      next(err);
    }
  });

  // GET /api/ordinances/:id — single ordinance
  router.get('/:id', async (req, res, next) => {
    try {
      const [rows] = await db.query('SELECT * FROM ordinances WHERE id = ?', [req.params.id]);
      if (!rows.length) return res.status(404).json({ error: 'Ordinance not found' });
      res.json(parseOrdinance(rows[0]));
    } catch (err) {
      next(err);
    }
  });

  // POST /api/ordinances — create (admin only)
  router.post('/', requireAdmin, async (req, res, next) => {
    try {
      const { ref, catK, cat, title, desc, summary, full, steps, related, handbookSectionId } = req.body;
      if (!ref || !title) return res.status(400).json({ error: 'ref and title are required' });

      const [result] = await db.query(`
        INSERT INTO ordinances (ref, cat_key, cat, title, \`desc\`, summary, full_text, steps, related, handbook_section_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        ref,
        catK || 'conduct',
        cat || 'Student Conduct',
        title,
        desc || '',
        summary || '',
        full || '',
        JSON.stringify(steps || []),
        JSON.stringify(related || []),
        handbookSectionId || null,
      ]);

      const [rows] = await db.query('SELECT * FROM ordinances WHERE id = ?', [result.insertId]);
      res.status(201).json(parseOrdinance(rows[0]));
    } catch (err) {
      next(err);
    }
  });

  // PUT /api/ordinances/:id — update (admin only)
  router.put('/:id', requireAdmin, async (req, res, next) => {
    try {
      const [existingRows] = await db.query('SELECT * FROM ordinances WHERE id = ?', [req.params.id]);
      if (!existingRows.length) return res.status(404).json({ error: 'Ordinance not found' });
      const existing = existingRows[0];

      const { ref, catK, cat, title, desc, summary, full, steps, related, handbookSectionId, status, updatedBy } = req.body;

      const newSteps = steps !== undefined
        ? JSON.stringify(steps)
        : (typeof existing.steps === 'string' ? existing.steps : JSON.stringify(existing.steps || []));

      const newRelated = related !== undefined
        ? JSON.stringify(related)
        : (typeof existing.related === 'string' ? existing.related : JSON.stringify(existing.related || []));

      const validStatuses = ['published', 'draft', 'inactive'];
      const newStatus = status !== undefined && validStatuses.includes(status) ? status : existing.status;

      await db.query(`
        UPDATE ordinances
        SET ref=?, cat_key=?, cat=?, title=?, \`desc\`=?,
            summary=?, full_text=?, steps=?, related=?, handbook_section_id=?, status=?, updated_by=?
        WHERE id=?
      `, [
        ref        !== undefined ? ref        : existing.ref,
        catK       !== undefined ? catK       : existing.cat_key,
        cat        !== undefined ? cat        : existing.cat,
        title      !== undefined ? title      : existing.title,
        desc       !== undefined ? desc       : existing.desc,
        summary    !== undefined ? summary    : existing.summary,
        full       !== undefined ? full       : existing.full_text,
        newSteps,
        newRelated,
        handbookSectionId !== undefined ? handbookSectionId : existing.handbook_section_id,
        newStatus,
        updatedBy  !== undefined ? updatedBy  : existing.updated_by,
        req.params.id,
      ]);

      const [updatedRows] = await db.query('SELECT * FROM ordinances WHERE id = ?', [req.params.id]);
      res.json(parseOrdinance(updatedRows[0]));
    } catch (err) {
      next(err);
    }
  });

  // DELETE /api/ordinances/:id — delete (admin only)
  router.delete('/:id', requireAdmin, async (req, res, next) => {
    try {
      const [result] = await db.query('DELETE FROM ordinances WHERE id = ?', [req.params.id]);
      if (result.affectedRows === 0) return res.status(404).json({ error: 'Ordinance not found' });
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  return router;
};
