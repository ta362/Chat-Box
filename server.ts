import express from "express";
import http from "http";
import path from "path";
import fs from "fs";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";

interface PostComment {
  id: string;
  postId: string;
  content: string;
  createdAt: number;
  authorToken: string;
  likesCount?: number;
}

interface SerialPost {
  id: string;
  serialNumber: number;
  content: string;
  createdAt: number;
  authorToken: string;
  likesCount: number;
  commentsCount: number;
  likedBy?: string[];
  reactions?: Record<string, number>;
  tag?: string;
  comments?: PostComment[];
}

const DATA_DIR = path.join(process.cwd(), "data");
const POSTS_FILE = path.join(DATA_DIR, "posts.json");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initial sample posts with sequential serial numbers
const INITIAL_POSTS: SerialPost[] = [
  {
    id: "post-init-1",
    serialNumber: 1,
    content: "Welcome to the Anonymous Serial Board! 📝 No accounts, no sign-ups. Every post gets a permanent serial number starting from #1.",
    createdAt: Date.now() - 1000 * 60 * 60,
    authorToken: "anon-system-1",
    likesCount: 14,
    commentsCount: 2,
    likedBy: [],
    reactions: { "🔥": 8, "❤️": 6 },
    tag: "Announcement",
    comments: [
      {
        id: "c-1",
        postId: "post-init-1",
        content: "Awesome! Can anyone post anonymously?",
        createdAt: Date.now() - 1000 * 60 * 45,
        authorToken: "user-alpha",
        likesCount: 3,
      },
      {
        id: "c-2",
        postId: "post-init-1",
        content: "Yes, completely anonymous with serial tracking.",
        createdAt: Date.now() - 1000 * 60 * 30,
        authorToken: "anon-system-1",
        likesCount: 5,
      },
    ],
  },
  {
    id: "post-init-2",
    serialNumber: 2,
    content: "Post #2: You can share thoughts, stories, questions, or ideas. Feel free to leave a like and comment below any post!",
    createdAt: Date.now() - 1000 * 60 * 35,
    authorToken: "anon-system-2",
    likesCount: 9,
    commentsCount: 1,
    likedBy: [],
    reactions: { "💡": 5, "✨": 4 },
    tag: "Thoughts",
    comments: [
      {
        id: "c-3",
        postId: "post-init-2",
        content: "Loving the clean serial numbering layout! 🚀",
        createdAt: Date.now() - 1000 * 60 * 15,
        authorToken: "user-beta",
        likesCount: 2,
      },
    ],
  },
  {
    id: "post-init-3",
    serialNumber: 3,
    content: "Post #3: Drop your honest thoughts here. What should we talk about next?",
    createdAt: Date.now() - 1000 * 60 * 10,
    authorToken: "anon-system-3",
    likesCount: 7,
    commentsCount: 0,
    likedBy: [],
    reactions: { "❤️": 4, "💬": 3 },
    tag: "Discussion",
    comments: [],
  },
];

let posts: SerialPost[] = [];

try {
  if (fs.existsSync(POSTS_FILE)) {
    const data = fs.readFileSync(POSTS_FILE, "utf-8");
    posts = JSON.parse(data);
  } else {
    posts = [...INITIAL_POSTS];
    fs.writeFileSync(POSTS_FILE, JSON.stringify(posts, null, 2), "utf-8");
  }
} catch (err) {
  console.error("Error reading posts file, starting with defaults:", err);
  posts = [...INITIAL_POSTS];
}

function savePostsToDisk() {
  try {
    fs.writeFileSync(POSTS_FILE, JSON.stringify(posts, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to save posts to disk:", err);
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
          posts,
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
        // ignore
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

  app.get("/api/posts", (_req, res) => {
    res.json({
      posts,
      total: posts.length,
      onlineCount: Math.max(1, clients.size),
    });
  });

  app.get("/api/posts/:id", (req, res) => {
    const post = posts.find((p) => p.id === req.params.id || p.serialNumber === Number(req.params.id));
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }
    res.json(post);
  });

  app.post("/api/posts", (req, res) => {
    const { content, text, authorToken, tag } = req.body;
    const postContent = content || text;

    if (!postContent || typeof postContent !== "string" || postContent.trim().length === 0) {
      return res.status(400).json({ error: "Post content is required" });
    }

    const trimmed = postContent.trim();
    if (trimmed.length > 5000) {
      return res.status(400).json({ error: "Post is too long (max 5000 chars)" });
    }

    const nextSerialNumber = posts.length > 0 ? Math.max(...posts.map(p => p.serialNumber)) + 1 : 1;

    const newPost: SerialPost = {
      id: `post-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      serialNumber: nextSerialNumber,
      content: trimmed,
      createdAt: Date.now(),
      authorToken: authorToken || "anon",
      likesCount: 0,
      commentsCount: 0,
      likedBy: [],
      reactions: {},
      tag: tag || undefined,
      comments: [],
    };

    posts.push(newPost);
    savePostsToDisk();

    broadcast({
      type: "post:created",
      payload: newPost,
    });

    res.status(201).json(newPost);
  });

  app.post("/api/posts/:id/like", (req, res) => {
    const { id } = req.params;
    const { authorToken } = req.body;

    const post = posts.find((p) => p.id === id);
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    if (!post.likedBy) post.likedBy = [];
    const token = authorToken || "anon";
    const alreadyLiked = post.likedBy.includes(token);

    if (alreadyLiked) {
      post.likedBy = post.likedBy.filter((t) => t !== token);
      post.likesCount = Math.max(0, post.likesCount - 1);
    } else {
      post.likedBy.push(token);
      post.likesCount = (post.likesCount || 0) + 1;
    }

    savePostsToDisk();

    broadcast({
      type: "post:liked",
      payload: { id: post.id, likesCount: post.likesCount, likedBy: post.likedBy },
    });

    res.json({ id: post.id, likesCount: post.likesCount, liked: !alreadyLiked });
  });

  app.post("/api/posts/:id/comments", (req, res) => {
    const { id } = req.params;
    const { content, authorToken } = req.body;

    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return res.status(400).json({ error: "Comment content is required" });
    }

    const post = posts.find((p) => p.id === id);
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    if (!post.comments) post.comments = [];

    const newComment: PostComment = {
      id: `comm-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      postId: id,
      content: content.trim(),
      createdAt: Date.now(),
      authorToken: authorToken || "anon",
      likesCount: 0,
    };

    post.comments.push(newComment);
    post.commentsCount = post.comments.length;
    savePostsToDisk();

    broadcast({
      type: "comment:created",
      payload: { postId: id, comment: newComment, commentsCount: post.commentsCount },
    });

    res.status(201).json(newComment);
  });

  app.get("/api/stats", (_req, res) => {
    res.json({
      totalPosts: posts.length,
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
    console.log(`Anonymous Serial Board Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});

