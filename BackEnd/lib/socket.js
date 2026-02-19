// server/socket.js
import app from "../app.js"
import { Server } from "socket.io";
import conversationManager from "./conversationManager.js";

let ioInstance = null;

/**
 * Initialize Socket.IO with an existing http.Server instance.
 * Call this exactly once during server startup (after http.createServer(app)).
 * Returns the created io instance.
 */
export function initSocket(server, opts = {}) {
  if (ioInstance) return ioInstance;
  ioInstance = new Server(server, {
    cors: {
      origin: ['http://localhost:5173', 'https://ai-interviewprepapp.netlify.app'],
      methods: ["GET", "POST"],
      credentials: true,
    },
    ...opts,
  });

  ioInstance.on("connection", (socket) => {
    console.log(" A user connected:", socket.id);

    socket.on("join_interview", (payload) => {
      const interviewId = payload?.interviewId;
      if (interviewId) {
        socket.join(String(interviewId));
        console.log(`Socket ${socket.id} joined room ${interviewId}`);
      }
    });

    // inside ioInstance.on('connection', socket => { ... })
    socket.on("played", async ({ interviewId }) => {
      console.log("played event for", interviewId);
      
      const state = conversationManager.getState(interviewId);
      
      if (state && state.stage === "permission") {
        try {
          const backendBase = `http://localhost:8000`;
          await fetch(`${backendBase}/api/model/${encodeURIComponent(interviewId)}/permission`, { method: "POST" });
        } catch (err) {
          console.error("Error calling internal permission route:", err);
          ioInstance.to(interviewId).emit("start_record", { mode: "permission" });
        }
        return;
      }

      ioInstance.to(interviewId).emit("start_record", { mode: "answer" });
    });


    socket.on("user_audio", async ({ interviewId, audioBase64 }) => {
      try {
        // convert base64 to buffer and forward to STT endpoint in same way as /upload-audio
        const buffer = Buffer.from(audioBase64, "base64");
        // call helper that proxies buffer to STT and scoring (we'll provide helper function)
        const result = await require("./lib/orchestrator").handleUserAudioBuffer(interviewId, buffer);
        // result contains transcript, scoring, next audioUrl etc.
        io.to(interviewId).emit("scoring_result", result);
        if (result.audioUrl) {
          io.to(interviewId).emit("play_audio", { audioUrl: result.audioUrl, utteranceText: result.nextText });
        }
      } catch (err) {
        console.error("user_audio handler failed", err);
        io.to(interviewId).emit("error", { message: "server user_audio failed" });
      }
    });

    socket.on("disconnect", () => {
      console.log("socket disconnected:", socket.id);
    });
  });

  app.locals.io = ioInstance; 
  return ioInstance;
}

/**
 * Getter for the initialized io instance.
 * Throws if not initialized (so callers know to call initSocket first).
 */
export function getIO() {
  if (!ioInstance) {
    throw new Error("Socket.IO not initialized. Call initSocket(server) during startup first.");
  }
  return ioInstance;
}
