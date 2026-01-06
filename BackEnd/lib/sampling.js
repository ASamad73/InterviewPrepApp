
// export const DIFFICULTY_DISTRIBUTION = {
//   associate: [0.60, 0.30, 0.08, 0.02, 0.00],
//   junior:    [0.40, 0.35, 0.20, 0.04, 0.01],
//   mid:       [0.20, 0.35, 0.30, 0.12, 0.03],
//   senior:    [0.10, 0.20, 0.35, 0.25, 0.10],
//   lead:      [0.05, 0.10, 0.25, 0.35, 0.25]
// };

// export function buildSamplingPlan(jobLevel, totalQuestions) {
//   const dist = DIFFICULTY_DISTRIBUTION[jobLevel];

//   if (!dist) {
//     throw new Error(`Unknown jobLevel "${jobLevel}"`);
//   }

//   // Step 1: raw expected counts
//   const raw = dist.map(p => p * totalQuestions);

//   // Step 2: floor them
//   const counts = raw.map(v => Math.floor(v));
//   let assigned = counts.reduce((a, b) => a + b, 0);

//   // Step 3: distribute remainder via largest fractional parts
//   let remaining = totalQuestions - assigned;
//   if (remaining > 0) {
//     const fractions = raw
//       .map((v, i) => ({ idx: i, frac: v - Math.floor(v) }))
//       .sort((a, b) => b.frac - a.frac);

//     for (let i = 0; i < remaining; i++) {
//       counts[fractions[i].idx]++;
//     }
//   }

//   // Step 4: build plan array
//   const plan = [];
//   for (let i = 0; i < counts.length; i++) {
//     const difficulty = i + 1;
//     for (let j = 0; j < counts[i]; j++) {
//       plan.push(difficulty);
//     }
//   }

//   // Step 5: shuffle plan (Fisher–Yates)
//   shuffleInPlace(plan);

//   return plan;
// }

// export function bucketByDifficulty(questions) {
//   const buckets = { 1: [], 2: [], 3: [], 4: [], 5: [] };

//   for (const q of questions) {
//     const lvl = Number(q.difficulty_score);
//     if (lvl >= 1 && lvl <= 5) {
//       buckets[lvl].push(q);
//     }
//   }

//   return buckets;
// }

// export function popRandomFromBucket(buckets, difficulty) {
//   const arr = buckets[difficulty];
//   if (!arr || arr.length === 0) {
//     return { question: null, buckets };
//   }

//   const idx = Math.floor(Math.random() * arr.length);
//   const question = arr[idx];

//   // remove immutably
//   buckets[difficulty] = [
//     ...arr.slice(0, idx),
//     ...arr.slice(idx + 1)
//   ];

//   return { question, buckets };
// }

// export function findNearestAvailableDifficulty(buckets, targetDifficulty) {
//   for (let offset = 0; offset <= 4; offset++) {
//     const lower = targetDifficulty - offset;
//     const upper = targetDifficulty + offset;

//     if (buckets[lower]?.length) return lower;
//     if (buckets[upper]?.length) return upper;
//   }
//   return null;
// }

// function shuffleInPlace(arr) {
//   for (let i = arr.length - 1; i > 0; i--) {
//     const j = Math.floor(Math.random() * (i + 1));
//     [arr[i], arr[j]] = [arr[j], arr[i]];
//   }
// }
// lib/sampling.js
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
