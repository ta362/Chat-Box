// In-memory fallback message cache for Vercel serverless functions
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

const globalMessages: ChatMessage[] = [
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

export default function handler(req: any, res: any) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'GET') {
    return res.status(200).json({
      messages: globalMessages,
      total: globalMessages.length,
      onlineCount: Math.floor(Math.random() * 5) + 3,
    });
  }

  if (req.method === 'POST') {
    const { text, authorToken, replyTo } = req.body || {};

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({ error: 'Message text is required' });
    }

    const trimmedText = text.trim();
    const nextSerialNumber =
      globalMessages.length > 0
        ? globalMessages[globalMessages.length - 1].serialNumber + 1
        : 1;

    const newMessage: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      serialNumber: nextSerialNumber,
      text: trimmedText,
      createdAt: Date.now(),
      authorToken: authorToken || undefined,
      reactions: {},
      replyTo:
        replyTo && replyTo.serialNumber && replyTo.text
          ? {
              serialNumber: Number(replyTo.serialNumber),
              text: String(replyTo.text).substring(0, 120),
            }
          : null,
    };

    globalMessages.push(newMessage);
    return res.status(201).json(newMessage);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
