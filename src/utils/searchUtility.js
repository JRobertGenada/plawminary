import Fuse from 'fuse.js';
import { POLICY_SCENARIOS } from '../data/policyScenarios.js';

const STOPWORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'aren\'t', 'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by', 'can\'t', 'cannot', 'could', 'couldn\'t', 'did', 'didn\'t', 'do', 'does', 'doesn\'t', 'doing', 'don\'t', 'down', 'during', 'each', 'few', 'for', 'from', 'further', 'had', 'hadn\'t', 'has', 'hasn\'t', 'have', 'haven\'t', 'having', 'he', 'he\'d', 'he\'ll', 'he\'s', 'her', 'here', 'here\'s', 'hers', 'herself', 'him', 'himself', 'his', 'how', 'how\'s', 'i', 'i\'d', 'i\'ll', 'i\'m', 'i\'ve', 'if', 'in', 'into', 'is', 'isn\'t', 'it', 'it\'s', 'its', 'itself', 'let\'s', 'me', 'more', 'most', 'mustn\'t', 'my', 'myself', 'no', 'nor', 'not', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'ought', 'our', 'ours', 'ourselves', 'out', 'over', 'own', 'same', 'shan\'t', 'she', 'she\'d', 'she\'ll', 'she\'s', 'should', 'shouldn\'t', 'so', 'some', 'such', 'than', 'that', 'that\'s', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'there\'s', 'these', 'they', 'they\'d', 'they\'ll', 'they\'re', 'they\'ve', 'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'wasn\'t', 'we', 'we\'d', 'we\'ll', 'we\'re', 'we\'ve', 'were', 'weren\'t', 'what', 'what\'s', 'when', 'when\'s', 'where', 'where\'s', 'which', 'while', 'who', 'who\'s', 'whom', 'why', 'why\'s', 'with', 'won\'t', 'would', 'wouldn\'t', 'you', 'you\'d', 'you\'ll', 'you\'re', 'you\'ve', 'your', 'yours', 'yourself', 'yourselves'
]);

/**
 * Synonym Map for Campus/Legal Terms
 * This allows "Semantic-like" matching without a full Vector DB.
 */
const SYNONYM_MAP = {
  'clothes': ['uniform', 'attire', 'dress code', 'clothing'],
  'clothing': ['uniform', 'attire', 'dress code'],
  'dress': ['uniform', 'attire', 'clothing'],
  'cheat': ['integrity', 'plagiarism', 'cheating', 'dishonesty'],
  'cheating': ['integrity', 'plagiarism', 'dishonesty'],
  'plagiarism': ['integrity', 'cheating', 'copying'],
  'absent': ['attendance', 'absences', 'tardiness', 'late'],
  'absence': ['attendance', 'absences', 'tardiness'],
  'late': ['tardiness', 'attendance', 'punctual'],
  'money': ['fees', 'refund', 'tuition', 'payment', 'cost'],
  'payment': ['fees', 'refund', 'tuition', 'cost'],
  'quit': ['withdrawal', 'drop', 'leave', 'loa'],
  'leave': ['withdrawal', 'drop', 'loa', 'absence'],
  'dropped': ['withdrawal', 'drop', 'fail'],
  'id': ['identification', 'sic', 'gate pass'],
  'harassment': ['sexual', 'conduct', 'misconduct', 'sh'],
  'fight': ['assault', 'conduct', 'misconduct', 'discipline'],
  'grade': ['gwa', 'grading', 'marks', 'inc', 'failing', 'passed', 'passing'],
  'fail': ['grading', 'marks', '5.00', 'failing', 'failed'],
  'exam': ['grading', 'integrity', 'test', 'quiz', 'examination'],
  'test': ['grading', 'integrity', 'exam', 'quiz', 'examination'],
  'smart': ['honors', 'latin', 'cum laude', 'awards', 'merit'],
  'top': ['honors', 'latin', 'awards', 'distinction', 'outstanding'],
  'drunk': ['safety', 'prohibited', 'alcohol', 'liquor', 'intoxicated'],
  'drugs': ['safety', 'prohibited', 'substances', 'illegal'],
  'bully': ['harassment', 'misconduct', 'discipline', 'bullying'],
  'pe': ['physical education', 'nstp', 'requirements'],
  'scholarship': ['unifast', 'assistance', 'incentives', 'discount'],
  'clearance': ['registrar', 'requirements', 'graduation'],
  // ── Scenario-specific additions ──────────────────────────────────────────
  'threatening': ['threat', 'intimidation', 'harassment', 'misconduct', 'bully'],
  'insulting': ['insult', 'verbal abuse', 'harassment', 'misconduct'],
  'insult': ['verbal abuse', 'harassment', 'misconduct', 'bully'],
  'threat': ['intimidation', 'harassment', 'misconduct', 'bully'],
  'assault': ['fight', 'violence', 'discipline', 'misconduct'],
  'violence': ['assault', 'fight', 'discipline', 'misconduct'],
  'weapon': ['safety', 'prohibited', 'security', 'dangerous'],
  'alcohol': ['drunk', 'prohibited', 'safety', 'substances'],
  'stolen': ['lost', 'theft', 'security', 'misconduct'],
  'hospital': ['sick', 'illness', 'medical', 'INC', 'incomplete'],
  'sick': ['illness', 'medical', 'absent', 'excuse letter', 'hospital'],
  'reported': ['complaint', 'report', 'grievance', 'formal'],
  'complain': ['complaint', 'grievance', 'formal', 'rights'],
  'kicked': ['removed', 'expelled', 'class', 'discipline'],
  'kicked out': ['removed from class', 'class removal', 'discipline'],
  'refund': ['tuition', 'fees', 'payment', 'withdrawal'],
  'shift': ['transfer', 'course change', 'program change'],
  'transfer': ['shift', 'course change', 'withdrawal'],
  'probation': ['readmission', 'LOA', 'leave of absence'],
  'honors': ['cum laude', 'GWA', 'latin honors', 'distinction'],
  'privacy': ['data', 'records', 'confidential', 'protection'],
  'unauthorized': ['prohibited', 'illegal', 'violation', 'misconduct'],
  'vandalize': ['vandalism', 'property damage', 'misconduct', 'discipline'],
  'expelled': ['expulsion', 'dismissed', 'discipline', 'grave offense'],
  'suspended': ['suspension', 'disciplinary', 'sanction'],
};

const GENERIC_WORDS = new Set([
  'student', 'students', 'campus', 'school', 'inside', 'class', 'classes', 'classroom',
  'policy', 'policies', 'ordinance', 'ordinances', 'university', 'college',
  'what', 'can', 'how', 'when', 'where', 'why', 'who', 'someone', 'person', 'people',
  'tell', 'know', 'want', 'need', 'get', 'getting', 'got', 'give', 'go', 'going', 'let', 'may',
  'i', 'me', 'my', 'is', 'am', 'are', 'was', 'were', 'the', 'a', 'an',
  'enter', 'entering', 'without', 'with', 'come', 'coming', 'caught', 'allow', 'allowed'
]);

// Create a Fuse instance for fuzzy matching synonym keys
const synonymKeys = Object.keys(SYNONYM_MAP).map(key => ({ key }));
const keyFuse = new Fuse(synonymKeys, { keys: ['key'], threshold: 0.3 });

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Normalize a user query — lowercase, strip punctuation, collapse whitespace.
 * Preserves numbers (e.g. "5.00", "20%").
 */
export function normalizeQuery(q) {
  if (!q) return '';
  return q
    .toLowerCase()
    .replace(/[^\w\s.%]/g, ' ')   // strip non-alphanumeric except . and %
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Detect whether the query looks like a natural-language scenario
 * (i.e. a sentence or phrase rather than a keyword/ref search).
 * Heuristic: ≥3 words AND no exact ref pattern (PLSP-XX-NNN).
 */
export function isScenarioQuery(q) {
  if (!q) return false;
  const isRef = /^plsp[-\s]?\w+[-\s]?\d+$/i.test(q.trim());
  const normalized = normalizeQuery(q);
  const words = normalized.split(/\s+/).filter(Boolean);
  return words.length >= 3 && !isRef;
}

/**
 * Extract multi-word phrases from the query that match synonyms
 */
function extractPhraseSynonyms(normalizedQuery) {
  let synonyms = [];
  Object.entries(SYNONYM_MAP).forEach(([root, list]) => {
    // If the root key is a phrase and it's in the query
    if (root.includes(' ') && normalizedQuery.includes(root)) {
      synonyms = synonyms.concat(list);
    }
    // If any synonym in the list is a phrase and it's in the query
    list.forEach(syn => {
      if (syn.includes(' ') && normalizedQuery.includes(syn)) {
        synonyms.push(root);
      }
    });
  });
  return Array.from(new Set(synonyms));
}

/**
 * Get all synonyms for a given word
 */
function getSynonyms(word) {
  let synonyms = [];

  // 1. Direct or fuzzy match
  if (SYNONYM_MAP[word]) {
    synonyms = synonyms.concat(SYNONYM_MAP[word]);
  } else {
    // Fuzzy key match to handle slight typos (e.g. "threatning" -> "threatening")
    const fuzzyResults = keyFuse.search(word);
    if (fuzzyResults.length > 0) {
      synonyms = synonyms.concat(SYNONYM_MAP[fuzzyResults[0].item.key]);
    }
  }

  // 2. Suffix stemming
  const suffixes = ['ing', 'ed', 'es', 's'];
  for (const suffix of suffixes) {
    if (word.endsWith(suffix) && word.length > suffix.length + 2) {
      const stem = word.slice(0, -suffix.length);
      if (SYNONYM_MAP[stem]) {
        synonyms = synonyms.concat(SYNONYM_MAP[stem]);
      }
      // Try with an 'e' at the end (e.g. "vandalizing" -> "vandalize")
      if (SYNONYM_MAP[stem + 'e']) {
        synonyms = synonyms.concat(SYNONYM_MAP[stem + 'e']);
      }
    }
  }

  // 3. Reverse lookup with stem support
  const stems = [word];
  for (const suffix of suffixes) {
    if (word.endsWith(suffix) && word.length > suffix.length + 2) {
      stems.push(word.slice(0, -suffix.length));
    }
  }
  Object.entries(SYNONYM_MAP).forEach(([root, list]) => {
    if (stems.some(s => list.includes(s) || s === root)) {
      synonyms.push(root);
      synonyms = synonyms.concat(list);
    }
  });

  return Array.from(new Set(synonyms));
}

/**
 * Map a Fuse.js score (0 = perfect, 1 = no match) to a human label.
 * Only called when isScenarioQuery() is true.
 */
export function getRelevanceLabel(score) {
  if (score == null) return null;
  if (score < 0.25) return 'High';
  if (score < 0.40) return 'Medium';
  return 'Low';
}

/**
 * Multi-signal Scenario Search Ranking
 * Signals & weights:
 *   1. Scenario/example match: 40% (0.40)
 *   2. Scenario keywords: 25% (0.25)
 *   3. Synonym/concept match: 20% (0.20)
 *   4. Title/ref/category: 10% (0.10)
 *   5. Summary/description/full text: 5% (0.05)
 */
function scoreScenarioSearch(data, query) {
  const normalized = normalizeQuery(query);
  const allTokens = normalized.split(/\s+/).filter(Boolean);
  const nonStopwords = allTokens.filter(w => !STOPWORDS.has(w));
  const queryWords = nonStopwords.length > 0 ? nonStopwords : allTokens;

  // Identify meaningful concepts & weights
  const wordEntries = queryWords.map(w => {
    const isGeneric = GENERIC_WORDS.has(w);
    const weight = isGeneric ? 0.15 : 1.0;
    const syns = getSynonyms(w);
    return { word: w, isGeneric, weight, synonyms: syns };
  });

  const specificWords = wordEntries.filter(e => !e.isGeneric);
  const specificBaseWeight = specificWords.reduce((sum, e) => sum + e.weight, 0) || 1.0;
  const totalBaseWeight = wordEntries.reduce((sum, e) => sum + e.weight, 0) || 1.0;

  // Multi-word phrases from query (n-grams)
  const phrases = [];
  const seenPhrases = new Set();
  function addPhrase(p) {
    const clean = p.toLowerCase().trim();
    if (!clean || seenPhrases.has(clean) || clean.split(/\s+/).length < 2) return;
    seenPhrases.add(clean);
    const words = clean.split(/\s+/);
    const hasSpecific = words.some(w => !GENERIC_WORDS.has(w) && !STOPWORDS.has(w));
    phrases.push({ phrase: clean, weight: hasSpecific ? 2.5 : 0.3 });
  }

  for (let i = 0; i < allTokens.length - 1; i++) {
    addPhrase(allTokens[i] + ' ' + allTokens[i + 1]);
    if (i < allTokens.length - 2) {
      addPhrase(allTokens[i] + ' ' + allTokens[i + 1] + ' ' + allTokens[i + 2]);
    }
  }
  for (let i = 0; i < nonStopwords.length - 1; i++) {
    addPhrase(nonStopwords[i] + ' ' + nonStopwords[i + 1]);
  }
  const phraseSyns = extractPhraseSynonyms(normalized);
  phraseSyns.forEach(p => addPhrase(p));

  // Calculate field match score in [0, 1] where 0 = perfect match, 1 = no match
  function calculateFieldScore(textList) {
    if (!textList || textList.length === 0) return 1.0;
    const items = textList.filter(Boolean).map(t => ({ text: t.toLowerCase() }));
    if (items.length === 0) return 1.0;

    const fuse = new Fuse(items, {
      keys: ['text'],
      includeScore: true,
      threshold: 0.35,
      ignoreLocation: true
    });

    const combinedText = ' ' + items.map(i => i.text.replace(/[^\w\s.%]/g, ' ').replace(/\s+/g, ' ')).join(' \n ') + ' ';

    function testWordOrPhrase(target) {
      if (!target || target.length < 2) return 0;
      const escaped = escapeRegex(target);
      const regex = new RegExp('(?:^|\\s)' + escaped + '(?:$|\\s)', 'i');
      if (regex.test(combinedText)) return 1.0;
      const fRes = fuse.search(target);
      if (fRes.length > 0 && fRes[0].score <= 0.35) {
        return 1.0 - fRes[0].score;
      }
      return 0;
    }

    let matchedWeight = 0;
    let specificMatched = 0;

    wordEntries.forEach(entry => {
      let q = testWordOrPhrase(entry.word);
      if (q > 0) {
        matchedWeight += entry.weight * q;
        if (!entry.isGeneric) specificMatched += q;
      } else if (entry.synonyms && entry.synonyms.length > 0) {
        let bestSynQ = 0;
        for (const syn of entry.synonyms) {
          const sq = testWordOrPhrase(syn);
          if (sq > bestSynQ) bestSynQ = sq;
        }
        if (bestSynQ > 0) {
          matchedWeight += entry.weight * 0.85 * bestSynQ;
          if (!entry.isGeneric) specificMatched += 0.85 * bestSynQ;
        }
      }
    });

    // Check multi-word phrase matches
    let phraseBonus = 0;
    phrases.forEach(p => {
      const pq = testWordOrPhrase(p.phrase);
      if (pq > 0) {
        phraseBonus += p.weight * 0.5 * pq;
      }
    });

    const denominator = specificWords.length > 0 ? specificBaseWeight : totalBaseWeight;
    let rawRatio = (matchedWeight + phraseBonus) / denominator;

    // Penalize if specific concepts exist in query but none matched in this field
    if (specificWords.length > 0 && specificMatched === 0) {
      rawRatio *= 0.15;
    }

    const cappedRatio = Math.min(1.0, Math.max(0.0, rawRatio));
    return 1.0 - cappedRatio; // 0 = best, 1 = worst
  }

  const scored = data.map(ordinance => {
    const scenarios = (ordinance.scenarios && ordinance.scenarios.length > 0)
      ? ordinance.scenarios
      : POLICY_SCENARIOS.filter(s => s.policy_id === ordinance.id);

    // 1. Scenario / example match (40%)
    let bestScenarioScore = 1.0;
    scenarios.forEach(s => {
      const score = calculateFieldScore([s.scenario]);
      if (score < bestScenarioScore) bestScenarioScore = score;
    });

    // 2. Scenario keywords (25%)
    let bestKeywordScore = 1.0;
    scenarios.forEach(s => {
      const score = calculateFieldScore(s.keywords || []);
      if (score < bestKeywordScore) bestKeywordScore = score;
    });

    // 3. Synonym / concept match (20%)
    let bestSynonymScore = 1.0;
    scenarios.forEach(s => {
      const score = calculateFieldScore(s.synonyms || []);
      if (score < bestSynonymScore) bestSynonymScore = score;
    });

    // 4. Title / ref / category (10%)
    const titleScore = calculateFieldScore([ordinance.title, ordinance.ref, ordinance.cat, ordinance.catK]);

    // 5. Summary / description / full text (5%)
    const bodyScore = calculateFieldScore([ordinance.summary, ordinance.desc, ordinance.full]);

    // Combine signals into final score: 40% + 25% + 20% + 10% + 5% = 100%
    const finalScore = (
      0.40 * bestScenarioScore +
      0.25 * bestKeywordScore +
      0.20 * bestSynonymScore +
      0.10 * titleScore +
      0.05 * bodyScore
    );

    return {
      ...ordinance,
      searchScore: finalScore,
    };
  });

  return scored;
}

/**
 * Enhanced search for Ordinances with Synonym Expansion + Scenario Matching.
 *
 * Scoring:
 * - Scenario queries: Weighted multi-signal ranking (Scenario: 40%, Keywords: 25%, Synonyms: 20%, Title: 10%, Body: 5%)
 * - Non-scenario queries: Multi-field Fuse.js matching with improved synonym score merging and exact reference boosting
 */
export function searchOrdinances(data, query) {
  if (!query) return data;

  const normalized = normalizeQuery(query);
  const scenarioMode = isScenarioQuery(query);

  if (scenarioMode) {
    const scored = scoreScenarioSearch(data, query);
    // Confidence filtering (scenario queries only): score <= 0.55
    const filtered = scored.filter(r => r.searchScore <= 0.55);
    // Attach relevance label for UI display
    const withLabels = filtered.map(r => ({
      ...r,
      relevanceLabel: getRelevanceLabel(r.searchScore),
    }));
    return withLabels.sort((a, b) => a.searchScore - b.searchScore);
  }

  // Non-scenario search
  const options = {
    keys: [
      { name: 'scenarios.scenario', weight: 1.5 },
      { name: 'scenarios.keywords', weight: 1.2 },
      { name: 'scenarios.synonyms', weight: 1.1 },
      { name: 'title',   weight: 1.0 },
      { name: 'ref',     weight: 0.9 },
      { name: 'summary', weight: 0.8 },
      { name: 'desc',    weight: 0.7 },
      { name: 'full',    weight: 0.4 },
    ],
    threshold: 0.4,
    includeScore: true,
    ignoreLocation: true,
    getFn: (obj, path) => {
      if (path[0] === 'scenarios') {
        const field = path[1];
        if (!Array.isArray(obj.scenarios)) return '';
        return obj.scenarios.map(s => {
          const val = s[field];
          if (Array.isArray(val)) return val.join(' ');
          return val || '';
        }).join(' ');
      }
      let cur = obj;
      for (const key of path) {
        if (cur == null) return '';
        cur = cur[key];
      }
      if (Array.isArray(cur)) return cur.join(' ');
      return cur ?? '';
    },
  };

  const fuse = new Fuse(data, options);
  const originalResults = fuse.search(normalized);

  const synonymMatches = [];
  const phraseSynonyms = extractPhraseSynonyms(normalized);
  phraseSynonyms.forEach(syn => {
    fuse.search(syn).forEach(res => synonymMatches.push(res));
  });

  const words = normalized.split(/\s+/).filter(w => Boolean(w) && !STOPWORDS.has(w));
  words.forEach(word => {
    const syns = getSynonyms(word);
    syns.forEach(syn => {
      fuse.search(syn).forEach(res => synonymMatches.push(res));
    });
  });

  // Merge rule: evaluate all available matches and retain the strongest overall score!
  const mergedMap = new Map();

  originalResults.forEach(r => {
    mergedMap.set(r.item.id, { ...r.item, searchScore: r.score });
  });

  synonymMatches.forEach(r => {
    const penalizedScore = r.score + 0.15;
    if (penalizedScore <= 0.6) {
      if (mergedMap.has(r.item.id)) {
        const existing = mergedMap.get(r.item.id);
        // A synonym match CAN improve the existing score!
        if (penalizedScore < existing.searchScore) {
          existing.searchScore = penalizedScore;
        }
      } else {
        mergedMap.set(r.item.id, { ...r.item, searchScore: penalizedScore });
      }
    }
  });

  // Check for exact reference match (e.g. PLSP-SC-001)
  const cleanQ = query.toLowerCase().replace(/[^\w]/g, '');
  if (/^plsp\w+\d+$/.test(cleanQ)) {
    data.forEach(item => {
      const cleanRef = (item.ref || '').toLowerCase().replace(/[^\w]/g, '');
      if (cleanRef === cleanQ) {
        mergedMap.set(item.id, { ...item, searchScore: 0.0 });
      }
    });
  }

  return Array.from(mergedMap.values()).sort((a, b) => a.searchScore - b.searchScore);
}

/**
 * Enhanced search for Handbook Sections with Synonym Expansion.
 * Unchanged from original — handbook search is separate and unaffected.
 */
export function searchHandbook(data, query) {
  if (!query) return data;

  const words = query.toLowerCase().trim().split(/\s+/).filter(w => Boolean(w) && !STOPWORDS.has(w));

  const options = {
    keys: [
      { name: 'title', weight: 1.0 },
      { name: 'chapterTitle', weight: 0.6 }
    ],
    threshold: 0.45,
    includeScore: true,
    ignoreLocation: true,
  };

  const fuse = new Fuse(data, options);

  // 1. Search original query
  const originalResults = fuse.search(query);

  // 2. Search synonyms
  const synonymMatches = [];

  // Extract multi-word phrase synonyms first
  const phraseSynonyms = extractPhraseSynonyms(query.toLowerCase().trim());
  phraseSynonyms.forEach(syn => {
    const synResults = fuse.search(syn);
    synResults.forEach(res => synonymMatches.push(res));
  });

  words.forEach(word => {
    const synonyms = getSynonyms(word);
    synonyms.forEach(syn => {
      const synResults = fuse.search(syn);
      synResults.forEach(res => {
        synonymMatches.push(res);
      });
    });
  });

  // 3. Merge and deduplicate
  const mergedMap = new Map();

  originalResults.forEach(r => {
    mergedMap.set(r.item.id, { ...r.item, searchScore: r.score });
  });

  synonymMatches.forEach(r => {
    if (!mergedMap.has(r.item.id)) {
      const penalizedScore = r.score + 0.15;
      if (penalizedScore <= 0.6) {
        mergedMap.set(r.item.id, { ...r.item, searchScore: penalizedScore });
      }
    }
  });

  return Array.from(mergedMap.values()).sort((a, b) => a.searchScore - b.searchScore);
}
