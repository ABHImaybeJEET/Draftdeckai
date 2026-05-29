/**
 * Semantic Context Compression Types
 * Lightweight types for semantic memory and context management
 */

export interface SemanticSummary {
  section: string;
  keywords: string[];
  entities: Record<string, string[]>;
  tone: string;
  keyThemes: string[];
  formattingPatterns: string[];
  contentHash: string;
  timestamp: number;
}

export interface EmbeddingVector {
  text: string;
  embedding: number[];
  sectionId: string;
  metadata: {
    section: string;
    order: number;
    contentLength: number;
  };
}

export interface ContextCompression {
  summaries: SemanticSummary[];
  embeddings: EmbeddingVector[];
  contentHistory: string[];
  duplicateFlags: Map<string, boolean>;
}

export interface RetrievalResult {
  relevantContent: string;
  relevantSummaries: SemanticSummary[];
  similarity: number;
  sectionReferences: string[];
}

export interface SlidingContextWindow {
  currentSection: number;
  windowSize: number;
  previousSummaries: SemanticSummary[];
  upcomingSummaries: SemanticSummary[];
  contextString: string;
}
