/**
 * server/services/pdfIngestionService.js
 *
 * Ingestion engine for PLAWMINARY Student Handbook PDFs.
 * 1. Extracts raw page text and page numbers using pdf-parse.
 * 2. Uses document headings, numbering, articles, and rules to segment policy boundaries.
 * 3. Enriches each policy with structured AI metadata (summaries, keywords, scenarios) via Gemini.
 * 4. Validates records before presenting to Admin Review.
 */

const { PDFParse } = require('pdf-parse');
const { structurePolicyMetadata } = require('./geminiService');

/**
 * Clean running page headers/footers e.g. "52 | P a g e" or "Student Handbook 2018"
 */
function cleanPageText(text = '') {
  return text
    .split('\n')
    .filter(line => {
      const trimmed = line.trim();
      // Remove page footer markers like "52 | P a g e"
      if (/^\d+\s*\|\s*P\s*a\s*g\s*e$/i.test(trimmed)) return false;
      if (/^P\s*a\s*g\s*e\s*\|\s*\d+$/i.test(trimmed)) return false;
      return true;
    })
    .join('\n');
}

/**
 * Parse and segment a handbook PDF buffer into structured policy records.
 *
 * @param {Buffer} pdfBuffer - The uploaded PDF file buffer
 * @param {Function} onProgress - Optional callback for extraction progress
 * @returns {Promise<{totalPages: number, policies: Array, metadata: Object}>}
 */
async function ingestHandbookPdf(pdfBuffer, onProgress = () => {}) {
  const parser = new PDFParse({ data: pdfBuffer });
  let textResult;
  try {
    textResult = await parser.getText();
  } finally {
    try { await parser.destroy(); } catch (_) {}
  }

  if (!textResult || !textResult.pages || textResult.pages.length === 0) {
    throw new Error('Failed to extract text from the uploaded PDF document.');
  }

  const totalPages = textResult.total || textResult.pages.length;
  onProgress({ stage: 'extracted_text', totalPages });

  // ── Step 1: Identify Policy Boundaries across pages ───────────────────────
  const rawPolicies = segmentDocumentPolicies(textResult.pages);
  onProgress({ stage: 'identified_policies', count: rawPolicies.length });

  // ── Step 2: Enrich with Gemini AI Metadata (summaries, scenarios, terms) ───
  // ── Step 2: Enrich with Gemini AI Metadata concurrently (4 workers) ──────
  async function processOnePolicy(raw, i) {
    onProgress({
      stage: 'structuring_metadata',
      current: i + 1,
      total: rawPolicies.length,
      policyTitle: raw.title,
    });

    let metadata = {};
    try {
      metadata = await structurePolicyMetadata(raw.title, raw.fullText, 7000);
    } catch (err) {
      console.warn(`[ingestHandbookPdf] AI metadata fallback for "${raw.title}":`, err.message);
      metadata = {
        summary: raw.fullText.slice(0, 200).replace(/\s+/g, ' ').trim() + '...',
        catKey: raw.inferredCatKey || 'conduct',
        cat: 'Student Conduct',
        keywords: [raw.title.toLowerCase()],
        relatedTerms: [],
        scenarios: [`What are the rules regarding ${raw.title}?`],
        steps: [],
        source: 'fallback',
      };
    }

    // Reference code generation: e.g. PLSP-ACAD-001, PLSP-SC-002, PLSP-DISC-003
    const prefixMap = {
      academic: 'PLSP-AP',
      conduct: 'PLSP-SC',
      discipline: 'PLSP-CD',
      rights: 'PLSP-RR',
      general: 'PLSP-GN',
    };
    const codePrefix = prefixMap[metadata.catKey] || 'PLSP-POL';
    const seq = String(i + 1).padStart(3, '0');
    const ref = raw.explicitRef || `${codePrefix}-${seq}`;

    // Section ID mapping for handbook viewer
    const handbookSectionId = raw.handbookSectionId || `sec-${raw.page}-${i + 1}`;

    // Validate fields
    const warnings = [];
    if (!raw.title || raw.title.length < 3) warnings.push('Short or missing policy title');
    if (!raw.fullText || raw.fullText.length < 50) warnings.push('Very short policy content');
    if (!raw.page || raw.page < 1 || raw.page > totalPages) warnings.push('Invalid page reference');

    return {
      id: `draft-${Date.now()}-${i}`,
      ref,
      title: raw.title,
      catKey: metadata.catKey || 'conduct',
      cat: metadata.cat || 'Student Conduct',
      summary: metadata.summary,
      desc: raw.fullText.slice(0, 300).replace(/\s+/g, ' ').trim(),
      full: raw.fullText,
      steps: metadata.steps || [],
      related: [],
      scenarios: metadata.scenarios || [],
      keywords: metadata.keywords || [],
      relatedTerms: metadata.relatedTerms || [],
      handbookSectionId,
      page: raw.page,
      endPage: raw.endPage,
      status: warnings.length === 0 ? 'ready' : 'needs_review',
      warnings,
      aiSource: metadata.source || 'gemini',
    };
  }

  // Concurrent worker queue with limit = 4
  const concurrency = 4;
  const enrichedPolicies = new Array(rawPolicies.length);
  let currentIndex = 0;
  async function worker() {
    while (currentIndex < rawPolicies.length) {
      const idx = currentIndex++;
      enrichedPolicies[idx] = await processOnePolicy(rawPolicies[idx], idx);
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, rawPolicies.length) }, () => worker());
  await Promise.all(workers);

  return {
    totalPages,
    totalPolicies: enrichedPolicies.length,
    policies: enrichedPolicies,
  };
}

/**
 * Segment pages into individual policy candidates using headings, numbering, and articles.
 */
function cleanTitle(rawTitle = '') {
  let cleaned = rawTitle
    .replace(/^(\d+\s*\|\s*P\s*a\s*g\s*e)/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Standardize "Section 1." or "Sec. 1." to "Sec. 1 — "
  cleaned = cleaned.replace(/^(Section|Sec\.)\s*(\d+)[\.\:\s—\-]+/i, 'Sec. $2 — ');
  cleaned = cleaned.replace(/^(Article|ARTICLE)\s*([IVXLCDM\d]+)[\.\:\s—\-]+/i, 'Article $2 — ');
  cleaned = cleaned.replace(/^(Rule|RULE)\s*([IVXLCDM\d]+)[\.\:\s—\-]+/i, 'Rule $2 — ');

  // Clean trailing punctuation or stray dashes
  cleaned = cleaned.replace(/[\s—\-:]+$/, '').trim();
  return cleaned;
}

/**
 * Segment pages into individual policy candidates using headings, numbering, and articles.
 */
function segmentDocumentPolicies(pages = []) {
  const policyCandidates = [];

  let currentChapter = '';
  let currentArticle = '';
  let activePolicy = null;

  // Regex patterns for headings
  const rulePattern = /^(RULE|Rule)\s+([IVXLCDM\d]+)[\s—\-\:\.]*(.*)$/i;
  const articlePattern = /^(ARTICLE|Article)\s+([IVXLCDM\d]+)[\s—\-\:\.]*(.*)$/i;
  const offensePattern = /^([A-D]\.\s*(Light|Less Grave|Grave)\s+Offenses.*)$/i;
  const sectionPattern = /^(Section|SECTION|Sec\.)\s*(\d+[\w\.\:\-\—\s]*)$/i;

  for (const pageObj of pages) {
    const pageNum = pageObj.num;
    // Regulations officially start at page 7 (Rule I - Academic Regulations)
    if (pageNum < 7) continue;

    const cleanedText = cleanPageText(pageObj.text);
    const lines = cleanedText.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Check Rule / Chapter
      const ruleMatch = line.match(rulePattern);
      if (ruleMatch) {
        currentChapter = line;
        continue;
      }

      // Check Offense Classifications (e.g. A. Light Offenses, B. Less Grave Offenses, C. Grave Offenses)
      const offenseMatch = line.match(offensePattern);
      if (offenseMatch) {
        if (activePolicy && activePolicy.fullText.trim().length > 60) {
          activePolicy.endPage = pageNum;
          policyCandidates.push(activePolicy);
        }
        activePolicy = {
          title: cleanTitle(offenseMatch[1]),
          page: pageNum,
          endPage: pageNum,
          fullText: '',
          section: currentArticle || 'Student Discipline',
          inferredCatKey: 'discipline',
        };
        continue;
      }

      // Check Article
      const articleMatch = line.match(articlePattern);
      if (articleMatch) {
        currentArticle = line;
        if (/offenses|code of conduct|discipline|guidelines|provisions|general rules/i.test(line)) {
          if (activePolicy && activePolicy.fullText.trim().length > 60) {
            activePolicy.endPage = pageNum;
            policyCandidates.push(activePolicy);
          }
          activePolicy = {
            title: cleanTitle(line),
            page: pageNum,
            endPage: pageNum,
            fullText: '',
            section: currentChapter || currentArticle,
            inferredCatKey: inferCatKeyFromContext(currentChapter, currentArticle, line),
          };
          continue;
        }
      }

      // Check Section (handles "Section 1. Prescribed Student Uniform", "Sec. 2 — DLSP Student Identification Card (I.D.)", etc.)
      let secTitle = null;
      const secMatch = line.match(/^(Section|SECTION|Sec\.)\s*(\d+)[\.\:\s—\-]+(.*)$/i);
      if (secMatch && line.length < 130) {
        let fullTitle = line;
        if (lines[i + 1] && lines[i + 1].trim().length < 60 && !lines[i + 1].match(/^(Section|Sec|Rule|Article|\d+\.)/i)) {
          const nextTrimmed = lines[i + 1].trim();
          if (/^[A-Z]/.test(nextTrimmed)) {
            fullTitle += ' — ' + nextTrimmed;
            i++;
          }
        }
        secTitle = cleanTitle(fullTitle);
      }

      if (secTitle) {
        // Commit previous policy if it has sufficient content
        if (activePolicy && activePolicy.fullText.trim().length > 60) {
          activePolicy.endPage = pageNum;
          policyCandidates.push(activePolicy);
        }

        activePolicy = {
          title: secTitle,
          page: pageNum,
          endPage: pageNum,
          fullText: '',
          section: currentArticle || currentChapter,
          inferredCatKey: inferCatKeyFromContext(currentChapter, currentArticle, secTitle),
        };
        continue;
      }

      // If we have an active policy, accumulate text
      if (activePolicy) {
        activePolicy.fullText += (activePolicy.fullText ? '\n' : '') + line;
      }
    }
  }

  // Push final active policy
  if (activePolicy && activePolicy.fullText.trim().length > 60) {
    activePolicy.endPage = pages[pages.length - 1]?.num || activePolicy.page;
    policyCandidates.push(activePolicy);
  }

  // Filter out table of contents or noise
  return policyCandidates.filter(p => {
    // Avoid table of contents entries e.g. "Section 1 ......... page 7"
    if (/\.{4,}|\bpage\s+\d+\b/i.test(p.title) && p.fullText.length < 150) return false;
    return p.fullText.trim().length >= 50;
  });
}

function inferCatKeyFromContext(chapter = '', article = '', title = '') {
  const combined = `${chapter} ${article} ${title}`.toLowerCase();
  if (/academic|curriculum|admission|retention|enrol|grading|honors|clearance|dismissal|internship/i.test(combined)) {
    return 'academic';
  }
  if (/uniform|id card|conduct|decorum|attire|civilian/i.test(combined)) {
    return 'conduct';
  }
  if (/discipline|offense|misdemeanor|sanction|suspension|expulsion|misconduct|harassment|investigation/i.test(combined)) {
    return 'discipline';
  }
  if (/rights|affairs|organization|council|ssg|publication|sinag|freedom/i.test(combined)) {
    return 'rights';
  }
  return 'general';
}

module.exports = {
  ingestHandbookPdf,
  segmentDocumentPolicies,
};
