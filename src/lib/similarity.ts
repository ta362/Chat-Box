import { SerialPost } from '../types';

/**
 * Normalizes text for similarity comparison.
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s\u0980-\u09FF]/g, '') // Keep alphanumeric & Bengali chars
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculates word-level Jaccard similarity coefficient between 0 and 1.
 */
function calculateSimilarity(str1: string, str2: string): number {
  const norm1 = normalizeText(str1);
  const norm2 = normalizeText(str2);

  if (norm1 === norm2) return 1.0;
  if (!norm1 || !norm2) return 0.0;

  const words1 = new Set(norm1.split(' ').filter(w => w.length > 2));
  const words2 = new Set(norm2.split(' ').filter(w => w.length > 2));

  if (words1.size === 0 || words2.size === 0) {
    return norm1 === norm2 ? 1.0 : 0.0;
  }

  let intersection = 0;
  words1.forEach(word => {
    if (words2.has(word)) intersection++;
  });

  const union = words1.size + words2.size - intersection;
  return union > 0 ? intersection / union : 0;
}

export interface SimilarityCheckResult {
  isDuplicate: boolean;
  matchedPost?: SerialPost;
  similarityPercentage: number;
}

/**
 * Checks if a candidate post content is a duplicate or highly similar to any existing post.
 */
export function checkIsSimilarPost(
  newContent: string,
  existingPosts: SerialPost[],
  threshold: number = 0.75
): SimilarityCheckResult {
  const normNew = normalizeText(newContent);
  if (!normNew || normNew.length < 5) {
    return { isDuplicate: false, similarityPercentage: 0 };
  }

  for (const post of existingPosts) {
    const normExisting = normalizeText(post.content);
    if (!normExisting) continue;

    // 1. Exact or near-exact string match
    if (normNew === normExisting) {
      return {
        isDuplicate: true,
        matchedPost: post,
        similarityPercentage: 100,
      };
    }

    // 2. High word overlap match
    const sim = calculateSimilarity(newContent, post.content);
    if (sim >= threshold) {
      return {
        isDuplicate: true,
        matchedPost: post,
        similarityPercentage: Math.round(sim * 100),
      };
    }
  }

  return { isDuplicate: false, similarityPercentage: 0 };
}
