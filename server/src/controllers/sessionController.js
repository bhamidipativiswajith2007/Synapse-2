// import { chatClient, streamClient } from "../lib/stream.js";
import Session from "../models/Session.js";
import { ENV } from "../lib/env.js";

export async function createSession(req, res) {
  try {
    const { problem, difficulty } = req.body;
    const userId = req.user._id;
    const clerkId = req.user.clerkId;

    if (!problem || !difficulty) {
      return res.status(400).json({ message: "Problem and difficulty are required" });
    }

    // generate a unique call id for stream video
    const callId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // create session in db
    const session = await Session.create({ problem, difficulty, host: userId, callId });

    const io = req.app.get("io");
    if (io) {
      io.emit("active-sessions-updated");
    }

    res.status(201).json({ session });
  } catch (error) {
    console.log("Error in createSession controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function getActiveSessions(req, res) {
  try {
    const sessions = await Session.find({ status: "active" })
      .populate("host", "name profileImage email clerkId")
      .populate("participant", "name profileImage email clerkId")
      .sort({ createdAt: -1 })
      .limit(20);

    const io = req.app.get("io");

    const sessionsWithLiveStatus = sessions.map((session) => {
      const roomById = io?.sockets?.adapter?.rooms?.get(session._id.toString());
      const roomByCallId = session.callId ? io?.sockets?.adapter?.rooms?.get(session.callId) : null;
      const socketCount = (roomById ? roomById.size : 0) + (roomByCallId ? roomByCallId.size : 0);
      const isLive = socketCount > 0;
      const liveUsersCount = isLive ? (session.participant ? 2 : 1) : 0;

      return {
        ...session.toObject(),
        isLive,
        liveUsersCount,
      };
    });

    res.status(200).json({ sessions: sessionsWithLiveStatus });
  } catch (error) {
    console.log("Error in getActiveSessions controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function getMyRecentSessions(req, res) {
  try {
    const userId = req.user._id;

    // get sessions where user is either host or participant
    const sessions = await Session.find({
      status: "completed",
      $or: [{ host: userId }, { participant: userId }],
    })
      .sort({ createdAt: -1 })
      .limit(20);

    res.status(200).json({ sessions });
  } catch (error) {
    console.log("Error in getMyRecentSessions controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function getSessionById(req, res) {
  try {
    const { id } = req.params;

    const session = await Session.findById(id)
      .populate("host", "name email profileImage clerkId")
      .populate("participant", "name email profileImage clerkId");

    if (!session) return res.status(404).json({ message: "Session not found" });

    res.status(200).json({ session });
  } catch (error) {
    console.log("Error in getSessionById controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function joinSession(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const clerkId = req.user.clerkId;

    const session = await Session.findById(id);

    if (!session) return res.status(404).json({ message: "Session not found" });

    if (session.status !== "active") {
      return res.status(400).json({ message: "Cannot join a completed session" });
    }

    if (session.host.toString() === userId.toString()) {
      return res.status(400).json({ message: "Host cannot join their own session as participant" });
    }

    // check if session is already full - has a participant
    if (session.participant) return res.status(409).json({ message: "Session is full" });

    session.participant = userId;
    await session.save();

    const io = req.app.get("io");
    if (io) {
      io.emit("active-sessions-updated");
    }

    res.status(200).json({ session });
  } catch (error) {
    console.log("Error in joinSession controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function endSession(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const session = await Session.findById(id);

    if (!session) return res.status(404).json({ message: "Session not found" });

    // check if user is the host
    if (session.host.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Only the host can end the session" });
    }

    // check if session is already completed
    if (session.status === "completed") {
      return res.status(400).json({ message: "Session is already completed" });
    }


    // Clear cached session state in Redis
    const { getRedisClient } = await import("../lib/redis.js");
    const redisClient = getRedisClient();
    if (redisClient) {
      try {
        await redisClient.del(`session:${id}:code`);
        await redisClient.del(`session:${id}:language`);
      } catch (error) {
        console.error("❌ Error clearing session cache from Redis:", error.message);
      }
    }

    session.status = "completed";
    await session.save();

    const io = req.app.get("io");
    if (io) {
      io.to(session._id.toString()).emit("session-ended");
      if (session.callId) {
        io.to(session.callId).emit("session-ended");
      }
      io.emit("active-sessions-updated");
    }

    res.status(200).json({ session, message: "Session ended successfully" });
  } catch (error) {
    console.log("Error in endSession controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function leaveSession(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const session = await Session.findById(id);
    if (!session) return res.status(404).json({ message: "Session not found" });

    const io = req.app.get("io");

    // If host leaves the call:
    // Host exits the call, but session is NOT completed until host clicks "End Session"
    if (session.host.toString() === userId.toString()) {
      if (io) {
        io.to(session._id.toString()).emit("user-left");
        if (session.callId) io.to(session.callId).emit("user-left");
        io.emit("active-sessions-updated");
      }
      return res.status(200).json({ message: "Host left the call" });
    }

    // If participant leaves the call:
    if (session.participant && session.participant.toString() === userId.toString()) {
      session.participant = null;
      await session.save();

      if (io) {
        io.to(session._id.toString()).emit("user-left");
        if (session.callId) io.to(session.callId).emit("user-left");
        io.emit("active-sessions-updated");
      }

      return res.status(200).json({ message: "Participant left the call", session });
    }

    res.status(200).json({ message: "User left session" });
  } catch (error) {
    console.log("Error in leaveSession controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function getAIAssist(req, res) {
  try {
    const { id } = req.params;
    const { code, language, message, history } = req.body;

    if (!message) {
      return res.status(400).json({ message: "Message is required" });
    }

    // 1. Fetch the active session to get the problem context
    const session = await Session.findById(id);
    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }

    const problemTitle = session.problem || "Coding Challenge";

    // 2. Build the Gemini API prompt with system instructions
    const systemInstruction = `You are an expert software engineering interviewer and coding assistant for Synapse.
The candidate is working on the coding problem: "${problemTitle}".
Your goal is to guide the candidate to the correct solution without giving them the direct full source code answer.
Follow these guidelines:
1. Provide conceptual explanations, hints, pseudocode, or highlight logical errors in their code.
2. If they ask for the full solution, politely refuse and provide a hint or step-by-step guidance instead.
3. Keep your responses concise and formatted in markdown.`;

    // Format conversation history for Gemini API content structure
    const contents = [];
    if (history && Array.isArray(history)) {
      history.forEach((msg) => {
        if (msg.text) {
          const role = msg.senderId === "gemini-ai" ? "model" : "user";
          contents.push({
            role,
            parts: [{ text: msg.text }],
          });
        }
      });
    }

    // Append the current prompt representing the context
    const currentCodeContext = code 
      ? `\n\nHere is my current code in ${language}:\n\`\`\`${language}\n${code}\n\`\`\``
      : "";
    
    contents.push({
      role: "user",
      parts: [
        {
          text: `Problem: ${problemTitle}${currentCodeContext}\n\nQuestion/Prompt: ${message}`,
        },
      ],
    });

    const apiKey = ENV.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ message: "Gemini API key is not configured on the server" });
    }

    // 3. Make REST API call to Google Gemini 2.5 Flash
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const response = await fetch(geminiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents,
        systemInstruction: {
          parts: [{ text: systemInstruction }],
        },
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Gemini API call failed:", errText);
      return res.status(502).json({ message: "Failed to communicate with AI service" });
    }

    const resData = await response.json();
    const answer = resData.candidates?.[0]?.content?.parts?.[0]?.text || "I'm sorry, I couldn't generate a response.";

    res.status(200).json({ answer });
  } catch (error) {
    console.error("Error in getAIAssist controller:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}
