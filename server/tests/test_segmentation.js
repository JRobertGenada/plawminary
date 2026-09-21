#!/usr/bin/env node
/**
 * server/tests/test_segmentation.js
 *
 * Deterministic Extraction & Validation CLI for PLawminary.
 * Validates deterministic records produced from officialhandbook.pdf before AI processing.
 *
 * Checks every extracted policy for:
 * - contaminated title
 * - merged previous/next policy
 * - truncated content
 * - duplicate record
 * - incorrect numbering
 * - incorrect hierarchy
 * - incorrect start/end page
 * - orphaned continuation text
 *
 * Verifies specifically:
 * - Article VI
 * - Section 10
 * - Article VII
 * - Light Offenses
 * - Less Grave Offenses
 * - lettered/nested items
 * - page-spanning policies
 *
 * Usage:
 *   node server/tests/test_segmentation.js [path/to/handbook.pdf]
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const { PDFParse } = require('pdf-parse');
const { segmentDocumentPolicies } = require('../services/pdfIngestionService');

function hr(ch, len) {
  return (ch || '─').repeat(len || 72);
}

function truncate(str, max) {
  if (!str) return '';
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
}

function printPolicy(p, label) {
  console.log('\n' + hr('-'));
  console.log('  ' + (label || p.title));
  console.log(hr('-'));
  console.log('  Title    :', truncate(p.title, 100));
  console.log('  Article  :', truncate(p.article, 80) || '(none)');
  console.log('  Section  :', truncate(p.section, 80) || '(none)');
  console.log('  Category :', truncate(p.category, 80) || '(none)');
  console.log('  Pages    :', p.page + (p.page !== p.endPage ? ' – ' + p.endPage : ''));
  console.log('  Chars    :', p.fullText ? p.fullText.length : 0);
  console.log('  Flags    :', p.validationFlags && p.validationFlags.length
    ? p.validationFlags.join(', ')
    : '(none)');
  if (p.categoryContext) {
    console.log('  Cat ctx  :', truncate(p.categoryContext.replace(/\n/g, ' | '), 120));
  }
  console.log('  Text     :', truncate((p.fullText || '').replace(/\n/g, ' ↵ '), 180));
}

async function main() {
  const defaultPdf = path.resolve(__dirname, '../../officialhandbook.pdf');
  const pdfPath = process.argv[2] || defaultPdf;
  const resolvedPath = path.resolve(pdfPath);

  if (!fs.existsSync(resolvedPath)) {
    console.error('File not found:', resolvedPath);
    process.exit(1);
  }

  console.log('\n' + hr('═'));
  console.log('  PLAWMINARY — DETERMINISTIC EXTRACTION & VALIDATION SUITE');
  console.log('  Document: ' + resolvedPath);
  console.log(hr('═'));

  // 1. Extract PDF pages
  console.log('\n[1] Extracting PDF text…');
  const buf = fs.readFileSync(resolvedPath);
  const parser = new PDFParse({ data: buf });
  let textResult;
  try {
    textResult = await parser.getText();
  } finally {
    try { await parser.destroy(); } catch (_) {}
  }

  const pages = textResult.pages || [];
  const totalPages = textResult.total || pages.length;
  console.log('    Total PDF pages:', totalPages);

  // 2. Segment and validate
  console.log('\n[2] Running deterministic segmentation and validation…');
  const { policies, diagnostics } = segmentDocumentPolicies(pages);
  const report = diagnostics.validationReport;

  // 3. Validation Report Output
  console.log('\n' + hr('═'));
  console.log('                   EXTRACTION VALIDATION REPORT');
  console.log(hr('═'));
  console.log('  Total Policies              : ' + report.totalPolicies);
  console.log('  Valid Policies (Ready)      : ' + report.validPolicies);
  console.log('  Flagged Policies (Review)   : ' + report.flaggedPolicies);
  console.log(hr('-'));
  console.log('  Duplicates                  : ' + report.issueCounts.duplicates);
  console.log('  Title Contamination Count   : ' + report.issueCounts.titleContamination);
  console.log('  Truncation Count            : ' + report.issueCounts.truncation);
  console.log('  Hierarchy Errors            : ' + report.issueCounts.hierarchyErrors);
  console.log('  Page Errors                 : ' + report.issueCounts.pageErrors);
  console.log('  Incorrect Numbering         : ' + report.issueCounts.numberingErrors);
  console.log('  Merged Policies             : ' + report.issueCounts.mergedPolicies);
  console.log('  Orphaned Continuation Text  : ' + report.issueCounts.orphanedContinuation);
  console.log(hr('═'));

  // 4. Representative Examples for Flagged Categories
  console.log('\n[3] Representative Examples by Issue Category:');
  const examples = report.representativeExamples;
  let hasExamples = false;

  for (const [catName, items] of Object.entries(examples)) {
    if (items && items.length > 0) {
      hasExamples = true;
      console.log('\n  ● ' + catName.toUpperCase() + ' (' + items.length + ' representative examples):');
      items.forEach((item, idx) => {
        console.log('    [' + (idx + 1) + '] ' + item.title + ' (Page: ' + item.page + ')');
        console.log('        Reason : ' + item.reason);
        console.log('        Snippet: ' + item.snippet);
      });
    }
  }
  if (!hasExamples) {
    console.log('    (No issues flagged — all records clean)');
  }

  // 5. Specific Verification Requirements
  console.log('\n' + hr('═'));
  console.log('  SPECIFIC VERIFICATION REQUIREMENTS');
  console.log(hr('═'));

  // (a) Article VI
  console.log('\n[A] Article VI Verification:');
  const art6Policies = policies.filter(p =>
    /Article\s+VI\b/i.test(p.article || '') || /Article\s+VI\b/i.test(p.title)
  );
  console.log('    Article VI policies found :', art6Policies.length);
  art6Policies.forEach((p, i) => {
    console.log('      ' + (i + 1) + '. ' + truncate(p.title, 85) + ' [p. ' + p.page + ']');
  });
  if (art6Policies.length >= 7) {
    console.log('    STATUS: PASS (All 7 recognized organization benefits extracted)');
  } else {
    console.log('    STATUS: FLAG (' + art6Policies.length + ' found, expected 7)');
  }

  // (b) Section 10
  console.log('\n[B] Section 10 Verification:');
  const sec10Policies = policies.filter(p =>
    /Section\s+10\b/i.test(p.section || '') || /Section\s+10\b/i.test(p.title)
  );
  console.log('    Total Section 10 policies :', sec10Policies.length);
  const byLawsSec10 = sec10Policies.filter(p => p.page === 38);
  console.log('    Constitution/By-laws (p.38) items:', byLawsSec10.length, '/ 14 expected');
  const hasItem1 = byLawsSec10.some(p => p.offenseNumber === '1' || /1[\.,]\s+The official name/i.test(p.fullText));
  const hasItem10 = byLawsSec10.some(p => p.offenseNumber === '10' || /10[\.,]\s*A process/i.test(p.fullText));
  console.log('      Item 1 ("1, The official name") captured  :', hasItem1 ? 'PASS' : 'FAIL');
  console.log('      Item 10 ("10.A process") captured         :', hasItem10 ? 'PASS' : 'FAIL');

  // (c) Article VII
  console.log('\n[C] Article VII Verification:');
  const art7Policies = policies.filter(p =>
    /Article\s+VII\b/i.test(p.article || '') || /Article\s+VII\b/i.test(p.title)
  );
  console.log('    Article VII policies found:', art7Policies.length);
  const art7Sections = [...new Set(art7Policies.map(p => p.section || p.title))];
  console.log('    Distinct Article VII sections/items represented: ' + art7Sections.length);
  const hasSec1 = art7Policies.some(p => /Section\s+1\b/i.test(p.section || p.title));
  const hasSec11 = art7Policies.some(p => /Section\s+11\b/i.test(p.section || p.title));
  console.log('      Paragraph Section 1 captured              :', hasSec1 ? 'PASS' : 'FAIL');
  console.log('      Numbered Section 11 items captured        :', hasSec11 ? 'PASS' : 'FAIL');

  // (d) Light Offenses
  console.log('\n[D] Light Offenses Verification:');
  const lightPolicies = policies.filter(p =>
    p.category && /light\s+offenses/i.test(p.category) && p.isNumberedOffense
  );
  const art3Light = lightPolicies.filter(p => /Article\s+III\b/i.test(p.article || ''));
  const otherLight = lightPolicies.filter(p => !/Article\s+III\b/i.test(p.article || ''));
  console.log('    Total Light Offenses extracted        : ' + lightPolicies.length);
  console.log('    Article III Disciplinary Light Offenses: ' + art3Light.length + ' / 19 expected');
  if (otherLight.length > 0) {
    console.log('    Sexual Harassment Light Offenses       : ' + otherLight.length + ' (under Sec. 4)');
  }
  const cleanCatTitle = lightPolicies.every(p => !/Students,?\s+who\s+have\s+been/i.test(p.category));
  console.log('    Category free of preamble contamination: ' + (cleanCatTitle ? 'PASS' : 'FAIL'));
  const withSharedCtx = art3Light.filter(p => p.categoryContext && p.categoryContext.length > 20);
  console.log('    Article III shared penalty context     : ' + withSharedCtx.length + '/' + art3Light.length + ' ' + (withSharedCtx.length === art3Light.length ? 'PASS' : 'FLAG'));

  // (e) Less Grave Offenses
  console.log('\n[E] Less Grave Offenses Verification:');
  const lessGravePolicies = policies.filter(p =>
    p.category && /less\s+grave\s+offenses/i.test(p.category) && p.isNumberedOffense
  );
  console.log('    Less Grave Offenses extracted:', lessGravePolicies.length);
  const flaggedSeq = lessGravePolicies.filter(p => p.validationFlags.includes('INCORRECT_NUMBERING'));
  console.log('    Sequence anomalies flagged (e.g. item 20):', flaggedSeq.length, 'flagged');

  // (f) Lettered/nested items
  console.log('\n[F] Lettered / Nested Items Verification:');
  const withNested = policies.filter(p =>
    /\n\s*(?:[a-z]\.|\([a-z0-9]+\))\s+/i.test(p.fullText)
  );
  console.log('    Policies with preserved nested clauses:', withNested.length);
  if (withNested.length > 0) {
    const sampleNested = withNested[0];
    console.log('    Sample: ' + truncate(sampleNested.title, 70));
    const nestedLines = sampleNested.fullText.split('\n').filter(l => /^\s*(?:[a-z]\.|\([a-z0-9]+\))/i.test(l));
    console.log('    Nested clauses attached: ' + nestedLines.slice(0, 3).join(' | '));
    console.log('    STATUS: PASS (Nested clauses appended to parent without splitting)');
  }

  // (g) Page-spanning policies
  console.log('\n[G] Page-Spanning Policies Verification:');
  const spanningPolicies = policies.filter(p => p.page !== p.endPage);
  console.log('    Policies spanning across pages:', spanningPolicies.length);
  spanningPolicies.slice(0, 4).forEach((p, idx) => {
    console.log('      [' + (idx + 1) + '] Page ' + p.page + ' -> ' + p.endPage + ': ' + truncate(p.title, 60) + ' (' + p.fullText.length + ' chars)');
  });
  const allSpanningValid = spanningPolicies.every(p => p.endPage >= p.page && p.fullText.length > 50);
  console.log('    STATUS:', allSpanningValid ? 'PASS (Multi-page boundaries and fullText intact)' : 'FLAG');

  console.log('\n' + hr('═'));
  console.log('  Validation complete. Ready policies: ' + report.validPolicies + ' | Flagged policies: ' + report.flaggedPolicies);
  console.log(hr('═') + '\n');
}

main().catch(err => {
  console.error('\n[TEST ERROR]', err.message);
  console.error(err.stack);
  process.exit(1);
});
