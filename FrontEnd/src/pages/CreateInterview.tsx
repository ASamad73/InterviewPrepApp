import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { Navigate } from "react-router-dom";
import axios from "axios";
import InterviewSummary from "./InterviewSummary";

export default function CreateInterview() {
  const navigate = useNavigate();
  const [jobTitle, setJobTitle] = useState("");
  const [company, setCompany] = useState("");
  const [jobDescription, setJobDescription] = useState("");

  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) return <div />; // or spinner
  if (!isSignedIn) return <Navigate to="/login" replace />;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    try {
      const response = await fetch("http://localhost:8000/api/interviews", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ jobTitle, company, jobDescription }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log("Interview created successfully:", data);
        navigate(`/interview-summary`, {
          state: { jobTitle, company, description: jobDescription },
        });
      } else {
        console.error("Failed to create interview:", await response.json());
      }
    } catch (error) {
      console.error("Error submitting interview:", error);
    }
  };

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[#0c0c0c] px-6 py-10">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-semibold text-white">Create Interview</h1>
        <form className="mt-6 grid grid-cols-1 gap-5" onSubmit={handleSubmit}>
          <div>
            <label className="mb-1 block text-sm text-gray-300">
              Job Title
            </label>
            <input
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              required
              className="w-full rounded-md border border-white/10 bg-[#0b0b0b] px-3 py-2 text-white placeholder-gray-500 outline-none ring-emerald-500/20 focus:ring-2"
              placeholder="Frontend Engineer"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-300">Company</label>
            <input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              required
              className="w-full rounded-md border border-white/10 bg-[#0b0b0b] px-3 py-2 text-white placeholder-gray-500 outline-none ring-emerald-500/20 focus:ring-2"
              placeholder="Acme Inc"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-300">
              Job Description
            </label>
            <textarea
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              required
              className="w-full rounded-md border border-white/10 bg-[#0b0b0b] px-3 py-2 text-white placeholder-gray-500 outline-none ring-emerald-500/20 focus:ring-2"
              placeholder="Provide a detailed job description here..."
              rows={5}
            />
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="rounded-md border border-white/10 px-4 py-2 text-sm text-gray-300 hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-md bg-[#3ecf8e] px-4 py-2 text-sm font-semibold text-black hover:bg-[#36be81]"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
