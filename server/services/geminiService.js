/**
 * server/services/geminiService.js
 *
 * Node/Express backend integration with Google Gemini AI.
 * Parses user scenario queries into structured intent, keywords, and related terms.
 *
 * CRITICAL: Gemini NEVER generates, hallucinates, or fabricates policies.
 * It is solely used as an institutional query analyzer / term expander.
 */

const { GoogleGenAI } = require('@google/genai');

const SYSTEM_INSTRUCTION = `You are an expert query analyzer for the Pamantasan ng Lungsod ng San Pablo (PLSP) Student Handbook and Campus Ordinance database.
Your job is to analyze the user's natural language situation, incident report, or inquiry and extract institutional search terms to match against official campus policies.

STRICT CONSTRAINTS:
1. You must ONLY output a single, valid JSON object with NO markdown backticks, NO markdown formatting, and NO extra commentary.
2. The JSON object must strictly match this structure:
   {
     "intent": "Brief description of the core situation or suspected violation/category",
     "keywords": ["array", "of", "concrete", "factual", "keywords", "from", "the", "user's", "query"],
     "relatedTerms": ["array", "of", "official", "campus", "policy", "terms", "synonyms", "and", "institutional", "concepts"]
   }
3. DO NOT invent, hallucinate, assume, or fabricate any policy titles, section numbers, penalties, sanctions, or handbook rules.
4. DO NOT attempt to answer the user's question or offer legal/academic advice. You are strictly a query parser.`;

/**
 * Extract structured search terms from a user scenario query using Gemini.
 *
 * @param {string} scenarioQuery - User's scenario or policy query
 * @param {number} timeoutMs - Timeout in milliseconds (default 5000)
 * @returns {Promise<{intent: string, keywords: string[], relatedTerms: string[]}>}
 */
async function extractSearchTerms(scenarioQuery, timeoutMs = 5000) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '' || apiKey.trim() === 'your_gemini_api_key_here') {
    const err = new Error('GEMINI_API_KEY is not configured in server .env');
    err.code = 'MISSING_API_KEY';
    throw err;
  }

  const modelName = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
  const ai = new GoogleGenAI({ apiKey: apiKey.trim() });

  const prompt = `Analyze this scenario and return only the JSON schema specified:
"${scenarioQuery.trim()}"`;

  // Create timeout promise
  let timerId;
  const timeoutPromise = new Promise((_, reject) => {
    timerId = setTimeout(() => {
      const timeoutErr = new Error(`Gemini API request timed out after ${timeoutMs}ms`);
      timeoutErr.code = 'TIMEOUT';
      reject(timeoutErr);
    }, timeoutMs);
  });

  const apiCallPromise = (async () => {
    const response = await callGeminiWithRetry(
      ai,
      modelName,
      prompt
    );

    const rawText = response?.text || '';
    if (!rawText) {
      throw new Error('Empty response from Gemini API');
    }

    // Clean any stray markdown formatting
    const cleanedText = rawText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    const parsed = JSON.parse(cleanedText);

    return {
      intent: typeof parsed.intent === 'string' ? parsed.intent.trim() : '',
      keywords: Array.isArray(parsed.keywords)
        ? parsed.keywords.map(k => String(k).trim()).filter(Boolean)
        : [],
      relatedTerms: Array.isArray(parsed.relatedTerms)
        ? parsed.relatedTerms.map(t => String(t).trim()).filter(Boolean)
        : [],
    };
  })();

  try {
    const result = await Promise.race([apiCallPromise, timeoutPromise]);
    return result;
  } finally {
    clearTimeout(timerId);
  }
}

const POLICY_STRUCTURING_INSTRUCTION = `You are an expert institutional policy structuring assistant for the Pamantasan ng Lungsod ng San Pablo (PLSP) Student Handbook.
Your job is to analyze the provided excerpt of an official campus policy and generate strictly factual structured metadata.

STRICT CONSTRAINTS:
1. You must ONLY output a single, valid JSON object with NO markdown backticks, NO markdown formatting, and NO extra commentary.
2. The JSON object must strictly match this structure:
   {
     "summary": "2-3 concise, student-friendly factual sentences summarizing what this policy covers, based ONLY on the provided text.",
     "catKey": "academic",
     "cat": "Academic Policies",
     "keywords": ["keyword1", "keyword2", "keyword3"],
     "relatedTerms": ["term1", "term2", "term3"],
     "scenarios": [
       "Natural language situation or student inquiry phrase 1",
       "Natural language situation or student inquiry phrase 2"
     ],
     "steps": [
       "Actionable step or key procedural requirement 1",
       "Actionable step or key procedural requirement 2"
     ]
   }
3. Allowed values for catKey and cat:
   - "academic" -> "Academic Policies"
   - "conduct" -> "Student Conduct"
   - "discipline" -> "Campus Discipline"
   - "rights" -> "Rights & Responsibilities"
   - "general" -> "University Policies"
4. ABSOLUTE ZERO-HALLUCINATION RULE:
   - Use ONLY the provided handbook excerpt.
   - DO NOT invent, hallucinate, assume, or fabricate any policy penalties, sanctions, fines, requirements, or legal conclusions not explicitly stated in the excerpt.
   - If the excerpt does not mention a sanction or procedure, DO NOT create one.`;

/**
 * Structure a policy excerpt into summaries, categories, keywords, and student scenarios.
 * Falls back to local heuristics if Gemini is unavailable, times out, or errors.
 *
 * @param {string} title - Policy title
 * @param {string} fullText - Policy full text
 * @param {number} timeoutMs - Timeout in ms (default 8000)
 * @returns {Promise<Object>}
 */
async function structurePolicyMetadata(title, fullText, timeoutMs = 8000) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '' || apiKey.trim() === 'your_gemini_api_key_here') {
    return generateFallbackMetadata(title, fullText);
  }

  const modelName = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
  const ai = new GoogleGenAI({ apiKey: apiKey.trim() });

  // Limit text to ~3500 chars to avoid hitting token quotas on large sections
  const safeExcerpt = (fullText || '').slice(0, 3500);
  const prompt = `Analyze this official policy and output the JSON schema specified:
TITLE: ${title}
CONTENT:
${safeExcerpt}`;

  let timerId;
  const timeoutPromise = new Promise((_, reject) => {
    timerId = setTimeout(() => {
      const timeoutErr = new Error(`Gemini structuring timed out after ${timeoutMs}ms`);
      timeoutErr.code = 'TIMEOUT';
      reject(timeoutErr);
    }, timeoutMs);
  });

  const apiCallPromise = (async () => {
    const response = await callGeminiWithRetry(
      ai,
      modelName,
      prompt,
      1,
      POLICY_STRUCTURING_INSTRUCTION
    );

    const rawText = response?.text || '';
    if (!rawText) throw new Error('Empty response from Gemini structuring');

    const cleanedText = rawText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    const parsed = JSON.parse(cleanedText);

    const validCatKeys = ['academic', 'conduct', 'discipline', 'rights', 'general'];
    const catKey = validCatKeys.includes(parsed.catKey) ? parsed.catKey : inferCategoryKey(title, fullText);
    const catNameMap = {
      academic: 'Academic Policies',
      conduct: 'Student Conduct',
      discipline: 'Campus Discipline',
      rights: 'Rights & Responsibilities',
      general: 'University Policies',
    };

    return {
      summary: typeof parsed.summary === 'string' && parsed.summary.trim() ? parsed.summary.trim() : generateSummary(fullText),
      catKey,
      cat: catNameMap[catKey] || 'University Policies',
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords.map(k => String(k).trim()).filter(Boolean) : extractBasicKeywords(title),
      relatedTerms: Array.isArray(parsed.relatedTerms) ? parsed.relatedTerms.map(t => String(t).trim()).filter(Boolean) : [],
      scenarios: Array.isArray(parsed.scenarios) ? parsed.scenarios.map(s => String(s).trim()).filter(Boolean) : generateFallbackScenarios(title),
      steps: Array.isArray(parsed.steps) ? parsed.steps.map(st => String(st).trim()).filter(Boolean) : extractStepsFromText(fullText),
      source: 'gemini',
    };
  })();

  try {
    const result = await Promise.race([apiCallPromise, timeoutPromise]);
    return result;
  } catch (err) {
    console.warn(`[Gemini structuring fallback for "${title}"]: ${err.message}`);
    return generateFallbackMetadata(title, fullText);
  } finally {
    clearTimeout(timerId);
  }
}

/**
 * Fallback metadata generator using deterministic text extraction.
 * Guarantees zero downtime even if Gemini quota or connection is unavailable.
 */
function generateFallbackMetadata(title, fullText) {
  const catKey = inferCategoryKey(title, fullText);
  const catNameMap = {
    academic: 'Academic Policies',
    conduct: 'Student Conduct',
    discipline: 'Campus Discipline',
    rights: 'Rights & Responsibilities',
    general: 'University Policies',
  };

  return {
    summary: generateSummary(fullText),
    catKey,
    cat: catNameMap[catKey] || 'University Policies',
    keywords: extractBasicKeywords(title + ' ' + (fullText || '').slice(0, 300)),
    relatedTerms: [],
    scenarios: generateFallbackScenarios(title),
    steps: extractStepsFromText(fullText),
    source: 'fallback',
  };
}

function inferCategoryKey(title = '', text = '') {
  const combined = (title + ' ' + text).toLowerCase();
  if (/grade|grading|gwa|honors|curriculum|enrol|admission|subject|retention|exam|transferee|clearance|dismissal|internship|ojt|unifast/i.test(combined)) {
    return 'academic';
  }
  if (/uniform|id card|dress code|identification|civilian wear|decorum|grooming/i.test(combined)) {
    return 'conduct';
  }
  if (/offense|discipline|sanction|suspension|expulsion|misdemeanor|misconduct|harassment|investigation|penalty|prohibited/i.test(combined)) {
    return 'discipline';
  }
  if (/rights|organization|council|ssg|publication|freedom|grievance|voting|election/i.test(combined)) {
    return 'rights';
  }
  return 'general';
}

function generateSummary(fullText = '') {
  if (!fullText) return 'Official policy provision from the PLSP Student Handbook.';
  // Split into sentences and pick first 2
  const cleaned = fullText.replace(/\s+/g, ' ').trim();
  const sentences = cleaned.match(/[^.!?]+[.!?]+/g) || [cleaned];
  const picked = sentences.slice(0, 2).join(' ').trim();
  if (picked.length > 280) return picked.slice(0, 277) + '...';
  return picked || 'Official policy provision from the PLSP Student Handbook.';
}

function extractBasicKeywords(text = '') {
  const stopWords = new Set(['the','and','for','that','this','with','from','shall','will','must','have','been','were','are','was']);
  const words = text.toLowerCase().match(/[a-z]{3,}/g) || [];
  const unique = [];
  for (const w of words) {
    if (!stopWords.has(w) && !unique.includes(w)) {
      unique.push(w);
    }
    if (unique.length >= 8) break;
  }
  return unique;
}

function generateFallbackScenarios(title = '') {
  const cleanTitle = title.replace(/^(Section|Sec\.|Article|Rule)\s*[\dIVXLCDM\.\:\-\—\s]+/i, '').trim();
  return [
    `What is the official policy regarding ${cleanTitle}?`,
    `What are the requirements or guidelines for ${cleanTitle} at PLSP?`
  ];
}

function extractStepsFromText(text = '') {
  if (!text) return [];
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const stepLines = [];
  for (const l of lines) {
    // Check if line starts with 1., a., -, bullet
    if (/^(\d+[\.\)]|[a-z][\.\)]|[\-\*•])\s+/i.test(l) && l.length > 10 && l.length < 250) {
      stepLines.push(l.replace(/^(\d+[\.\)]|[a-z][\.\)]|[\-\*•])\s+/i, '').trim());
    }
    if (stepLines.length >= 5) break;
  }
  return stepLines;
}

async function callGeminiWithRetry(ai, modelName, prompt, maxRetries = 2, customInstruction = SYSTEM_INSTRUCTION) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          systemInstruction: customInstruction,
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
      });
    } catch (err) {
      const status = err?.status || err?.error?.code;

      if ((status === 503 || status === 429) && attempt < maxRetries) {
        const delay = 1000 * (attempt + 1);

        console.warn(
          `[Gemini] Temporary error ${status}. Retrying in ${delay}ms...`
        );

        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      throw err;
    }
  }
}

module.exports = {
  extractSearchTerms,
  structurePolicyMetadata,
  generateFallbackMetadata,
};
