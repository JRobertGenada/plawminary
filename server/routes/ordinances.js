/**
 * routes/ordinances.js — CRUD endpoints for campus ordinances
 */
const express = require('express');
const router  = express.Router();
const { requireAdmin } = require('../middleware/auth');

module.exports = (db) => {

  // Helper: parse stored JSON columns back into arrays
  function parseOrdinance(row, scenarioRows) {
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

    // Parse scenario rows — each has scenario (string), keywords (JSON array), synonyms (JSON array)
    const scenarios = (scenarioRows || []).map(s => ({
      scenario: s.scenario || '',
      keywords: Array.isArray(s.keywords) ? s.keywords : (() => { try { return JSON.parse(s.keywords || '[]'); } catch { return []; } })(),
      synonyms: Array.isArray(s.synonyms) ? s.synonyms : (() => { try { return JSON.parse(s.synonyms || '[]'); } catch { return []; } })(),
    }));

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
      scenarios,
      handbookSectionId: row.handbook_section_id,
      page:      row.page || null,
      versionId: row.version_id || null,
      status:    row.status || 'published',
      updatedBy: row.updated_by || '',
      updatedAt: row.updated_at,
    };
  }

  // Helper: fetch all scenarios for a set of ordinance ids in one query
  async function fetchScenarios(db, ids) {
    if (!ids || ids.length === 0) return {};
    const placeholders = ids.map(() => '?').join(',');
    let rows;
    try {
      [rows] = await db.query(
        `SELECT policy_id, scenario, keywords, synonyms
         FROM policy_scenarios
         WHERE policy_id IN (${placeholders})
         ORDER BY policy_id, id`,
        ids
      );
    } catch (err) {
      // Table may not exist yet (first boot before migration) — degrade gracefully
      console.warn('[ordinances] policy_scenarios not available yet:', err.message);
      rows = [];
    }
    // Group by policy_id
    const map = {};
    for (const row of rows) {
      if (!map[row.policy_id]) map[row.policy_id] = [];
      map[row.policy_id].push(row);
    }
    return map;
  }

  // GET /api/ordinances — list all (optionally filter by catK, search, or version)
  // Student-facing handbook/search queries ONLY the ACTIVE version by default.
  router.get('/', async (req, res, next) => {
    try {
      const { cat, q, version_id, versionId, all } = req.query;
      const isAdmin = req.session?.user?.role === 'admin';
      const statusFilter = isAdmin ? '' : "AND o.status = 'published'";

      const targetVersionId = version_id || versionId;
      let versionFilter = '';
      const queryParams = [];

      if (targetVersionId) {
        versionFilter = 'AND o.version_id = ?';
        queryParams.push(parseInt(targetVersionId, 10));
      } else if (!isAdmin || all !== 'true') {
        // Query ONLY the ACTIVE version by default for student-facing search
        versionFilter = "AND o.version_id = (SELECT id FROM versions WHERE status = 'active' ORDER BY release_date DESC, id DESC LIMIT 1)";
      }

      let rows;
      if (q) {
        const like = `%${q}%`;
        [rows] = await db.query(`
          SELECT o.* FROM ordinances o
          WHERE (o.title LIKE ? OR o.summary LIKE ? OR o.\`desc\` LIKE ? OR o.full_text LIKE ?)
          ${statusFilter}
          ${versionFilter}
          ORDER BY o.page ASC, o.id ASC
        `, [like, like, like, like, ...queryParams]);
      } else if (cat) {
        [rows] = await db.query(`
          SELECT o.* FROM ordinances o
          WHERE o.cat_key = ?
          ${statusFilter}
          ${versionFilter}
          ORDER BY o.page ASC, o.id ASC
        `, [cat, ...queryParams]);
      } else {
        [rows] = await db.query(`
          SELECT o.* FROM ordinances o
          WHERE 1=1
          ${statusFilter}
          ${versionFilter}
          ORDER BY o.page ASC, o.id ASC
        `, queryParams);
      }

      // Attach scenario data for Fuse.js scenario-search on the client
      const ids = rows.map(r => r.id);
      const scenarioMap = await fetchScenarios(db, ids);

      res.json(rows.map(r => parseOrdinance(r, scenarioMap[r.id] || [])));
    } catch (err) {
      next(err);
    }
  });

  // GET /api/ordinances/:id — single ordinance
  router.get('/:id', async (req, res, next) => {
    try {
      const [rows] = await db.query('SELECT * FROM ordinances WHERE id = ?', [req.params.id]);
      if (!rows.length) return res.status(404).json({ error: 'Ordinance not found' });
      const scenarioMap = await fetchScenarios(db, [rows[0].id]);
      res.json(parseOrdinance(rows[0], scenarioMap[rows[0].id] || []));
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
