/**
 * routes/admin.js — Admin-only management endpoints
 */
const express = require('express');
const bcrypt  = require('bcrypt');
const fs      = require('fs');
const path    = require('path');
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

  // GET /api/admin/users/reset-preview — preflight summary before student accounts reset
  router.get('/users/reset-preview', async (req, res, next) => {
    try {
      const [students] = await db.query(
        "SELECT id, name, email, role FROM users WHERE role IN ('user', 'student') AND role != 'admin' AND id != 'admin'"
      );
      const [[adminCount]] = await db.query(
        "SELECT COUNT(*) as c FROM users WHERE role = 'admin'"
      );
      const [[masterRegistered]] = await db.query(
        "SELECT COUNT(*) as c FROM student_records WHERE is_registered = 1"
      );

      let progressCount = 0;
      let commentsCount = 0;

      if (students.length > 0) {
        const studentIds = students.map((s) => s.id);
        const [[prog]] = await db.query(
          "SELECT COUNT(*) as c FROM progress WHERE user_id IN (?)",
          [studentIds]
        );
        const [[comm]] = await db.query(
          "SELECT COUNT(*) as c FROM comments WHERE user_id IN (?)",
          [studentIds]
        );
        progressCount = prog?.c || 0;
        commentsCount = comm?.c || 0;
      }

      res.json({
        studentAccountsCount: students.length,
        adminAccountsCount: adminCount?.c || 0,
        masterRegisteredCount: masterRegistered?.c || 0,
        cascadedProgressCount: progressCount,
        cascadedCommentsCount: commentsCount,
      });
    } catch (err) {
      next(err);
    }
  });

  // POST /api/admin/users/reset-students — safe admin-only student account reset
  router.post('/users/reset-students', async (req, res, next) => {
    let conn;
    try {
      conn = await db.getConnection();
      await conn.beginTransaction();

      // 1. Identify all student accounts to be deleted, explicitly preserving admins
      const [students] = await conn.query(
        "SELECT id, email, role FROM users WHERE role IN ('user', 'student') AND role != 'admin' AND id != 'admin'"
      );
      const [[adminCountRow]] = await conn.query(
        "SELECT COUNT(*) as c FROM users WHERE role = 'admin'"
      );
      const preservedAdminCount = adminCountRow?.c || 0;

      if (students.length === 0) {
        // Also ensure any lingering is_registered flags are cleared
        const [resetRes] = await conn.query(
          "UPDATE student_records SET is_registered = 0, registered_at = NULL WHERE is_registered = 1"
        );
        await conn.commit();
        return res.json({
          success: true,
          deletedCount: 0,
          resetRecordsCount: resetRes.affectedRows || 0,
          cascadedProgressCount: 0,
          cascadedCommentsCount: 0,
          preservedAdminCount,
          message: 'No student accounts found to reset. Master list registration status verified.',
        });
      }

      const studentIds = students.map((s) => s.id);
      const studentEmails = students.map((s) => s.email).filter(Boolean);

      // Pre-count cascaded items for summary report
      const [[progRow]] = await conn.query(
        "SELECT COUNT(*) as c FROM progress WHERE user_id IN (?)",
        [studentIds]
      );
      const [[commRow]] = await conn.query(
        "SELECT COUNT(*) as c FROM comments WHERE user_id IN (?)",
        [studentIds]
      );

      const cascadedProgressCount = progRow?.c || 0;
      const cascadedCommentsCount = commRow?.c || 0;

      // 2. Reset student_records.is_registered to 0 for corresponding master-list records
      let resetSql = "UPDATE student_records SET is_registered = 0, registered_at = NULL WHERE is_registered = 1";
      const resetParams = [];

      if (studentIds.length > 0) {
        resetSql += " OR LOWER(TRIM(student_no)) IN (?)";
        resetParams.push(studentIds.map((id) => String(id).toLowerCase().trim()));
      }
      if (studentEmails.length > 0) {
        resetSql += " OR LOWER(TRIM(email)) IN (?)";
        resetParams.push(studentEmails.map((m) => String(m).toLowerCase().trim()));
      }

      const [resetResult] = await conn.query(resetSql, resetParams);
      const resetRecordsCount = resetResult.affectedRows || 0;

      // 3. Nullify page_views user_id references for clean telemetry (page_views has no FK constraint)
      await conn.query(
        "UPDATE page_views SET user_id = NULL WHERE user_id IN (?)",
        [studentIds]
      );

      // 4. Delete the student accounts (comments and progress cascade automatically via FK)
      const [deleteResult] = await conn.query(
        "DELETE FROM users WHERE role IN ('user', 'student') AND role != 'admin' AND id != 'admin'"
      );
      const deletedCount = deleteResult.affectedRows || 0;

      // 5. Commit transaction
      await conn.commit();

      return res.json({
        success: true,
        deletedCount,
        resetRecordsCount,
        cascadedProgressCount,
        cascadedCommentsCount,
        preservedAdminCount,
        message: `Successfully deleted ${deletedCount} student account(s), preserved ${preservedAdminCount} admin account(s), and reset master list registration status.`,
      });
    } catch (err) {
      if (conn) {
        try {
          await conn.rollback();
        } catch (rbErr) {
          console.error('Error during reset rollback:', rbErr);
        }
      }
      next(err);
    } finally {
      if (conn) conn.release();
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

  // ── Versions Management ───────────────────────────────────────────────────

  const uploadsDir = path.join(__dirname, '../uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  // GET /api/admin/versions — list all versions with accurate policy count
  router.get('/versions', async (req, res, next) => {
    try {
      const [rows] = await db.query(`
        SELECT v.*,
          COALESCE((SELECT COUNT(*) FROM ordinances o WHERE o.version_id = v.id), 0) AS policy_count
        FROM versions v
        ORDER BY v.release_date DESC, v.id DESC
      `);
      res.json(rows);
    } catch (err) {
      next(err);
    }
  });

  // GET /api/admin/versions/compare?from=:fromId&to=:toId — deterministic version diff
  router.get('/versions/compare', async (req, res, next) => {
    try {
      const fromId = parseInt(req.query.from, 10);
      const toId   = parseInt(req.query.to, 10);

      if (!fromId || !toId) {
        return res.status(400).json({ error: 'Both "from" and "to" version IDs are required' });
      }

      if (fromId === toId) {
        return res.status(400).json({ error: 'Cannot compare a version with itself. Please select two different versions.' });
      }

      const [vRows] = await db.query('SELECT * FROM versions WHERE id IN (?, ?)', [fromId, toId]);
      const fromVersion = vRows.find(v => v.id === fromId);
      const toVersion   = vRows.find(v => v.id === toId);

      if (!fromVersion || !toVersion) {
        return res.status(404).json({ error: 'One or both versions not found' });
      }

      const [fromOrds] = await db.query('SELECT * FROM ordinances WHERE version_id = ? ORDER BY ref, id', [fromId]);
      const [toOrds]   = await db.query('SELECT * FROM ordinances WHERE version_id = ? ORDER BY ref, id', [toId]);

      const parseSteps = (steps) => {
        if (!steps) return [];
        if (Array.isArray(steps)) return steps;
        try { return JSON.parse(steps); } catch { return []; }
      };

      const fromMap = new Map();
      for (const o of fromOrds) {
        const key = (o.ref || '').trim().toUpperCase();
        if (key) fromMap.set(key, o);
      }

      const toMap = new Map();
      for (const o of toOrds) {
        const key = (o.ref || '').trim().toUpperCase();
        if (key) toMap.set(key, o);
      }

      const added = [];
      const removed = [];
      const modified = [];
      const unchanged = [];

      // Check items in target (to)
      for (const [refKey, toItem] of toMap.entries()) {
        if (!fromMap.has(refKey)) {
          added.push({
            id: toItem.id,
            ref: toItem.ref,
            title: toItem.title,
            cat: toItem.cat,
            catKey: toItem.cat_key,
            page: toItem.page,
            summary: toItem.summary,
          });
        } else {
          const fromItem = fromMap.get(refKey);
          const changes = {};

          if ((fromItem.title || '').trim() !== (toItem.title || '').trim()) {
            changes.title = { from: fromItem.title, to: toItem.title };
          }
          if ((fromItem.cat_key || '').trim() !== (toItem.cat_key || '').trim() || (fromItem.cat || '').trim() !== (toItem.cat || '').trim()) {
            changes.category = { from: fromItem.cat, to: toItem.cat };
          }
          if ((fromItem.summary || '').trim() !== (toItem.summary || '').trim()) {
            changes.summary = { from: fromItem.summary, to: toItem.summary };
          }
          if ((fromItem.desc || '').trim() !== (toItem.desc || '').trim()) {
            changes.desc = { from: fromItem.desc, to: toItem.desc };
          }
          if ((fromItem.full_text || '').trim() !== (toItem.full_text || '').trim()) {
            changes.fullText = { from: fromItem.full_text, to: toItem.full_text };
          }
          if (Number(fromItem.page) !== Number(toItem.page)) {
            changes.page = { from: fromItem.page, to: toItem.page };
          }

          const fromSteps = JSON.stringify(parseSteps(fromItem.steps));
          const toSteps   = JSON.stringify(parseSteps(toItem.steps));
          if (fromSteps !== toSteps) {
            changes.steps = { from: parseSteps(fromItem.steps), to: parseSteps(toItem.steps) };
          }

          if (Object.keys(changes).length > 0) {
            modified.push({
              ref: toItem.ref,
              fromId: fromItem.id,
              toId: toItem.id,
              fromTitle: fromItem.title,
              toTitle: toItem.title,
              cat: toItem.cat,
              page: toItem.page,
              changes,
            });
          } else {
            unchanged.push({
              id: toItem.id,
              ref: toItem.ref,
              title: toItem.title,
              cat: toItem.cat,
              page: toItem.page,
            });
          }
        }
      }

      // Check items in base (from) that were removed in target
      for (const [refKey, fromItem] of fromMap.entries()) {
        if (!toMap.has(refKey)) {
          removed.push({
            id: fromItem.id,
            ref: fromItem.ref,
            title: fromItem.title,
            cat: fromItem.cat,
            page: fromItem.page,
            summary: fromItem.summary,
          });
        }
      }

      res.json({
        fromVersion: { id: fromVersion.id, label: fromVersion.label, status: fromVersion.status, releaseDate: fromVersion.release_date },
        toVersion:   { id: toVersion.id,   label: toVersion.label,   status: toVersion.status,   releaseDate: toVersion.release_date },
        summary: {
          totalFrom: fromOrds.length,
          totalTo:   toOrds.length,
          added:     added.length,
          modified:  modified.length,
          removed:   removed.length,
          unchanged: unchanged.length,
        },
        diff: {
          added,
          modified,
          removed,
          unchanged,
        },
      });
    } catch (err) {
      next(err);
    }
  });

  // GET /api/admin/versions/:id — single version details
  router.get('/versions/:id', async (req, res, next) => {
    try {
      const [rows] = await db.query(`
        SELECT v.*,
          COALESCE((SELECT COUNT(*) FROM ordinances o WHERE o.version_id = v.id), 0) AS policy_count
        FROM versions v
        WHERE v.id = ?
      `, [req.params.id]);

      if (rows.length === 0) {
        return res.status(404).json({ error: 'Version not found' });
      }

      res.json(rows[0]);
    } catch (err) {
      next(err);
    }
  });

  // GET /api/admin/versions/:id/policies — get all policies belonging to this version
  router.get('/versions/:id/policies', async (req, res, next) => {
    try {
      const [rows] = await db.query(`
        SELECT * FROM ordinances
        WHERE version_id = ?
        ORDER BY page ASC, ref ASC, id ASC
      `, [req.params.id]);

      const parseJson = (val) => {
        if (!val) return [];
        if (Array.isArray(val)) return val;
        try { return JSON.parse(val); } catch { return []; }
      };

      const policies = rows.map(r => ({
        id: r.id,
        ref: r.ref,
        catKey: r.cat_key,
        cat: r.cat,
        title: r.title,
        desc: r.desc,
        summary: r.summary,
        full: r.full_text,
        steps: parseJson(r.steps),
        related: parseJson(r.related),
        handbookSectionId: r.handbook_section_id,
        page: r.page,
        versionId: r.version_id,
        status: r.status,
        updatedBy: r.updated_by,
        updatedAt: r.updated_at,
      }));

      res.json(policies);
    } catch (err) {
      next(err);
    }
  });

  // POST /api/admin/versions — create a new version entry
  router.post('/versions', async (req, res, next) => {
    const conn = await db.getConnection();
    try {
      const { label, description, releaseDate, changeNotes, status = 'draft' } = req.body;
      if (!label || !label.trim() || !releaseDate) {
        return res.status(400).json({ error: 'label and releaseDate are required' });
      }

      await conn.beginTransaction();

      const newStatus = status === 'active' ? 'active' : 'draft';

      if (newStatus === 'active') {
        // If activating immediately, archive previous active version(s)
        await conn.query("UPDATE versions SET status = 'archived' WHERE status = 'active'");
      }

      const editor = req.user?.name || req.session?.user?.name || 'Admin';

      const [result] = await conn.query(
        `INSERT INTO versions (label, description, change_notes, sections, status, edited_by, release_date)
         VALUES (?, ?, ?, 0, ?, ?, ?)`,
        [label.trim(), description || '', changeNotes || '', newStatus, editor, releaseDate]
      );

      await conn.commit();

      const [rows] = await db.query(`
        SELECT v.*, 0 AS policy_count FROM versions v WHERE v.id = ?
      `, [result.insertId]);

      res.status(201).json(rows[0]);
    } catch (err) {
      await conn.rollback();
      next(err);
    } finally {
      conn.release();
    }
  });

  // POST /api/admin/versions/:id/activate — activate a version
  router.post('/versions/:id/activate', async (req, res, next) => {
    const conn = await db.getConnection();
    try {
      const targetId = parseInt(req.params.id, 10);
      const [existing] = await conn.query('SELECT * FROM versions WHERE id = ?', [targetId]);
      if (existing.length === 0) {
        return res.status(404).json({ error: 'Version not found' });
      }

      await conn.beginTransaction();

      // Archive previous active version(s)
      await conn.query("UPDATE versions SET status = 'archived' WHERE status = 'active' AND id != ?", [targetId]);

      // Activate this version
      await conn.query("UPDATE versions SET status = 'active' WHERE id = ?", [targetId]);

      // If this version has a source PDF file, keep public and src asset updated
      const targetVersion = existing[0];
      if (targetVersion.file_path) {
        const sourcePath = path.join(uploadsDir, targetVersion.file_path);
        if (fs.existsSync(sourcePath)) {
          try {
            fs.copyFileSync(sourcePath, path.join(__dirname, '../../public/handbook.pdf'));
          } catch (_) {}
          try {
            fs.copyFileSync(sourcePath, path.join(__dirname, '../../src/assets/handbook.pdf'));
          } catch (_) {}
        }
      }

      await conn.commit();

      const [updated] = await db.query(`
        SELECT v.*,
          COALESCE((SELECT COUNT(*) FROM ordinances o WHERE o.version_id = v.id), 0) AS policy_count
        FROM versions v
        WHERE v.id = ?
      `, [targetId]);

      res.json({
        success: true,
        message: `${updated[0].label} is now active and student-facing.`,
        version: updated[0],
      });
    } catch (err) {
      await conn.rollback();
      next(err);
    } finally {
      conn.release();
    }
  });

  // POST /api/admin/versions/:id/archive — archive a version (guard against archiving only active)
  router.post('/versions/:id/archive', async (req, res, next) => {
    try {
      const targetId = parseInt(req.params.id, 10);
      const [existing] = await db.query('SELECT * FROM versions WHERE id = ?', [targetId]);
      if (existing.length === 0) {
        return res.status(404).json({ error: 'Version not found' });
      }

      const version = existing[0];
      if (version.status === 'active') {
        return res.status(400).json({
          error: 'Cannot archive the only active version. Activate another version first, which will automatically archive this version.'
        });
      }

      await db.query("UPDATE versions SET status = 'archived' WHERE id = ?", [targetId]);

      const [updated] = await db.query('SELECT * FROM versions WHERE id = ?', [targetId]);
      res.json({
        success: true,
        message: `${updated[0].label} has been archived.`,
        version: updated[0],
      });
    } catch (err) {
      next(err);
    }
  });

  // POST /api/admin/versions/:id/re-import — Re-import into existing version without changing version number
  router.post('/versions/:id/re-import', async (req, res, next) => {
    const conn = await db.getConnection();
    try {
      const versionId = parseInt(req.params.id, 10);
      const [vRows] = await conn.query('SELECT * FROM versions WHERE id = ?', [versionId]);
      if (vRows.length === 0) {
        return res.status(404).json({ error: 'Version not found' });
      }
      const existingVersion = vRows[0];

      const { policies, tempFileId, description, changeNotes } = req.body;

      if (!Array.isArray(policies) || policies.length === 0) {
        return res.status(400).json({ error: 'No policies provided for re-import.' });
      }

      // Handle PDF association
      let newPdfName = existingVersion.file_path;
      if (tempFileId) {
        const sanitizedTemp = path.basename(tempFileId);
        const tempPath = path.join(uploadsDir, sanitizedTemp);
        if (fs.existsSync(tempPath)) {
          newPdfName = `handbook_v_${Date.now()}.pdf`;
          const destPath = path.join(uploadsDir, newPdfName);
          fs.copyFileSync(tempPath, destPath);

          // If this version is currently active, sync to public and src asset
          if (existingVersion.status === 'active') {
            try { fs.copyFileSync(tempPath, path.join(__dirname, '../../public/handbook.pdf')); } catch (_) {}
            try { fs.copyFileSync(tempPath, path.join(__dirname, '../../src/assets/handbook.pdf')); } catch (_) {}
          }
          try { fs.unlinkSync(tempPath); } catch (_) {}
        }
      }

      await conn.beginTransaction();

      const editor = req.user?.name || req.session?.user?.name || 'Admin';
      let updatedCount = 0;
      let insertedCount = 0;

      for (const p of policies) {
        const ref = (p.ref || '').trim();
        const title = (p.title || '').trim();
        if (!ref || !title) continue;

        const catKey = p.catKey || 'conduct';
        const cat = p.cat || 'Student Conduct';
        const summary = p.summary || '';
        const desc = p.desc || '';
        const full = p.full || '';
        const stepsJson = JSON.stringify(p.steps || []);
        const relatedJson = JSON.stringify(p.related || []);
        const pageNum = Number(p.page) || null;
        const handbookSectionId = p.handbookSectionId || null;

        // Check if policy with this ref exists in THIS version
        const [existing] = await conn.query(
          'SELECT id FROM ordinances WHERE ref = ? AND version_id = ?',
          [ref, versionId]
        );

        let ordinanceId;
        if (existing.length > 0) {
          ordinanceId = existing[0].id;
          await conn.query(`
            UPDATE ordinances
            SET cat_key = ?, cat = ?, title = ?, \`desc\` = ?, summary = ?, full_text = ?,
                steps = ?, related = ?, handbook_section_id = ?, page = ?,
                status = 'published', updated_by = ?
            WHERE id = ?
          `, [
            catKey, cat, title, desc, summary, full,
            stepsJson, relatedJson, handbookSectionId, pageNum,
            editor, ordinanceId
          ]);
          updatedCount++;

          // Clear prior scenarios to replace with re-imported ones
          await conn.query('DELETE FROM policy_scenarios WHERE policy_id = ?', [ordinanceId]);
        } else {
          const [ins] = await conn.query(`
            INSERT INTO ordinances (ref, cat_key, cat, title, \`desc\`, summary, full_text, steps, related, handbook_section_id, page, version_id, status, updated_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', ?)
          `, [
            ref, catKey, cat, title, desc, summary, full,
            stepsJson, relatedJson, handbookSectionId, pageNum, versionId,
            editor
          ]);
          ordinanceId = ins.insertId;
          insertedCount++;
        }

        // Insert scenarios for this policy
        const scenarios = Array.isArray(p.scenarios) ? p.scenarios : [];
        const keywordsJson = JSON.stringify(p.keywords || []);
        const synonymsJson = JSON.stringify(p.relatedTerms || []);

        for (const sc of scenarios) {
          const scText = typeof sc === 'string' ? sc.trim() : (sc.scenario || '').trim();
          if (scText) {
            await conn.query(`
              INSERT INTO policy_scenarios (policy_id, scenario, keywords, synonyms)
              VALUES (?, ?, ?, ?)
            `, [ordinanceId, scText, keywordsJson, synonymsJson]);
          }
        }
      }

      // Update version metadata (keeping the same label, ID, and status)
      await conn.query(`
        UPDATE versions
        SET description = COALESCE(?, description),
            change_notes = COALESCE(?, change_notes),
            file_path = ?,
            sections = (SELECT COUNT(*) FROM ordinances WHERE version_id = ?),
            edited_by = ?
        WHERE id = ?
      `, [
        description !== undefined ? description : null,
        changeNotes !== undefined ? changeNotes : null,
        newPdfName,
        versionId,
        editor,
        versionId
      ]);

      await conn.commit();

      const [updatedVersionRows] = await db.query(`
        SELECT v.*,
          (SELECT COUNT(*) FROM ordinances WHERE version_id = v.id) AS policy_count
        FROM versions v
        WHERE v.id = ?
      `, [versionId]);

      res.json({
        success: true,
        message: `Successfully re-imported ${existingVersion.label}. ${updatedCount} policies updated, ${insertedCount} added. Version number preserved.`,
        version: updatedVersionRows[0],
        updatedCount,
        insertedCount,
        totalPolicies: updatedVersionRows[0].policy_count,
      });
    } catch (err) {
      await conn.rollback();
      next(err);
    } finally {
      conn.release();
    }
  });

  // DELETE /api/admin/versions/:id — delete a version (for development/admin cleanup)
  router.delete('/versions/:id', async (req, res, next) => {
    const conn = await db.getConnection();
    try {
      const targetId = parseInt(req.params.id, 10);
      if (isNaN(targetId)) {
        return res.status(400).json({ error: 'Invalid version ID' });
      }

      const [existing] = await conn.query('SELECT * FROM versions WHERE id = ?', [targetId]);
      if (existing.length === 0) {
        return res.status(404).json({ error: 'Version not found' });
      }

      const version = existing[0];
      await conn.beginTransaction();

      // Find all ordinances attached to this version
      const [ords] = await conn.query('SELECT id FROM ordinances WHERE version_id = ?', [targetId]);
      const ordIds = ords.map(o => o.id);

      if (ordIds.length > 0) {
        // Delete dependent policy scenarios
        await conn.query('DELETE FROM policy_scenarios WHERE policy_id IN (?)', [ordIds]);
        // Delete comments attached to these ordinances
        await conn.query('DELETE FROM comments WHERE ordinance_id IN (?)', [ordIds]);
        // Delete page view analytics
        await conn.query("DELETE FROM page_views WHERE target_type = 'ordinance' AND target_id IN (?)", [ordIds.map(String)]);
        // Delete the ordinances themselves
        await conn.query('DELETE FROM ordinances WHERE version_id = ?', [targetId]);
      }

      // Clean up uploaded PDF if any and not referenced by another version
      if (version.file_path) {
        const sanitized = path.basename(version.file_path);
        const pdfPath = path.join(uploadsDir, sanitized);
        const [otherUsingFile] = await conn.query('SELECT id FROM versions WHERE file_path = ? AND id != ?', [version.file_path, targetId]);
        if (otherUsingFile.length === 0 && fs.existsSync(pdfPath) && sanitized !== 'handbook.pdf') {
          try { fs.unlinkSync(pdfPath); } catch (_) {}
        }
      }

      // Delete the version record
      await conn.query('DELETE FROM versions WHERE id = ?', [targetId]);

      // If the deleted version was active, promote another version to active if available
      let newActive = null;
      if (version.status === 'active') {
        const [remaining] = await conn.query(
          "SELECT id, label FROM versions ORDER BY release_date DESC, id DESC LIMIT 1"
        );
        if (remaining.length > 0) {
          await conn.query("UPDATE versions SET status = 'active' WHERE id = ?", [remaining[0].id]);
          newActive = remaining[0];
        }
      }

      await conn.commit();

      res.json({
        success: true,
        message: `${version.label} and its associated policies have been deleted.${newActive ? ` ${newActive.label} is now the active version.` : ''}`,
        deletedId: targetId,
        newActiveVersion: newActive,
      });
    } catch (err) {
      await conn.rollback();
      next(err);
    } finally {
      conn.release();
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
