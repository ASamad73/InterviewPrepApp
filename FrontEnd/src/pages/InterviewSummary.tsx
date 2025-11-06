declare global {
  namespace JSX {
    interface IntrinsicElements {
      "elevenlabs-convai": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      > & {
        "agent-id": string;
      };
    }
  }
}

import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export default function InterviewSummary() {
  const location = useLocation();
  const { jobTitle, company } = location.state || {
    jobTitle: "Unknown",
    company: "Unknown",
  };

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://unpkg.com/@elevenlabs/convai-widget-embed";
    script.async = true;
    script.type = "text/javascript";
    document.body.appendChild(script);

    const widget = document.createElement("elevenlabs-convai");
    widget.setAttribute("agent-id", "agent_2601k88rsw0dev5t706kwhywmtm4");

    // Pass job details to the widget
    widget.setAttribute(
      "context",
      JSON.stringify({
        jobTitle,
        company,
        description: "Job description goes here...", // Replace with actual description if needed
      })
    );

    document.getElementById("widget-container")?.appendChild(widget);

    return () => {
      document.body.removeChild(script);
      document.getElementById("widget-container")?.removeChild(widget);
    };
  }, [jobTitle, company]);

  console.log("Rendering InterviewSummary component");
  console.log("Location state:", location.state);

  if (!location.state) {
    return (
      <main className="min-h-[calc(100vh-4rem)] bg-[#0c0c0c] px-6 py-10">
        <div className="mx-auto max-w-2xl text-center text-white">
          <h1 className="text-2xl font-semibold">Error</h1>
          <p className="mt-4">
            No interview details found. Please go back and try again.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[#0c0c0c] px-6 py-10">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-semibold text-white">Interview Summary</h1>
        <div className="mt-6 text-white">
          <p className="text-lg">Job Title: {jobTitle}</p>
          <p className="text-lg">Company: {company}</p>
        </div>
        <div id="widget-container" className="mt-10"></div>
      </div>
    </main>
  );
}
