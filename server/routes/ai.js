/**
 * server/routes/ai.js — AI-assisted scenario search + grounded policy explanation
 *
 * Endpoints:
 *   POST /api/ai/search   — Query parser (existing, do not modify)
 *   POST /api/ai/explain  — Grounded policy explanation (Phase 2)
 *
 * Fallback: Both endpoints degrade gracefully if Gemini fails, times out,
 * or has no configured API key, without crashing or leaking the API key.
 */

const express = require('express');
const router = express.Router();
const geminiService = require('../services/geminiService');
const searchMatcher = require('../services/searchMatcher');

// Maximum character length accepted for policyContent to prevent abuse
const MAX_POLICY_CONTENT_LENGTH = 10_000;

module.exports = (db) => {

  /**
   * POST /api/ai/search
   * Body: { query: string }
   * (Existing — do not modify behavior)
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

  /**
   * POST /api/ai/explain
   *
   * Phase 2: Grounded AI Policy Explanation.
   * Explains an official policy to a student using ONLY the supplied content.
   * Gemini is strictly constrained — it cannot invent or assume any rules.
   *
   * Body: {
   *   query:         string  — The student's question or context (optional)
   *   policyTitle:   string  — Title of the policy section
   *   policyContent: string  — Official policy text to ground the explanation
   * }
   *
   * Returns: {
   *   success:           true
   *   explanation:       string
   *   keyPoints:         string[]
   *   recommendedAction: string
   *   source:            "gemini" | "fallback"
   * }
   */
  router.post('/explain', async (req, res, next) => {
    try {
      const { query, policyTitle, policyContent } = req.body;

      // ── Validation ────────────────────────────────────────────────────
      if (!policyTitle || typeof policyTitle !== 'string' || !policyTitle.trim()) {
        return res.status(400).json({ error: 'policyTitle is required' });
      }

      if (!policyContent || typeof policyContent !== 'string' || !policyContent.trim()) {
        return res.status(400).json({ error: 'policyContent is required and must be non-empty official policy text' });
      }

      if (policyContent.length > MAX_POLICY_CONTENT_LENGTH) {
        return res.status(400).json({
          error: `policyContent exceeds the maximum allowed length (${MAX_POLICY_CONTENT_LENGTH} characters)`,
        });
      }

      const cleanTitle   = policyTitle.trim();
      const cleanContent = policyContent.trim();
      const cleanQuery   = (typeof query === 'string' ? query : '').trim() || `Explain this policy: ${cleanTitle}`;

      // ── Call Gemini explain (with automatic fallback) ─────────────────
      const result = await geminiService.explainPolicy(
        cleanQuery,
        cleanTitle,
        cleanContent,
        8000   // 8-second timeout
      );

      return res.json({
        success: true,
        explanation:       result.explanation,
        keyPoints:         result.keyPoints,
        recommendedAction: result.recommendedAction,
        source:            result.source,
      });

    } catch (err) {
      next(err);
    }
  });

  return router;
};
