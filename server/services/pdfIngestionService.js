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
/**
 * Check if a line appears to be a Table of Contents entry.
 */
function isTableOfContentsLine(line) {
  if (!line) return false;
  const trimmed = line.trim();
  if (/^TABLE\s+OF\s+CONTENTS/i.test(trimmed)) return true;
  if (/^SECTION\s+POLICY\s+PAGE/i.test(trimmed)) return true;
  // Lines with leader dots, dashes, or tabs leading to a trailing page number
  if (/(\.{2,}|…|—{2,}|\-{2,}|\t|\s{2,})\s*\d+\s*$/i.test(trimmed)) return true;
  if (/\b(?:page|pg\.?)\s*\d+\s*$/i.test(trimmed)) return true;
  // TOC table row format: e.g. "1.1 Student Identification Card Policy 4"
  if (/^(?:SECTION\s+)?\d+(?:\.\d+)?\s+.*\s+\d+$/i.test(trimmed)) return true;
  return false;
}

const STOP_WORDS = new Set([
  'and', 'or', 'of', 'the', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'a', 'an', 'as', 'into', 'from', 'via', 'per', 'until', 'during', '&'
]);

/**
 * Validate that a string has title-case heading characteristics rather than prose/sentence text.
 */
function isTitleCasedHeading(title) {
  if (!title) return false;
  const trimmed = title.trim().replace(/^[\W\d]+/, '').replace(/[\W\d]+$/, '');
  const words = trimmed.split(/\s+/).filter(w => w.length > 0);
  if (words.length === 0) return false;
  if (words.length > 10) return false;

  let nonStopCount = 0;
  let capitalizedCount = 0;

  for (let i = 0; i < words.length; i++) {
    const rawWord = words[i].replace(/^[^\w]+|[^\w]+$/g, '');
    if (!rawWord) continue;
    const lower = rawWord.toLowerCase();

    if (i > 0 && STOP_WORDS.has(lower)) {
      continue;
    }

    nonStopCount++;
    if (/^[A-Z0-9]/.test(rawWord)) {
      capitalizedCount++;
    }
  }

  if (nonStopCount === 0) return false;
  return (capitalizedCount / nonStopCount) >= 0.7;
}

/**
 * Validate that a candidate title text is a legitimate heading title and not a sentence,
 * list item, or metadata artifact.
 */
function isValidHeadingTitle(title) {
  if (!title) return false;
  const trimmed = title.trim();
  if (trimmed.length < 3 || trimmed.length > 95) return false;
  if (!/^[A-Z0-9"']/i.test(trimmed)) return false;
  if (/^[a-z]/.test(trimmed)) return false;
  if (isTableOfContentsLine(trimmed)) return false;
  if (/^(POLICY\s+ID|POLICY\s+SUMMARY|POLICY\s+PROVISIONS|ILLUSTRATIVE|ADMINISTRATIVE\s+CONSEQUENCE)/i.test(trimmed)) return false;
  // Disallow common sentence modal verbs and phrases typical of body rule provisions
  if (/\b(shall|must|will not|is expected to|has the right to|have the right to|are required to|shall be|may not exceed|shall serve|shall pay|agrees to|cannot be|is prohibited|are prohibited)\b/i.test(trimmed)) return false;
  if (/(?:in case of|such as|including|as follows|the following)\s*[:\.]?$/i.test(trimmed)) return false;
  // Disallow dangling prepositions, conjunctions, or verbs at line end
  if (/\b(of|for|with|in|on|at|by|from|to|and|or|as|the|a|an|that|which|who|is|are|was|were|be|been|have|has|had|shall|will|may)\s*$/i.test(trimmed)) return false;
  if (/\.\s+[A-Z]/.test(trimmed)) return false;
  if (trimmed.endsWith('.') && (/^(The|No|A|An|Every|Any)\s/i.test(trimmed) || trimmed.length > 45)) return false;
  if (!isTitleCasedHeading(trimmed)) return false;
  return true;
}

/**
 * Clean and standardize policy candidate titles.
 */
function cleanTitle(rawTitle = '') {
  let cleaned = rawTitle
    .replace(/^(\d+\s*\|\s*P\s*a\s*g\s*e)/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Standardize "Section 1." or "Sec. 1." to "Sec. 1 — "
  cleaned = cleaned.replace(/^(Section|Sec\.)\s*(\d+(?:\.\d+)*)[\.\:\s—\-]+/i, 'Sec. $2 — ');
  cleaned = cleaned.replace(/^(Article|ARTICLE)\s*([IVXLCDM\d]+)[\.\:\s—\-]+/i, 'Article $2 — ');
  cleaned = cleaned.replace(/^(Rule|RULE)\s*([IVXLCDM\d]+)[\.\:\s—\-]+/i, 'Rule $2 — ');
  cleaned = cleaned.replace(/^(Policy|POLICY)\s*(\d+)[\.\:\s—\-]+/i, 'Policy $2 — ');

  // Standardize numbered headings "2.1. Admission and Enrollment" -> "2.1 Admission and Enrollment"
  cleaned = cleaned.replace(/^(\d+\.\d+(?:\.\d+)?)\s*[\.\:\—\-]+\s*/, '$1 ');

  // Clean trailing punctuation or stray dashes
  cleaned = cleaned.replace(/[\s—\-:]+$/, '').trim();
  return cleaned;
}

/**
 * Detect chapter.section numbered headings (e.g. "2.1 Admission and Enrollment",
 * "Section 1.1. Possession and Use", "3.1 Respectful Behavior", "4.2 Examples of Violations",
 * "5.1 Student Rights"). Supports multi-line headers (e.g. "SECTION 1.1\nPolicy Title").
 */
function detectNumberedSectionHeading(lines, i) {
  const line = lines[i];
  if (!line) return null;
  const trimmed = line.trim();
  if (isTableOfContentsLine(trimmed)) return null;

  // Chapter.section format: e.g. 2.1, 2.2, 3.1, 10.4 (with or without Section/Sec.)
  const hasSecPrefix = /^(?:Section|SECTION|Sec\.)\s+/i.test(trimmed);
  const match = trimmed.match(/^(?:(?:Section|SECTION|Sec\.)\s*)?(\d+\.\d+(?:\.\d+)?)(?:[\.\:\—\-]+|\s+)(.*)$/i);
  let sectionNum = '';
  let rawTitle = '';
  let linesConsumed = 0;

  if (match) {
    sectionNum = match[1];
    rawTitle = match[2].trim();
  } else {
    // Check if line is just "SECTION 1.1" or "2.1"
    const standaloneMatch = trimmed.match(/^(?:(?:Section|SECTION|Sec\.)\s*)?(\d+\.\d+(?:\.\d+)?)\s*[\.\:\—\-]?\s*$/i);
    if (standaloneMatch) {
      sectionNum = standaloneMatch[1];
      rawTitle = '';
    } else {
      return null;
    }
  }

  // If rawTitle is empty, look at next line
  if (!rawTitle) {
    const nextLine = lines[i + 1] ? lines[i + 1].trim() : '';
    if (!nextLine || isTableOfContentsLine(nextLine) || /^(POLICY\s+ID|RULE|ARTICLE|SECTION|\d+\.)/i.test(nextLine)) {
      return null;
    }
    rawTitle = nextLine;
    linesConsumed = 1;
  }

  // If rawTitle ends with a connecting word (e.g. "and", "or", "of"), or next line continues the title:
  if (lines[i + linesConsumed + 1]) {
    const following = lines[i + linesConsumed + 1].trim();
    if (following && following.length < 50 && !/^(POLICY\s+ID|POLICY\s+SUMMARY|SECTION|RULE|ARTICLE|\d+\.)/i.test(following)) {
      if (/\b(and|or|of|for|with|in|to|the|a)\s*$/i.test(rawTitle) || (isTitleCasedHeading(following) && rawTitle.length < 50)) {
        rawTitle += ' ' + following;
        linesConsumed++;
      }
    }
  }

  if (!isValidHeadingTitle(rawTitle)) {
    return null;
  }

  rawTitle = rawTitle.replace(/[\.\:\—\-]+$/, '').trim();
  const fullTitle = hasSecPrefix ? `Sec. ${sectionNum} — ${rawTitle}` : `${sectionNum} ${rawTitle}`;

  return {
    sectionNum,
    rawTitle,
    fullTitle,
    linesConsumed,
  };
}

/**
 * Segment pages into individual policy candidates using headings, numbering, and articles.
 */
function segmentDocumentPolicies(pages = []) {
  const policyCandidates = [];

  let currentChapter = '';
  let currentArticle = '';
  let activePolicy = null;
  let inToc = false;

  // Regex patterns for headings
  const rulePattern = /^(RULE|Rule|CHAPTER|Chapter)\s+([IVXLCDM\d]+)[\s—\-\:\.]*(.*)$/i;
  const articlePattern = /^(ARTICLE|Article)\s+([IVXLCDM\d]+)[\s—\-\:\.]*(.*)$/i;
  const offensePattern = /^([A-D]\.\s*(Light|Less Grave|Grave)\s+Offenses.*)$/i;
  const policyKeywordPattern = /^(Policy|POLICY)\s*(\d+)[\.\:\s—\-]+(.*)$/i;

  function commitActivePolicy(endPage) {
    if (activePolicy && activePolicy.fullText.trim().length >= 40) {
      activePolicy.endPage = activePolicy.lastSeenPage || endPage || activePolicy.page;
      delete activePolicy.lastSeenPage;
      policyCandidates.push(activePolicy);
    }
    activePolicy = null;
  }

  for (const pageObj of pages) {
    const pageNum = pageObj.num;
    const cleanedText = cleanPageText(pageObj.text);
    const lines = cleanedText.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Track Table of Contents
      if (/^TABLE\s+OF\s+CONTENTS/i.test(line)) {
        inToc = true;
        continue;
      }

      // Check Rule / Chapter (exit TOC if encountered)
      const ruleMatch = line.match(rulePattern);
      if (ruleMatch) {
        inToc = false;
        currentChapter = line;
        continue;
      }

      // If in TOC, check if we encountered a major boundary that exits TOC
      if (inToc) {
        if (isTableOfContentsLine(line) || /^(SECTION|POLICY|PAGE|CONTENTS)/i.test(line)) {
          continue;
        }
        inToc = false;
      }

      // Check Offense Classifications (e.g. A. Light Offenses, B. Less Grave Offenses, C. Grave Offenses)
      const offenseMatch = line.match(offensePattern);
      if (offenseMatch) {
        commitActivePolicy(pageNum);
        activePolicy = {
          title: cleanTitle(offenseMatch[1]),
          page: pageNum,
          endPage: pageNum,
          lastSeenPage: pageNum,
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
          commitActivePolicy(pageNum);
          activePolicy = {
            title: cleanTitle(line),
            page: pageNum,
            endPage: pageNum,
            lastSeenPage: pageNum,
            fullText: '',
            section: currentChapter || currentArticle,
            inferredCatKey: inferCatKeyFromContext(currentChapter, currentArticle, line),
          };
          continue;
        }
      }

      // Check Numbered Heading (chapter.section formats like 2.1 Admission and Enrollment)
      const numberedMatch = detectNumberedSectionHeading(lines, i);
      if (numberedMatch) {
        commitActivePolicy(pageNum);
        i += numberedMatch.linesConsumed;
        const formattedTitle = cleanTitle(numberedMatch.fullTitle);
        activePolicy = {
          title: formattedTitle,
          page: pageNum,
          endPage: pageNum,
          lastSeenPage: pageNum,
          fullText: '',
          section: currentArticle || currentChapter || 'Student Regulations',
          inferredCatKey: inferCatKeyFromContext(currentChapter, currentArticle, formattedTitle),
        };
        continue;
      }

      // Check Traditional Section (handles "Section 1. Prescribed Student Uniform", "Sec. 2 — DLSP...", etc.)
      let secTitle = null;
      const secMatch = line.match(/^(Section|SECTION|Sec\.)\s*(\d+)(?!\.\d)[\.\:\s—\-]+(.*)$/i);
      if (secMatch && line.length < 130 && !isTableOfContentsLine(line)) {
        let titleCandidate = secMatch[3].trim();
        let fullTitle = line;
        if (lines[i + 1] && lines[i + 1].trim().length < 60 && !lines[i + 1].match(/^(Section|Sec|Rule|Article|\d+\.)/i)) {
          const nextTrimmed = lines[i + 1].trim();
          if (/^[A-Z]/.test(nextTrimmed) && isValidHeadingTitle(nextTrimmed)) {
            fullTitle += ' — ' + nextTrimmed;
            titleCandidate += ' — ' + nextTrimmed;
            i++;
          }
        }
        if (isValidHeadingTitle(titleCandidate)) {
          secTitle = cleanTitle(fullTitle);
        }
      }

      // Check Compact Demonstration Handbook "Policy N: Title"
      if (!secTitle) {
        const polMatch = line.match(policyKeywordPattern);
        if (polMatch && line.length < 130 && !isTableOfContentsLine(line) && isValidHeadingTitle(polMatch[3])) {
          secTitle = cleanTitle(line);
        }
      }

      if (secTitle) {
        commitActivePolicy(pageNum);
        activePolicy = {
          title: secTitle,
          page: pageNum,
          endPage: pageNum,
          lastSeenPage: pageNum,
          fullText: '',
          section: currentArticle || currentChapter || 'Student Regulations',
          inferredCatKey: inferCatKeyFromContext(currentChapter, currentArticle, secTitle),
        };
        continue;
      }

      // If we have an active policy, accumulate text
      if (activePolicy) {
        activePolicy.fullText += (activePolicy.fullText ? '\n' : '') + line;
        activePolicy.lastSeenPage = pageNum;
      }
    }
  }

  // Push final active policy
  commitActivePolicy(pages[pages.length - 1]?.num);

  // Filter out table of contents or noise
  return policyCandidates.filter(p => {
    // Avoid table of contents entries e.g. "Section 1 ......... page 7"
    if (/\.{4,}|\bpage\s+\d+\b/i.test(p.title) && p.fullText.length < 150) return false;
    return p.fullText.trim().length >= 40;
  });
}

function inferCatKeyFromContext(chapter = '', article = '', title = '') {
  const combined = `${chapter} ${article} ${title}`.toLowerCase();
  if (/academic|curriculum|admission|retention|enrol|grading|honors|clearance|dismissal|internship|prerequisite|attendance|punctuality|tardiness|load/i.test(combined)) {
    return 'academic';
  }
  if (/uniform|id card|conduct|decorum|attire|civilian|respect|behavior|device|computer|network|facility|library/i.test(combined)) {
    return 'conduct';
  }
  if (/discipline|offense|misdemeanor|sanction|suspension|expulsion|misconduct|harassment|investigation|violation|penalty/i.test(combined)) {
    return 'discipline';
  }
  if (/rights|affairs|organization|council|ssg|publication|sinag|freedom|privilege/i.test(combined)) {
    return 'rights';
  }
  return 'general';
}

module.exports = {
  ingestHandbookPdf,
  segmentDocumentPolicies,
};
