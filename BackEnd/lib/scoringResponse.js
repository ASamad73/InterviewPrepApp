// scoring.js
//
// Usage (example):
//   import { scoreResponses } from './scoring.js';
//   const scored = await scoreResponses({ ordered, DEBUG: true });
//   // scored.items is array of scored entries
//
// Expected shape of each "ordered" item:
// {
//   question_id: '12345',
//   question_title: '...',
//   question_text: '...',
//   answer_text: '... (the expected / ideal answer)',
//   response: '... (the user's combined response)'
// }

import { config } from "dotenv";
import path from "path";
config({ path: path.join(process.cwd(), "back.env") });

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  throw new Error("Missing GEMINI_API_KEY in environment (back.env)");
}

const MODEL = "gemini-2.0-flash";
const ENDPOINT = (model) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;

/* ----------------------
   Helpers: Gemini caller
   ---------------------- */

// async function callGemini(prompt, retry = 0, DEBUG = false) {
//   const url = ENDPOINT(MODEL);
//   const body = {
//     contents: [{ parts: [{ text: prompt }] }],
//   };

//   try {
//     const res = await fetch(url, {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify(body),
//     });

//     const text = await res.text();

//     if (!res.ok) {
//       const snippet = text ? text.slice(0, 1000) : "";
//       const err = new Error(`HTTP ${res.status} ${res.statusText} - ${snippet}`);
//       err.status = res.status;
//       throw err;
//     }

//     // Try parse JSON-like SDK response or return raw body
//     try {
//       const parsed = JSON.parse(text);
//       const candidateText =
//         parsed?.candidates?.[0]?.content?.parts?.[0]?.text ??
//         parsed?.candidates?.[0]?.content?.[0]?.text ??
//         parsed?.candidates?.[0]?.content ??
//         null;
//       if (candidateText) return candidateText.toString();
//       // fallback to returning stringified response
//       return text;
//     } catch (e) {
//       return text;
//     }
//   } catch (err) {
//     const status = err?.status ?? null;
//     if (
//       retry < 3 &&
//       (status === 429 || (status >= 500 && status < 600) || err.message.includes("Timeout"))
//     ) {
//       const backoffMs = 1000 * Math.pow(2, retry) + Math.floor(Math.random() * 300);
//       if (DEBUG) console.warn(`Transient error (status=${status}). Retrying after ${backoffMs}ms.`);
//       await new Promise((r) => setTimeout(r, backoffMs));
//       return callGemini(prompt, retry + 1, DEBUG);
//     }
//     throw err;
//   }
// }

// scoring.js (replace existing callGemini with this)
async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseRetryAfter(retryAfterHeader) {
  if (!retryAfterHeader) return null;
  // If numeric seconds
  const sec = Number(retryAfterHeader);
  if (!Number.isNaN(sec) && sec >= 0) return Math.round(sec * 1000);
  // Else try HTTP-date parse
  const date = Date.parse(retryAfterHeader);
  if (!Number.isNaN(date)) {
    const delta = date - Date.now();
    return delta > 0 ? Math.round(delta) : 0;
  }
  return null;
}

async function callGemini(prompt, retry = 0, DEBUG = false, maxRetries = 5) {
  const url = ENDPOINT(MODEL);
  const body = { contents: [{ parts: [{ text: prompt }] }] };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const text = await res.text();

    if (!res.ok) {
      // Special handling for 429 Too Many Requests — respect Retry-After header if present
      if (res.status === 429 && retry < maxRetries) {
        const ra = res.headers ? res.headers.get("retry-after") : null;
        const waitMs = parseRetryAfter(ra);
        if (DEBUG) console.warn(`Gemini 429 received. Retry-After header: "${ra}". Computed waitMs: ${waitMs}`);

        if (waitMs !== null && waitMs > 0) {
          // Wait exactly as header requests then retry
          if (DEBUG) console.log(`Waiting ${waitMs}ms per Retry-After header before retry #${retry+1}`);
          await sleep(waitMs);
          return callGemini(prompt, retry + 1, DEBUG, maxRetries);
        } else {
          // no useful Retry-After — fall back to exponential backoff
          const backoffMs = 1000 * Math.pow(2, retry) + Math.floor(Math.random() * 300);
          if (DEBUG) console.log(`No Retry-After header or unparsable; using exponential backoff ${backoffMs}ms (retry ${retry+1})`);
          await sleep(backoffMs);
          return callGemini(prompt, retry + 1, DEBUG, maxRetries);
        }
      }

      // For 5xx and some transient errors, keep previous retry policy (up to maxRetries)
      const snippet = text ? text.slice(0, 1000) : "";
      const err = new Error(`HTTP ${res.status} ${res.statusText} - ${snippet}`);
      err.status = res.status;

      // If transient and retry remains, retry with exponential backoff
      if (retry < maxRetries && (res.status === 500 || res.status === 502 || res.status === 503 || res.status === 504)) {
        const backoffMs = 1000 * Math.pow(2, retry) + Math.floor(Math.random() * 300);
        if (DEBUG) console.warn(`Transient ${res.status}. Retrying after ${backoffMs}ms.`);
        await sleep(backoffMs);
        return callGemini(prompt, retry + 1, DEBUG, maxRetries);
      }

      throw err;
    }

    // success path
    try {
      const parsed = JSON.parse(text);
      const candidateText =
        parsed?.candidates?.[0]?.content?.parts?.[0]?.text ??
        parsed?.candidates?.[0]?.content?.[0]?.text ??
        parsed?.candidates?.[0]?.content ??
        null;
      if (candidateText) return candidateText.toString();
      return text;
    } catch (e) {
      return text;
    }
  } catch (err) {
    // network/other errors: attempt retry for transient conditions
    const status = err?.status ?? null;
    if (retry < maxRetries && (status === 429 || (status >= 500 && status < 600) || String(err).includes("Timeout"))) {
      // try to respect server hint if available (err may not carry headers here)
      const backoffMs = 1000 * Math.pow(2, retry) + Math.floor(Math.random() * 300);
      if (DEBUG) console.warn(`Exception during Gemini call (status=${status}). Retrying after ${backoffMs}ms. err=${String(err).slice(0,200)}`);
      await sleep(backoffMs);
      return callGemini(prompt, retry + 1, DEBUG, maxRetries);
    }
    throw err;
  }
}

function extractJsonFromText(text) {
  if (!text || typeof text !== "string") return null;
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  const jsonText = text.slice(start, end + 1);
  try {
    return JSON.parse(jsonText);
  } catch (e) {
    return null;
  }
}

/* ----------------------
   Fallback lexical scorer
   (used if LLM response not parseable)
   ---------------------- */

// function lexicalScore(expected, response) {
//   if (!response || !response.trim()) return { correctness: 0, depth: 0, communication: 1, metrics: 0 };

//   const normalize = (s) =>
//     (s || "").toLowerCase().replace(/[^a-z0-9\s]+/g, " ").split(/\s+/).filter(Boolean);

//   const eTokens = normalize(expected);
//   const rTokens = normalize(response);

//   const eSet = new Set(eTokens);
//   const matches = rTokens.filter((t) => eSet.has(t));
//   const overlap = matches.length / Math.max(1, eTokens.length);

//   const correctness = Math.min(5, Math.round(overlap * 5)); // rough
//   const depth = Math.min(5, Math.round(Math.min(1, rTokens.length / Math.max(10, eTokens.length)) * 5));
//   const communication = Math.min(5, Math.round(Math.min(1, rTokens.length / 20) * 5));
//   const metrics = /[0-9]+/.test(response) ? 2 : 0;

//   const missed = eTokens.slice(0, 30).filter((t) => !rTokens.includes(t)).slice(0, 10);
//   return {
//     correctness,
//     depth,
//     communication,
//     metrics,
//     misses: Array.from(new Set(missed)).slice(0, 10),
//   };
// }
function lexicalScore(expected, response) {
  if (!response || !response.trim()) {
    return { correctness: 0, depth: 0, communication: 1, metrics: 0, misses: [] };
  }

  const normalize = (s) =>
    (s || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]+/g, " ")
      .split(/\s+/)
      .filter(Boolean);

  const eTokens = normalize(expected);
  const rTokens = normalize(response);

  const eSet = new Set(eTokens);
  const matches = rTokens.filter((t) => eSet.has(t));
  const overlap = matches.length / Math.max(1, eTokens.length);

  // 🔹 technical token detection FIRST
  const technicalMatches = matches.filter(tok => tok.length > 3);

  // 🔹 correctness
  let correctness = Math.min(5, Math.round(overlap * 5));

  // boost correctness if core concepts appear (paraphrase-safe)
  if (technicalMatches.length >= 2 && correctness < 3) {
    correctness = 3;
  }

  // penalize very short answers
  if (response.trim().length < 10) {
    correctness = Math.min(correctness, 1);
  }

  // 🔹 depth
  let depth = Math.min(
    5,
    Math.round((technicalMatches.length / Math.max(1, eTokens.length)) * 5)
  );

  // avoid depth inflation from verbosity
  if (rTokens.length < Math.max(8, eTokens.length / 2)) {
    depth = Math.min(depth, 3);
  }

  // 🔹 communication
  const communication = Math.min(
    5,
    Math.round(Math.min(1, rTokens.length / 20) * 5)
  );

  // 🔹 metrics
  const metrics = /[0-9]+/.test(response) ? 2 : 0;

  const missed = eTokens
    .slice(0, 30)
    .filter((t) => !rTokens.includes(t))
    .slice(0, 10);

  return {
    correctness,
    depth,
    communication,
    metrics,
    misses: Array.from(new Set(missed)),
  };
}


/* ----------------------
   Main scoring: prompts Gemini to produce JSON
   ---------------------- */

function buildScoringPrompt({ questionTitle, questionText, expectedAnswer, userResponse }) {
  const q = (questionTitle ? `${questionTitle}\n` : "") + (questionText || "");
  return `
You are an expert technical interviewer and a grader. Given the INTERVIEW QUESTION, the IDEAL/EXPECTED ANSWER, and the CANDIDATE RESPONSE, produce a strict JSON object (and nothing else) that evaluates the candidate response.

Respond EXACTLY with a single JSON object with these keys:

{
  "question_id": "<string>",            // copy the question id (if available) or empty string
  "scores": {
    "correctness": <number 0-5>,        // how correct / relevant the response is
    "depth": <number 0-5>,              // how deep / detailed / technical the response is
    "communication": <number 0-5>,      // clarity / concision / organization
    "metrics": <number 0-5>             // evidence of numbers/estimations/impact when relevant
  },
  "overall_score": <number 0-5>,        // overall rating (0-5). Prefer averaging the above and rounding to nearest 0.25 or 0.5
  "missed_points": ["short bullet strings..."],  // list of specific expected concepts or phrases the candidate missed
  "positive_points": ["short bullet strings..."],// list of specific strengths found in the response (phrases/ideas)
  "rationale": "brief explanation (1-3 sentences) of why these scores were given"
}

RULES:
- Base scores on semantic content: do NOT require exact wording.
- If the candidate did not answer or answered "not sure", score low but still produce helpful missed_points.
- For missed_points, extract concise expected concepts from the IDEAL/EXPECTED ANSWER. Aim for 3-6 items where possible.
- Keep rationale short (1-3 sentences).
- Use numeric scores only (no percentages), range 0..5 inclusive. overall_score must be consistent with the component scores.
- Output ONLY the JSON object, nothing else (no preface). Ensure valid JSON.

INPUT FIELDS:
INTERVIEW QUESTION:
${q}

IDEAL/EXPECTED ANSWER:
${expectedAnswer || ""}

CANDIDATE RESPONSE:
${userResponse || ""}

Return JSON now.
`;
}

/* ----------------------
   Exported function
   ---------------------- */

export async function scoreResponses({
  ordered = [],
  DEBUG = false,
  sequential = true,
  maxConcurrent = 1,
} = {}) {
  if (!Array.isArray(ordered)) {
    throw new Error("ordered must be an array");
  }

  const results = [];

  function isExplicitSkipOrDontKnow(s) {
    if (!s || typeof s !== "string") return false;
    const t = s.trim().toLowerCase();
    return [
      /\b(skip|pass)\b/,
      /\bnot sure\b/,
      /\bdon'?t know\b/,
      /\bno idea\b/,
      /\bmove on\b/,
    ].some((re) => re.test(t));
  }

  async function scoreOne(item) {
    const qid = String(item.question_id ?? "");
    const expectedAnswer = item.answer_text || item.expected_answer || "";
    const userResponse = item.response || item.user_response || "";

    /* ---------- HARD SHORT-CIRCUIT ---------- */
    if (isExplicitSkipOrDontKnow(userResponse)) {
      return {
        ok: true,
        fallback: false,
        question_id: qid,
        scores: { correctness: 0, depth: 0, communication: 1, metrics: 0 },
        overall_score: 0,
        missed_points: [],
        positive_points: [],
        rationale: "Candidate explicitly skipped or indicated no knowledge.",
        raw_llm_text: null,
      };
    }

    const prompt = buildScoringPrompt({
      questionTitle: item.question_title,
      questionText: item.question_text,
      expectedAnswer,
      userResponse,
    });

    try {
      const respText = await callGemini(prompt, 0, DEBUG);
      const parsed = extractJsonFromText(respText);

      if (!parsed) throw new Error("Unparseable JSON");

      const raw = parsed.scores || {};
      const scores = {
        correctness: clamp(raw.correctness),
        depth: clamp(raw.depth),
        communication: clamp(raw.communication),
        metrics: clamp(raw.metrics),
      };

      const weighted5 = weightedOverall(scores);
      return {
        ok: true,
        fallback: false,
        question_id: qid,
        scores,
        overall_score: weighted5,
        missed_points: parsed.missed_points || [],
        positive_points: parsed.positive_points || [],
        rationale: parsed.rationale || "",
        raw_llm_text: respText?.slice(0, 3000) ?? null,
      };

    } catch (err) {
      /* ---------- FALLBACK ---------- */
      const lex = lexicalScore(expectedAnswer, userResponse);
      const scores = {
        correctness: lex.correctness,
        depth: lex.depth,
        communication: lex.communication,
        metrics: lex.metrics,
      };

      let weighted5 = weightedOverall(scores);

      // Only penalize hard failures, not semantic mismatch
      if (lex.correctness === 0 && lex.depth === 0) {
        weighted5 *= 0.7;
      }

      weighted5 = round(weighted5);

      return {
        ok: false,
        fallback: true,
        question_id: qid,
        scores,
        overall_score: weighted5,
        missed_points: lex.misses || [],
        positive_points: [],
        rationale: `Fallback scoring used: ${String(err).slice(0, 120)}`,
        raw_llm_text: null,
      };
    }
  }

  for (const item of ordered) {
    const out = await scoreOne(item);
    results.push({ ...item, score: out });
  }

  return {
    ok: true,
    items: results,
    count: results.length,
  };
}

/* ---------- HELPERS ---------- */

function clamp(v) {
  v = Number(v);
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(5, Math.round(v * 4) / 4));
}

function weightedOverall(scores) {
  const W = {
    correctness: 0.75,   // 🔼 correctness dominates
    depth: 0.15,
    communication: 0.10,
    metrics: 0.0,        // metrics should NEVER tank correctness
  };

  let sum = 0;
  for (const k in W) {
    sum += W[k] * (scores[k] || 0);
  }

  // Guardrail: if correctness ≥ 3, overall cannot be "very low"
  if ((scores.correctness || 0) >= 3) {
    sum = Math.max(sum, 2.5);
  }

  return round(sum);
}


function round(v) {
  return Math.round(v * 100) / 100;
}

/* ----------------------
   Export default helpers for CommonJS/ES interop
   ---------------------- */

export async function scoreSingleQuestion({
  question_id = '',
  question_title = '',
  question_text = '',
  expected_answer = '',
  user_response = '',
  DEBUG = false,
} = {}) {
  try {

    const lowerResp = (user_response || '').toLowerCase();
    if (['not sure','don\'t know','pass','skip','move on','i don\'t know'].some(p => lowerResp.includes(p))) {
      return { ok: true, score: 0.0, category: 'very_low', details: { overall_score_5: 0, componentScores: { correctness:0, depth:0, communication:0, metrics:0 }, rationale: 'Explicit low answer (not sure/skip)' } };
    }
    // Reuse your existing scoreResponses function for consistency.
    // Build the single-item "ordered" array in the same shape scoreResponses expects.
    const item = {
      question_id: String(question_id ?? ''),
      question_title: question_title ?? '',
      question_text: question_text ?? '',
      answer_text: expected_answer ?? '',
      response: user_response ?? '',
    };

    // Run the same pipeline (sequential, single item)
    const out = await scoreResponses({ ordered: [item], DEBUG, sequential: true });

    // scoreResponses returns { ok: true, items: [ { ...item, score: outScore } ], ... }
    const scoredItem = (out && Array.isArray(out.items) && out.items[0]) || null;
    const scoreObj = scoredItem?.score || null;

    let overall5 = null;
    let fallback = true;
    let componentScores = null;
    let missed = [];
    let positive = [];
    let rationale = '';
    let raw_llm_text = null;

    if (scoreObj) {
      overall5 = Number.isFinite(scoreObj.overall_score) ? Number(scoreObj.overall_score) : null;
      componentScores = scoreObj.scores ?? null;
      missed = Array.isArray(scoreObj.missed_points) ? scoreObj.missed_points : [];
      positive = Array.isArray(scoreObj.positive_points) ? scoreObj.positive_points : [];
      rationale = String(scoreObj.rationale ?? '');
      raw_llm_text = scoreObj.raw_llm_text ?? null;
      fallback = Boolean(scoreObj.fallback);
    }

    // If overall5 not available, set to 0 and keep fallback true
    if (!Number.isFinite(overall5)) {
      overall5 = 0;
    }

    // Map 0..5 -> 0..1
    // const score01 = Math.max(0, Math.min(1, overall5 / 5));
    const score5 = Number(scoreObj?.overall_score ?? 0);
    const score01 = Math.max(0, Math.min(1, score5 / 5));
    
    let category = 'very_low';
    if (score01 < 0.3) category = 'very_low';
    else if (score01 < 0.6) category = 'borderline';
    else if (score01 < 0.8) category = 'acceptable';
    else category = 'strong';

    return {
      ok: true,
      score: Number(Math.round(score01 * 100) / 100), // two-decimal
      category,
      details: {
        overall_score_5: overall5,
        componentScores,
        missed_points: missed,
        positive_points: positive,
        rationale,
        raw_llm_text,
        fallback,
      },
    };
  } catch (err) {
    // If something goes wrong, return a conservative "very_low" with fallback info
    console.error('scoreSingleQuestion error:', err && (err.stack || String(err)));
    return {
      ok: false,
      score: 0,
      score5: 0,
      category: 'very_low',
      details: { error: String(err) },
    };
  }
}

export default {
  scoreResponses,
  scoreSingleQuestion,
};
