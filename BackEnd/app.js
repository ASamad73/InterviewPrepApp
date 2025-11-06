import express from "express";
import cors from "cors";
import mongoose from "mongoose";

export const app = express();

// Define the Interview schema
const interviewSchema = new mongoose.Schema({
  jobTitle: { type: String, required: true },
  company: { type: String, required: true },
  jobDescription: { type: String, required: true },
});

// Create the Interview model
const Interview = mongoose.model("Interview", interviewSchema);

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json());

// Route to handle saving interview details
app.post("/api/interviews", async (req, res) => {
  try {
    const { jobTitle, company, jobDescription } = req.body;

    // Create a new interview document
    const interview = new Interview({ jobTitle, company, jobDescription });
    await interview.save();

    res
      .status(201)
      .json({ message: "Interview created successfully", interview });
  } catch (error) {
    console.error("Error saving interview:", error);
    res.status(500).json({ message: "Failed to create interview", error });
  }
});
