/**
 * Semantic Context Compression Pipeline
 * Main orchestrator for semantic memory and context compression
 */

import { generateSemanticSummary, generateBatchSummaries } from './semantic-summarizer';
import {
  EmbeddingStore,
  retrieveRelevantContext,
  rankSectionsByRelevance,
  compressContextWithSummaries,
  formatSummaryForContext,
} from './embedding-retriever';
import {
  checkForDuplicate,
  findContentMatches,
  detectRepeatedKeywords,
  detectRepeatedThemes,
  analyzeSectionDiversity,
} from './duplicate-detector';
import { ContextWindowManager, createConsistencyPrompt } from './context-window-manager';
import {
  SemanticSummary,
  ContextCompression,
  RetrievalResult,
  SlidingContextWindow,
} from './types';

/**
 * Main Semantic Compression Pipeline
 * Handles the full pipeline for context compression and consistency
 */
export class SemanticCompressionPipeline {
  private embeddingStore: EmbeddingStore;
  private contextWindowManager: ContextWindowManager;
  private summaries: SemanticSummary[] = [];
  private contentHistory: string[] = [];
  private duplicateFlags: Map<string, boolean> = new Map();

  constructor(windowSize?: number, maxTokens?: number) {
    this.embeddingStore = new EmbeddingStore();
    this.contextWindowManager = new ContextWindowManager(windowSize, maxTokens);
  }

  /**
   * Process a new section and add to pipeline
   */
  async processSectionGeneration(
    sectionTitle: string,
    sectionContent: string,
    sectionId: string
  ): Promise<{
    summary: SemanticSummary;
    isDuplicate: boolean;
    consistencyPrompt?: string;
    warnings?: string[];
  }> {
    // Generate semantic summary
    const summary = await generateSemanticSummary(sectionTitle, sectionContent);
    
    // Check for duplicates
    const duplicateCheck = checkForDuplicate(
      sectionContent,
      summary.contentHash,
      this.summaries,
      0.75
    );

    // Add to history
    this.summaries.push(summary);
    this.contentHistory.push(sectionContent);
    this.duplicateFlags.set(sectionId, duplicateCheck.isDuplicate);

    // Add to embedding store
    this.embeddingStore.addEmbedding(
      sectionContent,
      sectionId,
      sectionTitle,
      this.summaries.length - 1
    );

    // Update context window
    this.contextWindowManager.initialize(this.summaries);
    this.contextWindowManager.jumpToSection(this.summaries.length - 1);

    // Get consistency prompt if not duplicate
    let consistencyPrompt: string | undefined;
    let warnings: string[] = [];

    if (!duplicateCheck.isDuplicate && this.summaries.length > 1) {
      const contextWindow = this.contextWindowManager.getContextWindow();
      consistencyPrompt = createConsistencyPrompt(contextWindow);
    }

    if (duplicateCheck.isDuplicate) {
      warnings.push(
        `Duplicate content detected (similarity: ${(duplicateCheck.similarityScore * 100).toFixed(1)}%). ` +
        duplicateCheck.suggestions?.[0] || ''
      );
    }

    return {
      summary,
      isDuplicate: duplicateCheck.isDuplicate,
      consistencyPrompt,
      warnings,
    };
  }

  /**
   * Retrieve relevant context for generating next section
   */
  retrieveContextForNextSection(query: string, topK = 3): RetrievalResult {
    return retrieveRelevantContext(query, this.summaries, this.embeddingStore, topK);
  }

  /**
   * Get context window for current position
   */
  getContextWindow(): SlidingContextWindow {
    return this.contextWindowManager.getContextWindow();
  }

  /**
   * Move to next section in the pipeline
   */
  moveToNextSection(): void {
    this.contextWindowManager.moveToNextSection();
  }

  /**
   * Rank sections by relevance to a query
   */
  rankSectionsByQuery(query: string): Array<{ summary: SemanticSummary; score: number }> {
    return rankSectionsByRelevance(query, this.summaries);
  }

  /**
   * Compress all context into a summary
   */
  compressContextSummary(maxTokens = 1000): string {
    return compressContextWithSummaries(this.summaries, maxTokens);
  }

  /**
   * Analyze overall document diversity and consistency
   */
  analyzeDocumentDiversity(): {
    diversity: ReturnType<typeof analyzeSectionDiversity>;
    duplicateContent: Map<string, boolean>;
    repeatedKeywords: Map<string, number>;
    repeatedThemes: Map<string, number>;
  } {
    return {
      diversity: analyzeSectionDiversity(this.summaries),
      duplicateContent: this.duplicateFlags,
      repeatedKeywords: detectRepeatedKeywords(this.summaries),
      repeatedThemes: detectRepeatedThemes(this.summaries),
    };
  }

  /**
   * Get all summaries
   */
  getSummaries(): SemanticSummary[] {
    return this.summaries;
  }

  /**
   * Get full context compression state
   */
  getCompressionState(): ContextCompression {
    return {
      summaries: this.summaries,
      embeddings: [],
      contentHistory: this.contentHistory,
      duplicateFlags: this.duplicateFlags,
    };
  }

  /**
   * Reset pipeline
   */
  reset(): void {
    this.embeddingStore.clear();
    this.contextWindowManager.reset();
    this.summaries = [];
    this.contentHistory = [];
    this.duplicateFlags.clear();
  }

  /**
   * Optimize context window based on current tokens
   */
  optimizeContextWindow(): void {
    this.contextWindowManager.optimizeWindowSize();
  }

  /**
   * Get progress
   */
  getProgress(): { current: number; total: number; percentage: number } {
    return this.contextWindowManager.getProgress();
  }
}

/**
 * Export all types and utilities
 */
export * from './types';
export * from './semantic-summarizer';
export * from './embedding-retriever';
export * from './embedding-utils';
export * from './duplicate-detector';
export * from './context-window-manager';
export * from './generation-helper';
