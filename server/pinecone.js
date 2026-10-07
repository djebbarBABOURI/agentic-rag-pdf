import { Pinecone } from "@pinecone-database/pinecone";

const NAMESPACE = "__default__";
const API_VERSION = "2026-07";

let hostPromise;
const getHost = () => {
  if (!hostPromise) {
    const { PINECONE_API_KEY: apiKey, PINECONE_INDEX: index } = process.env;
    if (!apiKey) throw new Error("Missing PINECONE_API_KEY");
    if (!index) throw new Error("Missing PINECONE_INDEX");
    hostPromise = new Pinecone({ apiKey })
      .describeIndex(index)
      .then((d) => d.host)
      .catch((e) => {
        hostPromise = undefined; // permet de réessayer après une erreur
        throw e;
      });
  }
  return hostPromise;
};

const call = async (action, body) => {
  const host = await getHost();
  const res = await fetch(`https://${host}/namespaces/${NAMESPACE}/documents/${action}`, {
    method: "POST",
    headers: {
      "Api-Key": process.env.PINECONE_API_KEY,
      "Content-Type": "application/json",
      "X-Pinecone-Api-Version": API_VERSION,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Pinecone ${action} failed: ${res.status} ${await res.text()}`);
  return res.json().catch(() => ({}));
};

export const upsertDocuments = (documents) => call("upsert", { documents });

// Parsing tolérant de la réponse Pinecone -> [{ text, page, source, score }]
const extractHits = (data) => {
  const hits = data.documents ?? data.results ?? data.matches ?? data.result?.hits ?? [];
  return hits
    .map((h) => {
      const f = h.fields ?? h.document ?? h;
      return {
        text: f.chunk_text,
        page: f.page ?? null,
        source: f.source ?? null,
        score: h._score ?? h.score ?? null,
      };
    })
    .filter((h) => h.text);
};

export const searchDocuments = async (query, topK = 5) => {
  const data = await call("search", {
    top_k: topK,
    score_by: [{ type: "embed", fields: ["chunk_text"], query }],
    include_fields: ["chunk_text", "page", "source"],
  });
  const hits = extractHits(data);
  if (process.env.DEBUG_RAG) {
    console.log(`🔎 "${query}" -> ${hits.length} hit(s)`, JSON.stringify(data).slice(0, 400));
  }
  return hits;
};
