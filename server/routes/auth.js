/**
 * routes/auth.js — Login / logout / session check / registration endpoints
 * Enforces Student Master List Authentication for student account registration.
 */
const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();

module.exports = (db) => {

  // POST /api/auth/register — Student self-registration guarded by master list
  router.post('/register', async (req, res, next) => {
    let conn;
    try {
      const {
        studentId,
        studentNo,
        fullName,
        dept,
        email,
        password,
        confirmPassword,
      } = req.body;

      const rawId = (studentId || studentNo || '').trim();
      const mail  = (email || '').trim().toLowerCase();

      // ── 1. Validate required fields ───────────────────────────────────────
      if (!rawId) {
        return res.status(400).json({ error: 'Student Number is required.' });
      }
      if (!mail) {
        return res.status(400).json({ error: 'Email address is required.' });
      }
      if (!password) {
        return res.status(400).json({ error: 'Password is required.' });
      }
      if (!confirmPassword) {
        return res.status(400).json({ error: 'Please confirm your password.' });
      }

      // ── 2. Validate email format ──────────────────────────────────────────
      const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRx.test(mail)) {
        return res.status(400).json({ error: 'Please enter a valid email address.' });
      }

      // ── 3. Password rules ──────────────────────────────────────────────────
      if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters.' });
      }
      if (password !== confirmPassword) {
        return res.status(400).json({ error: 'Passwords do not match.' });
      }

      // ── 4. Find matching student_records entry using BOTH student_no & email
      const [matchedRecords] = await db.query(
        `SELECT * FROM student_records
         WHERE LOWER(TRIM(student_no)) = LOWER(TRIM(?))
           AND LOWER(TRIM(email)) = LOWER(TRIM(?))`,
        [rawId, mail]
      );

      // ── 5. Reject unmatched records ────────────────────────────────────────
      if (matchedRecords.length === 0) {
        return res.status(400).json({
          error: 'Student record not found in the authorized master list. Please verify your Student Number and Email or contact your college administrator.',
        });
      }

      const masterRecord = matchedRecords[0];

      // ── 6. Reject students who already have an account ────────────────────
      if (masterRecord.is_registered === 1) {
        return res.status(409).json({
          error: 'This student account has already been registered. Please sign in instead.',
        });
      }

      const [existingUsers] = await db.query(
        'SELECT id, email FROM users WHERE LOWER(id) = LOWER(?) OR (email IS NOT NULL AND LOWER(email) = LOWER(?))',
        [rawId, mail]
      );

      if (existingUsers.length > 0) {
        return res.status(409).json({
          error: 'An account with this Student Number or Email already exists. Please sign in instead.',
        });
      }

      // ── 7. Hash password securely using bcrypt ─────────────────────────────
      const hash = await bcrypt.hash(password, 10);

      // Resolve display name and department from form or master record
      const displayName = (fullName && fullName.trim())
        ? fullName.trim()
        : (masterRecord.full_name && masterRecord.full_name.trim())
          ? masterRecord.full_name.trim()
          : masterRecord.student_no;

      const department = masterRecord.department || dept || '';

      // ── 8. Create account & mark master record as registered in transaction ─
      conn = await db.getConnection();
      await conn.beginTransaction();

      await conn.query(
        `INSERT INTO users (id, name, dept, role, email, password_hash, student_record_id)
         VALUES (?, ?, ?, 'user', ?, ?, ?)`,
        [masterRecord.student_no, displayName, department, mail, hash, masterRecord.id]
      );

      await conn.query(
        `UPDATE student_records
         SET is_registered = 1, registered_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [masterRecord.id]
      );

      await conn.commit();

      // ── 9. Return clear, user-friendly success response ───────────────────
      return res.status(201).json({
        success: true,
        message: 'Account created successfully! You may now sign in with your credentials.',
      });

    } catch (err) {
      if (conn) {
        try {
          await conn.rollback();
        } catch (rbErr) {
          console.error('Error during registration rollback:', rbErr);
        }
      }
      next(err);
    } finally {
      if (conn) conn.release();
    }
  });

  // POST /api/auth/login — Login with either Student ID or Email
  router.post('/login', async (req, res, next) => {
    try {
      const { studentId, password } = req.body;
      if (!studentId || !password) {
        return res.status(400).json({ error: 'Student ID / Email and password are required.' });
      }

      const identifier = studentId.trim();
      const lowerId = identifier.toLowerCase();

      const [rows] = await db.query(
        'SELECT * FROM users WHERE LOWER(id) = ? OR (email IS NOT NULL AND LOWER(email) = ?)',
        [lowerId, lowerId]
      );

      const user = rows[0];
      if (!user) {
        return res.status(401).json({ error: 'Invalid Student ID or password. Please try again.' });
      }

      const hash = user.password_hash.startsWith('$2y$')
        ? '$2b$' + user.password_hash.slice(4)
        : user.password_hash;

      const match = await bcrypt.compare(password, hash);
      if (!match) {
        return res.status(401).json({ error: 'Invalid Student ID or password. Please try again.' });
      }

      const profile = { id: user.id, name: user.name, dept: user.dept, role: user.role };
      req.session.user = profile;

      return res.json({ success: true, user: profile });
    } catch (err) {
      next(err);
    }
  });

  // POST /api/auth/logout
  router.post('/logout', (req, res) => {
    req.session.destroy(() => res.json({ success: true }));
  });

  // GET /api/auth/me — check current session
  router.get('/me', (req, res) => {
    if (req.session?.user) {
      return res.json({ user: req.session.user });
    }
    return res.json({ user: null });
  });

  return router;
};
