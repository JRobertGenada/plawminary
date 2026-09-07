/**
 * server/routes/ai.js — AI-assisted scenario and policy search
 *
 * Endpoint: POST /api/ai/search
 *
 * Analyzes natural language scenarios with Google Gemini to extract intent and
 * search keywords, then queries the actual MySQL ordinances database via Fuse.js.
 *
 * Fallback: If Gemini fails, times out, or has no configured API key,
 * the search degrades gracefully to standard local scenario search without crashing.
 */

const express = require('express');
const router = express.Router();
const geminiService = require('../services/geminiService');
const searchMatcher = require('../services/searchMatcher');

module.exports = (db) => {

  /**
   * POST /api/ai/search
   * Body: { query: string }
   */
  router.post('/search', async (req, res, next) => {
    try {
      const { query } = req.body;

      if (!query || typeof query !== 'string' || !query.trim()) {
        return res.status(400).json({ error: 'Query string is required' });
      }

      const cleanQuery = query.trim();
      let aiTerms = null;
      let source = 'gemini';
      let fallbackReason = null;

      // ── Step 1: Call Gemini to extract intent & keywords ───────────────
      try {
        aiTerms = await geminiService.extractSearchTerms(cleanQuery, 5000);
      } catch (geminiErr) {
        source = 'fallback';
        fallbackReason = geminiErr.message;
        console.warn(`[ai/search] Gemini query parsing failed: ${geminiErr.message}. Utilizing fallback search.`);
      }

      // ── Step 2: Query MySQL ordinances and score results ───────────────
      const results = await searchMatcher.searchDatabasePolicies(db, cleanQuery, aiTerms);

      // ── Step 3: Return verified database records only ──────────────────
      return res.json({
        success: true,
        source,
        query: cleanQuery,
        ai: aiTerms ? {
          intent: aiTerms.intent,
          keywords: aiTerms.keywords,
          relatedTerms: aiTerms.relatedTerms,
        } : null,
        ...(fallbackReason ? { fallbackReason } : {}),
        total: results.length,
        results,
      });

    } catch (err) {
      next(err);
    }
  });

  return router;
};
