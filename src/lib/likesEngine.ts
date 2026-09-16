import { SerialPost } from '../types';

/**
 * Target growth duration: 6.5 hours
 */
export const TARGET_GROWTH_DURATION_MS = 6.5 * 60 * 60 * 1000;

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
 * Returns a unique, distinct target max likes count for each post
 */
export function getPostTargetLikes(post: SerialPost): number {
  if (typeof post.targetLikes === 'number' && post.targetLikes > 0) {
    return post.targetLikes;
  }

  const seed = getPostHashSeed(post);
  const percentBucket = seed % 100;

  // Distribute unique targets across diverse ranges so no two posts feel identical:
  // 15% get small targets: 1,500 - 8,000
  // 35% get medium targets: 12,000 - 38,000
  // 30% get large targets: 45,000 - 95,000
  // 20% get viral targets: 120,000 - 290,000
  if (percentBucket < 15) {
    return 1500 + (seed % 6500);
  } else if (percentBucket < 50) {
    return 12000 + (seed % 26000);
  } else if (percentBucket < 80) {
    return 45000 + (seed % 50000);
  } else {
    return 120000 + (seed % 170000);
  }
}

/**
 * Calculates current likes based on post creation age, ensuring EVERY post has a totally unique like count.
 */
export function computeCurrentLikesForPost(post: SerialPost, currentUserToken?: string): number {
  const targetMax = getPostTargetLikes(post);
  const now = Date.now();
  const elapsedSeconds = Math.max(0, (now - post.createdAt) / 1000);
  const elapsedMinutes = elapsedSeconds / 60;

  const seed = getPostHashSeed(post);
  // Post-specific variance factor between 0.70 and 1.30 to make every post progress uniquely
  const varianceFactor = 0.7 + ((seed % 60) / 100);

  let baseLikes = 0;

  if (elapsedMinutes < 2) {
    // 0 - 2 mins: Initial random organic growth (e.g., 3 to 45 likes, varying per post)
    const initialRate = 0.08 + ((seed % 15) * 0.02); // 0.08 to 0.38 per second
    baseLikes = Math.floor(elapsedSeconds * initialRate);
  } else if (elapsedMinutes < 3.5) {
    // 2 - 3.5 mins: First jump phase (~150 to ~450 likes, unique per post)
    const baseVal = Math.min(targetMax, 180 + (seed % 270));
    baseLikes = Math.floor(baseVal * varianceFactor);
  } else if (elapsedMinutes < 5.5) {
    // 3.5 - 5.5 mins: Second jump phase (~600 to ~1400 likes, unique per post)
    const baseVal = Math.min(targetMax, 650 + (seed % 750));
    baseLikes = Math.floor(baseVal * varianceFactor);
  } else if (elapsedMinutes < 8.5) {
    // 5.5 - 8.5 mins: Third jump phase (~1800 to ~3500 likes, unique per post)
    const baseVal = Math.min(targetMax, 1800 + (seed % 1700));
    baseLikes = Math.floor(baseVal * varianceFactor);
  } else if (elapsedMinutes < 390) { // Up to 6.5 hours
    // Stepped staircase growth unique per post
    const startVal = Math.min(targetMax, 1800 + (seed % 1700));
    const progressRatio = Math.min(1, (elapsedMinutes - 8.5) / (390 - 8.5));
    const curvedProgress = Math.pow(progressRatio, 0.75);

    // Add post-specific micro fluctuation based on minute block
    const minuteBlock = Math.floor(elapsedMinutes / 5);
    const blockNoise = ((seed + minuteBlock * 37) % 19) - 9;

    baseLikes = Math.floor(startVal + (targetMax - startVal) * curvedProgress + blockNoise);
  } else {
    // 6.5+ hours: Reached targetMax
    baseLikes = targetMax;
  }

  // Ensure bounds
  baseLikes = Math.max(0, Math.min(targetMax, baseLikes));

  // Preserve user's personal manual like if active
  const userHasLiked =
    currentUserToken && Array.isArray(post.likedBy) && post.likedBy.includes(currentUserToken);
  return Math.max(0, baseLikes + (userHasLiked ? 1 : 0));
}
