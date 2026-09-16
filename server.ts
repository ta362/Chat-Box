import express from "express";
import http from "http";
import path from "path";
import fs from "fs";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";

interface ChatMessage {
  id: string;
  serialNumber: number;
  text: string;
  createdAt: number;
  authorToken?: string;
  reactions?: Record<string, number>;
  replyTo?: {
    serialNumber: number;
    text: string;
  } | null;
}

const DATA_DIR = path.join(process.cwd(), "data");
const MESSAGES_FILE = path.join(DATA_DIR, "messages.json");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initial sample messages for new installations
const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: "msg-init-1",
    serialNumber: 1,
    text: "Welcome to Anonymous Live Chat! 👋 No accounts, no user details. Completely open for everyone.",
    createdAt: Date.now() - 1000 * 60 * 15,
    reactions: { "👋": 4, "✨": 3 },
  },
  {
    id: "msg-init-2",
    serialNumber: 2,
    text: "Every message is recorded in serial order. Anyone who opens or downloads this app will see the real-time continuous stream.",
    createdAt: Date.now() - 1000 * 60 * 10,
    reactions: { "❤️": 2, "🔥": 5 },
  },
  {
    id: "msg-init-3",
    serialNumber: 3,
    text: "Say whatever is on your mind! Keep it respectful and enjoy true anonymous freedom. 💬",
    createdAt: Date.now() - 1000 * 60 * 4,
    reactions: { "💡": 3 },
  },
];

let messages: ChatMessage[] = [];

try {
  if (fs.existsSync(MESSAGES_FILE)) {
    const data = fs.readFileSync(MESSAGES_FILE, "utf-8");
    messages = JSON.parse(data);
  } else {
    messages = [...INITIAL_MESSAGES];
    fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messages, null, 2), "utf-8");
  }
} catch (err) {
  console.error("Error reading messages file, starting with defaults:", err);
  messages = [...INITIAL_MESSAGES];
}

function saveMessagesToDisk() {
  try {
    fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messages, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to save messages to disk:", err);
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;
  const server = http.createServer(app);

  app.use(express.json());

  // WebSocket Server attached to the same HTTP server
  const wss = new WebSocketServer({ server });
  const clients = new Set<WebSocket>();

  function broadcast(data: object) {
    const payload = JSON.stringify(data);
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  }

  function broadcastPresence() {
    broadcast({
      type: "presence:update",
      payload: { onlineCount: Math.max(1, clients.size) },
    });
  }

  wss.on("connection", (ws: WebSocket) => {
    clients.add(ws);
    broadcastPresence();

    // Send initial snapshot
    ws.send(
      JSON.stringify({
        type: "init",
        payload: {
          messages,
          onlineCount: Math.max(1, clients.size),
        },
      })
    );

    ws.on("message", (raw) => {
      try {
        const parsed = JSON.parse(raw.toString());
        if (parsed.type === "ping") {
          ws.send(JSON.stringify({ type: "pong" }));
        }
      } catch (e) {
        // ignore malformed ws messages
      }
    });

    ws.on("close", () => {
      clients.delete(ws);
      broadcastPresence();
    });

    ws.on("error", () => {
      clients.delete(ws);
      broadcastPresence();
    });
  });

  // REST API Endpoints
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: Date.now() });
  });

  app.get("/api/messages", (_req, res) => {
    res.json({
      messages,
      total: messages.length,
      onlineCount: Math.max(1, clients.size),
    });
  });

  app.post("/api/messages", (req, res) => {
    const { text, authorToken, replyTo } = req.body;

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return res.status(400).json({ error: "Message text is required" });
    }

    const trimmedText = text.trim();
    if (trimmedText.length > 2000) {
      return res.status(400).json({ error: "Message is too long (max 2000 chars)" });
    }

    const nextSerialNumber = messages.length > 0 ? messages[messages.length - 1].serialNumber + 1 : 1;

    const newMessage: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      serialNumber: nextSerialNumber,
      text: trimmedText,
      createdAt: Date.now(),
      authorToken: authorToken || undefined,
      reactions: {},
      replyTo: replyTo && replyTo.serialNumber && replyTo.text ? {
        serialNumber: Number(replyTo.serialNumber),
        text: String(replyTo.text).substring(0, 120),
      } : null,
    };

    messages.push(newMessage);
    saveMessagesToDisk();

    // Broadcast to all connected clients
    broadcast({
      type: "message:created",
      payload: newMessage,
    });

    res.status(201).json(newMessage);
  });

  app.post("/api/messages/:id/react", (req, res) => {
    const { id } = req.params;
    const { emoji } = req.body;

    if (!emoji || typeof emoji !== "string") {
      return res.status(400).json({ error: "Valid emoji string is required" });
    }

    const msg = messages.find((m) => m.id === id);
    if (!msg) {
      return res.status(404).json({ error: "Message not found" });
    }

    if (!msg.reactions) {
      msg.reactions = {};
    }

    msg.reactions[emoji] = (msg.reactions[emoji] || 0) + 1;
    saveMessagesToDisk();

    broadcast({
      type: "message:reaction",
      payload: {
        id: msg.id,
        reactions: msg.reactions,
      },
    });

    res.json({ id: msg.id, reactions: msg.reactions });
  });

  app.get("/api/stats", (_req, res) => {
    res.json({
      totalMessages: messages.length,
      onlineCount: Math.max(1, clients.size),
    });
  });

  // Vite middleware in dev / Static serve in prod
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Anonymous Chat Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
