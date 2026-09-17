/**
 * routes/students.js — Student Master List & Import Management Endpoints
 * Admin-only endpoints for previewing, validating, and importing student records.
 */
const express = require('express');
const multer  = require('multer');
const XLSX    = require('xlsx');
const { requireAdmin } = require('../middleware/auth');

// Multer memory storage (files stored in RAM buffer, max 10MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const ext = (file.originalname || '').toLowerCase();
    if (ext.endsWith('.csv') || ext.endsWith('.xlsx') || ext.endsWith('.xls') ||
        file.mimetype === 'text/csv' ||
        file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.mimetype === 'application/vnd.ms-excel') {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only CSV and Excel (.xlsx, .xls) files are supported.'));
    }
  },
});

// Normalize headers to canonical fields.
// Strips whitespace, underscores, hyphens, dots, and parentheses before
// matching so real-file headers like "Student No." and "Department (College)"
// are handled without requiring exact spelling.
function mapHeaderToField(header) {
  // Remove spaces/underscores/hyphens/dots/parens, then lowercase
  const h = String(header || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_\-.()\/]+/g, '');

  if (/^(studentno|studentid|studentnumber|id)$/.test(h)) return 'student_no';
  if (/^(email|emailaddress|mail)$/.test(h)) return 'email';
  // "Department (College)" → "departmentcollege" after stripping
  if (/^(department|dept|college|departmentcollege)$/.test(h)) return 'department';
  if (/^(program|course|degree)$/.test(h)) return 'program';
  if (/^(fullname|name|studentname)$/.test(h)) return 'full_name';
  // Individual name parts from PLSP-style sheets
  if (/^(lastname|surname|familyname)$/.test(h)) return 'last_name';
  if (/^(firstname|givenname)$/.test(h)) return 'first_name';
  if (/^(middlename|middleinitial)$/.test(h)) return 'middle_name';
  // Never store passwords
  if (/^(password|pass|hash)$/.test(h)) return 'password_ignored';
  return null;
}

/**
 * Scan raw rows (array-of-arrays from sheet_to_json header:1) and return
 * the index of the first row that contains at least `minHits` recognised
 * canonical field names.  Returns -1 if no such row is found.
 *
 * This lets the importer skip any number of title / metadata rows that
 * appear above the real column headers in admin-exported Excel files.
 */
function detectHeaderRowIndex(rawRows, minHits = 2) {
  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!Array.isArray(row)) continue;
    const hits = row.filter((cell) => mapHeaderToField(cell) !== null).length;
    if (hits >= minHits) return i;
  }
  return -1;
}

/**
 * Build a sparse lookup map that propagates merged-cell values.
 *
 * The XLSX library only places a cell value at the TOP-LEFT cell of a merge
 * block.  All other cells in the block are absent from the sheet object,
 * so sheet_to_json returns '' for them.  This function reads sheet['!merges'],
 * finds the anchor value for each block, and records it under every
 * (rowIndex, colIndex) key so callers can do a simple map lookup.
 *
 * @param {object} sheet  - A worksheet object returned by XLSX.read
 * @returns {Map<string, any>}  key = 'rowIdx:colIdx', value = anchor cell value
 */
function buildMergeFillMap(sheet) {
  const map = new Map();
  const merges = sheet['!merges'] || [];
  for (const m of merges) {
    const anchorAddr = XLSX.utils.encode_cell(m.s);
    const anchorCell = sheet[anchorAddr];
    const val = anchorCell ? anchorCell.v : '';
    for (let r = m.s.r; r <= m.e.r; r++) {
      for (let c = m.s.c; c <= m.e.c; c++) {
        map.set(r + ':' + c, val);
      }
    }
  }
  return map;
}

/**
 * Read a cell value from a data row, preferring the merge-fill map.
 *
 * @param {Map}    mergeMap  - Map built by buildMergeFillMap
 * @param {Array}  row       - Raw row array from sheet_to_json header:1
 * @param {number} rowIdx    - 0-based row index in the sheet
 * @param {number} colIdx    - 0-based column index
 * @returns {string}  Trimmed string value, or '' if absent
 */
function getCellValue(mergeMap, row, rowIdx, colIdx) {
  const key = rowIdx + ':' + colIdx;
  if (mergeMap.has(key)) return String(mergeMap.get(key) ?? '').trim();
  return String(row[colIdx] ?? '').trim();
}

module.exports = (db) => {
  const router = express.Router();

  // All routes in this module require admin privileges
  router.use(requireAdmin);

  // ── Download Sample CSV Template ──────────────────────────────────────────
  router.get('/template', (req, res) => {
    const csvContent = 'student_no,email,department,program,full_name\n' +
      '2026-0001,juan.delacruz@plsp.edu.ph,College of Computer Studies and Technology (CCST),BS Information Technology,Juan Dela Cruz\n' +
      '2026-0002,maria.santos@plsp.edu.ph,College of Business Administration,BS Accountancy,Maria Santos\n' +
      '2026-0003,carlo.reyes@plsp.edu.ph,College of Nursing,BS Nursing,Carlo Reyes\n';
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="student_master_template.csv"');
    res.send(csvContent);
  });

  // ── POST /api/admin/students/preview — Validate & Preview File ─────────────
  router.post('/preview', upload.single('file'), async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Please upload a CSV or Excel (.xlsx) file.' });
      }

      let workbook;
      try {
        workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      } catch (parseErr) {
        return res.status(400).json({ error: 'Could not read or parse spreadsheet file. Please verify file integrity.' });
      }

      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        return res.status(400).json({ error: 'The uploaded spreadsheet contains no sheets.' });
      }

      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '', header: 1 });

      // Build merge-fill map so merged department/program cells are propagated
      // to every row in the block (not just the first).
      const mergeMap = buildMergeFillMap(sheet);

      if (rawRows.length === 0) {
        return res.status(400).json({ error: 'The uploaded file is empty.' });
      }

      // ── Auto-detect the header row ────────────────────────────────────────
      // Many admin-exported Excel files (e.g. the PLSP master list) include
      // school name, semester, and other title rows above the real column
      // headers.  We scan until we find a row with ≥2 recognised fields
      // rather than blindly using rawRows[0].
      const headerRowIndex = detectHeaderRowIndex(rawRows);
      if (headerRowIndex === -1) {
        return res.status(400).json({
          error:
            'Could not locate a header row in the uploaded file. ' +
            'Expected columns: Student No., Email, Department (College), Program. ' +
            'Please verify the file format and try again.',
        });
      }

      const headerRow = rawRows[headerRowIndex];
      const columnMapping = {};
      headerRow.forEach((colName, index) => {
        const canonical = mapHeaderToField(colName);
        if (canonical && !columnMapping[canonical]) {
          columnMapping[canonical] = index;
        }
      });

      // Check required columns
      const requiredCols = ['student_no', 'email', 'department', 'program'];
      const missingCols = requiredCols.filter(col => columnMapping[col] === undefined);
      if (missingCols.length > 0) {
        return res.status(400).json({
          error: `Missing required column(s): ${missingCols.join(', ')}. Expected headers are: Student No., Email, Department (College), Program.`,
          missingColumns: missingCols,
        });
      }

      // Query database for existing student numbers and emails for conflict detection
      const [existingRecords] = await db.query('SELECT student_no, email FROM student_records');
      const [existingUsers]   = await db.query('SELECT id, email FROM users');

      const dbStudentNos = new Set(existingRecords.map(r => String(r.student_no).trim().toLowerCase()));
      const dbEmails     = new Set(existingRecords.map(r => String(r.email).trim().toLowerCase()));
      const dbUserIds    = new Set(existingUsers.map(u => String(u.id).trim().toLowerCase()));
      const dbUserEmails = new Set(existingUsers.filter(u => u.email).map(u => String(u.email).trim().toLowerCase()));

      const fileStudentNos = new Set();
      const fileEmails     = new Set();

      const validRows   = [];
      const invalidRows = [];

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      // Process data rows (start immediately after the detected header row)
      for (let i = headerRowIndex + 1; i < rawRows.length; i++) {
        const row = rawRows[i];
        // Skip entirely blank rows
        if (!row || row.every(cell => String(cell).trim() === '')) continue;

        const rowNumber = i + 1; // 1-indexed spreadsheet row number
        const rowErrors = [];

        const rawStudentNo = getCellValue(mergeMap, row, i, columnMapping.student_no);
        const rawEmail     = getCellValue(mergeMap, row, i, columnMapping.email).toLowerCase();
        const rawDept      = getCellValue(mergeMap, row, i, columnMapping.department);
        const rawProgram   = getCellValue(mergeMap, row, i, columnMapping.program);

        // Skip footer / disclaimer rows — real student numbers are short and
        // do not contain spaces.  Long prose like "Total dummy accounts
        // generated: 180..." is the only pattern we need to suppress.
        if (rawStudentNo.length > 50 || rawStudentNo.includes(' ')) continue;

        // full_name can come from a dedicated column OR be assembled from
        // individual Last Name / First Name / Middle Name columns (PLSP style)
        let rawName = columnMapping.full_name !== undefined
          ? getCellValue(mergeMap, row, i, columnMapping.full_name)
          : '';
        if (!rawName) {
          const last   = columnMapping.last_name   !== undefined ? getCellValue(mergeMap, row, i, columnMapping.last_name)   : '';
          const first  = columnMapping.first_name  !== undefined ? getCellValue(mergeMap, row, i, columnMapping.first_name)  : '';
          const middle = columnMapping.middle_name !== undefined ? getCellValue(mergeMap, row, i, columnMapping.middle_name) : '';
          rawName = [last, first, middle].filter(Boolean).join(', ');
        }

        // 1. Field presence validation
        if (!rawStudentNo) {
          rowErrors.push('Student number is required.');
        }
        if (!rawEmail) {
          rowErrors.push('Email is required.');
        } else if (!emailRegex.test(rawEmail)) {
          rowErrors.push(`Invalid email format: "${rawEmail}".`);
        }
        if (!rawDept) {
          rowErrors.push('Department / College is required.');
        }
        if (!rawProgram) {
          rowErrors.push('Degree program is required.');
        }

        // 2. In-file duplicate validation
        const normalizedSNo = rawStudentNo.toLowerCase();
        if (rawStudentNo) {
          if (fileStudentNos.has(normalizedSNo)) {
            rowErrors.push(`Duplicate student number "${rawStudentNo}" found multiple times in this file.`);
          } else {
            fileStudentNos.add(normalizedSNo);
          }
        }

        if (rawEmail && emailRegex.test(rawEmail)) {
          if (fileEmails.has(rawEmail)) {
            rowErrors.push(`Duplicate email "${rawEmail}" found multiple times in this file.`);
          } else {
            fileEmails.add(rawEmail);
          }
        }

        // 3. Database conflicts
        if (rawStudentNo && dbStudentNos.has(normalizedSNo)) {
          rowErrors.push(`Student number "${rawStudentNo}" already exists in the master list.`);
        }
        if (rawEmail && dbEmails.has(rawEmail)) {
          rowErrors.push(`Email "${rawEmail}" already exists in the master list.`);
        }
        if (rawStudentNo && dbUserIds.has(normalizedSNo)) {
          rowErrors.push(`A registered user account already exists with student ID "${rawStudentNo}".`);
        }
        if (rawEmail && dbUserEmails.has(rawEmail)) {
          rowErrors.push(`A registered user account already exists with email "${rawEmail}".`);
        }

        const rowData = {
          student_no: rawStudentNo,
          email: rawEmail,
          department: rawDept,
          program: rawProgram,
          full_name: rawName || null,
        };

        if (rowErrors.length > 0) {
          invalidRows.push({
            rowNumber,
            data: rowData,
            errors: rowErrors,
          });
        } else {
          validRows.push({
            rowNumber,
            ...rowData,
          });
        }
      }

      return res.json({
        filename: req.file.originalname,
        fileSize: req.file.size,
        totalRows: validRows.length + invalidRows.length,
        validCount: validRows.length,
        invalidCount: invalidRows.length,
        validRows,
        invalidRows,
      });

    } catch (err) {
      next(err);
    }
  });

  // ── POST /api/admin/students/import — Commit Validated Import Transaction ──
  router.post('/import', async (req, res, next) => {
    let conn;
    try {
      const { records, filename } = req.body;

      if (!Array.isArray(records) || records.length === 0) {
        return res.status(400).json({ error: 'No valid records provided for import.' });
      }

      // Acquire dedicated connection for transaction
      conn = await db.getConnection();
      await conn.beginTransaction();

      const batchId = 'batch_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
      const batchFilename = String(filename || 'student_roster.csv').substring(0, 255);
      const importedBy = req.user?.name || req.user?.id || 'Administrator';

      // Record batch header
      await conn.query(
        'INSERT INTO import_batches (id, filename, total_records, imported_by) VALUES (?, ?, ?, ?)',
        [batchId, batchFilename, records.length, importedBy]
      );

      // Insert each record
      for (const rec of records) {
        const sNo   = String(rec.student_no || '').trim();
        const email = String(rec.email || '').trim().toLowerCase();
        const dept  = String(rec.department || '').trim();
        const prog  = String(rec.program || '').trim();
        const name  = rec.full_name ? String(rec.full_name).trim() : null;

        if (!sNo || !email || !dept || !prog) {
          throw new Error(`Invalid record in batch: student_no, email, department, and program are strictly required.`);
        }

        await conn.query(
          `INSERT INTO student_records
             (student_no, email, department, program, full_name, is_registered, import_batch_id)
           VALUES (?, ?, ?, ?, ?, 0, ?)`,
          [sNo, email, dept, prog, name, batchId]
        );
      }

      // Commit transaction
      await conn.commit();

      return res.status(201).json({
        success: true,
        message: `Successfully imported ${records.length} authorized student record(s).`,
        batchId,
        count: records.length,
      });

    } catch (err) {
      if (conn) {
        try {
          await conn.rollback();
          console.warn('⚠️ Import transaction rolled back due to error:', err.message);
        } catch (rbErr) {
          console.error('Error during rollback:', rbErr);
        }
      }
      // Check for duplicate key violation
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({
          error: 'Import failed: Duplicate record found. The batch was completely rolled back.',
          detail: err.message,
        });
      }
      next(err);
    } finally {
      if (conn) conn.release();
    }
  });

  // ── GET /api/admin/students — List Master Records ──────────────────────────
  router.get('/', async (req, res, next) => {
    try {
      const { search = '', status = 'all', department = '', page = 1, limit = 50 } = req.query;

      const p = Math.max(1, parseInt(page, 10) || 1);
      const l = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
      const offset = (p - 1) * l;

      const whereClauses = [];
      const params = [];

      if (status === 'registered') {
        whereClauses.push('sr.is_registered = 1');
      } else if (status === 'unregistered') {
        whereClauses.push('sr.is_registered = 0');
      }

      if (department) {
        whereClauses.push('sr.department = ?');
        params.push(department);
      }

      if (search.trim()) {
        const term = `%${search.trim()}%`;
        whereClauses.push('(sr.student_no LIKE ? OR sr.email LIKE ? OR sr.full_name LIKE ? OR sr.program LIKE ?)');
        params.push(term, term, term, term);
      }

      const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

      // Count totals
      const [[{ total }]] = await db.query(
        `SELECT COUNT(*) as total FROM student_records sr ${whereSql}`,
        params
      );

      // KPI counts
      const [[{ totalRecords }]]    = await db.query('SELECT COUNT(*) as totalRecords FROM student_records');
      const [[{ registeredCount }]] = await db.query('SELECT COUNT(*) as registeredCount FROM student_records WHERE is_registered = 1');
      const [[{ pendingCount }]]    = await db.query('SELECT COUNT(*) as pendingCount FROM student_records WHERE is_registered = 0');
      const [[{ batchCount }]]      = await db.query('SELECT COUNT(*) as batchCount FROM import_batches');

      // Fetch records with batch info
      const [records] = await db.query(
        `SELECT sr.*, b.filename as batch_filename
         FROM student_records sr
         LEFT JOIN import_batches b ON b.id = sr.import_batch_id
         ${whereSql}
         ORDER BY sr.created_at DESC
         LIMIT ? OFFSET ?`,
        [...params, l, offset]
      );

      // Distinct departments for filtering
      const [departments] = await db.query(
        'SELECT DISTINCT department FROM student_records WHERE department != "" ORDER BY department'
      );

      res.json({
        records,
        total,
        page: p,
        limit: l,
        kpis: {
          totalRecords,
          registeredCount,
          pendingCount,
          batchCount,
        },
        departments: departments.map(d => d.department),
      });

    } catch (err) {
      next(err);
    }
  });

  // ── GET /api/admin/students/batches — Import Batch History ─────────────────
  router.get('/batches', async (req, res, next) => {
    try {
      const [batches] = await db.query(`
        SELECT b.*,
          COUNT(sr.id) as current_record_count,
          SUM(CASE WHEN sr.is_registered = 1 THEN 1 ELSE 0 END) as registered_count
        FROM import_batches b
        LEFT JOIN student_records sr ON sr.import_batch_id = b.id
        GROUP BY b.id
        ORDER BY b.created_at DESC
      `);
      res.json(batches);
    } catch (err) {
      next(err);
    }
  });

  // ── DELETE /api/admin/students/:id — Delete a Student Record ───────────────
  router.delete('/:id', async (req, res, next) => {
    try {
      const [rows] = await db.query('SELECT * FROM student_records WHERE id = ?', [req.params.id]);
      if (rows.length === 0) {
        return res.status(404).json({ error: 'Student record not found.' });
      }
      const record = rows[0];

      // Check if user account is attached
      if (record.is_registered) {
        return res.status(400).json({
          error: 'Cannot delete record: Student has already registered a user account. Remove the user account in Users management first if necessary.',
        });
      }

      await db.query('DELETE FROM student_records WHERE id = ?', [req.params.id]);
      res.json({ success: true, message: 'Student record deleted successfully.' });
    } catch (err) {
      next(err);
    }
  });

  return router;
};
