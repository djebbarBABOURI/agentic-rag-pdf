import { tool } from "langchain";
import { z } from "zod";
import { searchDocuments } from "./pinecone.js";

export const formatContext = (hits) =>
  hits
    .map((h, i) => `[Extrait ${i + 1}${h.page ? `, p.${h.page}` : ""}${h.source ? `, ${h.source}` : ""}]\n${h.text}`)
    .join("\n\n---\n\n");

// Outil LangChain conservé pour un usage "agent" avec un modèle plus puissant
export const searchKnowledgeBase = tool(
  async ({ query }) => {
    const hits = await searchDocuments(query, 5);
    return hits.length ? formatContext(hits) : "No relevant information found in the knowledge base.";
  },
  {
    name: "search_knowledge_base",
    description:
      "Searches the internal knowledge base (uploaded PDF documents). Use it for any question about documents.",
    schema: z.object({
      query: z.string().describe("The search query to look up in the knowledge base"),
    }),
  }
);
