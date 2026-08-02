import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { useUser } from "@clerk/clerk-react";
import { io } from "socket.io-client";
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  MessageSquare,
  Users,
  X,
  PhoneOff,
} from "lucide-react";

function VideoCallUI({ session }) {
  const navigate = useNavigate();
  const { user } = useUser();

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState("");

  const [localStream, setLocalStream] = useState(null);
  const [remoteStreamActive, setRemoteStreamActive] = useState(false);
  const [cameraActive, setCameraActive] = useState(true);
  const [micActive, setMicActive] = useState(true);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const socketRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Initialize media devices, sockets, and WebRTC listeners
  useEffect(() => {
    let active = true;

    async function initMediaAndSockets() {
      try {
        // 1. Get user's local video and audio stream
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });

        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        localStreamRef.current = stream;
        setLocalStream(stream);

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        // 2. Connect to the signaling socket server
        const socketUrl = import.meta.env.VITE_API_URL.replace("/api", "");
        const socket = io(socketUrl, {
          withCredentials: true,
        });
        socketRef.current = socket;

        // 3. Socket event handlers
        socket.on("connect", () => {
          socket.emit("join-room", session.callId);
        });

        // Triggered when the other user enters the session room
        socket.on("user-joined", async () => {
          const pc = getOrCreatePeerConnection();
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit("webrtc-offer", { roomId: session.callId, sdp: offer });
        });

        // Received WebRTC offer from signaling server
        socket.on("webrtc-offer", async (sdp) => {
          const pc = getOrCreatePeerConnection();
          await pc.setRemoteDescription(new RTCSessionDescription(sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit("webrtc-answer", { roomId: session.callId, sdp: answer });
        });

        // Received WebRTC answer from signaling server
        socket.on("webrtc-answer", async (sdp) => {
          if (peerConnectionRef.current) {
            await peerConnectionRef.current.setRemoteDescription(
              new RTCSessionDescription(sdp)
            );
          }
        });

        // Received ICE candidate from signaling server
        socket.on("webrtc-ice-candidate", async (candidate) => {
          if (peerConnectionRef.current) {
            await peerConnectionRef.current.addIceCandidate(
              new RTCIceCandidate(candidate)
            );
          }
        });

        // Triggered when the other user leaves the session room
        socket.on("user-left", () => {
          setRemoteStreamActive(false);
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = null;
          }
          if (peerConnectionRef.current) {
            peerConnectionRef.current.close();
            peerConnectionRef.current = null;
          }
        });

        // Chat message listener
        socket.on("receive-message", (message) => {
          setMessages((prev) => [...prev, message]);
        });
      } catch (err) {
        console.error("Failed to access media devices or connect socket:", err);
      }
    }

    initMediaAndSockets();

    // Clean up streams, connections, and sockets when component unmounts
    return () => {
      active = false;
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [session?.callId]);

  // Creates or returns the existing RTCPeerConnection
  const getOrCreatePeerConnection = () => {
    if (peerConnectionRef.current) return peerConnectionRef.current;

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" }, // STUN server for NAT traversal
      ],
    });

    // Add local stream tracks to the connection
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    // Send generated ICE candidates to the remote peer
    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit("webrtc-ice-candidate", {
          roomId: session.callId,
          candidate: event.candidate,
        });
      }
    };

    // Mount remote track when received from partner
    pc.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
        setRemoteStreamActive(true);
      }
    };

    peerConnectionRef.current = pc;
    return pc;
  };

  // Scroll to bottom of chat whenever messages list updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Toggle Video Track
  const toggleCamera = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setCameraActive((prev) => !prev);
    }
  };

  // Toggle Audio Track
  const toggleMic = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setMicActive((prev) => !prev);
    }
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!inputMessage.trim() || !socketRef.current) return;

    const messageData = {
      roomId: session.callId,
      text: inputMessage,
      senderId: user?.id,
      senderName: user?.fullName || user?.username || "Anonymous",
      senderImage: user?.imageUrl,
      createdAt: new Date().toISOString(),
    };

    socketRef.current.emit("send-message", messageData);
    setInputMessage("");
  };

  return (
    <div className="h-full flex gap-3 relative">
      {/* Video feeds and controls */}
      <div className="flex-1 flex flex-col gap-3 min-h-0">
        
        {/* Top Header */}
        <div className="flex items-center justify-between gap-2 bg-base-100 p-3 rounded-lg shadow">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            <span className="font-semibold">
              {remoteStreamActive ? "2 participants" : "1 participant"}
            </span>
          </div>
          <button
            onClick={() => setIsChatOpen(!isChatOpen)}
            className={`btn btn-sm gap-2 ${isChatOpen ? "btn-primary" : "btn-ghost"}`}
            title={isChatOpen ? "Hide chat" : "Show chat"}
          >
            <MessageSquare className="size-4" />
            Chat
          </button>
        </div>

        {/* Video Grid */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3 min-h-0">
          
          {/* Remote Video Container */}
          <div className="relative bg-neutral-900 rounded-2xl overflow-hidden shadow-inner flex items-center justify-center">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
            {!remoteStreamActive && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-950/80 text-white gap-2 pointer-events-none">
                <Users className="size-10 text-primary animate-pulse" />
                <p className="text-sm font-semibold">Waiting for partner...</p>
              </div>
            )}
          </div>

          {/* Local Video Container */}
          <div className="relative bg-neutral-900 rounded-2xl overflow-hidden shadow-inner flex items-center justify-center">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            {!cameraActive && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-950 text-white gap-2 pointer-events-none">
                <VideoOff className="size-10 text-error" />
                <p className="text-sm font-semibold">Camera is Off</p>
              </div>
            )}
          </div>

        </div>

        {/* Control Buttons */}
        <div className="bg-base-100 p-3 rounded-lg shadow flex justify-center gap-3">
          <button
            onClick={toggleMic}
            className={`btn btn-circle ${micActive ? "btn-primary" : "btn-error"}`}
            title={micActive ? "Mute Microphone" : "Unmute Microphone"}
          >
            {micActive ? <Mic className="size-5" /> : <MicOff className="size-5" />}
          </button>

          <button
            onClick={toggleCamera}
            className={`btn btn-circle ${cameraActive ? "btn-primary" : "btn-error"}`}
            title={cameraActive ? "Turn Camera Off" : "Turn Camera On"}
          >
            {cameraActive ? <Video className="size-5" /> : <VideoOff className="size-5" />}
          </button>

          <button
            onClick={() => navigate("/dashboard")}
            className="btn btn-error btn-circle"
            title="Leave Call"
          >
            <PhoneOff className="size-5" />
          </button>
        </div>
      </div>

      {/* CHAT SECTION */}
      {isChatOpen && (
        <div className="flex flex-col w-80 rounded-lg shadow overflow-hidden bg-[#272a30] transition-all duration-300 ease-in-out">
          <div className="bg-[#1c1e22] p-3 border-b border-[#3a3d44] flex items-center justify-between">
            <h3 className="font-semibold text-white">Session Chat</h3>
              <button
                onClick={() => setIsChatOpen(false)}
                className="text-gray-400 hover:text-white transition-colors"
                title="Close chat"
              >
                <X className="size-5" />
              </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0 bg-[#1c1e22]">
            {messages.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-500 text-sm">
                No messages yet. Start the conversation!
              </div>
            ) : (
              messages.map((msg, idx) => {
                const isMe = msg.senderId === user?.id;
                return (
                  <div key={idx} className={`chat ${isMe ? "chat-end" : "chat-start"}`}>
                    <div className="chat-image avatar">
                      <div className="w-8 rounded-full">
                        <img src={msg.senderImage || "https://avatar.iran.liara.run/public"} alt={msg.senderName} />
                      </div>
                    </div>
                    <div className="chat-header text-xs text-gray-400 mb-1">
                      {msg.senderName}{" "}
                      <time className="text-[10px] opacity-60">
                        {new Date(msg.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </time>
                    </div>
                    <div
                      className={`chat-bubble text-sm break-words ${
                        isMe ? "chat-bubble-primary text-white" : "bg-neutral text-white"
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSendMessage} className="p-3 bg-[#17191c] border-t border-[#3a3d44] flex gap-2">
            <input
              type="text"
              placeholder="Type a message..."
              className="input input-bordered input-sm flex-1 bg-base-300 text-white border-[#3a3d44] focus:outline-none"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
            />
            <button type="submit" className="btn btn-primary btn-sm">
              Send
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export default VideoCallUI;
