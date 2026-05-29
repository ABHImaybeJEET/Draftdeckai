/**
 * Embedding-Based Retriever
 * Retrieves relevant context using semantic similarity
 * Uses cosine similarity for matching
 */

import { EmbeddingVector, RetrievalResult, SemanticSummary } from './types';
import { cosineSimilarity, generateSimpleEmbedding } from './embedding-utils';

/**
 * Store embeddings for retrieval
 */
export class EmbeddingStore {
  private embeddings: EmbeddingVector[] = [];
  private maxStoreSize = 100;

  /**
   * Add or update an embedding
   */
  addEmbedding(
    text: string,
    sectionId: string,
    sectionTitle: string,
    order: number
  ): void {
    const embedding = generateSimpleEmbedding(text);
    
    // Remove old embedding if it exists
    this.embeddings = this.embeddings.filter(e => e.sectionId !== sectionId);
    
    this.embeddings.push({
      text,
      embedding,
      sectionId,
      metadata: {
        section: sectionTitle,
        order,
        contentLength: text.length,
      },
    });

    // Keep store size manageable - remove oldest entries if over limit
    if (this.embeddings.length > this.maxStoreSize) {
      this.embeddings = this.embeddings.slice(-this.maxStoreSize);
    }
  }

  /**
   * Retrieve relevant embeddings based on query
   */
  retrieveRelevant(
    query: string,
    topK = 5,
    minSimilarity = 0.3
  ): EmbeddingVector[] {
    if (this.embeddings.length === 0) return [];

    const queryEmbedding = generateSimpleEmbedding(query);
    
    // Calculate similarities
    const scored = this.embeddings.map(embedding => ({
      embedding,
      similarity: cosineSimilarity(queryEmbedding, embedding.embedding),
    }));

    // Filter by minimum similarity and sort
    return scored
      .filter(item => item.similarity >= minSimilarity)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK)
      .map(item => item.embedding);
  }

  /**
   * Clear all embeddings
   */
  clear(): void {
    this.embeddings = [];
  }

  /**
   * Get store size
   */
  size(): number {
    return this.embeddings.length;
  }
}

/**
 * Retrieve relevant context from summaries and embeddings
 */
export function retrieveRelevantContext(
  query: string,
  summaries: SemanticSummary[],
  embeddingStore: EmbeddingStore,
  topK = 3
): RetrievalResult {
  // Get relevant embeddings
  const relevantEmbeddings = embeddingStore.retrieveRelevant(query, topK);
  
  // Build context from relevant embeddings
  const relevantContent = relevantEmbeddings
    .map(e => e.text)
    .join('\n\n---\n\n');

  // Get corresponding summaries
  const sectionIds = new Set(relevantEmbeddings.map(e => e.sectionId));
  const relevantSummaries = summaries.filter(s => 
    sectionIds.has(s.section)
  );

  // Calculate average similarity
  const queryEmbedding = generateSimpleEmbedding(query);
  const similarities = relevantEmbeddings.map(e => 
    cosineSimilarity(queryEmbedding, e.embedding)
  );
  const avgSimilarity = similarities.length > 0
    ? similarities.reduce((a, b) => a + b) / similarities.length
    : 0;

  return {
    relevantContent,
    relevantSummaries,
    similarity: avgSimilarity,
    sectionReferences: Array.from(sectionIds),
  };
}

/**
 * Rank sections by relevance to query
 */
export function rankSectionsByRelevance(
  query: string,
  summaries: SemanticSummary[]
): Array<{ summary: SemanticSummary; score: number }> {
  const queryKeywords = extractKeywordsFromQuery(query).toLowerCase().split(/\s+/);
  
  return summaries
    .map(summary => {
      let score = 0;

      // Match keywords
      queryKeywords.forEach(keyword => {
        if (summary.keywords.some(k => k.includes(keyword))) score += 2;
        if (summary.keyThemes.some(t => t.toLowerCase().includes(keyword))) score += 1.5;
        Object.values(summary.entities).forEach(entities => {
          if (entities.some(e => e.toLowerCase().includes(keyword))) score += 1;
        });
      });

      // Bonus for matching tone
      if (summary.tone.includes(queryKeywords[0])) score += 0.5;

      return { summary, score };
    })
    .sort((a, b) => b.score - a.score);
}

/**
 * Extract keywords from natural language query
 */
function extractKeywordsFromQuery(query: string): string {
  // Remove common words
  const stopWords = /\b(what|how|why|when|where|which|do|show|get|retrieve|find|about|regarding|concerning)\b/gi;
  return query.replace(stopWords, '').trim();
}

/**
 * Compress context by selecting most relevant summaries
 */
export function compressContextWithSummaries(
  summaries: SemanticSummary[],
  maxTokens = 1000
): string {
  let contextString = '';
  let tokenCount = 0;
  const estimatedTokensPerSummary = 100;

  // Sort by recency first
  const sortedSummaries = [...summaries].sort(
    (a, b) => b.timestamp - a.timestamp
  );

  for (const summary of sortedSummaries) {
    if (tokenCount + estimatedTokensPerSummary > maxTokens) break;

    const summaryString = formatSummaryForContext(summary);
    contextString += summaryString + '\n---\n';
    tokenCount += estimatedTokensPerSummary;
  }

  return contextString;
}

/**
 * Format a summary for inclusion in context
 */
export function formatSummaryForContext(summary: SemanticSummary): string {
  return `[${summary.section}]
Keywords: ${summary.keywords.join(', ')}
Tone: ${summary.tone}
Themes: ${summary.keyThemes.join(', ')}
Key Entities: ${Object.entries(summary.entities)
    .map(([type, values]) => `${type}: ${values.join(', ')}`)
    .join('; ')}`;
}
