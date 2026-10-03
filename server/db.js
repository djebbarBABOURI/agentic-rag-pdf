import { MongoClient } from "mongodb";

let client;
let db;

export const connectDb = async () => {
  if (db) return db;
  // 127.0.0.1 plutôt que "localhost" : évite les soucis IPv6 avec Node 17+
  const uri = process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017";
  client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
  await client.connect();
  db = client.db(process.env.MONGODB_DB ?? "agentic_assistant");

  await db.collection("conversations").createIndex({ sessionId: 1 }, { unique: true });
  await db.collection("conversations").createIndex({ updatedAt: -1 });
  await db.collection("documents").createIndex({ name: 1 }, { unique: true });

  console.log(`🍃 MongoDB connected (${db.databaseName})`);
  return db;
};

export const getDb = () => {
  if (!db) throw new Error("MongoDB not connected: call connectDb() first");
  return db;
};

export const closeDb = () => client?.close();
