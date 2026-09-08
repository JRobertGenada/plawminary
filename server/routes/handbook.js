/**
 * server/routes/handbook.js
 *
 * Handbook Management API:
 * - Admin upload & real-time ingestion pipeline (PDF parsing, section segmentation, Gemini metadata)
 * - Atomic MySQL transaction for approving & importing versioned policies
 * - Version safety: processing -> review -> approved -> active (previous active -> archived)
 * - Serving active handbook PDF stream
 */

const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const fs      = require('fs');
const path    = require('path');
const { requireAdmin } = require('../middleware/auth');
const { ingestHandbookPdf } = require('../services/pdfIngestionService');

// Multer in-memory storage with 25MB max file size limit
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
  fileFilter: (req, file, cb) => {
    // Only accept PDF MIME type or .pdf extension
    if (file.mimetype === 'application/pdf' || path.extname(file.originalname).toLowerCase() === '.pdf') {
      cb(null, true);
    } else {
      const err = new Error('Only valid PDF documents (.pdf) are allowed');
      err.code = 'INVALID_FILE_TYPE';
      cb(err, false);
    }
  },
});

module.exports = (db) => {

  const uploadsDir = path.join(__dirname, '../uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  // ── 1. POST /api/admin/handbook/process — Admin uploads and extracts PDF ───
  router.post('/process', requireAdmin, (req, res, next) => {
    upload.single('pdf')(req, res, async (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'File exceeds the 25MB size limit.' });
        }
        return res.status(400).json({ error: err.message || 'PDF upload failed' });
      }

      try {
        if (!req.file || !req.file.buffer) {
          return res.status(400).json({ error: 'Please choose a PDF file to upload.' });
        }

        const buffer = req.file.buffer;

        // Verify PDF Magic Bytes (%PDF-)
        const header = buffer.slice(0, 5).toString();
        if (!header.startsWith('%PDF')) {
          return res.status(400).json({ error: 'The uploaded file is not a valid PDF document (invalid magic header).' });
        }

        // Save a secure temporary file
        const tempId = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}.pdf`;
        const tempFilePath = path.join(uploadsDir, tempId);
        fs.writeFileSync(tempFilePath, buffer);

        // Run extraction pipeline
        const result = await ingestHandbookPdf(buffer);

        return res.json({
          success: true,
          tempFileId: tempId,
          filename: req.file.originalname,
          fileSizeBytes: req.file.size,
          totalPages: result.totalPages,
          totalPolicies: result.totalPolicies,
          policies: result.policies,
        });

      } catch (ingestErr) {
        console.error('[handbook/process error]', ingestErr);
        return res.status(500).json({ error: ingestErr.message || 'Failed to process PDF handbook.' });
      }
    });
  });

  // ── 2. POST /api/admin/handbook/import — Transactional Approve & Import ────
  router.post('/import', requireAdmin, async (req, res, next) => {
    const conn = await db.getConnection();
    try {
      const {
        versionLabel,
        description,
        changeNotes,
        releaseDate,
        policies,
        tempFileId,
        status = 'active',
        targetVersionId,
      } = req.body;

      if (!versionLabel || !versionLabel.trim()) {
        return res.status(400).json({ error: 'Version label is required (e.g. Version 2.1)' });
      }

      if (!Array.isArray(policies) || policies.length === 0) {
        return res.status(400).json({ error: 'No approved policies provided for import.' });
      }

      const targetStatus = status === 'draft' ? 'draft' : 'active';

      // Handle PDF file promotion
      let activePdfRelativePath = null;
      if (tempFileId) {
        const sanitizedTemp = path.basename(tempFileId);
        const tempPath = path.join(uploadsDir, sanitizedTemp);
        if (fs.existsSync(tempPath)) {
          const activePdfName = `handbook_v_${Date.now()}.pdf`;
          const activeDest = path.join(uploadsDir, activePdfName);
          fs.copyFileSync(tempPath, activeDest);
          activePdfRelativePath = activePdfName;

          // If active, keep the public and src asset updated so Vite and static fallback sync
          if (targetStatus === 'active') {
            try {
              const publicPath = path.join(__dirname, '../../public/handbook.pdf');
              fs.copyFileSync(tempPath, publicPath);
            } catch (_) {}
            try {
              const srcAssetPath = path.join(__dirname, '../../src/assets/handbook.pdf');
              fs.copyFileSync(tempPath, srcAssetPath);
            } catch (_) {}
          }

          // Remove temp file
          try { fs.unlinkSync(tempPath); } catch (_) {}
        }
      }

      // ── BEGIN MySQL Transaction ───────────────────────────────────────────
      await conn.beginTransaction();

      let versionId = targetVersionId ? parseInt(targetVersionId, 10) : null;

      if (versionId) {
        // Re-importing or updating an existing version
        if (targetStatus === 'active') {
          await conn.query("UPDATE versions SET status = 'archived' WHERE status = 'active' AND id != ?", [versionId]);
        }
        await conn.query(`
          UPDATE versions
          SET label = ?, description = ?, change_notes = COALESCE(?, change_notes),
              file_path = COALESCE(?, file_path), status = ?, release_date = ?
          WHERE id = ?
        `, [
          versionLabel.trim(),
          description || '',
          changeNotes || null,
          activePdfRelativePath,
          targetStatus,
          releaseDate || new Date().toISOString().split('T')[0],
          versionId
        ]);
      } else {
        // New version creation
        if (targetStatus === 'active') {
          await conn.query("UPDATE versions SET status = 'archived' WHERE status = 'active'");
        }

        const [vResult] = await conn.query(
          `INSERT INTO versions (label, description, change_notes, sections, file_path, status, edited_by, release_date)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            versionLabel.trim(),
            description || '',
            changeNotes || '',
            policies.length,
            activePdfRelativePath,
            targetStatus,
            req.user?.name || req.session?.user?.name || 'Admin',
            releaseDate || new Date().toISOString().split('T')[0],
          ]
        );
        versionId = vResult.insertId;
      }

      // 3. Upsert policies and scenarios for THIS version
      let insertedCount = 0;
      let updatedCount = 0;

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
        const editor = req.user?.name || req.session?.user?.name || 'Admin';

        // Check if policy with this reference code already exists in THIS version
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

          // Clear prior scenarios for this policy to replace with reviewed ones
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

        // Insert scenarios for Fuse.js search matching
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

      // ── COMMIT Transaction ────────────────────────────────────────────────
      await conn.commit();

      res.json({
        success: true,
        versionId,
        versionLabel,
        totalImported: policies.length,
        inserted: insertedCount,
        updated: updatedCount,
        message: `Successfully activated ${versionLabel} with ${policies.length} policies.`
      });

    } catch (err) {
      await conn.rollback();
      console.error('[handbook/import transaction error]', err);
      next(err);
    } finally {
      conn.release();
    }
  });

  // ── 3. GET /api/handbook/active-pdf — Stream active PDF handbook ───────────
  router.get('/active-pdf', async (req, res) => {
    try {
      // Find currently active version file
      const [rows] = await db.query("SELECT file_path FROM versions WHERE status = 'active' ORDER BY id DESC LIMIT 1");
      let targetPath = null;

      if (rows.length > 0 && rows[0].file_path) {
        const potential = path.join(uploadsDir, rows[0].file_path);
        if (fs.existsSync(potential)) {
          targetPath = potential;
        }
      }

      // Fallback to public/handbook.pdf
      if (!targetPath) {
        const fallback = path.join(__dirname, '../../public/handbook.pdf');
        if (fs.existsSync(fallback)) {
          targetPath = fallback;
        }
      }

      if (!targetPath) {
        return res.status(404).json({ error: 'No handbook PDF file available.' });
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline; filename="handbook.pdf"');
      res.setHeader('Accept-Ranges', 'bytes');
      fs.createReadStream(targetPath).pipe(res);

    } catch (err) {
      console.error('[handbook/active-pdf error]', err);
      res.status(500).json({ error: 'Failed to retrieve handbook PDF.' });
    }
  });

  return router;
};
