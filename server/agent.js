import { ChatOllama } from "@langchain/ollama";
import { searchDocuments } from "./pinecone.js";
import { formatContext } from "./tools.js";
import { getHistory, appendExchange } from "./store.js";

const model = new ChatOllama({
  model: process.env.OLLAMA_MODEL ?? "qwen2.5:3b", // qwen2.5:7b recommandé si votre machine le permet
  temperature: 0,
  baseUrl: process.env.OLLAMA_URL ?? "http://localhost:11434",
  numCtx: 8192,
});

const SYSTEM = `Tu es un assistant qui répond à partir de documents PDF fournis par l'utilisateur.
Règles :
- Réponds UNIQUEMENT avec les EXTRAITS fournis dans le message. N'invente rien.
- Si les extraits ne contiennent pas la réponse, dis-le clairement en une phrase.
- Réponds dans la langue de la question, de façon concise, et cite la page (p. X) quand elle est indiquée.`;

const asText = (c) =>
  typeof c === "string" ? c : Array.isArray(c) ? c.map((p) => p.text ?? "").join("") : String(c ?? "");

// Réécrit une question de suivi en question autonome pour la recherche
const standaloneQuestion = async (history, message) => {
  if (history.length === 0) return message;
  const res = await model.invoke([
    ["system", "Reformule la dernière question de l'utilisateur en une question autonome, dans la même langue, en utilisant l'historique. Réponds uniquement avec la question reformulée."],
    ...history.slice(-4),
    ["user", message],
  ]);
  return asText(res.content).trim() || message;
};

export async function runAgent({ sessionId = "default", message }) {
  console.log(`🤖 [${sessionId}] "${message}"`);

  // Historique persistant (MongoDB)
  const history = await getHistory(sessionId);

  // 1. Recherche toujours effectuée avant le modèle
  const query = await standaloneQuestion(history, message);
  const hits = await searchDocuments(query, 6);

  let output;
  if (hits.length === 0) {
    output =
      "Je n'ai trouvé aucune information pertinente dans la base. Vérifiez qu'un PDF a bien été importé (l'indexation peut prendre quelques secondes) ou reformulez votre question.";
  } else {
    // 2. Génération avec le contexte injecté
    const res = await model.invoke([
      ["system", SYSTEM],
      ...history,
      ["user", `EXTRAITS :\n${formatContext(hits)}\n\nQUESTION : ${message}`],
    ]);
    output = asText(res.content).trim();
  }

  const seen = new Set();
  const sources = hits
    .filter((h) => h.source || h.page)
    .map((h) => ({ source: h.source, page: h.page }))
    .filter((s) => !seen.has(`${s.source}|${s.page}`) && seen.add(`${s.source}|${s.page}`));

  // 3. Sauvegarde de l'échange (question brute, sans les extraits)
  await appendExchange(sessionId, message, output, sources);

  console.log(`✅ ${output.slice(0, 100)}...`);
  return { output, sources };
}
