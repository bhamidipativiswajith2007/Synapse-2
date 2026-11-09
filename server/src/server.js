import express from "express";
import path from "path";
import cors from "cors";
import { serve } from "inngest/express";
import { clerkMiddleware } from "@clerk/express";
import { createServer } from "http";
import { Server } from "socket.io";

import { ENV } from "./lib/env.js";
import { connectDB } from "./lib/db.js";
import { inngest, functions } from "./lib/inngest.js";

import sessionRoutes from "./routes/sessionRoute.js";
import { connectRedis, getRedisClient } from "./lib/redis.js";
import mongoose from "mongoose";
import Session from "./models/Session.js";

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: ENV.CLIENT_URL,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

app.set("io", io);

// socket.io events
io.on("connection", (socket) => {
  socket.on("join-room", async (roomId) => {
    socket.join(roomId);
    socket.to(roomId).emit("user-joined");
    io.emit("active-sessions-updated");

    // Retrieve active cached code and language state from Redis
    const redisClient = getRedisClient();
    if (redisClient) {
      try {
        const cachedCode = await redisClient.get(`session:${roomId}:code`);
        const cachedLanguage = await redisClient.get(`session:${roomId}:language`);
        if (cachedCode !== null || cachedLanguage !== null) {
          socket.emit("sync-code-state", { code: cachedCode, language: cachedLanguage });
        }
      } catch (error) {
        console.error("❌ Error fetching cached state from Redis:", error.message);
      }
    }
  });
//handling the chatting 
  socket.on("send-message", (messageData) => {
    const { roomId } = messageData;
    if (roomId) {
      io.to(roomId).emit("receive-message", messageData);
    }
  });

  socket.on("send-ai-message", (messageData) => {
    const { roomId } = messageData;
    if (roomId) {
      io.to(roomId).emit("receive-ai-message", messageData);
    }
  });
//webrtc events for video call 1->2 offering
  socket.on("webrtc-offer", (data) => {
    const { roomId, sdp } = data;
    socket.to(roomId).emit("webrtc-offer", sdp);
  });
//2->1 answering
  socket.on("webrtc-answer", (data) => {
    const { roomId, sdp } = data;
    socket.to(roomId).emit("webrtc-answer", sdp);
  });
//ice candidate exchange
  socket.on("webrtc-ice-candidate", (data) => {
    const { roomId, candidate } = data;
    socket.to(roomId).emit("webrtc-ice-candidate", candidate);
  });

//code change event for real-time collaborative coding..like every key stroke is sent to other users in the same room
  socket.on("code-change", async (data) => {
    const { roomId, code } = data;
    socket.to(roomId).emit("code-change", code);

// Save active code buffer to Redis with 24h expiration(86400s)
    const redisClient = getRedisClient();
    if (redisClient) {
      try {
        await redisClient.set(`session:${roomId}:code`, code, { EX: 86400 });
      } catch (error) {
        console.error("❌ Error saving code to Redis:", error.message);
      }
    }
  });

  socket.on("language-change", async (data) => {
    const { roomId, language, starterCode } = data;
    socket.to(roomId).emit("language-change", { language, starterCode });

// Save language and reset code state cache in Redis
    const redisClient = getRedisClient();
    if (redisClient) {
      try {
        await redisClient.set(`session:${roomId}:language`, language, { EX: 86400 });
        if (starterCode) {
          await redisClient.set(`session:${roomId}:code`, starterCode, { EX: 86400 });
        }
      } catch (error) {
        console.error("❌ Error saving language to Redis:", error.message);
      }
    }
 });

  socket.on("disconnecting", () => {
    for (const room of socket.rooms) {
      if (room !== socket.id) {
        socket.to(room).emit("user-left");
      }
    }
  });

  socket.on("disconnect", () => {
    io.emit("active-sessions-updated");
  });
});

const __dirname = path.resolve();

// middleware
app.use(express.json());
// credentials:true meaning?? => server allows a browser to include cookies on request
app.use(cors({ origin: ENV.CLIENT_URL, credentials: true }));
app.use(clerkMiddleware()); // this adds auth field to request object: req.auth()

app.use("/api/inngest", serve({ client: inngest, functions }));
app.use("/api/sessions", sessionRoutes);

//check the server is healthy or not
app.get("/health", (req, res) => {
  res.status(200).json({ msg: "api is up and running" });
});

// make our app ready for deployment production 
if (ENV.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../frontend/dist")));

  app.get("/{*any}", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend", "dist", "index.html"));
  });
}

const startServer = async () => {
  try {
    await connectDB();
    await connectRedis();
    httpServer.listen(ENV.PORT, () => console.log("Server is running on port:", ENV.PORT));
  } catch (error) {
    console.error(" Error starting the server", error);
  }
};

startServer();
