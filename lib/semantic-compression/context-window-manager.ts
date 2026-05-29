/**
 * Sliding Context Window Manager
 * Manages the context window for long-document generation
 * Keeps recent history while planning for upcoming sections
 */

import { SemanticSummary, SlidingContextWindow } from './types';
import { compressContextWithSummaries } from './embedding-retriever';

export class ContextWindowManager {
  private windowSize: number = 3; // Number of previous/upcoming summaries to keep
  private maxContextTokens: number = 2000; // Max tokens for context
  private allSummaries: SemanticSummary[] = [];
  private currentSection: number = 0;

  constructor(windowSize?: number, maxTokens?: number) {
    if (windowSize) this.windowSize = windowSize;
    if (maxTokens) this.maxContextTokens = maxTokens;
  }

  /**
   * Initialize window with all summaries
   */
  initialize(summaries: SemanticSummary[]): void {
    this.allSummaries = summaries;
    this.currentSection = 0;
  }

  /**
   * Get context window for current section
   */
  getContextWindow(): SlidingContextWindow {
    const previousStart = Math.max(0, this.currentSection - this.windowSize);
    const previousSummaries = this.allSummaries.slice(previousStart, this.currentSection);

    const upcomingEnd = Math.min(
      this.allSummaries.length,
      this.currentSection + this.windowSize + 1
    );
    const upcomingSummaries = this.allSummaries.slice(
      this.currentSection + 1,
      upcomingEnd
    );

    const contextString = this.buildContextString(
      previousSummaries,
      upcomingSummaries
    );

    return {
      currentSection: this.currentSection,
      windowSize: this.windowSize,
      previousSummaries,
      upcomingSummaries,
      contextString,
    };
  }

  /**
   * Move to next section
   */
  moveToNextSection(): void {
    if (this.currentSection < this.allSummaries.length - 1) {
      this.currentSection++;
    }
  }

  /**
   * Move to previous section
   */
  moveToPreviousSection(): void {
    if (this.currentSection > 0) {
      this.currentSection--;
    }
  }

  /**
   * Jump to specific section
   */
  jumpToSection(sectionIndex: number): void {
    if (sectionIndex >= 0 && sectionIndex < this.allSummaries.length) {
      this.currentSection = sectionIndex;
    }
  }

  /**
   * Get progress
   */
  getProgress(): { current: number; total: number; percentage: number } {
    const percentage = this.allSummaries.length > 0
      ? (this.currentSection / this.allSummaries.length) * 100
      : 0;

    return {
      current: this.currentSection,
      total: this.allSummaries.length,
      percentage,
    };
  }

  /**
   * Build context string from summaries
   */
  private buildContextString(
    previousSummaries: SemanticSummary[],
    upcomingSummaries: SemanticSummary[]
  ): string {
    let contextString = '';

    if (previousSummaries.length > 0) {
      contextString += '## Previous Context\n\n';
      contextString += compressContextWithSummaries(previousSummaries, this.maxContextTokens / 2);
      contextString += '\n\n';
    }

    if (upcomingSummaries.length > 0) {
      contextString += '## Upcoming Sections\n';
      contextString += upcomingSummaries
        .map(s => `- ${s.section} (keywords: ${s.keywords.slice(0, 3).join(', ')})`)
        .join('\n');
      contextString += '\n\n';
    }

    contextString += '## Consistency Notes\n';
    contextString += this.generateConsistencyNotes(previousSummaries);

    return contextString;
  }

  /**
   * Generate consistency notes from previous sections
   */
  private generateConsistencyNotes(summaries: SemanticSummary[]): string {
    if (summaries.length === 0) {
      return 'This is the first section. Establish tone and key themes here.';
    }

    const notes: string[] = [];

    // Get dominant tone
    const tones = summaries.map(s => s.tone);
    const dominantTone = getMostCommon(tones);
    notes.push(`**Maintain tone**: ${dominantTone}`);

    // Get repeated keywords
    const allKeywords = summaries.flatMap(s => s.keywords);
    const keywordFreq = getFrequency(allKeywords);
    const topKeywords = Object.entries(keywordFreq)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([k]) => k);

    if (topKeywords.length > 0) {
      notes.push(`**Key terms**: Use ${topKeywords.join(', ')} consistently`);
    }

    // Get repeated themes
    const allThemes = summaries.flatMap(s => s.keyThemes);
    const themeFreq = getFrequency(allThemes);
    const topThemes = Object.entries(themeFreq)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([t]) => t);

    if (topThemes.length > 0) {
      notes.push(`**Running themes**: ${topThemes.join(', ')}`);
    }

    // Get formatting patterns
    const patterns = summaries
      .flatMap(s => s.formattingPatterns)
      .filter(p => p.length > 0);
    if (patterns.length > 0) {
      const uniquePatterns = [...new Set(patterns)];
      notes.push(`**Format**: Use ${uniquePatterns.slice(0, 2).join(', ')}`);
    }

    return notes.join('\n');
  }

  /**
   * Estimate tokens in context
   */
  estimateContextTokens(): number {
    const window = this.getContextWindow();
    const estimatedTokensPerSummary = 100;
    return (
      window.previousSummaries.length * estimatedTokensPerSummary +
      window.contextString.length / 4 // Rough estimate: 4 chars per token
    );
  }

  /**
   * Optimize context window if too large
   */
  optimizeWindowSize(): void {
    const tokens = this.estimateContextTokens();
    
    if (tokens > this.maxContextTokens) {
      // Reduce window size
      if (this.windowSize > 1) {
        this.windowSize = Math.ceil(this.windowSize / 2);
      }
    } else if (tokens < this.maxContextTokens * 0.6 && this.windowSize < 5) {
      // Increase window size
      this.windowSize = Math.min(5, Math.ceil(this.windowSize * 1.5));
    }
  }

  /**
   * Reset to initial state
   */
  reset(): void {
    this.currentSection = 0;
    this.allSummaries = [];
  }
}

/**
 * Get most common element from array
 */
function getMostCommon(arr: string[]): string {
  if (arr.length === 0) return '';
  const freq = getFrequency(arr);
  return Object.entries(freq).sort(([, a], [, b]) => b - a)[0]?.[0] || arr[0];
}

/**
 * Calculate frequency of elements
 */
function getFrequency(arr: string[]): Record<string, number> {
  return arr.reduce((acc, item) => {
    acc[item] = (acc[item] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}

/**
 * Create a context prompt for the AI to maintain consistency
 */
export function createConsistencyPrompt(contextWindow: SlidingContextWindow): string {
  return `You are continuing a document. Here is the context to maintain consistency:

${contextWindow.contextString}

Current section number: ${contextWindow.currentSection + 1}/${contextWindow.previousSummaries.length + 1 + contextWindow.upcomingSummaries.length}

Instructions:
1. Maintain the established tone throughout
2. Use consistent terminology with previous sections
3. Avoid repeating content from earlier sections
4. Transition smoothly between sections
5. Keep formatting consistent with previous sections
`;
}
