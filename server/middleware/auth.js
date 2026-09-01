/**
 * auth.js — Session-based auth middleware
 * Attaches req.user from session, exports requireAuth and requireAdmin guards.
 */

function requireAuth(req, res, next) {
  if (!req.session?.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  req.user = req.session.user;
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session?.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  if (req.session.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden — admin only' });
  }
  req.user = req.session.user;
  next();
}

module.exports = { requireAuth, requireAdmin };
