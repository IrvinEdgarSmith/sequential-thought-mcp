import { db } from "./state.js";

// Basic text chunker
function chunkText(text: string, chunkSize: number = 500, overlap: number = 50): string[] {
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    chunks.push(text.substring(i, i + chunkSize));
    i += chunkSize - overlap;
  }
  return chunks;
}

// Very basic BM25-ish keyword scorer
function scoreChunk(chunk: string, query: string): number {
  const terms = query.toLowerCase().split(/\W+/).filter(t => t.length > 2);
  let score = 0;
  const chunkLower = chunk.toLowerCase();
  
  for (const term of terms) {
    // Term frequency in this chunk
    const count = (chunkLower.match(new RegExp(term, 'g')) || []).length;
    if (count > 0) {
      score += Math.log(1 + count);
    }
  }
  return score;
}

export function storeDocument(sessionId: string, docId: string, content: string): void {
  const chunks = chunkText(content);
  db.storeRagChunks(sessionId, docId, chunks);
}

export function queryDocument(sessionId: string, docId: string, query: string, topK: number = 2): string {
  const chunks = db.getRagChunks(sessionId, docId);
  if (!chunks || chunks.length === 0) {
    throw new Error(`Document '${docId}' not found or has no content.`);
  }

  const scored = chunks.map(chunk => ({
    chunk,
    score: scoreChunk(chunk, query)
  }));

  scored.sort((a, b) => b.score - a.score);
  
  const bestChunks = scored.slice(0, topK).filter(s => s.score > 0).map(s => s.chunk);
  
  if (bestChunks.length === 0) {
    return `[No highly relevant information found in document '${docId}' for query '${query}']`;
  }

  // Enforce context economics (truncation if it gets too large)
  let result = bestChunks.join("\n\n... [PRUNED] ...\n\n");
  if (result.length > 2000) {
    result = result.substring(0, 2000) + "\n\n[TRUNCATED: Result exceeded 2000 characters. Refine your query.]";
  }

  return result;
}
