import http from "http";
import { app } from "./app.js";
import mongoose from "mongoose";
import { Server } from "socket.io";
import { config } from "dotenv";

config({ path: "./back.env" });

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: ['http://localhost:5173', 'https://ai-interviewprepapp.netlify.app'],
    methods: ["GET", "POST"],
    credentials: true,
  },
});

io.on("connection", (socket) => {
  console.log("🔌 A user connected:", socket.id);

  socket.on("join_interview", (payload) => {
    console.log("received join_interview:", payload);
    const interviewId = payload?.interviewId;
    if (interviewId) {
      socket.join(String(interviewId));
      console.log(`Socket ${socket.id} joined room ${interviewId}`);
    }
  });

  socket.on("disconnect", () => {
    console.log("socket disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 8000;
const MONGO_URL = process.env.MONGO_URL;

// near top of server.js, after startServer() or before server.listen(...)

async function startServer() {
  try {
    await mongoose.connect(MONGO_URL);
    console.log("✅ Connected to MongoDB Atlas");

    server.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error("❌ Startup error:", err);
    process.exit(1);
  }
}

startServer();
