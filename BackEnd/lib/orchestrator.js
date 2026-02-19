// backend/lib/orchestrator.js
import fetch from "node-fetch";
import FormData from "form-data";
import fs from "fs/promises";
import path from "path";
import conversationManager from "./conversationManager.js";

const STT_URL = process.env.STT_URL || "http://127.0.0.1:8000/transcribe";
const TTS_URL = process.env.TTS_URL || "http://127.0.0.1:5000/synthesize";
const BACKEND_INTERNAL = process.env.BACKEND_INTERNAL_URL || "http://127.0.0.1:3000";

/* ---------------------
   Helper: proxy a Buffer to STT service
   Returns parsed JSON from STT: { text, segments, model, device }
   --------------------- */
export async function proxyBufferToSTT(buffer, filename = "user.wav") {
  const form = new FormData();
  form.append("file", buffer, { filename, contentType: "audio/wav" });
  const resp = await fetch(STT_URL, { method: "POST", body: form });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`STT request failed: ${resp.status} ${txt}`);
  }
  const json = await resp.json();
  return json;
}

/* ---------------------
   Helper: call scoring
   This prefers in-process scoringModule.scoreSingleQuestion if available.
   Otherwise it forwards to your existing HTTP scoring endpoint.
   The scoring function expects full context: question_id, question_title, question_text,
   expected_answer and user_response (see your earlier scoreSingleQuestion signature).
   --------------------- */
async function callScoringRoute(interviewId, transcript, state = {}, headers = {}) {
  // OPTION A: In-process scoring module (fast, recommended)
  try {
    // try to import your scoring module; update path as needed
    const scoringModule = await import("../path/to/your/scoring/module.js"); // <-- CHANGE THIS PATH
    if (scoringModule && typeof scoringModule.scoreSingleQuestion === "function") {
      // build parameters for scoreSingleQuestion using state.currentQuestionId and DB lookup
      // You must implement getQuestionById to fetch question text and expected answer
      const questionId = state.currentQuestionId || "";
      // default question fields - replace with DB fetch as needed
      const q = await getQuestionById(questionId); // IMPLEMENT below or replace with your DB call
      const params = {
        question_id: String(questionId || ""),
        question_title: q?.question_title || "",
        question_text: q?.question_text || "",
        expected_answer: q?.answer_text || q?.expected_answer || "",
        user_response: transcript || "",
        DEBUG: false,
      };
      const out = await scoringModule.scoreSingleQuestion(params);
      return out;
    }
  } catch (err) {
    // import failed or scoring module not found: fallback to HTTP below
    // console.warn("in-process scoring not available:", err);
  }

  // OPTION B: HTTP forward to existing scoring endpoint
  // Ensure your scoring endpoint accepts { transcript } and returns scoring + next_utterance_text
  const resp = await fetch(`${BACKEND_INTERNAL}/api/interviews/${interviewId}/save-transcript`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(headers || {}) },
    body: JSON.stringify({ transcript }),
  });
  if (!resp.ok) {
    throw new Error(`Scoring HTTP call failed: ${resp.status} ${await resp.text()}`);
  }
  const json = await resp.json();
  return json;
}

/* ---------------------
   Helper: synthesize text via TTS and save under public/audio, return audioUrl
   --------------------- */
async function synthesizeAndSave(text, interviewId) {
  const resp = await fetch(TTS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!resp.ok) {
    throw new Error(`TTS synth failed: ${resp.status} ${await resp.text()}`);
  }
  const arrayBuffer = await resp.arrayBuffer();
  const buf = Buffer.from(arrayBuffer);
  const audioDir = path.join(process.cwd(), "public", "audio");
  await fs.mkdir(audioDir, { recursive: true });
  const audioId = `audio_${interviewId}_${Date.now()}.wav`;
  const audioPath = path.join(audioDir, audioId);
  await fs.writeFile(audioPath, buf);
  return { audioUrl: `/audio/${audioId}`, audioPath };
}

/* ---------------------
   Stub: getQuestionById - you MUST replace this with real DB access
   Example: import Question model and do Question.findOne({ question_id: id })
   Here we return a minimal object for scoring routine compatibility.
   --------------------- */
async function getQuestionById(questionId) {
  if (!questionId) return { question_title: "", question_text: "", answer_text: "" };
  // TODO: replace the below with your DB query
  return { question_id: questionId, question_title: `Title ${questionId}`, question_text: `Question text for ${questionId}`, answer_text: `Expected answer for ${questionId}` };
}

/* ---------------------
   Main: handle user audio buffer: STT -> scoring -> decide next -> TTS -> return result
   buffer: Buffer containing audio bytes (wav/webm etc)
   headers: optional headers (for forwarding auth)
   --------------------- */
export async function handleUserAudioBuffer(interviewId, buffer, headers = {}) {
  // 1) STT
  const sttRes = await proxyBufferToSTT(buffer, `user_${Date.now()}.wav`);
  const transcript = sttRes?.text ?? "";

  // 2) Update state (append)
  const state = conversationManager.getState(interviewId) || {};

  // 3) Call scoring
  const scoring = await callScoringRoute(interviewId, transcript, state, headers);

  // 4) Update conversation manager and decide next
  const cmResult = conversationManager.handleTranscript(interviewId, transcript, scoring, { headers });

  // 5) If cmResult asks to speak next, synthesize text and return audioUrl
  let audioUrl = null;
  if (cmResult && cmResult.nextText) {
    try {
      const tts = await synthesizeAndSave(cmResult.nextText, interviewId);
      audioUrl = tts.audioUrl;
    } catch (e) {
      console.warn("TTS failed while handling audio:", e);
    }
  }

  return { transcript, scoring, nextText: cmResult?.nextText ?? null, audioUrl };
}

export default { handleUserAudioBuffer, proxyBufferToSTT, synthesizeAndSave };
