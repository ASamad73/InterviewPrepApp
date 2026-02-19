import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import os from "os";
import fetch from "node-fetch";
import ffmpegPath from "ffmpeg-static";
import ffmpeg from "fluent-ffmpeg";
import Question from "../models/Question.js";
import Transcript from "../models/Transcript.js";
import { scoreSingleQuestion } from "../lib/scoringResponse.js"
import { selectNextQuestion } from "../lib/sampling.js";
import conversationManager from "../lib/conversationManager.js";
import utterances from "../lib/utterences.js";
import FormData from "form-data";
import { config } from "dotenv";

config({ path: "./back.env" });

const router = express.Router();
const upload = multer({ dest: os.tmpdir() });

function convertToWav(srcPath, destPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(srcPath)
      .setFfmpegPath(ffmpegPath)
      .outputOptions(["-ac 1", "-ar 16000", "-f wav", "-acodec pcm_s16le"])
      .save(destPath)
      .on("end", () => resolve(destPath))
      .on("error", (err) => reject(err));
  });
}

async function synthesizeAndSaveAudio(text, interviewId) {
  const ttsUrl = process.env.TTS_URL || "http://127.0.0.1:5000/synthesize";
  const resp = await fetch(ttsUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error("TTS failed: " + txt);
  }
  const arrayBuffer = await resp.arrayBuffer();
  const buf = Buffer.from(arrayBuffer);
  // save under public/audio so frontend can fetch
  const audioId = `audio_${interviewId}_${Date.now()}.wav`;
  const audioDir = path.join(process.cwd(), "public", "audio");
  await fs.mkdir(audioDir, { recursive: true });
  const audioPath = path.join(audioDir, audioId);
  await fs.writeFile(audioPath, buf);
  const audioUrl = `/audio/${audioId}`; // served by static middleware
  return { audioUrl, audioPath };
}

async function ensureTranscriptDoc(interviewId) {
  let t = await Transcript.findOne({ interviewId });
  if (!t) {
    t = new Transcript({ interviewId, status: "in-progress" });
    await t.save();
    return t;
  }
  return t;
}

async function upsertPerQuestion(transcriptDoc, questionId, utterances = []) {
  const qid = String(questionId);
  let entry = transcriptDoc.perQuestion.find(p => String(p.question_id) === qid);
  if (!entry) {
    entry = {
      question_id: qid,
      combined_text: "",
      savedAt: new Date(),
      rawUtterances: []
    };
    transcriptDoc.perQuestion.push(entry);
  }

  for (const u of utterances) {
    if (!u.role || u.role === "user") {
      entry.rawUtterances.push({ role: 'user', text: u.text || "", timestamp: u.timestamp || new Date(), meta: u.meta || {} });
    }
  }
  entry.combined_text = entry.rawUtterances.map(r => r.text.trim()).filter(Boolean).join(" ").trim();
  entry.savedAt = new Date();

  transcriptDoc.updatedAt = new Date();
  await transcriptDoc.save();

  return entry;
}

router.post("/:id/start", async (req, res) => {
  // Verify user property, 'play_audio', 
  try {
    console.log("Starting interview with ID:", req.params.id);
    const interviewId = req.params.id;
    const data = req.body; 

    conversationManager.startConversation(interviewId, { data });
    
    const greetText = utterances.greeting();
    const { audioUrl } = await synthesizeAndSaveAudio(greetText, interviewId);

    const io = req.app.locals.io;
    io.to(interviewId).emit("play_audio", { audioUrl });

    conversationManager.setStage(interviewId, "permission");

    return res.json({ ok: true, audioUrl, stage: "permission" });
  } catch (err) {
    console.error("start interview error", err);
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

router.post("/:id/permission", async (req, res) => {
  try {
    const interviewId = req.params.id;

    // const state = conversationManager.getState(interviewId);
    // if (!state || state.stage !== "permission") {
    //   return res.status(200).json({ ok: false, message: `Permission stage already done. Current state is: '${state?.stage}'` });
    // }
    
    const greetText = utterances.permission();
    const { audioUrl } = await synthesizeAndSaveAudio(greetText, interviewId);

    const io = req.app.locals.io;
    io.to(interviewId).emit("play_audio", { audioUrl });

    conversationManager.setStage(interviewId, "question");

    return res.json({ ok: true, audioUrl, stage: "question" });
  } catch (err) {
    console.error("start interview error", err);
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

router.post("/:id/upload-audio", upload.single("file"), async (req, res) => {
  const file = req.file;
  const interviewId = req.params.id;
  if (!file) return res.status(400).json({ error: "missing file" });

  const converted = path.join(os.tmpdir(), `conv_${Date.now()}.wav`);
  try {
    // 1) convert to WAV (16k mono)
    await convertToWav(file.path, converted);

    // 2) call STT (multipart)
    const sttUrl = process.env.STT_URL || "http://127.0.0.1:8000/transcribe";
    const form = new FormData();
    const fileBuf = await fs.readFile(converted);
    form.append("file", fileBuf, { filename: "answer.wav", contentType: "audio/wav" });

    const sttResp = await fetch(sttUrl, { method: "POST", body: form });
    if (!sttResp.ok) {
      const txt = await sttResp.text();
      throw new Error(`STT failed: ${sttResp.status} ${txt}`);
    }
    const sttJson = await sttResp.json();
    const transcript = (sttJson.text || "").trim();

    // 3) Determine current question id from session state
    const state = conversationManager.getState(interviewId);
    const currentQuestionId = state?.currentQuestionId || null;

    const tdoc = await ensureTranscriptDoc(interviewId);
    if (!tdoc) {
      console.error('ensureTranscriptDoc returned null/undefined for interviewId:', interviewId);
      return res.status(500).json({ ok: false, message: 'Failed to create or load transcript doc' });
    }

    const perQ = await upsertPerQuestion(tdoc, currentQuestionId, [
      { role: 'user', text: transcript, timestamp: new Date() }
    ]);

    // 4) Score the transcript:
    let scoringResult = null;
    try {
      if (currentQuestionId) {
        const qDoc = await Question.findOne({ question_id: currentQuestionId }).lean();
        const expectedAnswer = (qDoc && (qDoc.answer_text || '')) || '';
        const qTitle = (qDoc && qDoc.question_title) || '';
        const qText = (qDoc && qDoc.question_text) || '';
        
        scoringResult = await scoreSingleQuestion({
          question_id: currentQuestionId || "",
          question_title: qTitle || "",
          question_text: qText || "",
          expected_answer: expectedAnswer || "",
          user_response: transcript || "",
          DEBUG: false,
        });
      } else{
        console.error("No currentQuestionId in session state for interviewId:", interviewId);
        return res.status(400).json({ ok: false, message: 'No current question context for scoring' });
      }
    } catch (err) {
      throw new Error("Scoring failed: " + (err && (err.message || String(err))));
    }

    const pqEntry = tdoc.perQuestion.find(p => String(p.question_id) === String(currentQuestionId));
    if (pqEntry) {
      pqEntry.score = scoringResult.score; // store the entire scoring object (or pick fields)
      pqEntry.category = scoringResult.category; // store the entire scoring object (or pick fields)
    } else {
      // if not found, append a small record
      tdoc.perQuestion.push({
        question_id: currentQuestionId || "",
        combined_text: perQ.combined_text || transcript,
        savedAt: new Date(),
        rawUtterances: perQ.rawUtterances || [{ role: 'user', text: transcript, timestamp: new Date() }],
        score: scoringResult.score || null,
        category: scoringResult.category || ''
      });
    }

    tdoc.updatedAt = new Date();
    await tdoc.save();

    let nextPick = null;
    try {
      nextPick = await selectNextQuestion(interviewId, currentQuestionId, scoringResult);
      console.log('selectNextQuestion decided:', nextPick?.action);
    } catch (e) {
      console.error('selectNextQuestion error:', e && (e.stack || String(e)));
      nextPick = null;
    }

    console.log("NEXT QUESTION: ", nextPick)

    if(!nextPick || nextPick.action === 'end') {
      conversationManager.setStage(interviewId, "done");
      console.log("No next pick returned")
      return res.status(200).json({
        ok: false,
        done: true,
        nextQuestion: null,
        // nextAction: 'end',
      });
    }

    const nextQuestion = {question_id: String(nextPick.question.question_id || ''), question_text: nextPick.question.question_text || ''};
    state.currentQuestionId = nextQuestion.question_id;
    conversationManager.setStage(interviewId, "awaiting_playback");

    // 6) If there is a nextQuestion and you want to TTS it here, synthesize it and attach audioUrl
    let audioUrl = null;
    if (nextQuestion?.question_text) {
      try {
        const synth = await synthesizeAndSaveAudio(nextQuestion.question_text, interviewId);
        audioUrl = synth.audioUrl;
      } catch (ttsErr) {
        console.warn("TTS of nextQuestion failed:", ttsErr && String(ttsErr));
      }
    } 

    if(!audioUrl) {
      console.log("No audioUrl generated for next question");
      return res.status(200).json({
        ok: false,
        nextQuestion,
        audioUrl: null,
        message: "next question chosen but audio not available"
      });
    }
    const io = req.app.locals.io;
    io.to(interviewId).emit("play_audio", { audioUrl });

    await fs.unlink(converted).catch(() => {});
    await fs.unlink(file.path).catch(() => {});

    return res.json({
      ok: true,
      nextQuestion: nextQuestion || null,
      audioUrl
      // nextAction: nextPick.action, // e.g. 'speak_next_question' or 'ask_permission' or 'end'
    });
  } catch (err) {
    console.error("upload-audio error", err && (err.stack || String(err)));
    try { await fs.unlink(converted); } catch (e) {}
    try { await fs.unlink(file.path); } catch (e) {}
    return res.status(500).json({ error: String(err) });
  }
});

export default router;
