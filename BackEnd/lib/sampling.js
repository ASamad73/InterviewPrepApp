
export const DIFFICULTY_DISTRIBUTION = {
  associate: [0.60, 0.30, 0.08, 0.02, 0.00],
  junior:    [0.40, 0.35, 0.20, 0.04, 0.01],
  mid:       [0.20, 0.35, 0.30, 0.12, 0.03],
  senior:    [0.10, 0.20, 0.35, 0.25, 0.10],
  lead:      [0.05, 0.10, 0.25, 0.35, 0.25]
};

export function buildSamplingPlan(jobLevel, totalQuestions) {
  const dist = DIFFICULTY_DISTRIBUTION[jobLevel];

  if (!dist) {
    throw new Error(`Unknown jobLevel "${jobLevel}"`);
  }

  // Step 1: raw expected counts
  const raw = dist.map(p => p * totalQuestions);

  // Step 2: floor them
  const counts = raw.map(v => Math.floor(v));
  let assigned = counts.reduce((a, b) => a + b, 0);

  // Step 3: distribute remainder via largest fractional parts
  let remaining = totalQuestions - assigned;
  if (remaining > 0) {
    const fractions = raw
      .map((v, i) => ({ idx: i, frac: v - Math.floor(v) }))
      .sort((a, b) => b.frac - a.frac);

    for (let i = 0; i < remaining; i++) {
      counts[fractions[i].idx]++;
    }
  }

  // Step 4: build plan array
  const plan = [];
  for (let i = 0; i < counts.length; i++) {
    const difficulty = i + 1;
    for (let j = 0; j < counts[i]; j++) {
      plan.push(difficulty);
    }
  }

  // Step 5: shuffle plan (Fisher–Yates)
  shuffleInPlace(plan);

  return plan;
}

export function bucketByDifficulty(questions) {
  const buckets = { 1: [], 2: [], 3: [], 4: [], 5: [] };

  for (const q of questions) {
    const lvl = Number(q.difficulty_score);
    if (lvl >= 1 && lvl <= 5) {
      buckets[lvl].push(q);
    }
  }

  return buckets;
}

export function popRandomFromBucket(buckets, difficulty) {
  const arr = buckets[difficulty];
  if (!arr || arr.length === 0) {
    return { question: null, buckets };
  }

  const idx = Math.floor(Math.random() * arr.length);
  const question = arr[idx];

  // remove immutably
  buckets[difficulty] = [
    ...arr.slice(0, idx),
    ...arr.slice(idx + 1)
  ];

  return { question, buckets };
}

export function findNearestAvailableDifficulty(buckets, targetDifficulty) {
  for (let offset = 0; offset <= 4; offset++) {
    const lower = targetDifficulty - offset;
    const upper = targetDifficulty + offset;

    if (buckets[lower]?.length) return lower;
    if (buckets[upper]?.length) return upper;
  }
  return null;
}

function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
