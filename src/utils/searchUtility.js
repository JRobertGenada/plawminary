import Fuse from 'fuse.js';

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

// Create a Fuse instance for fuzzy matching synonym keys
const synonymKeys = Object.keys(SYNONYM_MAP).map(key => ({ key }));
const keyFuse = new Fuse(synonymKeys, { keys: ['key'], threshold: 0.3 });

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
  const normalized = normalizeQuery(q);
  const words = normalized.split(/\s+/).filter(Boolean);
  const isRef = /^plsp-\w+-\d+$/i.test(normalized.replace(/\s/g, ''));
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

  // 3. Reverse lookup
  Object.entries(SYNONYM_MAP).forEach(([root, list]) => {
    if (list.includes(word)) {
      synonyms.push(root);
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
 * Enhanced search for Ordinances with Synonym Expansion + Scenario Matching.
 *
 * Fuse.js key weights:
 *   scenarios[].scenario  1.5  ← highest: direct situation phrase
 *   scenarios[].keywords  1.2
 *   scenarios[].synonyms  1.1
 *   title                 1.0
 *   ref                   0.9
 *   summary               0.8
 *   desc                  0.7
 *   full                  0.4
 *
 * Confidence filtering (scenario queries only):
 *   score > 0.55 → hidden (too low confidence)
 *   score 0.40–0.55 → Low
 *   score 0.25–0.40 → Medium
 *   score < 0.25    → High
 */
export function searchOrdinances(data, query) {
  if (!query) return data;

  const normalized = normalizeQuery(query);
  const words = normalized.split(/\s+/).filter(w => Boolean(w) && !STOPWORDS.has(w));
  const scenarioMode = isScenarioQuery(query);

  const options = {
    keys: [
      // Scenario fields — highest weights
      { name: 'scenarios.scenario', weight: 1.5 },
      { name: 'scenarios.keywords', weight: 1.2 },
      { name: 'scenarios.synonyms', weight: 1.1 },
      // Standard fields
      { name: 'title',   weight: 1.0 },
      { name: 'ref',     weight: 0.9 },
      { name: 'summary', weight: 0.8 },
      { name: 'desc',    weight: 0.7 },
      { name: 'full',    weight: 0.4 },
    ],
    threshold: scenarioMode ? 0.5 : 0.4,
    includeScore: true,
    ignoreLocation: true,
    // Allow matching inside nested arrays of objects
    getFn: (obj, path) => {
      // Custom getter to flatten scenario arrays for Fuse
      if (path[0] === 'scenarios') {
        const field = path[1]; // 'scenario' | 'keywords' | 'synonyms'
        if (!Array.isArray(obj.scenarios)) return '';
        return obj.scenarios.map(s => {
          const val = s[field];
          if (Array.isArray(val)) return val.join(' ');
          return val || '';
        }).join(' ');
      }
      // Default getter
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

  // 1. Search the normalized query first
  const originalResults = fuse.search(normalized);

  // 2. Search synonyms separately to avoid score dilution
  const synonymMatches = [];
  
  // Extract multi-word phrase synonyms first
  const phraseSynonyms = extractPhraseSynonyms(normalized);
  phraseSynonyms.forEach(syn => {
    fuse.search(syn).forEach(res => synonymMatches.push(res));
  });

  // Then process individual non-stopword words
  words.forEach(word => {
    const syns = getSynonyms(word);
    syns.forEach(syn => {
      fuse.search(syn).forEach(res => synonymMatches.push(res));
    });
  });

  // 3. Merge and deduplicate — prefer original match score
  const mergedMap = new Map();

  originalResults.forEach(r => {
    mergedMap.set(r.item.id, { ...r.item, searchScore: r.score });
  });

  synonymMatches.forEach(r => {
    if (!mergedMap.has(r.item.id)) {
      // Slight penalty for synonym-only hits
      const penalizedScore = r.score + 0.15;
      const cutoff = scenarioMode ? 0.55 : 0.55;
      if (penalizedScore <= cutoff) {
        mergedMap.set(r.item.id, { ...r.item, searchScore: penalizedScore });
      }
    }
  });

  // 4. In scenario mode: filter out very low-confidence results
  let results = Array.from(mergedMap.values());
  if (scenarioMode) {
    results = results.filter(r => r.searchScore <= 0.55);
    // Attach relevance label for UI display
    results = results.map(r => ({
      ...r,
      relevanceLabel: getRelevanceLabel(r.searchScore),
    }));
  }

  return results.sort((a, b) => a.searchScore - b.searchScore);
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
