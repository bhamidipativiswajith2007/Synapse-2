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

// import chatRoutes from "./routes/chatRoutes.js";
import sessionRoutes from "./routes/sessionRoute.js";

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: ENV.CLIENT_URL,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// socket.io events
io.on("connection", (socket) => {
  socket.on("join-room", (roomId) => {
    socket.join(roomId);
    socket.to(roomId).emit("user-joined");
  });

  socket.on("send-message", (messageData) => {
    const { roomId } = messageData;
    if (roomId) {
      io.to(roomId).emit("receive-message", messageData);
    }
  });

  socket.on("webrtc-offer", (data) => {
    const { roomId, sdp } = data;
    socket.to(roomId).emit("webrtc-offer", sdp);
  });

  socket.on("webrtc-answer", (data) => {
    const { roomId, sdp } = data;
    socket.to(roomId).emit("webrtc-answer", sdp);
  });

  socket.on("webrtc-ice-candidate", (data) => {
    const { roomId, candidate } = data;
    socket.to(roomId).emit("webrtc-ice-candidate", candidate);
  });

  socket.on("code-change", (data) => {
    const { roomId, code } = data;
    socket.to(roomId).emit("code-change", code);
  });

  socket.on("language-change", (data) => {
    const { roomId, language, starterCode } = data;
    socket.to(roomId).emit("language-change", { language, starterCode });
  });

  socket.on("disconnecting", () => {
    for (const room of socket.rooms) {
      if (room !== socket.id) {
        socket.to(room).emit("user-left");
      }
    }
  });
});

const __dirname = path.resolve();

// middleware
app.use(express.json());
// credentials:true meaning?? => server allows a browser to include cookies on request
app.use(cors({ origin: ENV.CLIENT_URL, credentials: true }));
app.use(clerkMiddleware()); // this adds auth field to request object: req.auth()

app.use("/api/inngest", serve({ client: inngest, functions }));
// app.use("/api/chat", chatRoutes);
app.use("/api/sessions", sessionRoutes);

app.get("/health", (req, res) => {
  res.status(200).json({ msg: "api is up and running" });
});

// make our app ready for deployment
if (ENV.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../frontend/dist")));

  app.get("/{*any}", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend", "dist", "index.html"));
  });
}

const startServer = async () => {
  try {
    await connectDB();
    httpServer.listen(ENV.PORT, () => console.log("Server is running on port:", ENV.PORT));
  } catch (error) {
    console.error("💥 Error starting the server", error);
  }
};

startServer();
