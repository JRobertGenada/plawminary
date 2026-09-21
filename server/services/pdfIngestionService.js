/**
 * server/services/pdfIngestionService.js
 *
 * Deterministic ingestion and validation engine for PLAWMINARY Student Handbook PDFs.
 * 1. Extracts raw page text and page numbers using pdf-parse.
 * 2. Uses a hierarchy state machine (Chapter/Rule → Article → Section → Category → Policy → Sub-items)
 *    to segment policy boundaries correctly, preserving complete text across page breaks.
 * 3. Handles shared offense penalty preambles (e.g. Light/Less Grave Offenses shared penalty block)
 *    as category context on individual offense records, not separate policies.
 * 4. Preserves parent Article/Rule/Section/Category headings as metadata, not prepended into title text.
 * 5. Preserves paragraph-based sections as substantive policy records when no numbered items follow.
 * 6. Runs a comprehensive validation suite detecting:
 *    - contaminated titles
 *    - merged previous/next policies
 *    - truncated content
 *    - duplicate records
 *    - incorrect numbering
 *    - incorrect hierarchy
 *    - incorrect start/end page
 *    - orphaned continuation text
 * 7. Enriches policies with AI metadata (Gemini) when requested during ingestion.
 */

'use strict';

const { PDFParse } = require('pdf-parse');
const { structurePolicyMetadata } = require('./geminiService');

// ═══════════════════════════════════════════════════════════════════════════════
// §1  PAGE CLEANING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Remove running page headers/footers e.g. "52 | P a g e" or "Student Handbook 2018".
 */
function cleanPageText(text = '') {
  return text
    .split('\n')
    .filter(line => {
      const t = line.trim();
      if (!t) return true;
      if (/^\d+\s*\|\s*P\s*a\s*g\s*e$/i.test(t)) return false;
      if (/^P\s*a\s*g\s*e\s*\|\s*\d+$/i.test(t)) return false;
      if (/^\d+$/.test(t) && t.length <= 4) return false;
      return true;
    })
    .join('\n');
}

// ═══════════════════════════════════════════════════════════════════════════════
// §2  TITLE HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

const STOP_WORDS = new Set([
  'and', 'or', 'of', 'the', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'a',
  'an', 'as', 'into', 'from', 'via', 'per', 'until', 'during', '&',
]);

function isTitleCasedHeading(title) {
  if (!title) return false;
  const trimmed = title.trim().replace(/^[\W\d]+/, '').replace(/[\W\d]+$/, '');
  const words = trimmed.split(/\s+/).filter(w => w.length > 0);
  if (words.length === 0) return false;
  if (words.length > 10) return false;
  let nonStop = 0, capped = 0;
  for (let i = 0; i < words.length; i++) {
    const raw = words[i].replace(/^[^\w]+|[^\w]+$/g, '');
    if (!raw) continue;
    if (i > 0 && STOP_WORDS.has(raw.toLowerCase())) continue;
    nonStop++;
    if (/^[A-Z0-9]/.test(raw)) capped++;
  }
  if (nonStop === 0) return false;
  return (capped / nonStop) >= 0.7;
}

function isTableOfContentsLine(line) {
  if (!line) return false;
  const t = line.trim();
  if (/^TABLE\s+OF\s+CONTENTS/i.test(t)) return true;
  if (/^SECTION\s+POLICY\s+PAGE/i.test(t)) return true;
  if (/(\.{2,}|\u2026|\u2014{2,}|-{2,}|\t|\s{2,})\s*\d+\s*$/i.test(t)) return true;
  if (/\b(?:page|pg\.?)\s*\d+\s*$/i.test(t)) return true;
  if (/^(?:SECTION\s+)?\d+(?:\.\d+)?\s+.*\s+\d+$/i.test(t)) return true;
  return false;
}

function isValidHeadingTitle(title) {
  if (!title) return false;
  const t = title.trim();
  if (t.length < 3 || t.length > 95) return false;
  if (!/^[A-Z0-9"']/i.test(t)) return false;
  if (/^[a-z]/.test(t)) return false;
  if (isTableOfContentsLine(t)) return false;
  if (/^(POLICY\s+ID|POLICY\s+SUMMARY|POLICY\s+PROVISIONS|ILLUSTRATIVE|ADMINISTRATIVE\s+CONSEQUENCE)/i.test(t)) return false;
  if (/\b(shall|must|will not|is expected to|have the right to|are required to|shall be|may not exceed|shall serve|shall pay|agrees to|cannot be|is prohibited|are prohibited)\b/i.test(t)) return false;
  if (/(?:in case of|such as|including|as follows|the following)\s*[:\.]?$/i.test(t)) return false;
  if (/\b(of|for|with|in|on|at|by|from|to|and|or|as|the|a|an|that|which|who|is|are|was|were|be|been|have|has|had|shall|will|may)\s*$/i.test(t)) return false;
  if (/\.\s+[A-Z]/.test(t)) return false;
  if (t.endsWith('.') && (/^(The|No|A|An|Every|Any)\s/i.test(t) || t.length > 45)) return false;
  if (!isTitleCasedHeading(t)) return false;
  return true;
}

function cleanTitle(rawTitle = '') {
  let c = rawTitle.replace(/^(\d+\s*\|\s*P\s*a\s*g\s*e)/i, '').replace(/\s+/g, ' ').trim();
  c = c.replace(/^(Section|Sec\.)\s*(\d+(?:\.\d+)*)[\.\:\s\u2014\-]+/i, 'Section $2 \u2014 ');
  c = c.replace(/^(Article|ARTICLE)\s*([IVXLCDM\d]+)[\.\:\s\u2014\-]+/i, 'Article $2 \u2014 ');
  c = c.replace(/^(Rule|RULE)\s*([IVXLCDM\d]+)[\.\:\s\u2014\-]+/i, 'Rule $2 \u2014 ');
  c = c.replace(/^(Policy|POLICY)\s*(\d+)[\.\:\s\u2014\-]+/i, 'Policy $2 \u2014 ');
  c = c.replace(/^(\d+\.\d+(?:\.\d+)?)\s*[\.\:\u2014\-]+\s*/, '$1 ');
  c = c.replace(/[\s\u2014\-:]+$/, '').trim();
  return c;
}

function cleanSnippet(str, max = 80) {
  if (!str) return '';
  let s = str.replace(/\s+/g, ' ').trim();
  const puncIdx = s.search(/[.;:]/);
  if (puncIdx > 15 && puncIdx <= max) {
    s = s.slice(0, puncIdx).trim();
  } else if (s.length > max) {
    const cut = s.slice(0, max);
    const lastSpace = cut.lastIndexOf(' ');
    s = (lastSpace > 20 ? cut.slice(0, lastSpace) : cut).trim();
  }
  s = s.replace(/\s+(?:and|or|of|the|in|on|at|to|for|with|by|a|an|as|into|from|which|that|who|is|are|shall)\s*$/i, '');
  return s.replace(/[\s\u2014\-:,;]+$/, '').trim();
}

// ═══════════════════════════════════════════════════════════════════════════════
// §3  CATEGORY KEY INFERENCE
// ═══════════════════════════════════════════════════════════════════════════════

function inferCatKeyFromContext(chapter, article, title) {
  const combined = ((chapter || '') + ' ' + (article || '') + ' ' + (title || '')).toLowerCase();
  if (/academic|curriculum|admission|retention|enrol|grading|honors|clearance|dismissal|internship|prerequisite|attendance|punctuality|tardiness|load/i.test(combined)) return 'academic';
  if (/uniform|id card|conduct|decorum|attire|civilian|respect|behavior|device|computer|network|facility|library/i.test(combined)) return 'conduct';
  if (/discipline|offense|misdemeanor|sanction|suspension|expulsion|misconduct|harassment|investigation|violation|penalty/i.test(combined)) return 'discipline';
  if (/rights|affairs|organization|council|ssg|publication|sinag|freedom|privilege/i.test(combined)) return 'rights';
  return 'general';
}

// ═══════════════════════════════════════════════════════════════════════════════
// §4  LINE CLASSIFIERS
// ═══════════════════════════════════════════════════════════════════════════════

const ARTICLE_RE = /^(ARTICLE|Article)\s+([IVXLCDM\d]+)[\s\-\u2014\.:]*(.*)$/i;
const SECTION_RE = /^(Section|SECTION|Sec\.)\s*(\d+)(?!\.\d)[\s\-\u2014\.:]+(.*)$/i;
const NUMBERED_SEC_RE = /^(?:(?:Section|SECTION|Sec\.)\s*)?(\d+\.\d+(?:\.\d+)?)[\s\-\u2014\.:]+(.+)$/i;
const OFFENSE_CAT_VARIANT_RE = /^([A-Z])\.\s+(?:The\s+following\s+shall\s+be\s+considered\s+)?((?:Light|Less\s+Grave|Grave|Very\s+Grave)\s+Offenses)(?:\s+shall\s+include\s+but\s+are\s+not\s+limited\s+to)?\s*[:\.]?\s*(.*)$/i;
const GENERIC_OFFENSE_CAT_RE = /^([A-Z])\.\s+([A-Z][A-Za-z\s\-]{3,40}\s+Offenses)\s*[:\.]?\s*(.*)$/i;
// Match 1 to 3 digits for numbered items (not 4-digit years or resolutions like 0940)
const NUMBERED_ITEM_RE = /^(\d{1,3})[\.,](?:\s+|\b(?=[A-Za-z]))(.+)$/;
const LETTERED_SUB_RE = /^([a-zA-Z])[\.\)]\s+(.+)$/;
const PAREN_NUM_RE = /^\((\d+|[a-zA-Z]+)\)\s+(.+)$/;
const ROMAN_SUB_RE = /^(i{1,3}|iv|v|vi{0,3}|ix|x)[\.\)]\s+(.+)$/i;
const RULE_RE = /^(RULE|Rule|CHAPTER|Chapter)\s+([IVXLCDM\d]+)[\s\-\u2014\.:]*(.*)$/i;
const POLICY_KW_RE = /^(Policy|POLICY)\s*(\d+)[\.\:\s\u2014\-]+(.+)$/i;

// ═══════════════════════════════════════════════════════════════════════════════
// §5  VALIDATION FLAGS
// ═══════════════════════════════════════════════════════════════════════════════

const ValidationFlag = {
  CONTAMINATED_TITLE:          'CONTAMINATED_TITLE',
  MERGED_POLICIES:             'MERGED_POLICIES',
  TRUNCATED_CONTENT:           'TRUNCATED_CONTENT',
  DUPLICATE_RECORD:            'DUPLICATE_RECORD',
  INCORRECT_NUMBERING:         'INCORRECT_NUMBERING',
  INCORRECT_HIERARCHY:         'INCORRECT_HIERARCHY',
  INCORRECT_PAGE_RANGE:        'INCORRECT_PAGE_RANGE',
  ORPHANED_CONTINUATION:       'ORPHANED_CONTINUATION',
  SUSPICIOUS_SHORT:            'SUSPICIOUS_SHORT',
  SUSPICIOUS_LONG:             'SUSPICIOUS_LONG',
  POSSIBLE_HEADER_FOOTER:      'POSSIBLE_HEADER_FOOTER',
};

// ═══════════════════════════════════════════════════════════════════════════════
// §6  HIERARCHY CONTEXT
// ═══════════════════════════════════════════════════════════════════════════════

function createHierarchyContext() {
  return {
    chapter: '',
    article: '',
    section: '',
    subsection: '',
    category: '',
    categoryLetter: '',
    categoryPreamble: '',
    inCategory: false,
    preambleCollected: false,
  };
}

function resetSectionLevel(ctx) {
  ctx.section = '';
  ctx.subsection = '';
  ctx.category = '';
  ctx.categoryLetter = '';
  ctx.categoryPreamble = '';
  ctx.inCategory = false;
  ctx.preambleCollected = false;
}

function resetCategoryLevel(ctx) {
  ctx.category = '';
  ctx.categoryLetter = '';
  ctx.categoryPreamble = '';
  ctx.inCategory = false;
  ctx.preambleCollected = false;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §7  POLICY BUILDER HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function makePolicyDraft(title, page, ctx, extra) {
  return Object.assign({
    title: (title || '').replace(/[\s\u2014\-:]+$/, '').trim(),
    page,
    endPage: page,
    lastSeenPage: page,
    fullText: '',
    chapter: ctx.chapter,
    article: ctx.article,
    section: ctx.section,
    subsection: ctx.subsection,
    category: ctx.category,
    categoryContext: ctx.categoryPreamble || '',
    inferredCatKey: inferCatKeyFromContext(ctx.chapter, ctx.article, title),
    validationFlags: [],
  }, extra || {});
}

function appendLine(policy, line, pageNum) {
  if (!policy) return;
  policy.fullText += (policy.fullText ? '\n' : '') + line;
  if (pageNum > policy.lastSeenPage) policy.lastSeenPage = pageNum;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §8  COMPREHENSIVE VALIDATION ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Validate every policy against deterministic extraction quality rules.
 *
 * Rules:
 * 1. Truncation: Do NOT require terminal punctuation. Only flag genuine extraction truncation
 *    (unfinished broken hyphenated words without continuation).
 * 2. Title Contamination: Parent Article/Rule/Section/category headings remain metadata.
 *    Do not flag legitimate wording merely because a title is long.
 * 3. Duplicates: Distinguish true duplicate records from legitimately repeated wording
 *    across different degree programs/pages.
 * 4. Numbering: Treat unusual/misprinted numbering as source-document anomalies when
 *    present in the authoritative PDF. Preserve original numbering.
 *
 * @param {Array<Object>} policies
 * @param {number} totalPages
 * @returns {Object} Full validation report
 */
function runValidationSuite(policies, totalPages = 80) {
  // Pass 1: Identify true duplicates
  // A true duplicate is a record duplicated in the exact same hierarchy position on the exact same page
  const seenKey = Object.create(null);
  const trueDuplicateIndices = new Set();

  for (let idx = 0; idx < policies.length; idx++) {
    const p = policies[idx];
    const fullNorm = (p.fullText || '').replace(/\s+/g, ' ').trim().slice(0, 150);
    const key = (p.article || '') + '::' + (p.section || '') + '::' + (p.category || '') + '::' + p.title + '::p' + p.page + '::' + fullNorm;
    if (seenKey[key] !== undefined) {
      trueDuplicateIndices.add(idx);
    } else {
      seenKey[key] = idx;
    }
  }

  // Pass 2: Source Numbering Anomalies
  // Check sequences within category offense groups (e.g. Less Grave Offenses 4 -> 20 -> 6, Grave Offenses 13 -> 15, 25 & 25)
  const groupSequences = Object.create(null);
  for (let i = 0; i < policies.length; i++) {
    const p = policies[i];
    if (p.isNumberedOffense && p.offenseNumber && p.category) {
      const groupKey = (p.article || '') + '::' + p.category;
      if (!groupSequences[groupKey]) groupSequences[groupKey] = [];
      groupSequences[groupKey].push({ num: parseInt(p.offenseNumber, 10), index: i });
    }
  }

  const numberingFlaggedIndices = new Set();
  for (const [, seqList] of Object.entries(groupSequences)) {
    if (seqList.length < 2) continue;
    for (let j = 0; j < seqList.length; j++) {
      const item = seqList[j];
      if (j > 0) {
        const prev = seqList[j - 1];
        if (item.num === prev.num || item.num !== prev.num + 1) {
          numberingFlaggedIndices.add(item.index);
        }
      }
    }
  }

  const flaggedPolicies = [];
  const validPolicies = [];
  const issueCounts = {
    duplicates: 0,
    titleContamination: 0,
    truncation: 0,
    hierarchyErrors: 0,
    pageErrors: 0,
    numberingErrors: 0,
    orphanedContinuation: 0,
    mergedPolicies: 0,
  };

  const representativeExamples = {
    duplicates: [],
    titleContamination: [],
    truncation: [],
    hierarchyErrors: [],
    pageErrors: [],
    numberingErrors: [],
    orphanedContinuation: [],
    mergedPolicies: [],
  };

  function addExample(category, policy, reason) {
    if (representativeExamples[category].length < 3) {
      representativeExamples[category].push({
        title: policy.title,
        page: policy.page + (policy.page !== policy.endPage ? '–' + policy.endPage : ''),
        reason,
        snippet: (policy.fullText || '').slice(0, 120).replace(/\n/g, ' ') + '...',
      });
    }
  }

  for (let idx = 0; idx < policies.length; idx++) {
    const p = policies[idx];
    const flags = new Set(p.validationFlags || []);
    const text = (p.fullText || '').trim();

    // 1. Contaminated title
    let titleContaminated = false;
    let contamReason = '';
    if (/Students,?\s+who\s+have\s+been\s+found/i.test(p.title)) {
      titleContaminated = true;
      contamReason = 'Preamble sentence leaked into title';
    } else if (/\b(?:shall contain the following|are expected to get involved in)\b/i.test(p.title)) {
      titleContaminated = true;
      contamReason = 'Structural lead-in phrase in title';
    } else if (/\b\d+\s*\|\s*P\s*a\s*g\s*e\b|\bP\s*a\s*g\s*e\s*\|\s*\d+\b/i.test(p.title)) {
      titleContaminated = true;
      contamReason = 'Running header/footer text in title';
    } else if (/\s*—\s*$/.test(p.title) || /\s*-\s*$/.test(p.title)) {
      titleContaminated = true;
      contamReason = 'Title ends with dangling hyphen/dash separator';
    }

    if (titleContaminated) {
      flags.add(ValidationFlag.CONTAMINATED_TITLE);
      issueCounts.titleContamination++;
      addExample('titleContamination', p, contamReason);
    }

    // 2. Merged policies
    let merged = false;
    let mergeReason = '';
    if (/\n(?:Section|Sec\.)\s+\d+(?!\.\d)[\s\-\u2014\.:]+/i.test(text)) {
      merged = true;
      mergeReason = 'Contains embedded Section header in fullText';
    } else if (/\n(?:ARTICLE|Article)\s+[IVXLCDM\d]+[\s\-\u2014\.:]+/i.test(text)) {
      merged = true;
      mergeReason = 'Contains embedded Article header in fullText';
    } else if (p.isNumberedOffense && /\n\d+[\.,]\s+[A-Z].*\n\s*(?:1st\s+Offense:|Warning)/i.test(text)) {
      merged = true;
      mergeReason = 'Contains embedded subsequent offense penalty block';
    }

    if (merged) {
      flags.add(ValidationFlag.MERGED_POLICIES);
      issueCounts.mergedPolicies++;
      addExample('mergedPolicies', p, mergeReason);
    }

    // 3. Truncated content
    // Only flag truncation when source text clearly continues into content that belongs to the same policy but was not captured.
    // Do NOT require terminal punctuation as proof of completeness.
    let truncated = false;
    let truncReason = '';
    if (/[a-zA-Z]{2,}-\s*$/.test(text)) {
      truncated = true;
      truncReason = 'Ends with unfinished hyphenated broken word';
    }

    if (truncated) {
      flags.add(ValidationFlag.TRUNCATED_CONTENT);
      issueCounts.truncation++;
      addExample('truncation', p, truncReason);
    }

    // 4. Duplicate record
    if (trueDuplicateIndices.has(idx)) {
      flags.add(ValidationFlag.DUPLICATE_RECORD);
      issueCounts.duplicates++;
      addExample('duplicates', p, 'Duplicate extraction in identical hierarchy and page location');
    }

    // 5. Incorrect numbering (source PDF anomalies)
    if (numberingFlaggedIndices.has(idx)) {
      flags.add(ValidationFlag.INCORRECT_NUMBERING);
      issueCounts.numberingErrors++;
      addExample('numberingErrors', p, 'Source PDF numbering anomaly (item ' + p.offenseNumber + ')');
    }

    // 6. Incorrect hierarchy
    let hierError = false;
    let hierReason = '';
    if (!p.article && !p.section && !p.chapter) {
      hierError = true;
      hierReason = 'Missing all hierarchy context (no article, section, or chapter)';
    } else if (p.isNumberedOffense && !p.category) {
      hierError = true;
      hierReason = 'Numbered offense missing category';
    }

    if (hierError) {
      flags.add(ValidationFlag.INCORRECT_HIERARCHY);
      issueCounts.hierarchyErrors++;
      addExample('hierarchyErrors', p, hierReason);
    }

    // 7. Page errors
    let pageError = false;
    let pageReason = '';
    if (!p.page || p.page < 1 || p.page > totalPages) {
      pageError = true;
      pageReason = 'Start page out of document bounds (1–' + totalPages + ')';
    } else if (p.endPage < p.page) {
      pageError = true;
      pageReason = 'Inverted page range: endPage (' + p.endPage + ') < page (' + p.page + ')';
    } else if (p.endPage - p.page > 5) {
      pageError = true;
      pageReason = 'Excessive page span (' + (p.endPage - p.page + 1) + ' pages)';
    }

    if (pageError) {
      flags.add(ValidationFlag.INCORRECT_PAGE_RANGE);
      issueCounts.pageErrors++;
      addExample('pageErrors', p, pageReason);
    }

    // 8. Orphaned continuation
    if (flags.has(ValidationFlag.ORPHANED_CONTINUATION)) {
      issueCounts.orphanedContinuation++;
      addExample('orphanedContinuation', p, 'Orphaned list item or continuation fragment');
    }

    p.validationFlags = Array.from(flags);
    if (p.validationFlags.length > 0) {
      flaggedPolicies.push(p);
    } else {
      validPolicies.push(p);
    }
  }

  return {
    totalPolicies: policies.length,
    validPolicies: validPolicies.length,
    flaggedPolicies: flaggedPolicies.length,
    issueCounts,
    representativeExamples,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// §9  MAIN SEGMENTATION FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Segment PDF pages into individual policy candidates using a hierarchy state machine.
 *
 * @param {Array<{num: number, text: string}>} pages
 * @returns {{ policies: Array, diagnostics: Object }}
 */
function segmentDocumentPolicies(pages) {
  if (!Array.isArray(pages)) pages = [];
  const policyCandidates = [];
  const ctx = createHierarchyContext();
  let activePolicy = null;
  let inToc = false;

  function commitPolicy(endPage) {
    if (!activePolicy) return;
    activePolicy.endPage = activePolicy.lastSeenPage || endPage || activePolicy.page;
    delete activePolicy.lastSeenPage;
    activePolicy.fullText = activePolicy.fullText.trim();
    if (activePolicy.fullText.length > 0) {
      policyCandidates.push(activePolicy);
    }
    activePolicy = null;
  }

  function startPolicy(title, page, extra = {}) {
    commitPolicy(page);
    activePolicy = makePolicyDraft(title, page, ctx, extra);
  }

  for (const pageObj of pages) {
    const pageNum = pageObj.num;
    const cleanedText = cleanPageText(pageObj.text || '');
    const lines = cleanedText.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // End of handbook concluding non-policy sections (hymn, pledges)
      if (/^(DLSP,\s+MAHAL\s+KA\s+SA\s+AMING\s+TUNAY|PLEDGE|—\s*END\s+OF)/i.test(line)) {
        commitPolicy(pageNum);
        continue;
      }

      // TOC detection
      if (/^TABLE\s+OF\s+CONTENTS/i.test(line)) {
        inToc = true;
        continue;
      }

      // RULE/CHAPTER exits TOC; updates chapter context
      const ruleMatch = line.match(RULE_RE);
      if (ruleMatch) {
        inToc = false;
        ctx.chapter = line;
        resetSectionLevel(ctx);
        commitPolicy(pageNum);
        continue;
      }

      if (inToc) {
        if (!isTableOfContentsLine(line) && line.length > 0 &&
            !(/^(SECTION|POLICY|PAGE|CONTENTS)/i.test(line))) {
          inToc = false;
        } else {
          continue;
        }
      }

      if (!line) continue;

      // PREAMBLE / INSTITUTIONAL HEADINGS
      if (!inToc && /^(Philosophy|Vision|Mission|Goals|Objectives)$/i.test(line)) {
        ctx.section = line;
        ctx.subsection = '';
        resetCategoryLevel(ctx);
        startPolicy(line, pageNum, { isSectionPolicy: true });
        continue;
      }

      // ARTICLE
      const articleMatch = line.match(ARTICLE_RE);
      if (articleMatch) {
        ctx.article = line;
        resetSectionLevel(ctx);
        commitPolicy(pageNum);
        continue;
      }

      // OFFENSE CATEGORY
      let catMatch = line.match(OFFENSE_CAT_VARIANT_RE) || line.match(GENERIC_OFFENSE_CAT_RE);
      if (catMatch) {
        const catLetter = catMatch[1].toUpperCase();
        const catName = catMatch[2].trim();
        const trailingText = (catMatch[3] || '').trim();

        ctx.category = catLetter + '. ' + catName;
        ctx.categoryLetter = catLetter;
        ctx.categoryPreamble = trailingText;
        ctx.inCategory = true;
        ctx.preambleCollected = false;
        commitPolicy(pageNum);
        continue;
      }

      // SECTION
      const secMatch = line.match(SECTION_RE);
      if (secMatch && line.length < 130 && !isTableOfContentsLine(line)) {
        const secNum = secMatch[2];
        let rawSecTitle = secMatch[3].trim();
        let sectionTitle = '';
        let initialBody = '';

        if (rawSecTitle) {
          if (isValidHeadingTitle(rawSecTitle)) {
            sectionTitle = rawSecTitle;
          } else {
            initialBody = rawSecTitle;
          }
        } else if (lines[i + 1]) {
          const next = lines[i + 1].trim();
          if (next && isValidHeadingTitle(next) && !/^(Section|Sec|Rule|Article|\d+\.)/i.test(next)) {
            sectionTitle = next;
            i++;
          }
        }

        const secMeta = 'Section ' + secNum + (sectionTitle ? '. ' + sectionTitle : '');
        ctx.section = secMeta;
        ctx.subsection = '';
        resetCategoryLevel(ctx);

        // Policy's own title is the section heading or clean initial phrase
        const policyTitle = sectionTitle ? ('Section ' + secNum + '. ' + sectionTitle) : ('Section ' + secNum + (initialBody ? ' — ' + cleanSnippet(initialBody, 65) : ''));
        startPolicy(policyTitle, pageNum, {
          isSectionPolicy: true,
          sectionNumber: secNum,
        });
        if (initialBody) {
          appendLine(activePolicy, initialBody, pageNum);
        }
        continue;
      }

      // NUMBERED SUBSECTION (e.g. 1.1 or Section 1.1)
      const numSecMatch = line.match(NUMBERED_SEC_RE);
      if (numSecMatch && !isTableOfContentsLine(line)) {
        const secDigits = numSecMatch[1];
        const titlePart = numSecMatch[2].trim();
        ctx.subsection = secDigits + ' ' + titlePart;

        // Title is the subsection itself (not prefixed with parent article/section)
        const subTitle = secDigits + ' ' + cleanSnippet(titlePart, 75);
        startPolicy(subTitle, pageNum, { isSubSectionPolicy: true });
        appendLine(activePolicy, line, pageNum);
        continue;
      }

      // POLICY KEYWORD HEADING (Policy 1: Title)
      const polKwMatch = line.match(POLICY_KW_RE);
      if (polKwMatch && line.length < 130 && !isTableOfContentsLine(line) && isValidHeadingTitle(polKwMatch[3])) {
        startPolicy(cleanTitle(line), pageNum, {});
        continue;
      }

      // NUMBERED ITEM
      const numItemMatch = line.match(NUMBERED_ITEM_RE);
      if (numItemMatch) {
        const num = numItemMatch[1];
        const firstLine = numItemMatch[2].trim();
        const snippet = cleanSnippet(firstLine, 80);

        // If currently on an empty or lead-in section policy, clear or commit it
        if (activePolicy && activePolicy.isSectionPolicy) {
          const trimmed = activePolicy.fullText.trim();
          if (!trimmed || /(?:contain the following|expected to|get involved in|as follows|the following)[:\.]?$/i.test(trimmed) || trimmed.endsWith(':')) {
            ctx.categoryPreamble = trimmed;
            activePolicy = null;
          } else {
            commitPolicy(pageNum);
          }
        }

        // Title is the numbered item itself: parent headings remain metadata!
        const title = num + '. ' + snippet;

        if (ctx.inCategory) {
          ctx.preambleCollected = true;
          startPolicy(title, pageNum, { offenseNumber: num, isNumberedOffense: true });
          appendLine(activePolicy, line, pageNum);
        } else if (ctx.section) {
          startPolicy(title, pageNum, { offenseNumber: num, isNumberedItem: true });
          appendLine(activePolicy, line, pageNum);
        } else if (ctx.article) {
          startPolicy(title, pageNum, { offenseNumber: num, isNumberedItem: true });
          appendLine(activePolicy, line, pageNum);
        } else if (activePolicy) {
          appendLine(activePolicy, line, pageNum);
        } else {
          startPolicy('Item ' + num + ' — ' + snippet, pageNum, { offenseNumber: num });
          activePolicy.validationFlags.push(ValidationFlag.ORPHANED_CONTINUATION);
          appendLine(activePolicy, line, pageNum);
        }
        continue;
      }

      // LETTERED SUB-ITEM OR NESTED ITEM
      const letSubMatch = line.match(LETTERED_SUB_RE) || line.match(PAREN_NUM_RE) || line.match(ROMAN_SUB_RE);
      if (letSubMatch && activePolicy) {
        appendLine(activePolicy, line, pageNum);
        continue;
      }

      // PREAMBLE ACCUMULATION
      if (ctx.inCategory && !ctx.preambleCollected) {
        ctx.categoryPreamble += (ctx.categoryPreamble ? '\n' : '') + line;
        continue;
      }

      // ALL CAPS STRUCTURAL HEADING
      if (!activePolicy && line === line.toUpperCase() && line.length >= 5 &&
          line.length <= 80 && /^[A-Z]/.test(line) && !isTableOfContentsLine(line) &&
          !/^\d+[\.,]/.test(line) && isValidHeadingTitle(line)) {
        ctx.section = line;
        startPolicy(line, pageNum, { isSectionPolicy: true });
        continue;
      }

      // GENERAL BODY TEXT
      if (activePolicy) {
        appendLine(activePolicy, line, pageNum);
      }
    }
  }

  commitPolicy(pages[pages.length - 1] ? pages[pages.length - 1].num : 1);

  // Filter noise (TOC remnants)
  const filtered = policyCandidates.filter(p => {
    if (/\.{4,}|\bpage\s+\d+\b/i.test(p.title) && p.fullText.length < 150) return false;
    return p.fullText.trim().length > 0;
  });

  // Run comprehensive validation suite
  const totalPages = pages.length > 0 ? pages[pages.length - 1].num : 1;
  const validationReport = runValidationSuite(filtered, totalPages);

  const diagnostics = {
    totalPolicies: filtered.length,
    rawCandidates: policyCandidates.length,
    filteredOut: policyCandidates.length - filtered.length,
    policyTitles: filtered.map(p => p.title),
    hierarchyMap: filtered.map(p => ({
      title: p.title,
      chapter: p.chapter,
      article: p.article,
      section: p.section,
      subsection: p.subsection,
      category: p.category,
    })),
    pageRanges: filtered.map(p => ({
      title: p.title,
      startPage: p.page,
      endPage: p.endPage,
    })),
    charCounts: filtered.map(p => ({
      title: p.title,
      chars: p.fullText.length,
    })),
    validationSummary: {
      ready: validationReport.validPolicies,
      flagged: validationReport.flaggedPolicies,
      issueCounts: validationReport.issueCounts,
      representativeExamples: validationReport.representativeExamples,
    },
    validationReport,
  };

  return { policies: filtered, diagnostics };
}

// ═══════════════════════════════════════════════════════════════════════════════
// §10  MAIN INGESTION PIPELINE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Parse and segment a handbook PDF buffer into structured policy records.
 */
async function ingestHandbookPdf(pdfBuffer, onProgress) {
  if (typeof onProgress !== 'function') onProgress = function() {};

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

  const segResult = segmentDocumentPolicies(textResult.pages);
  const rawPolicies = segResult.policies;
  const diagnostics = segResult.diagnostics;
  onProgress({ stage: 'identified_policies', count: rawPolicies.length });

  // AI enrichment queue
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
      console.warn('[ingestHandbookPdf] AI metadata fallback for "' + raw.title + '":', err.message);
      metadata = {
        summary: raw.fullText.slice(0, 200).replace(/\s+/g, ' ').trim() + '...',
        catKey: raw.inferredCatKey || 'conduct',
        cat: 'Student Conduct',
        keywords: [raw.title.toLowerCase()],
        relatedTerms: [],
        scenarios: ['What are the rules regarding ' + raw.title + '?'],
        steps: [],
        source: 'fallback',
      };
    }

    const prefixMap = {
      academic:   'PLSP-AP',
      conduct:    'PLSP-SC',
      discipline: 'PLSP-CD',
      rights:     'PLSP-RR',
      general:    'PLSP-GN',
    };
    const codePrefix = prefixMap[metadata.catKey] || 'PLSP-POL';
    const seq = String(i + 1).padStart(3, '0');
    const ref = raw.explicitRef || (codePrefix + '-' + seq);
    const handbookSectionId = raw.handbookSectionId || ('sec-' + raw.page + '-' + (i + 1));

    const validationFlags = raw.validationFlags || [];
    const warnings = [];
    if (!raw.title || raw.title.length < 3) warnings.push('Short or missing policy title');
    if (!raw.fullText || raw.fullText.length < 30) warnings.push('Very short policy content');
    if (!raw.page || raw.page < 1 || raw.page > totalPages) warnings.push('Invalid page reference');
    if (validationFlags.length > 0) warnings.push.apply(warnings, validationFlags);

    return {
      id: 'draft-' + Date.now() + '-' + i,
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
      chapter: raw.chapter || '',
      article: raw.article || '',
      section: raw.section || '',
      subsection: raw.subsection || '',
      category: raw.category || '',
      categoryContext: raw.categoryContext || '',
      status: warnings.length === 0 ? 'ready' : 'needs_review',
      warnings,
      validationFlags,
      aiSource: metadata.source || 'gemini',
    };
  }

  const concurrency = 4;
  const enrichedPolicies = new Array(rawPolicies.length);
  let currentIndex = 0;
  async function worker() {
    while (currentIndex < rawPolicies.length) {
      const idx = currentIndex++;
      enrichedPolicies[idx] = await processOnePolicy(rawPolicies[idx], idx);
    }
  }
  const workerPool = [];
  for (let w = 0; w < Math.min(concurrency, rawPolicies.length); w++) {
    workerPool.push(worker());
  }
  await Promise.all(workerPool);

  return {
    totalPages,
    totalPolicies: enrichedPolicies.length,
    policies: enrichedPolicies,
    diagnostics,
  };
}

module.exports = {
  ingestHandbookPdf,
  segmentDocumentPolicies,
  runValidationSuite,
  ValidationFlag,
};
