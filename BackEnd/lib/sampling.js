import Interview from "../models/Interview";

export const DIFFICULTY_DISTRIBUTION = {
  associate: [0.60, 0.30, 0.08, 0.02, 0.00],
  junior:    [0.40, 0.35, 0.20, 0.04, 0.01],
  mid:       [0.20, 0.35, 0.30, 0.12, 0.03],
  senior:    [0.10, 0.20, 0.35, 0.25, 0.10],
  lead:      [0.05, 0.10, 0.25, 0.35, 0.25]
};

function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

// Build plan as before (array of difficulty numbers, length === totalQuestions)
export function buildSamplingPlan(jobLevel, totalQuestions) {
  const dist = DIFFICULTY_DISTRIBUTION[jobLevel];
  if (!dist) throw new Error(`Unknown jobLevel "${jobLevel}"`);

  const raw = dist.map(p => p * totalQuestions);
  const counts = raw.map(v => Math.floor(v));
  let assigned = counts.reduce((a, b) => a + b, 0);

  let remaining = totalQuestions - assigned;
  if (remaining > 0) {
    const fractions = raw
      .map((v, i) => ({ idx: i, frac: v - Math.floor(v) }))
      .sort((a, b) => b.frac - a.frac);

    for (let i = 0; i < remaining; i++) {
      counts[fractions[i % fractions.length].idx]++;
    }
  }

  const plan = [];
  for (let i = 0; i < counts.length; i++) {
    const difficulty = i + 1;
    for (let j = 0; j < counts[i]; j++) plan.push(difficulty);
  }

  shuffleInPlace(plan);
  // Ensure exact length
  return plan.slice(0, totalQuestions);
}

// Buckets keyed by number (1..5), each value is an array of question objects
export function bucketByDifficulty(questions = []) {
  const buckets = { 1: [], 2: [], 3: [], 4: [], 5: [] };
  for (const q of questions) {
    const lvl = Number(q.difficulty_score ?? q.difficulty ?? q.difficulty_int ?? 0);
    const key = (lvl >= 1 && lvl <= 5) ? lvl : null;
    if (key) buckets[key].push(q);
    else {
      // fallback: put into difficulty 3 if missing or invalid
      buckets[3].push(q);
    }
  }
  return buckets;
}

// Find nearest available difficulty with items (searching outward)
export function findNearestAvailableDifficulty(buckets, desired) {
  desired = Number(desired);
  if (!buckets) return null;
  if (buckets[String(desired)]?.length) return desired;
  for (let offset = 1; offset <= 4; offset++) {
    const up = desired + offset;
    const down = desired - offset;
    if (up <= 5 && buckets[String(up)]?.length) return up;
    if (down >= 1 && buckets[String(down)]?.length) return down;
  }
  // If nothing available, return null
  return null;
}

// Pop a random question for the given difficulty; if empty, fall back to nearest non-empty (returns usedDifficulty too)
export function popRandomFromBucket(buckets, difficulty) {
  let used = Number(difficulty);
  if (!buckets[String(used)] || buckets[String(used)].length === 0) {
    const nearest = findNearestAvailableDifficulty(buckets, used);
    if (!nearest) return { question: null, buckets, usedDifficulty: null };
    used = nearest;
  }

  const arr = buckets[String(used)];
  const idx = Math.floor(Math.random() * arr.length);
  const question = arr[idx];

  // remove in place (mutates buckets) — this is fine for sampling lifecycle
  arr.splice(idx, 1);
  buckets[String(used)] = arr;
  return { question, buckets, usedDifficulty: used };
}

/**
 * Prepare buckets and a plan that is guaranteed to be feasible:
 * - buckets: grouped by difficulty (1..5)
 * - plan: array of difficulty numbers, each mapped to an available difficulty (nearest fallback applied)
 *
 * Returns: { buckets, plan }
 */
export function prepareSamplingPlanAndBuckets(questions, jobLevel, totalQuestions) {
  const buckets = bucketByDifficulty(questions || []);
  let rawPlan = buildSamplingPlan(jobLevel, totalQuestions);

  // Map rawPlan to available difficulties (nearest fallback). If no available bucket at all,
  // collapse plan to empty.
  const adjustedPlan = [];
  for (const desired of rawPlan) {
    const avail = findNearestAvailableDifficulty(buckets, desired);
    if (avail !== null) {
      adjustedPlan.push(avail);
      // **Do not remove the question yet** — removal happens during actual sampling
    } else {
      // no available questions at all — break early
      break;
    }
  }

  // If adjustedPlan is shorter than requested, fill with any available difficulties
  if (adjustedPlan.length < totalQuestions) {
    const allAvailable = [];
    for (let d = 1; d <= 5; d++) {
      for (let i = 0; i < (buckets[String(d)] || []).length; i++) {
        allAvailable.push(d);
      }
    }
    // append until we reach requested length or exhaust
    for (let i = 0; adjustedPlan.length < totalQuestions && i < allAvailable.length; i++) {
      adjustedPlan.push(allAvailable[i]);
    }
  }

  // Final trim to exact length
  const plan = adjustedPlan.slice(0, totalQuestions);
  return { buckets, plan };
}

/**
 * Given buckets and a plan (array of desired difficulties), sample questions in order,
 * applying fallback when a bucket becomes empty during consumption.
 * Returns { selectedQuestions: Question[], remainingBuckets }
 */
export function sampleQuestionsFromPlan(buckets, plan) {
  const selected = [];
  const working = { ...buckets }; // shallow copy of bucket references

  for (const desired of plan) {
    const { question, buckets: newBuckets, usedDifficulty } = popRandomFromBucket(working, desired);
    if (!question) break; // no more available questions
    selected.push({ ...question, sampled_difficulty: usedDifficulty });
    // working already mutated by popRandomFromBucket, but reassign to be safe
    for (let d = 1; d <= 5; d++) working[d] = newBuckets[d] || [];
  }

  return { selectedQuestions: selected, remainingBuckets: working };
}

export async function selectNextQuestion(interviewId, prevQid, scoringResult = {}) {
  const interview = await Interview.findOne({ interviewId });
  if (!interview) throw new Error('Interview not found: ' + interviewId);

  // ---- defaults / guards ----
  interview.samplingPlan = interview.samplingPlan || [];
  interview.buckets = interview.buckets || { 1: [], 2: [], 3: [], 4: [], 5: [] };
  interview.extras = interview.extras || [];
  interview.currentPlanIndex =
    Number.isFinite(interview.currentPlanIndex) ? interview.currentPlanIndex : 0;

  if (interview.currentPlanIndex >= interview.samplingPlan.length) {
    interview.status = "finalized";
    return { action: "end" };
  }
  
  const plan = interview.samplingPlan;
  const idx = interview.currentPlanIndex;
  const currentTarget = plan[idx] ?? 3;

  // ---- normalize scoring ----
  const score01 = Number(scoringResult.score ?? scoringResult.score01 ?? 0);
  const category =
    scoringResult.category ??
    (score01 < 0.3
      ? 'very_low'
      : score01 < 0.6
      ? 'borderline'
      : score01 < 0.8
      ? 'acceptable'
      : 'strong');

  let result = null;

  // ============================================================
  // CASE 1: VERY LOW → step down, DO NOT consume plan
  // ============================================================
  if (category === 'very_low') {
    const desired = Math.max(1, currentTarget - 1);
    const fallback = findNearestAvailableDifficulty(interview.buckets, desired);

    if (fallback !== null) {
      const { question } = popRandomFromBucket(interview.buckets, fallback);
      if (question) {
        await interview.save();
        return { action: 'ask', question };
      }
    }

    // nothing left → end
    interview.status = 'finalized';
    await interview.save();
    return { action: 'end' };
  }

  // ============================================================
  // CASE 2: BORDERLINE → follow-up, DO NOT consume plan
  // ============================================================
  if (category === 'borderline') {
    interview.pendingFollowup = interview.pendingFollowup || {};
    interview.pendingFollowup.question_id = String(prevQid);
    interview.pendingFollowup.attempts =
      (interview.pendingFollowup.attempts || 0) + 1;

    await interview.save();

    return {
      action: 'followup',
      question_id: String(prevQid),
      prompt:
        'Could you clarify or expand on your previous answer? Please explain your reasoning step by step.'
    };
  }

  // ============================================================
  // CASE 3: ACCEPTABLE / STRONG → consume plan
  // ============================================================
  let desiredDifficulty = currentTarget;

  if (category === 'strong') {
    desiredDifficulty = Math.min(5, currentTarget + 1);
  }

  const chosenDifficulty =
    findNearestAvailableDifficulty(interview.buckets, desiredDifficulty) ??
    findNearestAvailableDifficulty(interview.buckets, currentTarget);

  if (chosenDifficulty !== null) {
    const { question } = popRandomFromBucket(
      interview.buckets,
      chosenDifficulty
    );

    if (question) {
      interview.currentPlanIndex += 1;
      await interview.save();
      return { action: 'ask', question };
    }
  }

  // ============================================================
  // FALLBACK: extras
  // ============================================================
  if (interview.extras.length) {
    const q = interview.extras.shift();
    interview.currentPlanIndex += 1;
    await interview.save();
    return { action: 'ask', question: q };
  }

  // ============================================================
  // FINAL: nothing left
  // ============================================================
  interview.status = 'finalized';
  await interview.save();
  return { action: 'end' };
}
