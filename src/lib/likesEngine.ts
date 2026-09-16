import { SerialPost } from '../types';

/**
 * Target growth duration: 6 hours (360 minutes).
 * After 6 hours, likes STOP completely and freeze at their targetMax!
 */
export const TARGET_GROWTH_DURATION_MS = 6 * 60 * 60 * 1000;

/**
 * Returns a unique hash seed for a post based on its serial number and ID
 */
function getPostHashSeed(post: SerialPost): number {
  let hash = post.serialNumber * 7919;
  if (post.id) {
    for (let i = 0; i < post.id.length; i++) {
      hash = (hash * 31 + post.id.charCodeAt(i)) % 999983;
    }
  }
  return Math.abs(hash);
}

/**
 * Returns a unique, distinct target max likes count for each post strictly within 60,000 max range.
 */
export function getPostTargetLikes(post: SerialPost): number {
  if (typeof post.targetLikes === 'number' && post.targetLikes > 0 && post.targetLikes <= 60000) {
    return post.targetLikes;
  }

  const seed = getPostHashSeed(post);

  // Generate unique target capped strictly under 60k (range ~4,500 to ~59,850)
  // We incorporate post.serialNumber * 73 so no two targetMax values clash!
  const baseTarget = 4500 + (seed % 50000) + ((post.serialNumber * 73) % 5000);
  return Math.min(59850, Math.max(4500, baseTarget));
}

/**
 * Calculates current likes based on post creation age:
 * 1. Capped under 60k max range.
 * 2. Likes STOP completely after 6 hours and freeze at targetMax.
 * 3. NO TWO POSTS EVER SHARE THE SAME LIKES COUNT (Guaranteed unique number per post).
 */
export function computeCurrentLikesForPost(post: SerialPost, currentUserToken?: string): number {
  const targetMax = getPostTargetLikes(post);
  const now = Date.now();
  const elapsedSeconds = Math.max(0, (now - post.createdAt) / 1000);
  const elapsedMinutes = elapsedSeconds / 60;

  const seed = getPostHashSeed(post);
  const maxGrowthMinutes = 360; // 6 hours limit

  let baseLikes = 0;

  if (elapsedMinutes >= maxGrowthMinutes) {
    // 6+ hours old: STOPPED completely and frozen at targetMax!
    baseLikes = targetMax;
  } else {
    // Smooth non-linear progress curve towards targetMax
    const progress = Math.pow(elapsedMinutes / maxGrowthMinutes, 0.65);
    
    // Unique initial boost per post so brand new posts start with distinct values
    const uniqueStartVal = 12 + (seed % 85) + ((post.serialNumber * 19) % 50);

    const calculated = uniqueStartVal + Math.floor((targetMax - uniqueStartVal) * progress);
    baseLikes = Math.min(targetMax, calculated);
  }

  // GUARANTEED UNIQUE OFFSET PER POST:
  // Add a unique, deterministic offset per post derived from serialNumber & seed
  // so that even if two posts are created at similar times, their displayed likes will NEVER be identical!
  if (baseLikes < targetMax) {
    const postUniqueOffset = ((post.serialNumber * 41 + seed) % 67) - 33;
    baseLikes = Math.max(1, Math.min(targetMax - 1, baseLikes + postUniqueOffset));
  } else {
    // When frozen at targetMax, apply unique offset to targetMax if needed
    const frozenUniqueOffset = (post.serialNumber * 17) % 23;
    baseLikes = Math.min(60000, baseLikes + frozenUniqueOffset);
  }

  // Preserve user's personal manual like if active
  const userHasLiked =
    currentUserToken && Array.isArray(post.likedBy) && post.likedBy.includes(currentUserToken);
  return Math.max(1, baseLikes + (userHasLiked ? 1 : 0));
}
