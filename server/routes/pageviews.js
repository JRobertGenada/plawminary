/**
 * routes/pageviews.js — Track ordinance and handbook page views for analytics
 */
const express = require('express');
const router  = express.Router();

module.exports = (db) => {

  // POST /api/page-views — log a view event (auth optional, guests allowed)
  router.post('/', async (req, res, next) => {
    try {
      const { targetType, targetId } = req.body;

      if (!targetType || !targetId) {
        return res.status(400).json({ error: 'targetType and targetId are required' });
      }

      const validTypes = ['ordinance', 'handbook'];
      if (!validTypes.includes(targetType)) {
        return res.status(400).json({ error: `targetType must be one of: ${validTypes.join(', ')}` });
      }

      const userId = req.session?.user?.id || null;

      await db.query(
        'INSERT INTO page_views (user_id, target_type, target_id) VALUES (?, ?, ?)',
        [userId, targetType, String(targetId)]
      );

      res.status(201).json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  return router;
};
