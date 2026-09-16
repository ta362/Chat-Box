import { SerialPost } from '../types';

/**
 * Target growth duration: 6.5 hours (between 6 and 7 hours)
 */
export const TARGET_GROWTH_DURATION_MS = 6.5 * 60 * 60 * 1000;

/**
 * Returns a unique, distinct target max likes count for a post (e.g., 5k, 20k, 50k, 85k, 120k).
 */
export function getPostTargetLikes(post: SerialPost): number {
  if (typeof post.targetLikes === 'number' && post.targetLikes > 0) {
    return post.targetLikes;
  }

  // Deterministic unique hash based on serial number & post ID
  const hashSeed = Math.abs(
    post.serialNumber * 9301 + (post.id ? post.id.charCodeAt(0) * 1337 : 42)
  ) % 100;

  // Distribute targets realistically across ranges:
  // 15% get ~5k (3k - 8k)
  // 35% get ~20k (12k - 30k)
  // 30% get ~50k (40k - 85k)
  // 20% get ~150k - 280k
  if (hashSeed < 15) {
    return 3500 + hashSeed * 300; // ~3.5k to 8k
  } else if (hashSeed < 50) {
    return 12000 + (hashSeed - 15) * 500; // ~12k to 29.5k (around 20k)
  } else if (hashSeed < 80) {
    return 40000 + (hashSeed - 50) * 1500; // ~40k to 85k (around 50k)
  } else {
    return 110000 + (hashSeed - 80) * 8500; // ~110k to 280k
  }
}

/**
 * Calculates current likes based on post creation age.
 * Timed Phase Schedule:
 * - 0 - 2 mins: Quiet start (0 to ~14 likes)
 * - 2 - 3.5 mins: Jump to ~200 likes, then flat pause (gap)
 * - 3.5 - 5.5 mins: Jump to ~800 likes, then flat pause (gap)
 * - 5.5 - 8.5 mins: Jump to ~2.2k likes, then flat pause (gap)
 * - 8.5m to 6.5 hours: Pure stepped jumps ("gap deya deya barba") every 15 minutes
 * - After 6.5 hours: STOPPED completely at targetMax!
 */
export function computeCurrentLikesForPost(post: SerialPost, currentUserToken?: string): number {
  const targetMax = getPostTargetLikes(post);
  const now = Date.now();
  const elapsedSeconds = Math.max(0, (now - post.createdAt) / 1000);
  const elapsedMinutes = elapsedSeconds / 60;

  let baseLikes = 0;

  if (elapsedMinutes < 2) {
    // 0 - 2 mins: Quiet start (0 - 14 likes)
    baseLikes = Math.floor(elapsedSeconds * 0.12);
  } else if (elapsedMinutes < 3.5) {
    // 2 - 3.5 mins: Jump to ~200 likes, flat pause during gap
    baseLikes = 200;
  } else if (elapsedMinutes < 5.5) {
    // 3.5 - 5.5 mins: Jump to ~800 likes, flat pause during gap
    baseLikes = 800;
  } else if (elapsedMinutes < 8.5) {
    // 5.5 - 8.5 mins: Jump to ~2.2k likes, flat pause during gap
    baseLikes = Math.min(targetMax, 2200);
  } else if (elapsedMinutes < 390) { // 390 minutes = 6.5 hours
    // Pure "gap deya deya" staircase: Every 15 minutes, there is a jump with a flat gap pause in-between
    const gapBlockMinutes = 15;
    const startVal = Math.min(targetMax, 2200);
    const totalBlocks = Math.ceil((390 - 8.5) / gapBlockMinutes); // ~25 gap blocks
    const currentBlock = Math.floor((elapsedMinutes - 8.5) / gapBlockMinutes);

    // Curved progression across gap steps
    const stepProgress = Math.min(1, currentBlock / totalBlocks);
    const curvedProgress = Math.pow(stepProgress, 0.75);

    baseLikes = Math.floor(startVal + (targetMax - startVal) * curvedProgress);
  } else {
    // 6.5+ hours: STOPPED permanently at targetMax!
    baseLikes = targetMax;
  }

  // Cap at post targetMax
  baseLikes = Math.min(targetMax, baseLikes);

  // Preserve user's personal manual like if active
  const userHasLiked =
    currentUserToken && Array.isArray(post.likedBy) && post.likedBy.includes(currentUserToken);
  return Math.max(0, baseLikes + (userHasLiked ? 1 : 0));
}
