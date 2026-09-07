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

async function callGeminiWithRetry(ai, modelName, prompt, maxRetries = 2) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
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
};
