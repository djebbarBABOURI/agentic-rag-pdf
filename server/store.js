import { ObjectId } from "mongodb";
import { getDb } from "./db.js";

const conversations = () => getDb().collection("conversations");
const documents = () => getDb().collection("documents");

/* ---------- Conversations ---------- */

// Derniers messages au format attendu par LangChain : [["user", "..."], ["assistant", "..."]]
export const getHistory = async (sessionId, limit = 8) => {
  const doc = await conversations().findOne(
    { sessionId },
    { projection: { messages: { $slice: -limit } } }
  );
  return (doc?.messages ?? []).map((m) => [m.role === "ai" ? "assistant" : "user", m.text]);
};

export const appendExchange = async (sessionId, question, answer, sources = []) => {
  const now = new Date();
  await conversations().updateOne(
    { sessionId },
    {
      $push: {
        messages: {
          $each: [
            { role: "user", text: question, createdAt: now },
            { role: "ai", text: answer, sources, createdAt: now },
          ],
        },
      },
      $set: { updatedAt: now },
      $setOnInsert: { title: question.slice(0, 60), createdAt: now },
    },
    { upsert: true }
  );
};

export const listConversations = (limit = 50) =>
  conversations()
    .find({}, { projection: { sessionId: 1, title: 1, updatedAt: 1, _id: 0 } })
    .sort({ updatedAt: -1 })
    .limit(limit)
    .toArray();

export const getConversation = (sessionId) =>
  conversations().findOne({ sessionId }, { projection: { _id: 0 } });

export const deleteConversation = async (sessionId) =>
  (await conversations().deleteOne({ sessionId })).deletedCount > 0;

/* ---------- Documents (métadonnées des PDF indexés) ---------- */

export const recordDocument = ({ name, chunks, size }) =>
  documents().updateOne(
    { name },
    { $set: { chunks, size, ingestedAt: new Date() }, $setOnInsert: { _id: new ObjectId() } },
    { upsert: true }
  );

export const listDocuments = () =>
  documents()
    .find({}, { projection: { _id: 0 } })
    .sort({ ingestedAt: -1 })
    .toArray();
