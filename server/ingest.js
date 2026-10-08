import { createHash } from "node:crypto";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { upsertDocuments } from "./pinecone.js";

const BATCH_SIZE = 96;

// ID déterministe : ré-uploader le même PDF écrase les chunks au lieu de les dupliquer
const chunkId = (source, i) =>
  createHash("sha1").update(`${source}:${i}`).digest("hex");

export const ingestData = async (filePath, originalName = "document.pdf") => {
  const docs = await new PDFLoader(filePath).load();
  const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000, chunkOverlap: 200 });
  const chunks = (await splitter.splitDocuments(docs))
    .map((c) => ({ ...c, pageContent: c.pageContent.replace(/\s+/g, " ").trim() }))
    .filter((c) => c.pageContent.length > 20);

  if (chunks.length === 0) {
    throw new Error("Aucun texte extrait : le PDF est probablement scanné (images). Un OCR est nécessaire.");
  }

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const documents = chunks.slice(i, i + BATCH_SIZE).map((c, j) => ({
      _id: chunkId(originalName, i + j),
      chunk_text: c.pageContent,
      page: c.metadata?.loc?.pageNumber ?? null,
      source: originalName,
    }));
    await upsertDocuments(documents);
  }

  console.log(`✅ Ingestion complete: ${chunks.length} chunks (${originalName})`);
  return { chunks: chunks.length };
};
