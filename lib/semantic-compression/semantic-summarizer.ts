/**
 * Semantic Summarizer
 * Extracts key semantic information from generated sections
 * Keywords, entities, tone, themes, formatting patterns
 */

import { SemanticSummary } from './types';
import crypto from 'crypto';

/**
 * Generate semantic summary from section content
 */
export async function generateSemanticSummary(
  sectionTitle: string,
  sectionContent: string
): Promise<SemanticSummary> {
  // Extract keywords using simple NLP
  const keywords = extractKeywords(sectionContent);
  
  // Extract entities (skills, names, tools, etc.)
  const entities = extractEntities(sectionContent);
  
  // Detect tone from writing style
  const tone = detectTone(sectionContent);
  
  // Extract key themes/topics
  const keyThemes = extractThemes(sectionContent);
  
  // Detect formatting patterns
  const formattingPatterns = detectFormattingPatterns(sectionContent);
  
  // Generate content hash for duplicate detection
  const contentHash = generateContentHash(sectionContent);
  
  return {
    section: sectionTitle,
    keywords,
    entities,
    tone,
    keyThemes,
    formattingPatterns,
    contentHash,
    timestamp: Date.now(),
  };
}

/**
 * Extract keywords using TF-IDF-like scoring with stopwords filtering
 */
function extractKeywords(text: string, topN = 10): string[] {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
    'from', 'as', 'is', 'was', 'are', 'were', 'been', 'being', 'have', 'has', 'had', 'do',
    'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'shall',
    'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they',
    'my', 'your', 'his', 'her', 'its', 'our', 'their', 'which', 'who', 'what', 'when',
    'where', 'why', 'how', 'be', 'am', 'etc', 'able', 'also', 'more', 'most', 'very',
    'it', 'all', 'no', 'not', 'just', 'only', 'some', 'there', 'about', 'if'
  ]);

  // Split and clean text
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 3 && !stopWords.has(word));

  // Count frequency
  const frequency = new Map<string, number>();
  words.forEach(word => {
    frequency.set(word, (frequency.get(word) || 0) + 1);
  });

  // Sort by frequency and return top N
  return Array.from(frequency.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([word]) => word);
}

/**
 * Extract named entities and categories (skills, tools, metrics, etc.)
 */
function extractEntities(text: string): Record<string, string[]> {
  const entities: Record<string, string[]> = {
    skills: [],
    tools: [],
    metrics: [],
    names: [],
    organizations: [],
  };

  // Extract metrics (numbers with units/percentages)
  const metricPattern = /(\d+[%+\-]|\d+\s*(?:years?|months?|weeks?|days?|dollars?|usd))/gi;
  const metricsMatches = text.match(metricPattern) || [];
  entities.metrics = [...new Set(metricsMatches.map(m => m.trim()))].slice(0, 10);

  // Extract capitalized phrases (likely names/organizations)
  const namePattern = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g;
  const namesMatches = text.match(namePattern) || [];
  entities.names = [...new Set(namesMatches)].slice(0, 10);

  // Extract common programming skills/tools from text
  const techKeywords = [
    'python', 'javascript', 'typescript', 'react', 'node', 'django', 'fastapi',
    'tensorflow', 'pytorch', 'aws', 'gcp', 'azure', 'kubernetes', 'docker',
    'sql', 'postgresql', 'mongodb', 'redis', 'elasticsearch', 'git', 'ci/cd',
    'ml', 'ai', 'api', 'rest', 'graphql', 'websocket', 'microservices'
  ];
  const lowerText = text.toLowerCase();
  entities.skills = techKeywords.filter(
    skill => lowerText.includes(skill)
  ).slice(0, 15);

  return entities;
}

/**
 * Detect writing tone from linguistic patterns
 */
function detectTone(text: string): string {
  const lowerText = text.toLowerCase();
  const wordCount = text.split(/\s+/).length;
  
  // Tone indicators
  const formalIndicators = ['therefore', 'moreover', 'furthermore', 'consequently', 'accordance'];
  const casualIndicators = ['like', 'really', 'basically', 'literally', 'honestly'];
  const technicalIndicators = ['algorithm', 'architecture', 'optimization', 'scalability', 'infrastructure'];
  const actionOrientedIndicators = ['led', 'developed', 'implemented', 'optimized', 'designed', 'built'];
  
  let formalScore = formalIndicators.filter(word => lowerText.includes(word)).length;
  let casualScore = casualIndicators.filter(word => lowerText.includes(word)).length;
  let technicalScore = technicalIndicators.filter(word => lowerText.includes(word)).length;
  let actionScore = actionOrientedIndicators.filter(word => lowerText.includes(word)).length;
  
  // Normalize by word count
  formalScore = (formalScore / wordCount) * 100;
  casualScore = (casualScore / wordCount) * 100;
  technicalScore = (technicalScore / wordCount) * 100;
  actionScore = (actionScore / wordCount) * 100;
  
  const scores = {
    formal: formalScore,
    casual: casualScore,
    technical: technicalScore,
    'action-oriented': actionScore,
    'ATS-friendly': actionScore > technicalScore ? 'high' : 'medium'
  };
  
  // Return dominant tone
  const maxScore = Math.max(formalScore, casualScore, technicalScore, actionScore);
  if (maxScore === formalScore) return 'formal';
  if (maxScore === casualScore) return 'casual';
  if (maxScore === technicalScore) return 'technical';
  if (maxScore === actionScore) return 'action-oriented';
  return 'neutral';
}

/**
 * Extract key themes/topics from text
 */
function extractThemes(text: string): string[] {
  const themes: string[] = [];
  
  // Common theme patterns
  const themePatterns = [
    { pattern: /leadership|team|manage|lead/gi, theme: 'Leadership' },
    { pattern: /innovation|develop|create|design|build/gi, theme: 'Innovation' },
    { pattern: /optimize|improve|efficient|performance/gi, theme: 'Optimization' },
    { pattern: /growth|scale|expand|increase|revenue/gi, theme: 'Growth' },
    { pattern: /strategy|plan|roadmap|vision|goal/gi, theme: 'Strategy' },
    { pattern: /collaborate|team|partner|communicate/gi, theme: 'Collaboration' },
    { pattern: /data|analysis|insight|metric|measure/gi, theme: 'Data-Driven' },
    { pattern: /customer|client|user|experience|satisfaction/gi, theme: 'Customer-Focused' },
    { pattern: /quality|reliability|testing|bug|fix/gi, theme: 'Quality Assurance' },
    { pattern: /security|privacy|compliance|protect/gi, theme: 'Security & Compliance' },
  ];
  
  themePatterns.forEach(({ pattern, theme }) => {
    if (pattern.test(text)) {
      themes.push(theme);
    }
  });
  
  return [...new Set(themes)]; // Remove duplicates
}

/**
 * Detect formatting patterns (bullet points, lists, etc.)
 */
function detectFormattingPatterns(text: string): string[] {
  const patterns: string[] = [];
  
  const bulletCount = (text.match(/^[\s]*[-•*]\s/gm) || []).length;
  const numberListCount = (text.match(/^\s*\d+\.\s/gm) || []).length;
  const paragraphCount = text.split(/\n\n+/).length;
  const averageParagraphLength = text.split(/\n\n+/).reduce((a, b) => a + b.length, 0) / paragraphCount;
  
  if (bulletCount > 3) patterns.push('bullet-points');
  if (numberListCount > 3) patterns.push('numbered-list');
  if (paragraphCount > 5) patterns.push('multi-paragraph');
  if (averageParagraphLength > 200) patterns.push('dense-paragraphs');
  if (averageParagraphLength < 50) patterns.push('short-sentences');
  
  const hasLinks = /https?:\/\//gi.test(text);
  if (hasLinks) patterns.push('contains-links');
  
  const hasCode = /```|`.*?`/g.test(text);
  if (hasCode) patterns.push('contains-code');
  
  return patterns;
}

/**
 * Generate hash of content for duplicate detection
 */
function generateContentHash(content: string): string {
  return crypto
    .createHash('sha256')
    .update(content)
    .digest('hex')
    .slice(0, 12);
}

/**
 * Batch process multiple sections
 */
export async function generateBatchSummaries(
  sections: Array<{ title: string; content: string }>
): Promise<SemanticSummary[]> {
  return Promise.all(
    sections.map(section =>
      generateSemanticSummary(section.title, section.content)
    )
  );
}
