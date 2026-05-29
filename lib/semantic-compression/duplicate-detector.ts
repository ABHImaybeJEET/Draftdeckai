/**
 * Duplicate Content Detector
 * Identifies and prevents duplicate/repetitive content across sections
 * Uses content hashing and semantic similarity
 */

import { SemanticSummary } from './types';
import { textSimilarity, cosineSimilarity } from './embedding-utils';

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  similarityScore: number;
  duplicateSection?: string;
  suggestions?: string[];
}

export interface ContentMatch {
  sectionId: string;
  sectionTitle: string;
  similarity: number;
  matchedContent: string;
}

/**
 * Check if content is duplicate based on summaries and content hash
 */
export function checkForDuplicate(
  newContent: string,
  newContentHash: string,
  existingSummaries: SemanticSummary[],
  similarityThreshold = 0.75
): DuplicateCheckResult {
  // Check exact hash match first
  const exactMatch = existingSummaries.find(s => s.contentHash === newContentHash);
  if (exactMatch) {
    return {
      isDuplicate: true,
      similarityScore: 1.0,
      duplicateSection: exactMatch.section,
    };
  }

  // Check semantic similarity
  let maxSimilarity = 0;
  let mostSimilarSection: SemanticSummary | undefined;

  for (const summary of existingSummaries) {
    const similarity = textSimilarity(newContent, summary.section);
    if (similarity > maxSimilarity) {
      maxSimilarity = similarity;
      mostSimilarSection = summary;
    }
  }

  if (maxSimilarity > similarityThreshold) {
    return {
      isDuplicate: true,
      similarityScore: maxSimilarity,
      duplicateSection: mostSimilarSection?.section,
      suggestions: generateDuplicateSuggestions(mostSimilarSection),
    };
  }

  return {
    isDuplicate: false,
    similarityScore: maxSimilarity,
  };
}

/**
 * Find all content matches above threshold
 */
export function findContentMatches(
  content: string,
  summaries: SemanticSummary[],
  similarityThreshold = 0.6
): ContentMatch[] {
  const matches: ContentMatch[] = [];

  for (const summary of summaries) {
    const similarity = textSimilarity(content, summary.section);
    
    if (similarity >= similarityThreshold) {
      matches.push({
        sectionId: summary.section,
        sectionTitle: summary.section,
        similarity,
        matchedContent: summary.section,
      });
    }
  }

  return matches.sort((a, b) => b.similarity - a.similarity);
}

/**
 * Generate suggestions to avoid duplication
 */
function generateDuplicateSuggestions(duplicateSummary?: SemanticSummary): string[] {
  if (!duplicateSummary) return [];

  const suggestions: string[] = [];

  // Suggest combining with duplicate section
  suggestions.push(
    `This content is very similar to the "${duplicateSummary.section}" section. ` +
    `Consider merging them or providing a different angle.`
  );

  // Suggest new themes
  if (duplicateSummary.keyThemes.length > 0) {
    suggestions.push(
      `The duplicate section focuses on: ${duplicateSummary.keyThemes.slice(0, 3).join(', ')}. ` +
      `Try adding new themes or perspectives.`
    );
  }

  // Suggest different tone/style
  suggestions.push(
    `Try adjusting the tone or writing style. ` +
    `The duplicate section uses a "${duplicateSummary.tone}" tone.`
  );

  return suggestions.slice(0, 3);
}

/**
 * Detect repeated keywords across sections
 */
export function detectRepeatedKeywords(
  summaries: SemanticSummary[],
  minOccurrences = 3
): Map<string, number> {
  const keywordCounts = new Map<string, number>();

  summaries.forEach(summary => {
    summary.keywords.forEach(keyword => {
      const lower = keyword.toLowerCase();
      keywordCounts.set(lower, (keywordCounts.get(lower) || 0) + 1);
    });
  });

  // Filter to repeated keywords
  const repeated = new Map<string, number>();
  keywordCounts.forEach((count, keyword) => {
    if (count >= minOccurrences) {
      repeated.set(keyword, count);
    }
  });

  return repeated;
}

/**
 * Detect repeated themes across sections
 */
export function detectRepeatedThemes(
  summaries: SemanticSummary[],
  minOccurrences = 2
): Map<string, number> {
  const themeCounts = new Map<string, number>();

  summaries.forEach(summary => {
    summary.keyThemes.forEach(theme => {
      themeCounts.set(theme, (themeCounts.get(theme) || 0) + 1);
    });
  });

  // Filter to repeated themes
  const repeated = new Map<string, number>();
  themeCounts.forEach((count, theme) => {
    if (count >= minOccurrences) {
      repeated.set(theme, count);
    }
  });

  return repeated;
}

/**
 * Analyze section diversity
 */
export function analyzeSectionDiversity(
  summaries: SemanticSummary[]
): {
  uniqueSections: number;
  averageSimilarity: number;
  diversityScore: number;
  warnings: string[];
} {
  if (summaries.length < 2) {
    return {
      uniqueSections: summaries.length,
      averageSimilarity: 0,
      diversityScore: 1.0,
      warnings: [],
    };
  }

  const warnings: string[] = [];
  let totalSimilarity = 0;
  let comparisons = 0;

  // Compare all pairs
  for (let i = 0; i < summaries.length; i++) {
    for (let j = i + 1; j < summaries.length; j++) {
      const sim = textSimilarity(
        summaries[i].section,
        summaries[j].section
      );
      totalSimilarity += sim;
      comparisons++;
    }
  }

  const averageSimilarity = comparisons > 0 ? totalSimilarity / comparisons : 0;
  const diversityScore = 1 - averageSimilarity; // Higher is better

  // Generate warnings based on diversity
  if (averageSimilarity > 0.6) {
    warnings.push(
      `Low content diversity detected (similarity: ${(averageSimilarity * 100).toFixed(1)}%). ` +
      `Consider adding more varied content to sections.`
    );
  }

  // Check for repeated keywords
  const repeatedKeywords = detectRepeatedKeywords(summaries);
  if (repeatedKeywords.size > 5) {
    warnings.push(
      `Many repeated keywords detected (${repeatedKeywords.size} keywords appearing 3+ times). ` +
      `Consider using more varied vocabulary.`
    );
  }

  // Check for repeated themes
  const repeatedThemes = detectRepeatedThemes(summaries);
  if (repeatedThemes.size > 2) {
    const themes = Array.from(repeatedThemes.keys()).join(', ');
    warnings.push(
      `Repeated themes found: ${themes}. ` +
      `Try introducing new perspectives or aspects.`
    );
  }

  return {
    uniqueSections: summaries.length,
    averageSimilarity,
    diversityScore,
    warnings,
  };
}

/**
 * Generate content differentiation suggestions
 */
export function generateDifferentiationSuggestions(
  currentSection: SemanticSummary,
  allSummaries: SemanticSummary[]
): string[] {
  const suggestions: string[] = [];

  // Find similar sections
  const similar = allSummaries
    .filter(s => s.section !== currentSection.section)
    .map(s => ({
      summary: s,
      similarity: textSimilarity(currentSection.section, s.section),
    }))
    .filter(item => item.similarity > 0.5)
    .sort((a, b) => b.similarity - a.similarity);

  if (similar.length > 0) {
    const similarTheme = similar[0].summary.keyThemes[0];
    if (similarTheme) {
      suggestions.push(
        `The "${similar[0].summary.section}" section already covers ${similarTheme}. ` +
        `Focus on a different angle or add complementary information.`
      );
    }
  }

  // Suggest using complementary themes
  const usedThemes = new Set(
    allSummaries.flatMap(s => s.keyThemes)
  );
  const allThemes = [
    'Leadership', 'Innovation', 'Optimization', 'Growth', 'Strategy',
    'Collaboration', 'Data-Driven', 'Customer-Focused', 'Quality Assurance',
    'Security & Compliance'
  ];
  const unusedThemes = allThemes.filter(t => !usedThemes.has(t));
  
  if (unusedThemes.length > 0) {
    suggestions.push(
      `Consider incorporating: ${unusedThemes.slice(0, 2).join(', ')} ` +
      `to add variety.`
    );
  }

  return suggestions.slice(0, 3);
}
