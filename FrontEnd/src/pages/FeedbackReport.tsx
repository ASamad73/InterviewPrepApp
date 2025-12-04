import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';

type ScoreData = {
  correctness?: number;
  depth?: number;
  communication?: number;
  metrics?: number;
};

type QuestionScore = {
  ok?: boolean;
  fallback?: boolean;
  question_id?: string;
  scores?: ScoreData;
  overall_score?: number;
  missed_points?: string[];
  positive_points?: string[];
  rationale?: string;
};

type PerQuestion = {
  question_id: string;
  combined_text?: string;
  savedAt?: string;
  score?: QuestionScore;
};

type TranscriptData = {
  interviewId: string;
  status: string;
  overallScore?: number;
  perQuestion: PerQuestion[];
  createdAt?: string;
  updatedAt?: string;
};

type TabType = 'overview' | 'questions' | 'suggestions';

export default function FeedbackReport() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isLoaded, isSignedIn, getToken } = useAuth();

  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [transcript, setTranscript] = useState<TranscriptData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const API_URL = import.meta.env.VITE_API_URL || '';

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      navigate('/login');
      return;
    }
    if (!id) {
      setError('Interview ID is missing');
      setLoading(false);
      return;
    }

    fetchTranscript();
  }, [id, isLoaded, isSignedIn]);

  async function fetchTranscript() {
    try {
      setLoading(true);
      setError(null);

      const token = await getToken({ template: 'interview-backend' });
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(`${API_URL}/api/webhooks/transcripts/${id}`, {
        method: 'GET',
        headers,
      });

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.message || `Failed to fetch transcript (${res.status})`);
      }

      if (!body || !body.transcript) {
        throw new Error('No transcript data available');
      }

      setTranscript(body.transcript);
    } catch (err: any) {
      console.error('fetchTranscript error:', err);
      setError(err?.message || 'Failed to load feedback data');
    } finally {
      setLoading(false);
    }
  }

  // Helper functions
  function calculateAverageScores(): ScoreData {
    if (!transcript || !transcript.perQuestion || transcript.perQuestion.length === 0) {
      return { correctness: 0, depth: 0, communication: 0, metrics: 0 };
    }

    const totals = { correctness: 0, depth: 0, communication: 0, metrics: 0 };
    let count = 0;

    transcript.perQuestion.forEach((pq) => {
      if (pq.score?.scores) {
        totals.correctness += pq.score.scores.correctness || 0;
        totals.depth += pq.score.scores.depth || 0;
        totals.communication += pq.score.scores.communication || 0;
        totals.metrics += pq.score.scores.metrics || 0;
        count++;
      }
    });

    if (count === 0) return { correctness: 0, depth: 0, communication: 0, metrics: 0 };

    return {
      correctness: Math.round((totals.correctness / count) * 100) / 100,
      depth: Math.round((totals.depth / count) * 100) / 100,
      communication: Math.round((totals.communication / count) * 100) / 100,
      metrics: Math.round((totals.metrics / count) * 100) / 100,
    };
  }

  function aggregateMissedPoints(): string[] {
    if (!transcript || !transcript.perQuestion) return [];

    const allMissed: string[] = [];
    transcript.perQuestion.forEach((pq) => {
      if (pq.score?.missed_points) {
        allMissed.push(...pq.score.missed_points);
      }
    });

    return allMissed;
  }

  function aggregatePositivePoints(): string[] {
    if (!transcript || !transcript.perQuestion) return [];

    const allPositive: string[] = [];
    transcript.perQuestion.forEach((pq) => {
      if (pq.score?.positive_points) {
        allPositive.push(...pq.score.positive_points);
      }
    });

    return allPositive;
  }

  function formatScore(score?: number): string {
    if (score === undefined || score === null) return 'N/A';
    return score.toFixed(2);
  }

  function getScoreColor(score?: number): string {
    if (!score) return 'text-gray-400';
    if (score >= 4.5) return 'text-emerald-400';
    if (score >= 3.5) return 'text-blue-400';
    if (score >= 2.5) return 'text-yellow-400';
    return 'text-red-400';
  }

  function getScoreBgColor(score?: number): string {
    if (!score) return 'bg-gray-500/10';
    if (score >= 4.5) return 'bg-emerald-500/10';
    if (score >= 3.5) return 'bg-blue-500/10';
    if (score >= 2.5) return 'bg-yellow-500/10';
    return 'bg-red-500/10';
  }

  function prioritizeImprovements(missedPoints: string[]): { point: string; count: number }[] {
    const countMap = new Map<string, number>();
    missedPoints.forEach((point) => {
      const normalized = point.trim().toLowerCase();
      countMap.set(normalized, (countMap.get(normalized) || 0) + 1);
    });

    const sorted = Array.from(countMap.entries())
      .map(([point, count]) => ({ point, count }))
      .sort((a, b) => b.count - a.count);

    return sorted;
  }

  if (!isLoaded || loading) {
    return (
      <main className="min-h-[calc(100vh-4rem)] bg-[#0c0c0c] px-6 py-10">
        <div className="mx-auto max-w-4xl text-center text-gray-300">
          Loading feedback...
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-[calc(100vh-4rem)] bg-[#0c0c0c] px-6 py-10">
        <div className="mx-auto max-w-4xl">
          <div className="rounded-md bg-red-800/60 p-4 text-red-100">
            <p className="font-semibold">Error</p>
            <p className="mt-1 text-sm">{error}</p>
          </div>
          <div className="mt-4">
            <Link to="/dashboard" className="text-emerald-300 hover:text-emerald-200">
              ← Back to Dashboard
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (!transcript) {
    return (
      <main className="min-h-[calc(100vh-4rem)] bg-[#0c0c0c] px-6 py-10">
        <div className="mx-auto max-w-4xl text-center text-gray-300">
          No feedback data available for this interview.
          <div className="mt-4">
            <Link to="/dashboard" className="text-emerald-300 hover:text-emerald-200">
              ← Back to Dashboard
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const averageScores = calculateAverageScores();
  const missedPoints = aggregateMissedPoints();
  const positivePoints = aggregatePositivePoints();
  const prioritizedImprovements = prioritizeImprovements(missedPoints);

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[#0c0c0c] px-6 py-10">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-6">
          <Link to="/dashboard" className="text-sm text-emerald-300 hover:text-emerald-200">
            ← Back to Dashboard
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-white">Interview Feedback Report</h1>
          <p className="mt-1 text-sm text-gray-400">Interview ID: {transcript.interviewId}</p>
        </div>

        {/* Overall Score Card */}
        <div className="mb-6 rounded-lg border border-white/10 bg-[#0e0e0e] p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Overall Score</h2>
              <p className="text-sm text-gray-400">Aggregate performance across all questions</p>
            </div>
            <div
              className={`flex h-24 w-24 items-center justify-center rounded-full ${getScoreBgColor(
                transcript.overallScore
              )}`}
            >
              <span className={`text-3xl font-bold ${getScoreColor(transcript.overallScore)}`}>
                {formatScore(transcript.overallScore)}
              </span>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mb-6 flex gap-2 border-b border-white/10">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 text-sm font-medium transition ${
              activeTab === 'overview'
                ? 'border-b-2 border-emerald-500 text-emerald-300'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('questions')}
            className={`px-4 py-2 text-sm font-medium transition ${
              activeTab === 'questions'
                ? 'border-b-2 border-emerald-500 text-emerald-300'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            Question Breakdown
          </button>
          <button
            onClick={() => setActiveTab('suggestions')}
            className={`px-4 py-2 text-sm font-medium transition ${
              activeTab === 'suggestions'
                ? 'border-b-2 border-emerald-500 text-emerald-300'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            Improvement Suggestions
          </button>
        </div>

        {/* Tab Content */}
        <div>
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Component Scores */}
              <div className="rounded-lg border border-white/10 bg-[#0e0e0e] p-6">
                <h3 className="mb-4 text-lg font-semibold text-white">Component Scores</h3>
                <div className="space-y-4">
                  {['correctness', 'depth', 'communication', 'metrics'].map((key) => {
                    const score = averageScores[key as keyof ScoreData] || 0;
                    const percentage = (score / 5) * 100;
                    return (
                      <div key={key}>
                        <div className="mb-1 flex items-center justify-between">
                          <span className="text-sm capitalize text-gray-300">{key}</span>
                          <span className="text-sm font-medium text-white">{formatScore(score)} / 5.00</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full bg-emerald-500"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Strengths */}
              {positivePoints.length > 0 && (
                <div className="rounded-lg border border-white/10 bg-[#0e0e0e] p-6">
                  <h3 className="mb-4 text-lg font-semibold text-emerald-300">Strengths</h3>
                  <ul className="space-y-2">
                    {positivePoints.slice(0, 10).map((point, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-gray-300">
                        <span className="text-emerald-400">✓</span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Areas for Improvement */}
              {missedPoints.length > 0 && (
                <div className="rounded-lg border border-white/10 bg-[#0e0e0e] p-6">
                  <h3 className="mb-4 text-lg font-semibold text-amber-400">Areas for Improvement</h3>
                  <ul className="space-y-2">
                    {missedPoints.slice(0, 10).map((point, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-gray-300">
                        <span className="text-amber-400">•</span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Stats */}
              <div className="rounded-lg border border-white/10 bg-[#0e0e0e] p-6">
                <h3 className="mb-4 text-lg font-semibold text-white">Interview Stats</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-400">Questions Answered</p>
                    <p className="text-xl font-semibold text-white">{transcript.perQuestion.length}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Status</p>
                    <p className="text-xl font-semibold capitalize text-white">{transcript.status}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Question Breakdown Tab */}
          {activeTab === 'questions' && (
            <div className="space-y-4">
              {transcript.perQuestion.map((pq, idx) => (
                <div key={pq.question_id || idx} className="rounded-lg border border-white/10 bg-[#0e0e0e] p-6">
                  <div className="mb-4 flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-white">Question {idx + 1}</h3>
                      <p className="text-sm text-gray-400">ID: {pq.question_id}</p>
                    </div>
                    {pq.score?.overall_score !== undefined && (
                      <div
                        className={`flex h-16 w-16 items-center justify-center rounded-full ${getScoreBgColor(
                          pq.score.overall_score
                        )}`}
                      >
                        <span className={`text-xl font-bold ${getScoreColor(pq.score.overall_score)}`}>
                          {formatScore(pq.score.overall_score)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* User Response */}
                  {pq.combined_text && (
                    <div className="mb-4">
                      <h4 className="mb-2 text-sm font-semibold text-gray-300">Your Response</h4>
                      <div className="rounded-md bg-[#0b0b0b] p-3 text-sm text-gray-300">
                        {pq.combined_text}
                      </div>
                    </div>
                  )}

                  {/* Component Scores */}
                  {pq.score?.scores && (
                    <div className="mb-4">
                      <h4 className="mb-2 text-sm font-semibold text-gray-300">Score Breakdown</h4>
                      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                        {Object.entries(pq.score.scores).map(([key, value]) => (
                          <div key={key} className="rounded-md bg-[#0b0b0b] p-3 text-center">
                            <p className="text-xs capitalize text-gray-400">{key}</p>
                            <p className="text-lg font-semibold text-white">{formatScore(value)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Positive Points */}
                  {pq.score?.positive_points && pq.score.positive_points.length > 0 && (
                    <div className="mb-4">
                      <h4 className="mb-2 text-sm font-semibold text-emerald-300">What You Did Well</h4>
                      <ul className="space-y-1">
                        {pq.score.positive_points.map((point, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                            <span className="text-emerald-400">✓</span>
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Missed Points */}
                  {pq.score?.missed_points && pq.score.missed_points.length > 0 && (
                    <div className="mb-4">
                      <h4 className="mb-2 text-sm font-semibold text-amber-400">What You Missed</h4>
                      <ul className="space-y-1">
                        {pq.score.missed_points.map((point, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                            <span className="text-amber-400">•</span>
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* AI Rationale */}
                  {pq.score?.rationale && (
                    <div>
                      <h4 className="mb-2 text-sm font-semibold text-gray-300">AI Feedback</h4>
                      <p className="text-sm italic text-gray-400">{pq.score.rationale}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Improvement Suggestions Tab */}
          {activeTab === 'suggestions' && (
            <div className="space-y-6">
              {/* Prioritized Improvements */}
              {prioritizedImprovements.length > 0 && (
                <div className="rounded-lg border border-white/10 bg-[#0e0e0e] p-6">
                  <h3 className="mb-4 text-lg font-semibold text-white">Prioritized Improvement Areas</h3>
                  <p className="mb-4 text-sm text-gray-400">
                    Focus on these concepts that appeared most frequently in your missed points:
                  </p>
                  <div className="space-y-3">
                    {prioritizedImprovements.slice(0, 10).map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between rounded-md bg-[#0b0b0b] p-3"
                      >
                        <div className="flex items-center gap-3">
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/20 text-sm font-semibold text-amber-400">
                            {idx + 1}
                          </span>
                          <span className="capitalize text-gray-300">{item.point}</span>
                        </div>
                        {item.count > 1 && (
                          <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs text-amber-400">
                            Mentioned {item.count}x
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Key Takeaways */}
              <div className="rounded-lg border border-white/10 bg-[#0e0e0e] p-6">
                <h3 className="mb-4 text-lg font-semibold text-white">Key Takeaways</h3>
                <ul className="space-y-3 text-sm text-gray-300">
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-400">→</span>
                    <span>
                      Review the concepts you missed most frequently to strengthen your foundational
                      knowledge.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-400">→</span>
                    <span>
                      Practice explaining technical concepts clearly and concisely to improve your
                      communication score.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-400">→</span>
                    <span>
                      Include specific examples, metrics, and real-world applications in your answers.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-400">→</span>
                    <span>
                      Build on your strengths shown in the positive feedback to further enhance your
                      performance.
                    </span>
                  </li>
                </ul>
              </div>

              {/* Next Steps */}
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-6">
                <h3 className="mb-4 text-lg font-semibold text-emerald-300">Recommended Next Steps</h3>
                <ol className="space-y-3 text-sm text-gray-300">
                  <li className="flex items-start gap-2">
                    <span className="font-semibold text-emerald-400">1.</span>
                    <span>
                      Create a study plan focusing on your top 3-5 prioritized improvement areas.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-semibold text-emerald-400">2.</span>
                    <span>
                      Practice answering similar questions using the STAR method (Situation, Task, Action,
                      Result).
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-semibold text-emerald-400">3.</span>
                    <span>Schedule another mock interview to track your improvement over time.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-semibold text-emerald-400">4.</span>
                    <span>
                      Review the positive feedback and replicate those strategies in future interviews.
                    </span>
                  </li>
                </ol>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
