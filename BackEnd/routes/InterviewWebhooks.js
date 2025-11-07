// // routes/interviewWebhook.js
// import express from 'express';
// import Interview from './models/Interview' // existing schema
// // Optional: verify webhook signature using process.env.CONVAI_WEBHOOK_SECRET

// // Generic webhook endpoint Convai -> POST JSON
// // Example expected body:
// // {
// //   interviewId: "690cb143f37af548c7c2447e",
// //   question_id: 12345,
// //   transcript: "Candidate's reply...",
// //   speaker: "candidate",
// //   metadata: { ... } 
// // }
// const router = express.Router();

// router.post('/webhook', async (req, res) => {
//   try {
//     // optional signature checking:
//     // const sig = req.headers['x-convai-signature']; // adjust to provider header
//     // verifySignature(req.rawBody || JSON.stringify(req.body), sig, process.env.CONVAI_WEBHOOK_SECRET)

//     const { interviewId, question_id, transcript, speaker, metadata } = req.body || {};
//     if (!interviewId || !question_id || typeof transcript !== 'string') {
//       return res.status(400).json({ ok: false, message: 'interviewId, question_id and transcript required' });
//     }

//     const interview = await Interview.findById(interviewId);
//     if (!interview) return res.status(404).json({ ok: false, message: 'Interview not found' });

//     // add answer object
//     const answerObj = {
//       question_id,
//       question_title: '', // optional: try to fetch question document if needed
//       question_text: '',
//       transcript,
//       createdAt: new Date()
//     };

//     interview.answers.push(answerObj);
//     // advance pointer if interview.currentIndex corresponds to this question
//     interview.currentIndex = (interview.currentIndex || 0) + 1;
//     if (interview.currentIndex >= (interview.selectedQuestions?.length || 0)) {
//       interview.status = 'completed';
//     } else {
//       interview.status = 'in-progress';
//     }

//     await interview.save();

//     // Reply quickly
//     return res.json({ ok: true, message: 'Saved', interviewId: interview._id });
//   } catch (err) {
//     console.error('webhook save error', err);
//     return res.status(500).json({ ok: false, error: String(err) });
//   }
// });

// // Legacy / client POST method: accepts question_id + transcript JSON
// router.post('/:id/submit-answer', async (req, res) => {
//   try {
//     const interview = await Interview.findById(req.params.id);
//     if (!interview) return res.status(404).json({ ok: false, message: 'Interview not found' });

//     const { question_id, transcript } = req.body || {};
//     if (!question_id || typeof transcript !== 'string') {
//       return res.status(400).json({ ok: false, message: 'question_id and transcript required' });
//     }

//     // optional: enrich with question details
//     const qIndex = interview.selectedQuestions?.indexOf(question_id) ?? -1;
//     const questionTitle = ''; // optionally fetch from Question model

//     const answerObj = {
//       question_id,
//       question_title: questionTitle,
//       question_text: '',
//       transcript,
//       createdAt: new Date()
//     };

//     interview.answers.push(answerObj);
//     interview.currentIndex = (interview.currentIndex || 0) + 1;
//     if (interview.currentIndex >= (interview.selectedQuestions?.length || 0)) {
//       interview.status = 'completed';
//     } else {
//       interview.status = 'in-progress';
//     }

//     await interview.save();

//     // Return next question (optional)
//     const nextIdx = interview.currentIndex;
//     if (nextIdx >= (interview.selectedQuestions?.length || 0)) {
//       return res.json({ ok: true, finished: true });
//     }
//     const nextQid = interview.selectedQuestions[nextIdx];
//     // If you want to return the question document: require Question model and findOne
//     // const nextQuestion = await Question.findOne({ question_id: nextQid }).lean();
//     return res.json({ ok: true, finished: false, nextQuestionId: nextQid });
//   } catch (err) {
//     console.error('submit-answer error', err);
//     return res.status(500).json({ ok: false, error: String(err) });
//   }
// });

// module.exports = router;
