// server/models/Transcript.js
import mongoose from 'mongoose';
const { Schema } = mongoose;

const UtteranceSchema = new Schema({
  role: { type: String, enum: ['agent','user','system'], required: true },
  text: { type: String, required: true },
  timestamp: { type: Date, default: () => new Date() },
  meta: { type: Schema.Types.Mixed, default: {} } // vendor-specific metadata (confidence, etc.)
}, { _id: false });

const PerQuestionSchema = new Schema({
  question_id: { type: String, required: true, index: true }, // store as string
  combined_text: { type: String, default: '' },                // merged user utterances for scoring later
  savedAt: { type: Date, default: () => new Date() },
  rawUtterances: { type: [UtteranceSchema], default: [] }      // user utterances that contributed
}, { _id: false });

const TranscriptSchema = new Schema({
  interviewId: { type: String, required: true, index: true },
  fullTranscript: { type: [UtteranceSchema], default: [] },     // ordered agent/user messages
  perQuestion: { type: [PerQuestionSchema], default: [] },      // aggregated per-question user responses
  providerPayload: { type: Schema.Types.Mixed, default: {} },   // raw webhook payload (debug)
  status: { type: String, enum: ['in-progress','finalized','archived'], default: 'in-progress' },
}, { timestamps: true });

TranscriptSchema.index({ interviewId: 1 });

export default mongoose.model('Transcript', TranscriptSchema);
