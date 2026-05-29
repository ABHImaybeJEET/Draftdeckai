/**
 * Embedding Utilities
 * Simple embedding generation and vector operations
 * Uses TF-IDF-like approach for lightweight embeddings without external models
 */

/**
 * Generate a simple embedding from text
 * Uses word frequency and position weighting for semantic representation
 */
export function generateSimpleEmbedding(text: string, dimension = 384): number[] {
  // Normalize text
  const normalizedText = text.toLowerCase().trim();
  const words = normalizedText.split(/\s+/);
  
  // Create vocabulary from text
  const vocabulary = buildVocabulary(normalizedText);
  
  // Initialize embedding vector
  const embedding = new Array(dimension).fill(0);
  
  // Calculate TF-IDF-like scores
  words.forEach((word, index) => {
    // Only process meaningful words
    if (word.length < 3) return;
    
    const wordIndex = vocabulary.indexOf(word);
    if (wordIndex === -1) return;
    
    // Position weight (more importance to earlier words)
    const positionWeight = 1 / (1 + index * 0.1);
    
    // Word frequency in text
    const frequency = words.filter(w => w === word).length;
    const tfScore = Math.log(frequency + 1) * positionWeight;
    
    // Distribute across embedding dimensions
    const bucketSize = Math.ceil(vocabulary.length / dimension);
    const bucketIndex = Math.min(Math.floor(wordIndex / bucketSize), dimension - 1);
    embedding[bucketIndex] += tfScore;
  });
  
  // Normalize embedding
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  if (magnitude > 0) {
    return embedding.map(val => val / magnitude);
  }
  
  return embedding;
}

/**
 * Build vocabulary from text (used for embedding generation)
 */
function buildVocabulary(text: string): string[] {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
    'from', 'as', 'is', 'was', 'are', 'were', 'been', 'be', 'have', 'has', 'had', 'do',
    'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can'
  ]);

  const words = text
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word));

  return [...new Set(words)].sort().slice(0, 1000); // Limit vocabulary
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(vec1: number[], vec2: number[]): number {
  if (vec1.length !== vec2.length) {
    throw new Error('Vectors must have the same dimension');
  }

  let dotProduct = 0;
  let magnitude1 = 0;
  let magnitude2 = 0;

  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    magnitude1 += vec1[i] * vec1[i];
    magnitude2 += vec2[i] * vec2[i];
  }

  magnitude1 = Math.sqrt(magnitude1);
  magnitude2 = Math.sqrt(magnitude2);

  if (magnitude1 === 0 || magnitude2 === 0) {
    return 0;
  }

  return dotProduct / (magnitude1 * magnitude2);
}

/**
 * Calculate Euclidean distance between vectors
 */
export function euclideanDistance(vec1: number[], vec2: number[]): number {
  if (vec1.length !== vec2.length) {
    throw new Error('Vectors must have the same dimension');
  }

  let sum = 0;
  for (let i = 0; i < vec1.length; i++) {
    const diff = vec1[i] - vec2[i];
    sum += diff * diff;
  }

  return Math.sqrt(sum);
}

/**
 * Calculate Jaccard similarity between two sets of strings
 */
export function jaccardSimilarity(set1: string[], set2: string[]): number {
  const s1 = new Set(set1.map(s => s.toLowerCase()));
  const s2 = new Set(set2.map(s => s.toLowerCase()));

  const intersection = new Set([...s1].filter(x => s2.has(x)));
  const union = new Set([...s1, ...s2]);

  return union.size > 0 ? intersection.size / union.size : 0;
}

/**
 * Normalize vector to unit length
 */
export function normalizeVector(vec: number[]): number[] {
  const magnitude = Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0));
  if (magnitude === 0) return vec;
  return vec.map(val => val / magnitude);
}

/**
 * Calculate similarity between text samples (simple approach)
 */
export function textSimilarity(text1: string, text2: string): number {
  const embedding1 = generateSimpleEmbedding(text1);
  const embedding2 = generateSimpleEmbedding(text2);
  return cosineSimilarity(embedding1, embedding2);
}
