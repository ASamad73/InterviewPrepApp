import express from "express";
import fs from "fs/promises";
import path from "path";
import { clerkClient } from '@clerk/clerk-sdk-node';
import Question from "../models/Question.js";
import Parameter from "../models/Parameter.js";
import Interview from "../models/Interview.js";
import { selectQuestions } from "../lib/selectQuestions.js";
import PDFDocument from "pdfkit";
import Transcript from "../models/Transcript.js";

// add near other imports
import { prepareSamplingPlanAndBuckets, sampleQuestionsFromPlan } from '../lib/sampling.js';

const router = express.Router()


/// ADDED BY HAIDER!!!!

router.get("/report/:interviewId", async (req, res) => {
  try {
    const { interviewId } = req.params;
    
    console.log("📄 Generating PDF report for interview:", interviewId);
    
    // 1. Fetch interview details
    let interview = await Interview.findOne({ interviewId: interviewId }).lean();
    if (!interview) {
      interview = await Interview.findById(interviewId).lean();
    }
    
    if (!interview) {
      console.log("❌ Interview not found");
      return res.status(404).json({ error: 'Interview not found' });
    }
    
    console.log("✅ Interview found:", interview.title);
    
    // 2. Fetch transcript with scoring
    let transcript = await Transcript.findOne({ interviewId: interviewId }).lean();
    if (!transcript) {
      try {
        transcript = await Transcript.findById(interviewId).lean();
      } catch (e) { }
    }
    
    if (!transcript) {
      console.log("❌ Transcript not found");
      return res.status(404).json({ error: 'Transcript not found' });
    }
    
    console.log("✅ Transcript found, overallScore:", transcript.overallScore);
    
    // 3. Get questions details from interview.answers
    const questionDetails = interview.answers || [];
    
    // 4. Match transcript.perQuestion with questionDetails
    const enhancedQuestions = (transcript.perQuestion || []).map(pq => {
      const questionDetail = questionDetails.find(
        q => String(q.question_id) === String(pq.question_id)
      );
      
      // Extract recommendations from scoring object
      let recommendations = [];
      if (pq.score) {
        // Check multiple possible fields for recommendations
        if (pq.score.areas_for_improvement && Array.isArray(pq.score.areas_for_improvement)) {
          recommendations = pq.score.areas_for_improvement;
        } else if (pq.score.recommendations && Array.isArray(pq.score.recommendations)) {
          recommendations = pq.score.recommendations;
        } else if (pq.score.suggestions && Array.isArray(pq.score.suggestions)) {
          recommendations = pq.score.suggestions;
        } else if (pq.score.missed_points && Array.isArray(pq.score.missed_points)) {
          recommendations = pq.score.missed_points.map(point => `Missing: ${point}`);
        }
      }
      
      return {
        question_id: pq.question_id,
        question_text: questionDetail?.question_text || 'Question not found',
        question_title: questionDetail?.question_title || '',
        expected_answer: questionDetail?.answer_text || '',
        user_response: pq.combined_text || 'No response recorded',
        score: pq.score || {},
        category: pq.category || questionDetail?.category || 'general',
        recommendations: recommendations.length > 0 ? recommendations : ['No recommendations available for this question.']
      };
    });
    
    // 5. Extract overall recommendations if available in transcript
    let overallRecommendations = [];
    if (transcript.overallRecommendations && Array.isArray(transcript.overallRecommendations)) {
      overallRecommendations = transcript.overallRecommendations;
    } else if (transcript.score?.recommendations && Array.isArray(transcript.score.recommendations)) {
      overallRecommendations = transcript.score.recommendations;
    } else if (transcript.perQuestion) {
      // Collect unique recommendations from all questions
      const allRecs = enhancedQuestions.flatMap(q => q.recommendations);
      overallRecommendations = [...new Set(allRecs.filter(rec => rec !== 'No recommendations available for this question.'))];
    }
    
    if (overallRecommendations.length === 0) {
      // Fallback to existing logic if no recommendations in DB
      const overallScore = transcript.overallScore || 0;
      if (overallScore >= 0.8) {
        overallRecommendations = ['Excellent performance! You demonstrated strong technical knowledge and communication skills. Continue building on your strengths.'];
      } else if (overallScore >= 0.6) {
        overallRecommendations = ['Good performance with clear areas for improvement. Focus on enhancing your response structure and technical depth.'];
      } else {
        overallRecommendations = ['Needs improvement. Review fundamental concepts and practice structuring your responses more clearly.'];
      }
    }
    
    // 6. Calculate average question score safely
    const totalScore = enhancedQuestions.reduce((sum, q) => {
      const score = q.score?.overall_score || q.score || 0;
      return sum + (typeof score === 'number' ? score : 0);
    }, 0);
    
    const avgQuestionScore = enhancedQuestions.length > 0 
      ? totalScore / enhancedQuestions.length 
      : 0;
    
    const avgQuestionScorePercent = Math.round(avgQuestionScore * 100) || 0;
    
    // 7. Create PDF with better settings
    const doc = new PDFDocument({ 
      margin: 40,
      size: 'A4',
      layout: 'portrait',
      info: {
        Title: `Interview Report - ${interview.title}`,
        Author: 'Interview Prep App',
        Subject: 'Interview Feedback Report',
        CreationDate: new Date(),
        Keywords: 'interview, feedback, report, performance'
      }
    });
    
    // Set headers for browser display
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Interview_Report_${interviewId}.pdf"`);
    
    doc.pipe(res);
    
    // Helper functions
    function getScoreColor(score) {
      if (!score || typeof score !== 'number') return '#6b7280';
      if (score >= 0.8) return '#10b981'; // emerald
      if (score >= 0.6) return '#f59e0b'; // amber
      return '#ef4444'; // red
    }
    
    function getPerformanceText(score) {
      if (!score || typeof score !== 'number') return 'Needs Improvement';
      if (score >= 0.8) return 'Excellent';
      if (score >= 0.7) return 'Good';
      if (score >= 0.6) return 'Satisfactory';
      return 'Needs Improvement';
    }
    
    // Function to wrap text and calculate box height
    function calculateTextHeight(text, fontSize, maxWidth) {
      const words = text.split(' ');
      let lines = 0;
      let currentLine = '';
      
      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        // Rough estimate: each character is about fontSize * 0.6 pixels wide
        if ((testLine.length * fontSize * 0.6) > maxWidth) {
          lines++;
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) lines++;
      
      // Each line takes about fontSize * 1.2 pixels in height
      return lines * fontSize * 1.2;
    }
    
    // ========== COVER PAGE ==========
    // Header with logo/company name
    doc.rect(0, 0, doc.page.width, 80)
       .fill('#111827'); // Dark gray
    
    doc.fontSize(24).fillColor('#ffffff')
       .text('Interview Prep App', 50, 30)
       .fontSize(14).fillColor('#d1d5db')
       .text('Professional Interview Feedback Report', 50, 60);
    
    // Main title
    doc.moveDown(4);
    doc.fontSize(32).fillColor('#1e40af').text('INTERVIEW', { align: 'center' });
    doc.fontSize(32).fillColor('#1e40af').text('FEEDBACK REPORT', { align: 'center' });
    doc.moveDown(2);
    
    // Interview details box
    const boxY = doc.y;
    doc.rect(50, boxY, 500, 120)
       .fill('#f3f4f6')
       .stroke('#d1d5db');
    
    doc.fontSize(18).fillColor('#111827').text('Interview Details', 70, boxY + 20);
    
    doc.fontSize(12).fillColor('#374151')
       .text(`Candidate: ${interview.title || 'Untitled Interview'}`, 70, boxY + 50)
       .text(`Company: ${interview.company || 'Not specified'}`, 70, boxY + 70)
       .text(`Position: ${interview.role || 'Not specified'}`, 70, boxY + 90);
    
    doc.fontSize(12).fillColor('#374151')
       .text(`Date: ${interview.date ? new Date(interview.date).toLocaleDateString('en-US', { 
         weekday: 'long', 
         year: 'numeric', 
         month: 'long', 
         day: 'numeric' 
       }) : 'Not specified'}`, 300, boxY + 50)
       .text(`Report ID: ${interviewId.substring(0, 8)}`, 300, boxY + 70)
       .text(`Generated: ${new Date().toLocaleDateString()}`, 300, boxY + 90);
    
    doc.moveDown(8);
    
    // Confidential footer
    doc.fontSize(10).fillColor('#6b7280')
       .text('CONFIDENTIAL - For candidate use only', { align: 'center' });
    
    // ========== EXECUTIVE SUMMARY PAGE ==========
    doc.addPage();
    
    // Page header
    doc.fontSize(20).fillColor('#111827')
       .text('Executive Summary', 50, 50);
    
    doc.moveTo(50, 80).lineTo(550, 80).stroke('#d1d5db');
    
    doc.moveDown(1.5);
    
    // Performance summary box
    const overallScore = transcript.overallScore || 0; 
    const scorePercent = Math.round(overallScore * 100) || 0; // Fix: Ensure 0 instead of NaN
    const performanceText = getPerformanceText(overallScore);
    
    doc.rect(50, doc.y, 500, 100)
       .fill('#f0f9ff')
       .stroke('#0ea5e9');
    
    doc.fontSize(16).fillColor('#0369a1')
       .text(`Performance Rating: ${performanceText}`, 70, doc.y + 20);
    
    doc.fontSize(14).fillColor('#374151')
       .text(`Overall Performance: ${scorePercent}%`, 70, doc.y + 50);
    
    doc.moveDown(3);
    
    // Key metrics
    doc.fontSize(16).fillColor('#111827')
       .text('Key Metrics', 50, doc.y);
    
    const metrics = [
      { label: 'Total Questions', value: enhancedQuestions.length },
      { label: 'Questions Answered', value: enhancedQuestions.filter(q => q.user_response && q.user_response !== 'No response recorded').length },
      { label: 'Average Question Score', value: `${avgQuestionScorePercent}%` } // Use pre-calculated value
    ];
    
    const metricStartY = doc.y + 20;
    metrics.forEach((metric, index) => {
      const x = 50 + (index * 180);
      doc.rect(x, metricStartY, 150, 60)
         .fill(index % 2 === 0 ? '#f9fafb' : '#ffffff')
         .stroke('#e5e7eb');
      
      doc.fontSize(12).fillColor('#6b7280')
         .text(metric.label, x + 10, metricStartY + 15);
      
      doc.fontSize(18).fillColor('#111827')
         .text(metric.value, x + 10, metricStartY + 35);
    });
    
    doc.y = metricStartY + 80;
    
    // Overall Recommendations from database
    doc.fontSize(16).fillColor('#111827')
       .text('Overall Recommendations', 50, doc.y);
    
    const recommendationHeight = Math.max(100, calculateTextHeight(overallRecommendations.join(' • '), 11, 460) + 40);
    
    doc.rect(50, doc.y + 20, 500, recommendationHeight)
       .fill('#fef3c7')
       .stroke('#f59e0b');
    
    if (overallRecommendations.length > 0) {
      overallRecommendations.forEach((rec, index) => {
        doc.fontSize(11).fillColor('#92400e')
           .text(`• ${rec}`, 70, doc.y + 40 + (index * 20), { width: 460 });
      });
    } else {
      doc.fontSize(11).fillColor('#92400e')
         .text('No overall recommendations available.', 70, doc.y + 40, { width: 460 });
    }
    
    doc.y += recommendationHeight + 20;
    
    // ========== DETAILED ANALYSIS PAGES ==========
    if (enhancedQuestions.length > 0) {
      enhancedQuestions.forEach((q, index) => {
        // Add new page for each question after first 2
        if (index > 0 && index % 2 === 0) {
          doc.addPage();
          doc.y = 50;
        }
        
        // Question header with performance text (no badge/bar)
        const questionScore = q.score?.overall_score || q.score || 0;
        const questionScorePercent = Math.round(questionScore * 100) || 0; // Fix: Ensure 0 instead of NaN
        const questionPerformanceText = getPerformanceText(questionScore);
        
        // Question number and title
        doc.fontSize(14).fillColor('#1e40af')
           .text(`Question ${index + 1}: ${q.question_title || `Question #${index + 1}`}`, 50, doc.y);
        
        // Performance text on the same line
        doc.fontSize(12).fillColor(getScoreColor(questionScore))
           .text(`Performance: ${questionPerformanceText} (${questionScorePercent}%)`, 350, doc.y);
        
        doc.moveTo(50, doc.y + 20).lineTo(550, doc.y + 20).stroke('#d1d5db');
        
        doc.y += 30;
        
        // Calculate dynamic heights for question and response boxes
        const questionTextHeight = Math.max(60, calculateTextHeight(q.question_text, 10, 480) + 30);
        const responseTextHeight = Math.max(80, calculateTextHeight(q.user_response || 'No response provided', 10, 480) + 30);
        
        // Question text box with dynamic height
        doc.rect(50, doc.y, 500, questionTextHeight)
           .fill('#f8fafc')
           .stroke('#e2e8f0');
        
        doc.fontSize(11).fillColor('#334155')
           .text('Question:', 60, doc.y + 10);
        
        doc.fontSize(10).fillColor('#475569')
           .text(q.question_text, 60, doc.y + 25, { 
             width: 480,
             height: questionTextHeight - 35,
             ellipsis: true
           });
        
        doc.y += questionTextHeight + 10;
                
        doc.fontSize(11).fillColor('#166534')
           .text('Your Response:', 60, doc.y + 10);
        
        doc.fontSize(10).fillColor('#15803d')
           .text(q.user_response || 'No response provided', 60, doc.y + 25, { 
             width: 480,
             height: responseTextHeight - 35,
             ellipsis: true
           });
        
        doc.y += responseTextHeight + 15;
        
        // Display recommendations from database
        if (q.recommendations && q.recommendations.length > 0) {
          const recHeight = Math.max(40, calculateTextHeight(q.recommendations.join(' '), 10, 480) + 30);
          
          doc.rect(50, doc.y, 500, recHeight)
             .fill('#fff7ed')
             .stroke('#fb923c');
          
          doc.fontSize(11).fillColor('#c2410c')
             .text('Recommendations for Improvement:', 60, doc.y + 15);
          
          q.recommendations.forEach((rec, recIndex) => {
            doc.fontSize(10).fillColor('#9a3412')
               .text(`• ${rec}`, 60, doc.y + 35 + (recIndex * 15), { width: 470 });
          });
          
          doc.y += recHeight + 15;
        }
        
        // Feedback sections (if still needed alongside recommendations)
        if (q.score?.feedback_points && q.score.feedback_points.length > 0) {
          doc.fontSize(12).fillColor('#059669')
             .text('Strengths:', 50, doc.y);
          
          q.score.feedback_points.forEach((point, i) => {
            if (i < 2) { // Limit to 2 strengths
              doc.fontSize(10).fillColor('#065f46')
                 .text(`✓ ${point}`, 60, doc.y + 15, { width: 470 });
              doc.y += 15;
            }
          });
          doc.y += 10;
        }
        
        // Add separator between questions
        if (index < enhancedQuestions.length - 1) {
          doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke('#e5e7eb');
          doc.moveDown(1);
        }
      });
    } else {
      doc.addPage();
      doc.fontSize(14).fillColor('#6b7280')
         .text('No detailed question analysis available.', { align: 'center', y: 200 });
    }
    
    // ========== FINAL PAGE ==========
    doc.addPage();
    
    // Thank you message
    doc.fontSize(24).fillColor('#1e40af')
       .text('Thank You', { align: 'center', y: 150 });
    
    doc.fontSize(14).fillColor('#4b5563')
       .text('We hope this feedback helps you improve your interview skills.', { align: 'center', y: 200 });
    
    // Contact info
    doc.rect(100, 250, 400, 100)
       .fill('#f9fafb')
       .stroke('#d1d5db');
    
    doc.fontSize(16).fillColor('#111827')
       .text('Need More Help?', 120, 270);
    
    doc.fontSize(11).fillColor('#4b5563')
       .text('• Schedule a mock interview session', 120, 300)
       .text('• Review our interview preparation guide', 120, 320)
       .text('• Contact support: support@interviewprepapp.com', 120, 340);
    
    // Footer
    doc.fontSize(9).fillColor('#9ca3af')
       .text(`Report ID: ${interviewId} | Generated: ${new Date().toISOString()}`, 50, 500, { align: 'center' })
       .text('© Interview Prep App. All rights reserved.', 50, 515, { align: 'center' })
       .text('Page ' + doc.bufferedPageRange().count, 50, 530, { align: 'center' });
    
    // Finalize PDF
    doc.end();
    
    console.log("✅ PDF generated successfully");
    
  } catch (error) {
    console.error('❌ Error generating PDF report:', error);
    res.status(500).json({ error: 'Failed to generate report', details: error.message });
  }
});

router.get('/user/interviews', async (req, res) => {
  try {
    // === AUTH ===
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Unauthorized - No token' });
    }
    const token = authHeader.split('Bearer ')[1].trim();
    const verified = await clerkClient.verifyToken(token);
    const owner = verified.sub;

    console.log('Fetching interviews for user:', owner);

    // Fetch interviews for this user
    const interviews = await Interview.find({ owner })
      .sort({ date: -1 })
      .lean();

    console.log(`Found ${interviews.length} interviews for user ${owner}`);

    return res.json({
      ok: true,
      interviews: interviews.map(interview => ({
        id: interview.interviewId,
        title: interview.parameters?.jobTitle || 'Untitled Interview',
        company: interview.parameters?.company || '',
        date: interview.date,
        status: interview.status
      }))
    });

  } catch (error) {
    console.error('Error fetching user interviews:', error);
    return res.status(500).json({ ok: false, message: 'Server error', error: error.message });
  }
});

// Get user statistics - ONLY TOTAL COUNT
router.get('/user/stats', async (req, res) => {
  try {
    // === AUTH ===
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Unauthorized - No token' });
    }
    const token = authHeader.split('Bearer ')[1].trim();
    const verified = await clerkClient.verifyToken(token);
    const owner = verified.sub;

    // Fetch interviews for this user
    const interviews = await Interview.find({ owner }).lean();

    // ONLY TOTAL COUNT - nothing else
    const stats = {
      total: interviews.length
    };

    return res.json({
      ok: true,
      stats
    });

  } catch (error) {
    console.error('Error fetching user stats:', error);
    return res.status(500).json({ ok: false, message: 'Server error', error: error.message });
  }
});

// router.post('/import-qas', async (req, res) => {
//   try {
//     // Path to paraphrased_qas.json in BackEnd/
//     const filePath = path.join(process.cwd(), 'paraphrased_qas.json');

//     const raw = await fs.readFile(filePath, 'utf8');
//     const items = JSON.parse(raw);

//     if (!Array.isArray(items)) {
//       return res.status(400).json({ message: 'Invalid JSON: expected an array' });
//     }

//     // Prepare upsert operations
//     const ops = items.map((it) => {
//       const filter =
//         it.question_id !== undefined && it.question_id !== null
//           ? { question_id: it.question_id }
//           : { question_text: it.question_text };

//       const update = {
//         $set: {
//           question_id: it.question_id ? String(it.question_id) : null,
//           question_title: it.question_title || "",
//           question_text: it.question_text,
//           answer_text: it.answer_text,
//           tags: it.tags || []
//         },
//         $setOnInsert: { createdAt: new Date() }
//       };

//       return {
//         updateOne: {
//           filter,
//           update,
//           upsert: true
//         }
//       };
//     });

//     if (ops.length === 0) {
//       return res.status(204).json({ message: "No items to import" });
//     }

//     const result = await Question.bulkWrite(ops, { ordered: false });

//     console.log(`Imported QAs: inserted ${result.upsertedCount}, modified ${result.modifiedCount || 0}`);
//     return res.json({
//       ok: true,
//       inserted: result.upsertedCount,
//       modified: result.modifiedCount || 0
//     });

//   } catch (err) {
//     console.error('import-qas error', err);
//     return res.status(500).json({ message: 'server error', error: String(err) });
//   }
// });
router.post('/import-qas', async (req, res) => {
  try {
    const filePath = path.join(process.cwd(), 'combined_2.json');

    const raw = await fs.readFile(filePath, 'utf8');
    const items = JSON.parse(raw);

    if (!Array.isArray(items)) {
      return res.status(400).json({ message: 'Invalid JSON: expected an array' });
    }

    const ops = items.map((it) => {
      const filter =
        it.question_id !== undefined && it.question_id !== null
          ? { question_id: String(it.question_id) }
          : { question_text: it.question_text };

      return {
        updateOne: {
          filter,
          update: {
            $setOnInsert: {
              question_id: it.question_id ? String(it.question_id) : null,
              question_title: it.question_title || "",
              question_text: it.question_text,
              answer_text: it.answer_text,
              tags: it.tags || [],
              rank_value: typeof it.rank_value === 'number' ? it.rank_value : 0,
              createdAt: new Date()
            }
          },
          upsert: true
        }
      };
    });

    if (ops.length === 0) {
      return res.status(204).json({ message: "No items to import" });
    }

    const result = await Question.bulkWrite(ops, { ordered: false });

    console.log(
      `Imported QAs: inserted ${result.upsertedCount}, skipped existing`
    );

    return res.json({
      ok: true,
      inserted: result.upsertedCount
    });

  } catch (err) {
    console.error('import-qas error', err);
    return res.status(500).json({ message: 'server error', error: String(err) });
  }
});



router.get('/extract-qas', async (req, res) => {
  try {
    console.log(`IN extract-qas`)
    const documents = await Question.find({}).sort({ rank_value: -1 }).lean()
    console.log(`extract-qas: found ${documents.length} documents`)
    return res.json(documents)
  } catch (err) {
    console.error('extract-qas error', err)
    return res.status(500).json({ message: 'server error' })
  }
});

router.post('/save-parameters', async (req, res) => {
  try {
    // === AUTH (unchanged - perfect) ===
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Unauthorized - No token' });
    }
    const token = authHeader.split('Bearer ')[1].trim();
    const verified = await clerkClient.verifyToken(token);
    const owner = verified.sub;

    console.log('Authenticated user:', owner);

    
    // === INPUT VALIDATION ===
    const { jobTitle, jobLevel, company, jobDescription } = req.body ?? {};
    if (!jobTitle?.trim() || !jobLevel?.trim() || !company?.trim() || !jobDescription?.trim()) {
      return res.status(400).json({ ok: false, message: 'Missing required fields' });
    }

    // const num_questions = 10;
    const num_questions = 2;
    const questions_pool = num_questions * 3;
    const selectedIds = await selectQuestions(jobTitle, jobLevel, jobDescription, questions_pool);

    const selectedIdsRaw = selectedIds; // may be numbers or strings
    console.log('Selected IDs (raw):', selectedIdsRaw);

    // Build both string and numeric variants for robust matching
    const selectedIdsStr = selectedIdsRaw.map((id) => String(id));
    const selectedIdsNum = selectedIdsRaw
      .map((id) => {
        // convert numeric-looking strings to Number, otherwise NaN
        if (typeof id === 'number') return id;
        if (typeof id === 'string' && id.trim() !== '' && /^\d+$/.test(id.trim())) {
          return Number(id.trim());
        }
        return null;
      })
      .filter((v) => v !== null);

    // Build a $or query trying both types
    const orQueries = [];
    if (selectedIdsNum.length) {
      orQueries.push({ question_id: { $in: selectedIdsNum } });
    }
    if (selectedIdsStr.length) {
      orQueries.push({ question_id: { $in: selectedIdsStr } });
    }
    if (orQueries.length === 0) {
      console.warn('No valid selected IDs to query DB with');
    }

    // Query DB using $or so either numeric or string matches will be found
    let questionDocs = [];
    if (orQueries.length) {
      questionDocs = await Question.find({ $or: orQueries }).lean();
    }
    console.log(`Fetched ${questionDocs.length} questions from DB (robust query)`);

    // Map found IDs for quick check
    // const foundIdsSet = new Set(questionDocs.map((d) => String(d.question_id)));

    // // Detect which selected IDs were not found (as string)
    // const missing = selectedIdsStr.filter((sid) => !foundIdsSet.has(String(sid)));
    // if (missing.length) {
    //   console.warn('selectQuestions: some selected ids were not found in DB. missing count:', missing.length);
    //   console.warn('Missing IDs (string form):', missing.slice(0,50));
    // } else {
    //   console.log('selectQuestions: all selected ids were found in DB (string check).');
    // }

    // Build ordered array (preserving original order of selectedIds)
    const idToDoc = new Map(questionDocs.map((d) => [String(d.question_id), d]));

    const ordered = selectedIdsStr
      .map((qid) => idToDoc.get(qid))
      .filter(Boolean);

    console.log('Ordered questions count:', ordered.length);

    // // If ordered is less than requested, optionally append fallback top-ranked docs
    // if (ordered.length < num_questions) {
    //   const need = num_questions - ordered.length;
    //   // Exclude already included question_id values
    //   const excludeSet = new Set(ordered.map(q => String(q.question_id)));
    //   const fallback = await Question.find({
    //     question_id: { $nin: Array.from(excludeSet) }
    //   }).sort({ rank_value: -1 }).limit(need).lean();

    //   console.log(`selectQuestions: added fallback docs count: ${fallback.length}`);
    //   ordered.push(...fallback);
    // }
    const preFilledAnswers = ordered.map(q => ({
      question_id: q.question_id,                    // Already String
      question_title: q.question_title ?? '',
      question_text: q.question_text ?? '',
      difficulty_score: q.difficulty_score || null,
      answer_text: q.answer_text ?? '',
      createdAt: new Date(),
    }));

    // Save selectedQuestions as String[] — matches schema
    const interviewDoc = new Interview({
      owner,
      parameters: { jobTitle, jobLevel, company, jobDescription },
      selectedQuestions: selectedIdsStr,             // String[]
      answers: preFilledAnswers,
      currentIndex: 0,
      status: 'scheduled',
      date: new Date(),
    });

    await interviewDoc.save();

    return res.status(201).json({
      ok: true,
      message: 'Interview created successfully',
      interviewId: interviewDoc.interviewId,
    });

  } catch (error) {
    console.error('save-parameters error:', error);
    return res.status(500).json({ ok: false, message: 'Server error', error: error.message });
  }
});

router.get('/:id/questions', async (req, res) => {
  try {
    const param = req.params.id;
    console.log(`Fetching questions for interview: ${param}`);

    let interview = await Interview.findOne({ interviewId: param }).lean();
    if (!interview) interview = await Interview.findById(param).lean();
    if (!interview) return res.status(404).json({ ok: false, message: 'Interview not found' });

    console.log('Interview found. selectedQuestions:', interview.selectedQuestions);

    const jobLevel = (interview.parameters?.jobLevel || 'mid').toString().toLowerCase();

    // Query DB for docs referenced in interview.selectedQuestions (or all docs if none)
    const ids = Array.isArray(interview.selectedQuestions) ? interview.selectedQuestions.map(String) : [];
    console.log('Querying DB with String IDs:', ids);

    // If selectedQuestions is empty, fallback to fetching all docs (or return empty)
    let docs;
    if (ids.length === 0) {
      docs = await Question.find({}).sort({ rank_value: -1 }).lean();
    } else {
      docs = await Question.find({ question_id: { $in: ids } }).lean();
    }
    console.log(`Found ${docs.length} question docs`);

    // Minimal view object maker (keeps payload small)
    const makeView = (doc) => ({
      question_id: String(doc.question_id),
      question_title: doc.question_title || '',
      question_text: doc.question_text || '',
      difficulty_score: Number(doc.difficulty_score ?? 3),
    });

    // Decide totalToAsk (ensure integer >=1). Current behavior used docs.length/3; keep that but normalize.
    const totalToAsk = Math.max(1, Math.floor(docs.length / 3));

    // Use sampling helpers to prepare buckets & an adjusted feasible plan
    const { buckets: rawBuckets, plan: samplingPlan } = prepareSamplingPlanAndBuckets(docs, jobLevel, totalToAsk);

    // Convert rawBuckets (full docs) into view buckets (small objects)
    const buckets = { 1: [], 2: [], 3: [], 4: [], 5: [] };
    for (let lvl = 1; lvl <= 5; lvl++) {
      const arr = Array.isArray(rawBuckets[String(lvl)]) ? rawBuckets[String(lvl)] : rawBuckets[lvl] ?? [];
      buckets[lvl] = arr.map(makeView);
    }

    // Compute targetCounts from samplingPlan (counts per difficulty)
    const targetCounts = [0,0,0,0,0]; // index 0->diff1, etc
    for (const d of samplingPlan) {
      if (d >= 1 && d <= 5) targetCounts[d-1] ++;
    }

    // Compute availability summary (how many in each bucket)
    const availability = {};
    for (let lvl = 1; lvl <= 5; lvl++) {
      availability[lvl] = { available: (buckets[lvl] || []).length, target: targetCounts[lvl-1] || 0 };
    }

    // Answers map (lightweight)
    const answersMap = {};
    docs.forEach(q => { answersMap[String(q.question_id)] = q.answer_text ?? ''; });

    // Extras: an ordered fallback list (original order); produce minimal view for fallback usage
    const ordered = docs.map(d => makeView(d)).filter(Boolean);

    console.log('Prepared sampling plan and buckets for interview questions');
    console.log('Bucket: ', buckets);
    console.log('Plan: ', samplingPlan);

    return res.json({
      ok: true,
      totalToAsk,
      jobLevel,
      samplingPlan,          // e.g. [1,2,1,3,3,...] length == totalToAsk
      targetCounts: { 1: targetCounts[0]||0, 2: targetCounts[1]||0, 3: targetCounts[2]||0, 4: targetCounts[3]||0, 5: targetCounts[4]||0 },
      availability,
      buckets,
      extras: ordered,
      answersMap
    });

  } catch (err) {
    console.error('GET /:id/questions error', err);
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

// router.get('/:id/questions', async (req, res) => {
//   try {
//     const param = req.params.id;
//     console.log(`Fetching questions for interview: ${param}`);

//     let interview = await Interview.findOne({ interviewId: param }).lean();
//     if (!interview) {
//       interview = await Interview.findById(param).lean();
//     }
//     if (!interview) {
//       return res.status(404).json({ ok: false, message: 'Interview not found' });
//     }

//     console.log('Interview found. selectedQuestions:', interview.selectedQuestions);

//     const jobLevel = interview.parameters?.jobLevel || 'mid';
    
//     const DIFF_DIST = {
//       'associate': [0.35, 0.40, 0.20, 0.05, 0.00],
//       'junior':    [0.20, 0.35, 0.30, 0.10, 0.05],
//       'mid':       [0.10, 0.20, 0.35, 0.25, 0.10],
//       'senior':    [0.05, 0.10, 0.25, 0.35, 0.25]
//     }
    
//     // selectedQuestions is already String[] — use directly!
//     const ids = (Array.isArray(interview.selectedQuestions) 
//       ? interview.selectedQuestions 
//       : []
//     ).map(id => String(id));

//     console.log('Querying DB with String IDs:', ids);

//     if (ids.length === 0) {
//       return res.json({ ok: true, questions: [], answersMap: {} });
//     }

//     const docs = await Question.find({
//       question_id: { $in: ids }  // All String → perfect match
//     }).lean();

//     console.log(`Found ${docs.length} question docs`);    

//     const idToDoc = new Map(docs.map(d => [d.question_id, d]));

//     const ordered = ids.map(id => {
//       const doc = idToDoc.get(id);
//       if (!doc) return null;
//       return {
//         question_id: doc.question_id,
//         question_title: doc.question_title || '',
//         question_text: doc.question_text || '',
//       };
//     }).filter(Boolean);

//     const answersMap = {};
//     docs.forEach(q => {
//       answersMap[q.question_id] = q.answer_text ?? '';
//     });

//     return res.json({ ok: true, questions: ordered, answersMap });

//   } catch (err) {
//     console.error('GET /:id/questions error', err);
//     return res.status(500).json({ ok: false, error: String(err) });
//   }
// });

// POST /api/interviews/:id/init-sampling
router.post('/:id/init-sampling', async (req, res) => {
  const { samplingPlan, buckets, extras } = req.body;
  await Interview.updateOne({ interviewId: req.params.id }, {
    $set: { samplingPlan, buckets, extras, currentPlanIndex: 0 }
  });
  return res.json({ ok: true });
});



export default router