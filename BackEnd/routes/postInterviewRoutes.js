import express from "express";
import fs from "fs/promises";
import path from "path";
import bodyparser from "body-parser";
import Question from "../models/Question.js";
import Parameter from "../models/Parameter.js";
import Interview from "../models/Interview.js";
import { selectQuestions } from "../lib/selectQuestions.js";

const router = express.Router()
router.use(bodyparser.json());

router.post('/save-question', async (req, res) => {
    try {
        const { parameters, metadata } = req.body; // ElevenLabs payload: parameters from tool, metadata from widget
        const interviewId = metadata?.interviewId;
        const { question_id, transcript } = parameters;

        if (!interviewId || !question_id || !transcript) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        
    } catch (err) {
        console.error('Save question error:', err);
        res.status(500).json({ error: 'Internal error' });
    }
});