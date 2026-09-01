import Fuse from 'fuse.js';

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
};

/**
 * Get all synonyms for a given word
 */
function getSynonyms(word) {
  let synonyms = [];
  
  // 1. Direct match
  if (SYNONYM_MAP[word]) {
    synonyms = synonyms.concat(SYNONYM_MAP[word]);
  }
  
  // 2. Singular check (stemming)
  if (word.endsWith('s') && word.length > 3) {
    const singular = word.slice(0, -1);
    if (SYNONYM_MAP[singular]) {
      synonyms = synonyms.concat(SYNONYM_MAP[singular]);
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
 * Enhanced search for Ordinances with Synonym Expansion
 */
export function searchOrdinances(data, query) {
  if (!query) return data;

  const words = query.toLowerCase().trim().split(/\s+/);
  
  const options = {
    keys: [
      { name: 'title', weight: 1.0 },
      { name: 'desc', weight: 0.7 },
      { name: 'summary', weight: 0.8 },
      { name: 'full', weight: 0.4 },
      { name: 'ref', weight: 0.9 },
    ],
    threshold: 0.4, 
    includeScore: true,
    ignoreLocation: true,
  };

  const fuse = new Fuse(data, options);
  
  // 1. Search the original query first
  const originalResults = fuse.search(query);
  
  // 2. Search synonyms separately to avoid score dilution
  const synonymMatches = [];
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
      // Add slight penalty score for synonym matching so exact matches rank higher
      const penalizedScore = r.score + 0.15;
      if (penalizedScore <= 0.55) { // Only keep relevant matches
        mergedMap.set(r.item.id, { ...r.item, searchScore: penalizedScore });
      }
    }
  });

  return Array.from(mergedMap.values()).sort((a, b) => a.searchScore - b.searchScore);
}

/**
 * Enhanced search for Handbook Sections with Synonym Expansion
 */
export function searchHandbook(data, query) {
  if (!query) return data;

  const words = query.toLowerCase().trim().split(/\s+/);

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
