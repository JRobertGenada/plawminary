/**
 * routes/auth.js — Login / logout / session check / registration endpoints
 */
const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();

module.exports = (db) => {

  // POST /api/auth/register
  router.post('/register', async (req, res, next) => {
    try {
      const { studentId, fullName, email, password, confirmPassword } = req.body;

      // ── Required field validation ─────────────────────────────────────────
      if (!studentId || !fullName || !email || !password || !confirmPassword) {
        return res.status(400).json({ error: 'All fields are required.' });
      }

      const id    = studentId.trim();
      const name  = fullName.trim();
      const mail  = email.trim().toLowerCase();

      if (!id)   return res.status(400).json({ error: 'Student ID cannot be blank.' });
      if (!name) return res.status(400).json({ error: 'Full name cannot be blank.' });

      // ── Email format ──────────────────────────────────────────────────────
      const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRx.test(mail)) {
        return res.status(400).json({ error: 'Please enter a valid email address.' });
      }

      // ── Password rules ────────────────────────────────────────────────────
      if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters.' });
      }
      if (password !== confirmPassword) {
        return res.status(400).json({ error: 'Passwords do not match.' });
      }

      // ── Duplicate checks ──────────────────────────────────────────────────
      const [byId] = await db.query('SELECT id FROM users WHERE id = ?', [id]);
      if (byId.length > 0) {
        return res.status(409).json({ error: 'Student ID is already registered.' });
      }

      const [byEmail] = await db.query('SELECT id FROM users WHERE email = ?', [mail]);
      if (byEmail.length > 0) {
        return res.status(409).json({ error: 'Email address is already registered.' });
      }

      // ── Hash & insert ─────────────────────────────────────────────────────
      const hash = await bcrypt.hash(password, 10);

      await db.query(
        'INSERT INTO users (id, name, dept, role, email, password_hash) VALUES (?, ?, ?, ?, ?, ?)',
        [id, name, '', 'student', mail, hash]
      );

      // Return success — do NOT start a session; user must log in explicitly.
      return res.status(201).json({ success: true, message: 'Account created successfully. You may now log in.' });

    } catch (err) {
      next(err);
    }
  });

  // POST /api/auth/login
  router.post('/login', async (req, res, next) => {
    try {
      const { studentId, password } = req.body;
      if (!studentId || !password) {
        return res.status(400).json({ error: 'Student ID and password are required.' });
      }

      const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [studentId.trim()]);
      const user = rows[0];
      if (!user) {
        return res.status(401).json({ error: 'Invalid ID or password. Please try again.' });
      }

      const hash = user.password_hash.startsWith('$2y$')
        ? '$2b$' + user.password_hash.slice(4)
        : user.password_hash;

      const match = await bcrypt.compare(password, hash);
      if (!match) {
        return res.status(401).json({ error: 'Invalid ID or password. Please try again.' });
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
