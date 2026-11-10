import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import os from "node:os";
import path from "node:path";
import rateLimit from "express-rate-limit";
import { unlink } from "node:fs/promises";
import { runAgent } from "./agent.js";
import { ingestData } from "./ingest.js";
import { connectDb, closeDb } from "./db.js";
import {
  recordDocument,
  listDocuments,
  listConversations,
  getConversation,
  deleteConversation,
} from "./store.js";

const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173" }));
app.use(express.json({ limit: "100kb" }));
const limiter = (limit) =>
  rateLimit({
    windowMs: 60_000,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Trop de requêtes, réessayez dans une minute." },
  });

app.use("/api/chat", limiter(20));
app.use("/api/ingest", limiter(5));
const upload = multer({
  storage: multer.diskStorage({
    destination: os.tmpdir(),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || "");
      cb(null, `${Date.now()}-${Math.random().toString(16).slice(2)}${ext}`);
    },
  }),
  fileFilter: (_req, file, cb) => {
    const isPdf =
      file.mimetype === "application/pdf" ||
      (file.originalname || "").toLowerCase().endsWith(".pdf");
    cb(isPdf ? null : new Error("Only PDF files are allowed"), isPdf);
  },
  limits: { fileSize: 25 * 1024 * 1024 },
});

const handle = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

app.get("/api/health", (_req, res) => res.json({ ok: true }));

/* ---- Chat ---- */
app.post(
  "/api/chat",
  handle(async (req, res) => {
    const { message, sessionId } = req.body ?? {};
    if (typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ error: "Message required" });
    }
    if (message.length > 4000) return res.status(400).json({ error: "Message too long" });

    const { output, sources } = await runAgent({ message: message.trim(), sessionId });
    res.json({ answer: output || "Je n'ai pas pu générer de réponse, pouvez-vous reformuler ?", sources });
  })
);

/* ---- Historique des conversations ---- */
app.get("/api/conversations", handle(async (_req, res) => res.json(await listConversations())));

app.get(
  "/api/conversations/:sessionId",
  handle(async (req, res) => {
    const convo = await getConversation(req.params.sessionId);
    if (!convo) return res.status(404).json({ error: "Conversation not found" });
    res.json(convo);
  })
);

app.delete(
  "/api/conversations/:sessionId",
  handle(async (req, res) => {
    const ok = await deleteConversation(req.params.sessionId);
    res.status(ok ? 200 : 404).json({ ok });
  })
);

/* ---- Documents ---- */
app.get("/api/documents", handle(async (_req, res) => res.json(await listDocuments())));

app.post("/api/ingest", upload.single("file"), async (req, res) => {
  const tmp = req.file?.path;
  try {
    if (!tmp) return res.status(400).json({ error: "Missing PDF file" });
    const name = req.file.originalname;
    const { chunks } = await ingestData(tmp, name);
    await recordDocument({ name, chunks, size: req.file.size });
    res.json({ ok: true, chunks });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    if (tmp) await unlink(tmp).catch(() => undefined);
  }
});

// Erreurs multer (fichier trop gros, mauvais type)
app.use((err, _req, res, _next) => res.status(400).json({ error: err.message }));

try {
  await connectDb();
  app.listen(3001, () => console.log("🚀 Server running on port 3001"));
} catch (err) {
  console.error("❌ MongoDB connection failed:", err.message);
  console.error("   Vérifiez que MongoDB tourne et que MONGODB_URI est correct.");
  process.exit(1);
}

process.on("SIGINT", async () => {
  await closeDb();
  process.exit(0);
});
