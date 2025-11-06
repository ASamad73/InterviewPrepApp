import { Link } from 'react-router-dom'
import { readInterviews } from '../lib/storage'
import { useAuth, SignedIn, SignedOut } from '@clerk/clerk-react'
import { Navigate } from 'react-router-dom'
import React, { useEffect, useState } from 'react';
// import axios from 'axios';

// interface Question {
//   question_id: number;
//   question_url: string;
//   question_title: string;
//   question_text: string;
//   question_tags: string[];
//   question_score: number;
//   question_view_count: number;
//   question_creation_date: number;
//   answer_id?: number;
//   answer_text?: string;
//   answer_score?: number;
//   answer_is_accepted: boolean;
//   answer_has_code: boolean;
//   answer_has_steps: boolean;
//   answer_word_count: number;
//   preference_answer_ok: boolean;
//   rank_key: [number, number, number, number, number, number]; // Tuple from your rank_key
// }


export default function Dashboard() {
  const { isLoaded, isSignedIn, userId, getToken } = useAuth()
  // const [questions, setQuestions] = useState<Question[]>([]);
  // const [loading, setLoading] = useState<boolean>(true);
  // const [error, setError] = useState<string | null>(null);

  // if (!isLoaded) return <div /> // or spinner
  // if (!isSignedIn) return <Navigate to="/login" replace />

  const interviews = readInterviews()
  const hasItems = interviews.length > 0

  // useEffect(() => {
  //   const fetchQuestions = async () => {
  //     try {
  //       const response = await fetch(`${import.meta.env.VITE_API_URL}/api/interviews/extract-qas`);
  //       const data = await response.json();
  //       setQuestions(data);
  //     } catch (err) {
  //       setError('Failed to load questions. Please try again.');
  //       console.error(err);
  //     } finally {
  //       setLoading(false);
  //     }
  //   };

  //   fetchQuestions();
  // }, []); // Empty dependency array: Runs only once on mount

  // if (loading) return <div>Loading questions...</div>;
  // if (error) return <div>{error}</div>;

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[#0c0c0c] px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-white">Dashboard</h1>
          <Link
            to="/create-interview"
            className="rounded-md bg-[#3ecf8e] px-4 py-2 text-sm font-semibold text-black hover:bg-[#36be81]"
          >
            Create Interview
          </Link>
        </div>

        {!hasItems ? (
          <div className="rounded-lg border border-white/10 bg-[#0e0e0e] p-8 text-center">
            <p className="text-gray-300">No interviews yet. Create your first interview to get started.</p>
            <Link
              to="/create-interview"
              className="mt-6 inline-flex rounded-md bg-[#3ecf8e] px-4 py-2 text-sm font-semibold text-black hover:bg-[#36be81]"
            >
              Create Interview
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {interviews.map((it) => (
              <Link
                key={it.id}
                to={`/interview/${it.id}`}
                className="group rounded-lg border border-white/10 bg-[#0e0e0e] p-5 transition hover:border-emerald-500/30 hover:shadow-[0_0_0_1px_rgba(62,207,142,0.2)]"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-medium text-white group-hover:text-emerald-300">{it.title}</h2>
                  <span className="text-xs uppercase tracking-wide text-gray-400">{it.status}</span>
                </div>
                <p className="mt-1 text-sm text-gray-300">
                  {it.company} • {it.role}
                </p>
                <p className="mt-2 text-xs text-gray-400">{new Date(it.date).toLocaleString()}</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
