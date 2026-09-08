/**
 * server/services/searchMatcher.js
 *
 * Backend search engine for PLAWMINARY ordinances.
 * Evaluates candidates against real MySQL database records.
 * Uses Fuse.js, synonym expansion, and multi-signal scenario scoring.
 */

const Fuse = require('fuse.js');

const STOPWORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'aren\'t', 'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by', 'can\'t', 'cannot', 'could', 'couldn\'t', 'did', 'didn\'t', 'do', 'does', 'doesn\'t', 'doing', 'don\'t', 'down', 'during', 'each', 'few', 'for', 'from', 'further', 'had', 'hadn\'t', 'has', 'hasn\'t', 'have', 'haven\'t', 'having', 'he', 'he\'d', 'he\'ll', 'he\'s', 'her', 'here', 'here\'s', 'hers', 'herself', 'him', 'himself', 'his', 'how', 'how\'s', 'i', 'i\'d', 'i\'ll', 'i\'m', 'i\'ve', 'if', 'in', 'into', 'is', 'isn\'t', 'it', 'it\'s', 'its', 'itself', 'let\'s', 'me', 'more', 'most', 'mustn\'t', 'my', 'myself', 'no', 'nor', 'not', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'ought', 'our', 'ours', 'ourselves', 'out', 'over', 'own', 'same', 'shan\'t', 'she', 'she\'d', 'she\'ll', 'she\'s', 'should', 'shouldn\'t', 'so', 'some', 'such', 'than', 'that', 'that\'s', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'there\'s', 'these', 'they', 'they\'d', 'they\'ll', 'they\'re', 'they\'ve', 'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'wasn\'t', 'we', 'we\'d', 'we\'ll', 'we\'re', 'we\'ve', 'were', 'weren\'t', 'what', 'what\'s', 'when', 'when\'s', 'where', 'where\'s', 'which', 'while', 'who', 'who\'s', 'whom', 'why', 'why\'s', 'with', 'won\'t', 'would', 'wouldn\'t', 'you', 'you\'d', 'you\'ll', 'you\'re', 'you\'ve', 'your', 'yours', 'yourself', 'yourselves'
]);

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
  'harassment': ['conduct', 'misconduct', 'discipline', 'intimidation'],
  'harass': ['harassment', 'conduct', 'misconduct', 'discipline', 'intimidation'],
  'sexual': ['sexually', 'sexist', 'sexual harassment'],
  'sexually': ['sexual', 'sexist', 'sexual harassment'],
  'sexist': ['sexual', 'sexually', 'sexual harassment'],
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

const SEXUAL_CONTEXT_PATTERNS = [
  /\bsexual\b/i,
  /\bsexually\b/i,
  /\bsexist\b/i,
  /\bsexism\b/i,
  /\bsexual\s+harassment\b/i,
  /\bunwanted\s+(?:sexual\s+)?(?:touching|contact)\b/i,
  /\bsexual\s+(?:favor|favors|favour|favours|contact|advance|advances|remarks?|abuse|assault|conduct|misconduct|innuendo)\b/i,
  /\blewd\b/i,
  /\bgrop(?:e|ing|ed)\b/i,
  /\bmolest(?:ation|ed|ing)?\b/i,
  /\bindecent\b/i,
  /\bcodi\b/i,
  /\bra\s*7877\b/i,
  /\b7877\b/i,
];

function isSexualHarassmentPolicy(ordinance) {
  if (!ordinance) return false;
  const ref = (ordinance.ref || '').toUpperCase();
  const title = (ordinance.title || '').toLowerCase();
  const catKey = (ordinance.catK || '').toLowerCase();
  return ref.includes('SH') || catKey.includes('sexual') || title.includes('sexual harassment');
}

function hasSexualContext(rawQuery, aiTerms = null) {
  const queryStr = (rawQuery || '').toLowerCase();
  for (const pattern of SEXUAL_CONTEXT_PATTERNS) {
    if (pattern.test(queryStr)) return true;
  }

  if (aiTerms) {
    const aiText = [
      aiTerms.intent || '',
      ...(Array.isArray(aiTerms.keywords) ? aiTerms.keywords : []),
    ].join(' ').toLowerCase();

    for (const pattern of SEXUAL_CONTEXT_PATTERNS) {
      if (pattern.test(aiText)) return true;
    }

    if (Array.isArray(aiTerms.relatedTerms)) {
      const explicitRelated = aiTerms.relatedTerms.join(' ').toLowerCase();
      for (const pattern of SEXUAL_CONTEXT_PATTERNS) {
        if (pattern.test(explicitRelated)) return true;
      }
    }
  }

  return false;
}

const synonymKeys = Object.keys(SYNONYM_MAP).map(key => ({ key }));
const keyFuse = new Fuse(synonymKeys, { keys: ['key'], threshold: 0.3 });

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeQuery(q) {
  if (!q) return '';
  return q
    .toLowerCase()
    .replace(/[^\w\s.%]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isScenarioQuery(q) {
  if (!q) return false;
  const isRef = /^plsp[-\s]?\w+[-\s]?\d+$/i.test(q.trim());
  const normalized = normalizeQuery(q);
  const words = normalized.split(/\s+/).filter(Boolean);
  return words.length >= 3 && !isRef;
}

function extractPhraseSynonyms(normalizedQuery) {
  let synonyms = [];
  Object.entries(SYNONYM_MAP).forEach(([root, list]) => {
    if (root.includes(' ') && normalizedQuery.includes(root)) {
      synonyms = synonyms.concat(list);
    }
    list.forEach(syn => {
      if (syn.includes(' ') && normalizedQuery.includes(syn)) {
        synonyms.push(root);
      }
    });
  });
  return Array.from(new Set(synonyms));
}

function getSynonyms(word) {
  let synonyms = [];

  if (SYNONYM_MAP[word]) {
    synonyms = synonyms.concat(SYNONYM_MAP[word]);
  } else {
    const fuzzyResults = keyFuse.search(word);
    if (fuzzyResults.length > 0) {
      synonyms = synonyms.concat(SYNONYM_MAP[fuzzyResults[0].item.key]);
    }
  }

  const suffixes = ['ing', 'ed', 'es', 's', 'ly'];
  for (const suffix of suffixes) {
    if (word.endsWith(suffix) && word.length > suffix.length + 2) {
      const stem = word.slice(0, -suffix.length);
      synonyms.push(stem);
      if (SYNONYM_MAP[stem]) {
        synonyms = synonyms.concat(SYNONYM_MAP[stem]);
      }
      if (SYNONYM_MAP[stem + 'e']) {
        synonyms = synonyms.concat(SYNONYM_MAP[stem + 'e']);
      }
    }
  }

  const stems = [word];
  for (const suffix of suffixes) {
    if (word.endsWith(suffix) && word.length > suffix.length + 2) {
      stems.push(word.slice(0, -suffix.length));
      stems.push(word.slice(0, -suffix.length) + 'e');
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

function getRelevanceLabel(score) {
  if (score == null) return null;
  if (score < 0.25) return 'High';
  if (score < 0.40) return 'Medium';
  return 'Low';
}

function scoreScenarioSearch(data, query, aiTerms = null) {
  const normalized = normalizeQuery(query);
  const allTokens = normalized.split(/\s+/).filter(Boolean);
  const nonStopwords = allTokens.filter(w => !STOPWORDS.has(w));
  const queryWords = nonStopwords.length > 0 ? nonStopwords : allTokens;

  const sexualContextPresent = hasSexualContext(query, aiTerms);

  // 1. User Query Terms (Tier 1 - Highest Priority)
  const userWordEntries = queryWords.map(w => {
    const isGeneric = GENERIC_WORDS.has(w);
    const weight = isGeneric ? 0.15 : 1.0;
    const syns = getSynonyms(w);
    return {
      word: w,
      isGeneric,
      weight,
      synonyms: syns,
      source: 'user',
      directMult: 1.0,
      synMult: 0.80,
    };
  });

  const seenWords = new Set(userWordEntries.map(e => e.word));

  // 2. Gemini Keywords (Tier 2 - Concrete Contextual Signals)
  const aiKeywordEntries = [];
  if (aiTerms && Array.isArray(aiTerms.keywords)) {
    aiTerms.keywords.forEach(kw => {
      const kwNorm = normalizeQuery(kw);
      const kwTokens = kwNorm.split(/\s+/).filter(w => Boolean(w) && !STOPWORDS.has(w));
      kwTokens.forEach(w => {
        if (!seenWords.has(w)) {
          seenWords.add(w);
          const isGeneric = GENERIC_WORDS.has(w);
          aiKeywordEntries.push({
            word: w,
            isGeneric,
            weight: isGeneric ? 0.10 : 0.60,
            synonyms: getSynonyms(w),
            source: 'ai_keyword',
            directMult: 0.90,
            synMult: 0.60,
          });
        }
      });
    });
  }

  // 3. Gemini Related Terms (Tier 3 - Broad Institutional Terms, Lower Influence)
  const aiRelatedEntries = [];
  if (aiTerms && Array.isArray(aiTerms.relatedTerms)) {
    aiTerms.relatedTerms.forEach(rt => {
      const rtNorm = normalizeQuery(rt);
      const rtTokens = rtNorm.split(/\s+/).filter(w => Boolean(w) && !STOPWORDS.has(w));
      rtTokens.forEach(w => {
        if (!seenWords.has(w)) {
          seenWords.add(w);
          const isGeneric = GENERIC_WORDS.has(w);
          aiRelatedEntries.push({
            word: w,
            isGeneric,
            weight: isGeneric ? 0.05 : 0.25,
            synonyms: getSynonyms(w),
            source: 'ai_related',
            directMult: 0.70,
            synMult: 0.40,
          });
        }
      });
    });
  }

  const allWordEntries = [...userWordEntries, ...aiKeywordEntries, ...aiRelatedEntries];
  const userSpecificWords = userWordEntries.filter(e => !e.isGeneric);
  const userSpecificBaseWeight = userSpecificWords.reduce((sum, e) => sum + e.weight, 0) || (userWordEntries.reduce((sum, e) => sum + e.weight, 0) || 1.0);
  const aiSpecificBaseWeight = [...aiKeywordEntries, ...aiRelatedEntries].filter(e => !e.isGeneric).reduce((sum, e) => sum + e.weight, 0);

  // Denominator: Anchored primarily to the user query specific weight + moderate AI contribution
  const effectiveDenominator = userSpecificBaseWeight + (aiSpecificBaseWeight * 0.35);

  const phrases = [];
  const seenPhrases = new Set();
  function addPhrase(p, baseWeight) {
    const clean = p.toLowerCase().trim();
    if (!clean || seenPhrases.has(clean) || clean.split(/\s+/).length < 2) return;
    seenPhrases.add(clean);
    const words = clean.split(/\s+/);
    const hasSpecific = words.some(w => !GENERIC_WORDS.has(w) && !STOPWORDS.has(w));
    phrases.push({ phrase: clean, weight: hasSpecific ? baseWeight : 0.3 });
  }

  for (let i = 0; i < allTokens.length - 1; i++) {
    addPhrase(allTokens[i] + ' ' + allTokens[i + 1], 2.5);
    if (i < allTokens.length - 2) {
      addPhrase(allTokens[i] + ' ' + allTokens[i + 1] + ' ' + allTokens[i + 2], 2.5);
    }
  }
  for (let i = 0; i < nonStopwords.length - 1; i++) {
    addPhrase(nonStopwords[i] + ' ' + nonStopwords[i + 1], 2.5);
  }
  const phraseSyns = extractPhraseSynonyms(normalized);
  phraseSyns.forEach(p => addPhrase(p, 2.0));

  if (aiTerms && Array.isArray(aiTerms.keywords)) {
    aiTerms.keywords.forEach(kw => {
      const clean = kw.toLowerCase().trim();
      if (clean.split(/\s+/).length >= 2) addPhrase(clean, 1.0);
    });
  }
  if (aiTerms && Array.isArray(aiTerms.relatedTerms)) {
    aiTerms.relatedTerms.forEach(rt => {
      const clean = rt.toLowerCase().trim();
      if (clean.split(/\s+/).length >= 2) addPhrase(clean, 0.4);
    });
  }

  function calculateFieldScore(textList, isSHPolicy = false) {
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

      // Requirement 10: Prevent "harassment" alone from matching policies whose defining concept is "sexual harassment"
      if (isSHPolicy && !sexualContextPresent) {
        const lowerTarget = target.toLowerCase();
        if (
          lowerTarget === 'harassment' ||
          lowerTarget === 'harass' ||
          lowerTarget === 'harassed' ||
          lowerTarget === 'conduct' ||
          lowerTarget === 'misconduct' ||
          lowerTarget === 'discipline' ||
          lowerTarget === 'intimidation'
        ) {
          return 0;
        }
      }

      const escaped = escapeRegex(target);
      const regex = new RegExp('(?:^|\\s)' + escaped + '(?:$|\\s)', 'i');
      if (regex.test(combinedText)) return 1.0;

      // Stem check (e.g. sexually -> sexual, cheating -> cheat, bullying -> bully)
      const suffixes = ['ing', 'ed', 'es', 's', 'ly'];
      for (const suffix of suffixes) {
        if (target.endsWith(suffix) && target.length > suffix.length + 2) {
          const stem = target.slice(0, -suffix.length);
          const stemEscaped = escapeRegex(stem);
          const stemRegex = new RegExp('(?:^|\\s)' + stemEscaped + '(?:$|\\s)', 'i');
          if (stemRegex.test(combinedText)) return 0.95;
        }
      }

      const fRes = fuse.search(target);
      if (fRes.length > 0 && fRes[0].score <= 0.35) {
        return 1.0 - fRes[0].score;
      }
      return 0;
    }

    let matchedWeight = 0;
    let userSpecificMatched = 0;

    allWordEntries.forEach(entry => {
      let q = testWordOrPhrase(entry.word);
      if (q > 0) {
        matchedWeight += entry.weight * entry.directMult * q;
        if (entry.source === 'user' && !entry.isGeneric) userSpecificMatched += q;
      } else if (entry.synonyms && entry.synonyms.length > 0) {
        let bestSynQ = 0;
        for (const syn of entry.synonyms) {
          const sq = testWordOrPhrase(syn);
          if (sq > bestSynQ) bestSynQ = sq;
        }
        if (bestSynQ > 0) {
          matchedWeight += entry.weight * entry.synMult * bestSynQ;
          if (entry.source === 'user' && !entry.isGeneric) userSpecificMatched += entry.synMult * bestSynQ;
        }
      }
    });

    let phraseBonus = 0;
    phrases.forEach(p => {
      const pq = testWordOrPhrase(p.phrase);
      if (pq > 0) {
        phraseBonus += p.weight * 0.5 * pq;
      }
    });

    let rawRatio = (matchedWeight + phraseBonus) / effectiveDenominator;

    // Requirement 9: Specific terms absent from user query should not receive strong matches
    if (userSpecificWords.length > 0 && userSpecificMatched === 0) {
      rawRatio *= 0.15;
    }

    const cappedRatio = Math.min(1.0, Math.max(0.0, rawRatio));
    return 1.0 - cappedRatio;
  }

  const scored = data.map(ordinance => {
    const isSH = isSexualHarassmentPolicy(ordinance);
    const scenarios = (ordinance.scenarios && ordinance.scenarios.length > 0)
      ? ordinance.scenarios
      : [];

    let bestScenarioScore = 1.0;
    scenarios.forEach(s => {
      const score = calculateFieldScore([s.scenario], isSH);
      if (score < bestScenarioScore) bestScenarioScore = score;
    });

    let bestKeywordScore = 1.0;
    scenarios.forEach(s => {
      const score = calculateFieldScore(s.keywords || [], isSH);
      if (score < bestKeywordScore) bestKeywordScore = score;
    });

    let bestSynonymScore = 1.0;
    scenarios.forEach(s => {
      const score = calculateFieldScore(s.synonyms || [], isSH);
      if (score < bestSynonymScore) bestSynonymScore = score;
    });

    const titleScore = calculateFieldScore([ordinance.title, ordinance.ref, ordinance.cat, ordinance.catK], isSH);
    const bodyScore = calculateFieldScore([ordinance.summary, ordinance.desc, ordinance.full], isSH);

    let finalScore = (
      0.40 * bestScenarioScore +
      0.25 * bestKeywordScore +
      0.20 * bestSynonymScore +
      0.10 * titleScore +
      0.05 * bodyScore
    );

    // Requirement 10 & 11: A policy containing "sexual harassment" should rank highly
    // only when the query/Gemini terms provide sexual context.
    if (isSH && !sexualContextPresent) {
      if (finalScore < 0.60) {
        finalScore = Math.max(finalScore + 0.35, 0.60);
      }
    }

    return {
      ...ordinance,
      searchScore: finalScore,
    };
  });

  return scored;
}

function searchOrdinancesLocal(data, query, aiTerms = null) {
  if (!query) return data;

  const normalized = normalizeQuery(query);
  const scenarioMode = isScenarioQuery(query);
  const sexualContextPresent = hasSexualContext(query, aiTerms);

  if (scenarioMode) {
    const scored = scoreScenarioSearch(data, query, aiTerms);
    const filtered = scored.filter(r => r.searchScore <= 0.55);
    const withLabels = filtered.map(r => ({
      ...r,
      relevanceLabel: getRelevanceLabel(r.searchScore),
    }));
    return withLabels.sort((a, b) => a.searchScore - b.searchScore);
  }

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

  const mergedMap = new Map();

  originalResults.forEach(r => {
    // If no sexual context and candidate is a sexual harassment policy matched on generic term
    if (!sexualContextPresent && isSexualHarassmentPolicy(r.item)) {
      return;
    }
    mergedMap.set(r.item.id, { ...r.item, searchScore: r.score });
  });

  synonymMatches.forEach(r => {
    if (!sexualContextPresent && isSexualHarassmentPolicy(r.item)) {
      return;
    }
    const penalizedScore = r.score + 0.15;
    if (penalizedScore <= 0.6) {
      if (mergedMap.has(r.item.id)) {
        const existing = mergedMap.get(r.item.id);
        if (penalizedScore < existing.searchScore) {
          existing.searchScore = penalizedScore;
        }
      } else {
        mergedMap.set(r.item.id, { ...r.item, searchScore: penalizedScore });
      }
    }
  });

  const cleanQ = query.toLowerCase().replace(/[^\w]/g, '');
  if (/^plsp\w+\d+$/.test(cleanQ)) {
    data.forEach(item => {
      const cleanRef = (item.ref || '').toLowerCase().replace(/[^\w]/g, '');
      if (cleanRef === cleanQ) {
        mergedMap.set(item.id, { ...item, searchScore: 0.0 });
      }
    });
  }

  const results = Array.from(mergedMap.values()).map(r => ({
    ...r,
    relevanceLabel: getRelevanceLabel(r.searchScore),
  }));

  return results.sort((a, b) => a.searchScore - b.searchScore);
}

/**
 * Fetch all published ordinances from the database, attach scenario rows,
 * and format them consistently.
 */
async function getPublishedOrdinancesWithScenarios(db) {
  const [rows] = await db.query(
    "SELECT * FROM ordinances WHERE status = 'published' ORDER BY id"
  );

  if (!rows || rows.length === 0) return [];

  const ids = rows.map(r => r.id);
  const placeholders = ids.map(() => '?').join(',');

  let scenarioRows = [];
  try {
    const [sRows] = await db.query(
      `SELECT policy_id, scenario, keywords, synonyms
       FROM policy_scenarios
       WHERE policy_id IN (${placeholders})
       ORDER BY policy_id, id`,
      ids
    );
    scenarioRows = sRows || [];
  } catch (err) {
    console.warn('[searchMatcher] policy_scenarios query warning:', err.message);
  }

  const scenarioMap = {};
  for (const s of scenarioRows) {
    if (!scenarioMap[s.policy_id]) scenarioMap[s.policy_id] = [];
    scenarioMap[s.policy_id].push(s);
  }

  return rows.map(row => {
    let steps = [];
    if (typeof row.steps === 'string') {
      try { steps = JSON.parse(row.steps || '[]'); } catch { steps = []; }
    } else if (Array.isArray(row.steps)) {
      steps = row.steps;
    }

    let related = [];
    if (typeof row.related === 'string') {
      try { related = JSON.parse(row.related || '[]'); } catch { related = []; }
    } else if (Array.isArray(row.related)) {
      related = row.related;
    }

    const scenarios = (scenarioMap[row.id] || []).map(s => ({
      scenario: s.scenario || '',
      keywords: Array.isArray(s.keywords) ? s.keywords : (() => { try { return JSON.parse(s.keywords || '[]'); } catch { return []; } })(),
      synonyms: Array.isArray(s.synonyms) ? s.synonyms : (() => { try { return JSON.parse(s.synonyms || '[]'); } catch { return []; } })(),
    }));

    return {
      id:        row.id,
      ref:       row.ref,
      catK:      row.cat_key,
      cat:       row.cat,
      title:     row.title,
      desc:      row.desc,
      summary:   row.summary,
      full:      row.full_text,
      steps,
      related,
      scenarios,
      handbookSectionId: row.handbook_section_id,
      page:      row.page || null,
      versionId: row.version_id || null,
      status:    row.status || 'published',
      updatedBy: row.updated_by || '',
      updatedAt: row.updated_at,
    };
  });
}

/**
 * Execute search matching against actual database ordinances.
 *
 * @param {Object} db - MySQL connection pool
 * @param {string} rawQuery - The user's input query
 * @param {Object|null} aiTerms - { intent, keywords, relatedTerms } or null
 * @returns {Promise<Array>} Matching ordinances with scores and relevance labels
 */
async function searchDatabasePolicies(db, rawQuery, aiTerms = null) {
  const ordinances = await getPublishedOrdinancesWithScenarios(db);
  if (!ordinances.length) return [];

  // Primary search: Context-aware ranking with AI terms prioritizing rawQuery
  const results = searchOrdinancesLocal(ordinances, rawQuery, aiTerms);
  if (results && results.length > 0) {
    return results;
  }

  // Fallback search on rawQuery alone if aiTerms was provided but yielded nothing
  if (aiTerms) {
    return searchOrdinancesLocal(ordinances, rawQuery, null);
  }

  return [];
}

module.exports = {
  searchDatabasePolicies,
  searchOrdinancesLocal,
  isScenarioQuery,
  normalizeQuery,
  getRelevanceLabel,
};
