import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { io, Socket } from "socket.io-client";
import { list } from "postcss";

type LocationState = {
  id?: string;
  jobTitle?: string;
  company?: string;
  description?: string;
};

type QuestionItem = {
    question_id: string;
    question_title: string;
    question_text: string;
    difficulty_score: number;
};

type AgentQuestion = {
    question_id: string;    
    question_text: string;
}

type NextQuestionPayload = {
    action: string;
    question: {
        question_id: string;
        question_title: string;
        question_text: string;
        difficulty_score: number;
    };
    followup_prompt: string;
}

const RECORD_SECONDS = 15;

export default function InterviewSummary(): JSX.Element {
    const location = useLocation();
    const navigate = useNavigate();
    const { getToken, isLoaded, isSignedIn } = useAuth();

    const state = (location.state as LocationState) || {};
    const [interviewId, setInterviewId] = useState<string | null>(state.id ?? null);
    // const [jobLevel, setJobLevel] = useState<string>(state.jobLevel ?? "Unknown");
    const [jobTitle, setJobTitle] = useState<string>(state.jobTitle ?? "Unknown");
    const [company, setCompany] = useState<string>(state.company ?? "Unknown");
    const [description, setDescription] = useState<string>(state.description ?? "");

    const [questions, setQuestions] = useState<QuestionItem[]>([]);
    const [answersMap, setAnswersMap] = useState<Record<string, string>>({});
    const [transcript, setTranscript] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [widgetLoaded, setWidgetLoaded] = useState(false);
    const [interviewStarted, setInterviewStarted] = useState(false);

    const [scriptStatus, setScriptStatus] = useState<'idle'|'found'|'loading'|'loaded'|'error'|'ready'|'timeout'>('idle');
    const [scriptError, setScriptError] = useState<string | null>(null);

    const [overallScore, setOverallScore] = useState<number | null>(null);
    const [scoreLoading, setScoreLoading] = useState(false);

    // --- question sampling / difficulty state (new) ---
    const [questionBuckets, setQuestionBuckets] = useState<Record<number, QuestionItem[]>>({
        1: [], 2: [], 3: [], 4: [], 5: []
    });
    const [samplingPlan, setSamplingPlan] = useState<number[]>([]);
    const [extrasList, setExtrasList] = useState<QuestionItem[]>([]);
    const [totalToAsk, setTotalToAsk] = useState<number>(0);
    const [targetCounts, setTargetCounts] = useState<Record<number, number>>({});
    const [availability, setAvailability] = useState<Record<number, { available: number; target: number }>>({});

    const scriptRef = useRef<HTMLScriptElement | null>(null);
    const widgetRef = useRef<HTMLElement | null>(null);

    const socketRef = useRef<Socket | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const [connected, setConnected] = useState(false);
    const [lastTranscript, setLastTranscript] = useState<string>("");

    const API = import.meta.env.VITE_API_URL || "";

    async function getAuthHeaders() {
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (isLoaded && isSignedIn && getToken) {
        try {
            const token = await getToken({ template: "interview-backend" });
            if (token) headers["Authorization"] = `Bearer ${token}`;
        } catch (err) {
            console.warn("getToken failed", err);
        }
        }
        return headers;
    }

    async function ensureInterviewExists() {
        console.log("Ensuring interview exists, current id:", interviewId);
        if (interviewId) return interviewId;

        setCreating(true);
        setError(null);
        try {
            const headers = await getAuthHeaders();
            const res = await fetch(`${API}/api/interviews/save-parameters`, {
                method: "POST",
                headers,
                body: JSON.stringify({ jobTitle, company, jobDescription: description }),
            });
            const text = await res.text();
            let body: any = null;
            try {
                body = text ? JSON.parse(text) : null;
            } catch {
                body = { message: text };
            }
            if (!res.ok) {
                const msg = body?.message || `Server returned ${res.status}`;
                throw new Error(msg);
            }
            const id = body?.interviewId || body?.id || body?.interview?._id;
            if (!id) throw new Error("Server did not return interview id");
            setInterviewId(String(id));
            return String(id);
        } catch (err: any) {
            console.error("ensureInterviewExists error", err);
            setError(err?.message || "Failed to create interview");
        throw err;
        } finally {
            setCreating(false);
        }
    }

    async function fetchSelectedQuestions(id: string) {
        setLoading(true);
        setError(null);
        console.log("Fetching selected questions for interview id:", id);
        try {
            const headers = await getAuthHeaders();
            const res = await fetch(`${API}/api/interviews/${id}/questions`, { method: "GET", headers });
            const body = await res.json().catch(() => null);

            if (!res.ok) {
                throw new Error(body?.message || `Failed to fetch questions (${res.status})`);
            }

            const saveRes = await fetch(`${API}/api/interviews/${id}/init-sampling`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    samplingPlan: body.samplingPlan,
                    buckets: body.buckets,
                    extras: body.extras || [],
                }),
            });
            
            if (!saveRes.ok) {
                throw new Error(`Failed to persist questions and sampling plan`);
            }

            // --- Handle new enriched response shape (preferred) ---
            if (body && Array.isArray(body.samplingPlan) && body.buckets) {
                // buckets may have string keys '1'..'5' or numeric keys; normalize to numeric keys
                const rawBuckets = body.buckets || {};
                const normalizedBuckets: Record<number, any[]> = {1: [],2: [],3: [],4: [],5: []};
                for (let lvl = 1; lvl <= 5; lvl++) {
                    const maybe = rawBuckets[lvl] ?? rawBuckets[String(lvl)] ?? [];
                    normalizedBuckets[lvl] = Array.isArray(maybe) ? maybe : [];
                }

                // set frontend state for later sampling
                setQuestionBuckets(normalizedBuckets);
                setSamplingPlan(Array.isArray(body.samplingPlan) ? body.samplingPlan : []);
                setExtrasList(Array.isArray(body.extras) ? body.extras : []);
                setTotalToAsk(Number(body.totalToAsk ?? body.totalToAsk ?? (body.samplingPlan?.length ?? 0)));
                setTargetCounts(body.targetCounts ?? {});
                setAvailability(body.availability ?? { 1:{available: normalizedBuckets[1].length, target: (body.targetCounts?.[1] ?? 0) },
                                                        2:{available: normalizedBuckets[2].length, target: (body.targetCounts?.[2] ?? 0) },
                                                        3:{available: normalizedBuckets[3].length, target: (body.targetCounts?.[3] ?? 0) },
                                                        4:{available: normalizedBuckets[4].length, target: (body.targetCounts?.[4] ?? 0) },
                                                        5:{available: normalizedBuckets[5].length, target: (body.targetCounts?.[5] ?? 0) } });

                // answers map (if provided)
                const receivedAnswers = body.answersMap ?? {};
                const normalized: Record<string, string> = {};
                for (const k of Object.keys(receivedAnswers)) {
                    normalized[String(k)] = String(receivedAnswers[k] ?? '');
                }
                setAnswersMap(normalized);

                // Return a flattened array for backward-compatible widget building:
                // preserve bucket ordering so the widget gets a predictable pool
                
                const flattened: QuestionItem[] = [];
                for (let lvl = 1; lvl <= 5; lvl++) {
                    const items = normalizedBuckets[lvl] ?? [];
                    for (const it of items) {
                    // ensure shape matches QuestionItem (id/title/text); if server already returns that shape, fine
                        flattened.push({
                            question_id: String(it.question_id ?? it.id ?? ''),
                            question_title: String(it.question_title ?? it.title ?? ''),
                            question_text: String(it.question_text ?? it.text ?? it.question ?? ''),
                            difficulty_score: Number(it.difficulty_score ?? lvl),
                        });
                    }
                }
                // append extras (ordered fallback) at the end (if any)
                if (Array.isArray(body.extras)) {
                    for (const it of body.extras) {
                    flattened.push({
                        question_id: String(it.question_id ?? it.id),
                        question_title: String(it.question_title ?? it.title ?? ''),
                        question_text: String(it.question_text ?? it.text ?? it.question ?? ''),
                        difficulty_score: Number(it.difficulty_score ?? 3),
                    });
                    }
                }

                return flattened;
            }

        } catch (err: any) {
            console.error("fetchSelectedQuestions error", err);
            setError(err?.message || "Failed to load questions");
            throw err;
        } finally {
            setLoading(false);
        }
    }
    
    async function fetchOverallScoreOnce(interviewId: string) {
        try {
            const headers = await getAuthHeaders();

            const res = await fetch(`${API}/api/webhooks/transcripts/${interviewId}`, {
                method: "GET",
                headers,
            });

            const body = await res.json().catch(() => null);

            if (!res.ok) return null;

            return body?.transcript?.overallScore ?? null;
        } catch (err) {
            console.error("polling score error:", err);
            return null;
        }
    }
    
    useEffect(() => {
        if (!interviewId) return;
        
        console.log("Interview id type is: ", typeof interviewId);
        console.log("Starting overall score polling for interview id:", interviewId);

        let intervalId: ReturnType<typeof setInterval>; 

        async function startPolling() {
            intervalId = setInterval(async () => {
            let score: number | null = null;
            if (interviewId){
                score = await fetchOverallScoreOnce(interviewId);
            }

            if (score !== null) {
                setOverallScore(score);
                setScoreLoading(false);
                clearInterval(intervalId); // stop polling once ready
            }
            }, 3000); // poll every 3 seconds
        }

        startPolling();

        // cleanup
        return () => {
            if (intervalId) clearInterval(intervalId);
        };
    }, [interviewId]);

    const startInterview = async () => {
        setError(null);
        try {
            const id = await ensureInterviewExists();

            if (!socketRef.current) {
                throw new Error("Socket not initialized");
            } 

            if (!socketRef.current.connected) {
                // await new Promise<void>((resolve, reject) => {
                //     const onConnect = () => {
                //         // we joined in useEffect on connect already. If interviewId may be new,
                //         // emit join_interview for this id here (only once).
                //         socketRef.current?.emit("join_interview", { interviewId: id });
                //         socketRef.current?.off("connect", onConnect);
                //         resolve();
                //     };
                //     socketRef.current.on("connect", onConnect);
                //     // fallback timeout
                //     setTimeout(() => {
                //         socketRef.current?.off("connect", onConnect);
                //         resolve();
                //     }, 2000);
                // });
                console.log("socket is not connected yet");
                return;
            }

            const qs = await fetchSelectedQuestions(id);
            if (!qs || qs.length === 0) {
                setError("No questions selected for this interview.");
                return;
            }
            const firstQuestion: AgentQuestion = {question_id: qs[0].question_id, question_text: qs[0].question_text};
            console.log("Starting interview with first question:", firstQuestion.question_text);  
            console.log("Built full system prompt for widget.");
            
            const initialData = { currentQuestionId: firstQuestion.question_id, samplingPlan };
            const res = await fetch(`${API}/api/model/${encodeURIComponent(id)}/start`,{
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(initialData)
            });

            const data = await res.json();
            
            if(!res.ok) {
                throw new Error(`Failed to start interview`);
            }

            console.log("Start interview response:", data);
            setInterviewStarted(true);
        
        } catch (err) {
            console.error("startInterview failed", err);
            return;
        }
    };

    const handlePlayAudio = async (audioUrl: string) => {
        const absoluteUrl = audioUrl.startsWith("http")
        ? audioUrl
        : `${window.location.origin}${audioUrl}`;

        if (!audioRef.current) {
            audioRef.current = new Audio();
        }

        audioRef.current.onended = () => {
            socketRef.current?.emit("played", { interviewId });
        };
        
        audioRef.current.src = absoluteUrl;

        try {
            await audioRef.current.play();
        } catch (err) {
            console.error("Audio playback failed", err);
        }

    };

    // record for `secs` seconds and upload
    async function recordAndUpload (secs = 15){
        if(!interviewId) {
            console.error("No interviewId available for recording upload");
            return null;
        }

        let stream: MediaStream | null = null;
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (err) {
            console.error("getUserMedia failed", err);
            return null;
        }

        const recorder = new MediaRecorder(stream);
        const chunks: BlobPart[] = [];
        recorder.ondataavailable = (e) => chunks.push(e.data);
        recorder.start();

        await new Promise((r) => setTimeout(r, secs * 1000));
        recorder.stop();
        await new Promise((r) => (recorder.onstop = r));

        try {
            stream.getTracks().forEach((t) => t.stop());
        } catch (e) {
            console.warn("Failed stopping tracks", e);
        }

        const blob = new Blob(chunks, { type: "audio/webm" });

        // Build FormData and upload
        const fd = new FormData();
        fd.append("file", blob, "answer.webm"); // your backend will convert to WAV with ffmpeg

        // optional: include metadata
        // fd.append('user', JSON.stringify({ name: 'Alice' }));

        const resp = await fetch(`${API}/api/interviews/${encodeURIComponent(interviewId)}/upload-audio`, {
            method: "POST",
            body: fd,
        });

        if (!resp.ok) {
            const txt = await resp.text();
            console.error("upload-audio failed", resp.status, txt);
            return null;
        }

        const json = await resp.json();

        return json;
    };

    useEffect(() => {
        const socket = io(API, { transports: ["websocket"] });
        socketRef.current = socket;

        socket.on("connect", () => {
            console.log("Socket connected:", socket.id);
            setConnected(true);
            if (interviewId) socket.emit("join_interview", { interviewId });
        });

        socket.on("play_audio", (audioUrl: string) => {
            handlePlayAudio(audioUrl);
        });

        socket.on("start_record", ({ mode } = { mode: "answer" }) => {
            console.log("start_record received, mode:", mode);
            recordAndUpload(RECORD_SECONDS).then((result) => {
                console.log("record/upload result:", result);
            });
        });

        socket.on("disconnect", () => {
            setConnected(false);
            console.log("Socket disconnected");
        });

        return () => {
            socket.disconnect();
        };
    }, [interviewId]);


    return (
        <main className="min-h-[calc(100vh-4rem)] bg-[#0c0c0c] px-6 py-10">
            <div className="mx-auto max-w-2xl">
                <h1 className="text-2xl font-semibold text-white">Interview Summary</h1>

                <div className="mt-6 text-white">
                    <p className="text-lg">Job Title: {jobTitle}</p>
                    <p className="text-lg">Company: {company}</p>
                    {description && <p className="mt-2 text-sm text-gray-300">{description}</p>}
                </div>

                <div className="mt-6">
                    <div className="flex items-center gap-3">
                    <div className="text-sm text-gray-300">Interview ID:</div>
                    <div className="text-sm text-emerald-300">{interviewId ?? "Not created yet"}</div>
                </div>

                <div className="mt-4 space-x-2">
                    <button
                        className="rounded-md bg-[#3ecf8e] px-4 py-2 text-sm font-semibold text-black hover:bg-[#36be81]"
                        onClick={startInterview}
                        disabled={creating || loading || widgetLoaded}
                    >
                        {creating ? "Creating..." : loading ? "Loading..." : widgetLoaded ? "Widget loaded" : "Start interview"}
                    </button>

                    <button
                        className="rounded-md border border-white/10 px-4 py-2 text-sm text-gray-300 hover:bg-white/5"
                        onClick={() => navigate(-1)}
                    >
                        Edit parameters
                    </button>

                    {/* <button
                        className="rounded-md border border-white/10 px-4 py-2 text-sm text-gray-300 hover:bg-white/5"
                        onClick={endInterview}
                    >
                        End Interview
                    </button> */}

                    {widgetLoaded && (
                        <button
                            className="rounded-md border border-white/10 px-3 py-2 text-sm text-gray-300 hover:bg-white/5"
                            onClick={() => {
                            if (!interviewId) return;
                            startInterview();
                            }}
                        >
                            Reload widget
                        </button>
                    )}
                </div>

                <div className="mt-4 p-3 bg-gray-800 rounded-md text-white">
                    <div className="text-sm font-semibold">Overall Score</div>

                    {scoreLoading ? (
                        <div className="text-gray-400 text-sm">Waiting for score…</div>
                    ) : (
                        <div className="text-lg font-bold">{overallScore}</div>
                    )}
                </div>

                    {error && <div className="mt-4 rounded-md bg-red-800/60 p-3 text-red-100">{error}</div>}

                    {/* <div id="widget-container" className="mt-8 min-h-[200px]" /> */}
                    <div id="widget-container" className="mt-8 min-h-[200px]" />

                    {/* DEBUG PANEL */}
                    {/* <div className="mt-3 text-sm text-gray-400">
                        <div>Widget script status: <span className="text-emerald-300 ml-2">{scriptStatus}</span></div>
                        {scriptRef.current?.src && <div>Script src: <code className="text-xs">{scriptRef.current.src}</code></div>}
                        {scriptError && <div className="mt-1 text-red-400">Error: {scriptError}</div>}
                        {!widgetLoaded && !scriptError && <div className="mt-1 text-gray-500">If the widget does not appear after a few seconds, check the console for logs / network errors.</div>}
                    </div>

                    {interviewStarted && (
                        <div className="mt-4 text-sm text-gray-400">
                        The agent should now ask questions from your selected dataset. To persist transcripts you must either
                        configure the Convai/ElevenLabs webhook to POST transcripts to your server or capture/upload audio + call STT endpoints.
                        </div>
                    )} */}
                </div>
            </div>
        </main>
    );
}



    // const endInterview = async () => {
    //     if (!interviewId) {
    //         setError("Interview not created yet.");
    //         return;
    //     }
    //     try {
    //         const headers = await getAuthHeaders();
    //         await fetch(`${API}/api/interviews/${interviewId}/finish`, 
    //             { 
    //                 method: "POST", 
    //                 headers 
    //             }
    //         );
    //         setInterviewStarted(false);
    //         setWidgetLoaded(false);
    //         // also remove widget
    //         removeMountedWidgetElement();
    //     } catch (e) {
    //         console.error("finish error", e);
    //         setError("Failed to finish interview.");
    //     }
    // };

    // useEffect(() => {
    //     return () => {
    //         unloadWidget();
    //     };
    // }, []);


    // on receiving audioUrl from backend (via WebSocket or fetch)
    // function playAndRecord(audioUrl: any, interviewId: String) {
    //     const audio = new Audio(audioUrl);
    //     audio.play();
    //     audio.onended = () => {
    //         // enable record button or start auto-record
    //         startRecording(interviewId);
    //     }
    // }

    // async function startRecording(interviewId: String) {
    //     const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    //     const recorder = new MediaRecorder(stream);
    //     const chunks: Blob[] = [];
    //     recorder.ondataavailable = e => chunks.push(e.data);
    //     recorder.start();
    //     // stop after silence detection or fixed timeout (e.g., 30s)
    //     setTimeout(async () => {
    //         recorder.stop();
    //         const blob = new Blob(chunks, { type: 'audio/webm' });
    //         const fd = new FormData();
    //         fd.append('file', blob, 'answer.webm');
    //         const res = await fetch(`/api/interviews/${interviewId}/upload-audio`, { method: 'POST', body: fd });
    //         const json = await res.json();
    //         // handle scoring & next audioUrl
    //         if (json.audioUrl) playAndRecord(json.audioUrl, interviewId);
    //     }, 30000);
    // }

    // const recordAndSendAudio = async (seconds: number) => {
    //     const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    //     const recorder = new MediaRecorder(stream);

    //     const chunks: BlobPart[] = [];
    //     recorder.ondataavailable = (e) => chunks.push(e.data);

    //     recorder.start();
    //     await new Promise((res) => setTimeout(res, seconds * 1000));
    //     recorder.stop();

    //     await new Promise((res) => (recorder.onstop = res));

    //     const blob = new Blob(chunks, { type: "audio/webm" });
    //     const buffer = await blob.arrayBuffer();
    //     const base64 = arrayBufferToBase64(buffer);

    //     socketRef.current?.emit("user_audio", {
    //         interviewId,
    //         audioBase64: base64,
    //     });

    // };

    // const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
    //     let binary = "";
    //     const bytes = new Uint8Array(buffer);
    //     for (let i = 0; i < bytes.length; i++) {
    //         binary += String.fromCharCode(bytes[i]);
    //     }
    //     return btoa(binary);
    // };
