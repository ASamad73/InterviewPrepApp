const sessions = new Map();

/**
 * Start a new conversation session
 * @param {string} interviewId
 * @param {object} opts optional initial data {initialQuestionId, samplingPlan, user, extras}
 */
function startConversation(interviewId, opts = {}) {
  const state = {
    interviewId,
    stage: "greeting", 
    currentQuestionId: opts.currentQuestionId || "",
    samplingPlan: opts.samplingPlan || null, // optional: array of ids or plan object
    currentPlanIndex: 0,
    askedCount: 0,
    history: [], // { role: 'agent'|'user', text, ts }
    meta: opts.extras || {},
    createdAt: Date.now(),
  };
  sessions.set(interviewId, state);
  return state;
}

function getState(interviewId) {
  return sessions.get(interviewId) || null;
}

function setStage(interviewId, stage) {
  const st = sessions.get(interviewId);
  if (!st) return null;
  st.stage = stage;
  return st;
}
// /* --------------------------
//    Called by server when client reports playback finished.
//    Updates state to listening and returns a small action descriptor.
//    -------------------------- */
// export function handlePlayed(interviewId) {
//   const st = sessions.get(interviewId);
//   if (!st) return { ok: false, reason: "no session" };

//   // If we were awaiting playback, now we start listening / recording.
//   // If stage == permission we will expect a yes/no short response => use 'listen_permission'
//   if (st.stage === "permission") {
//     st.stage = "listening_permission";
//     return { ok: true, action: "start_record_permission" };
//   }

//   // If we just played a question, set stage to listening
//   if (st.stage === "awaiting_playback" || st.stage === "ask_question") {
//     st.stage = "listening";
//     return { ok: true, action: "start_record" };
//   }

//   // generic fallback
//   st.stage = "listening";
//   return { ok: true, action: "start_record" };
// }

// /* --------------------------
//    Called after STT + scoring to update state and decide what to speak next.
//    scoring: scoring object returned by your scoring pipeline (could be lexical fallback)
//    options: { transcript, headers } optional
//    Returns: { nextText, audioAction, newStage, scoring, transcript }
//    audioAction: 'speak_next_question' | 'ask_permission' | 'end'
//    -------------------------- */
// export function handleTranscript(interviewId, transcript, scoring = null, options = {}) {
//   const st = sessions.get(interviewId);
//   if (!st) return { ok: false, reason: "no session" };

//   // append user answer to history
//   appendHistory(interviewId, { role: "user", text: transcript });

//   // If we were listening for permission (short yes/no)
//   if (st.stage === "listening_permission" || st.stage === "permission") {
//     const affirmative = isAffirmative(transcript);
//     if (affirmative) {
//       // move to asking first question
//       st.stage = "ask_question";
//       // pick next question id (from samplingPlan or increment)
//       const nextQid = getNextQuestionId(st);
//       st.currentQuestionId = nextQid;
//       st.askedCount += 1;
//       const qText = getQuestionTextSync(nextQid); // sync helper; replace with async DB if needed
//       appendHistory(interviewId, { role: "agent", text: qText });
//       return { ok: true, audioAction: "speak_next_question", nextText: qText, newStage: st.stage, scoring, transcript };
//     } else {
//       st.stage = "done";
//       return { ok: true, audioAction: "end", nextText: "Okay — we can continue later.", newStage: st.stage, scoring, transcript };
//     }
//   }

//   // If we were listening to an answer to a question: scoring provided
//   if (st.stage === "listening" || st.stage === "scoring") {
//     // scoring should include decision for next question; if not, derive it
//     const nextText = decideNextUtteranceText(interviewId, scoring);
//     if (!nextText) {
//       st.stage = "done";
//       return { ok: true, audioAction: "end", nextText: "Thank you — interview complete.", newStage: st.stage, scoring, transcript };
//     } else {
//       // update state: next question assigned (if applicable)
//       const nextQid = getNextQuestionId(st);
//       if (nextQid) {
//         st.currentQuestionId = nextQid;
//         st.askedCount += 1;
//       }
//       st.stage = "awaiting_playback";
//       appendHistory(interviewId, { role: "agent", text: nextText });
//       return { ok: true, audioAction: "speak_next_question", nextText, newStage: st.stage, scoring, transcript };
//     }
//   }

//   // default: ask permission
//   st.stage = "permission";
//   return { ok: true, audioAction: "ask_permission", nextText: "May I ask you a question?", newStage: st.stage, scoring, transcript };
// }

// /* --------------------------
//    Decide what to speak next using scoring + session state.
//    If scoring contains explicit 'next_utterance_text', we prefer that.
//    Otherwise pick next question text via sampling plan.
//    -------------------------- */
// export function decideNextUtteranceText(interviewId, scoring = null) {
//   const st = sessions.get(interviewId);
//   if (!st) return null;

//   if (scoring && scoring.next_utterance_text) {
//     return scoring.next_utterance_text;
//   }

//   // Example fallback heuristic: ask next question from samplingPlan or return null if finished
//   const nextQid = getNextQuestionId(st);
//   if (!nextQid) return null;

//   return getQuestionTextSync(nextQid); // synchronous helper; replace if DB async
// }

// /* --------------------------
//    Simple yes/no detector for permission answers
//    -------------------------- */
// function isAffirmative(text) {
//   if (!text) return false;
//   const t = text.toLowerCase();
//   return /\b(yes|yeah|yep|sure|ok|please|go ahead|i am ready|ready|let's|lets)\b/.test(t);
// }

// /* --------------------------
//    Helpers: question selection / retrieval
//    NOTE: Replace these with actual DB access. They are sync stubs for clarity.
//    -------------------------- */
// function getQuestionTextSync(questionId) {
//   if (!questionId) return null;
//   // TODO: Replace this with a DB call to fetch question text for questionId
//   // Example: const q = await QuestionModel.findOne({ question_id: questionId })
//   // return q.question_text
//   // For now a placeholder:
//   return `Question placeholder text for ${questionId}`;
// }

// function getNextQuestionId(state) {
//   // If a samplingPlan array is present, use it; else increment numeric ids or return null
//   const plan = state.samplingPlan;
//   if (Array.isArray(plan) && plan.length > state.currentPlanIndex) {
//     const qid = plan[state.currentPlanIndex];
//     state.currentPlanIndex += 1;
//     return qid;
//   }

//   // If no plan, but currentQuestionId is present and you have question pool, implement policy here
//   // For now, return null to signal done
//   return null;
// }

// /* --------------------------
//    Export named functions
//    -------------------------- */

const conversationManager = {
  startConversation,
  getState,
  setStage,
}

export default conversationManager;


// export default {
//   startConversation,
//   getState,
//   setStage,
  // appendHistory,
  // handlePlayed,
  // handleTranscript,
  // decideNextUtteranceText,
  // // the following helpers are available for advanced usage:
  // getNextQuestionId,
  // getQuestionTextSync,
// };
