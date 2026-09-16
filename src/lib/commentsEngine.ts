import { SerialPost, PostComment } from '../types';

/**
 * Comments target growth duration: 12 hours (12 * 60 * 60 * 1000 ms)
 */
export const TARGET_COMMENTS_GROWTH_DURATION_MS = 12 * 60 * 60 * 1000;

/**
 * Generates a unique, distinct target max comments count for each post
 * (e.g. 105, 500, 1k, 2k, 4k)
 */
export function getPostTargetComments(post: SerialPost): number {
  if (typeof post.targetComments === 'number' && post.targetComments > 0) {
    return post.targetComments;
  }

  // Deterministic seed based on serial number & post ID
  const seed = Math.abs(
    post.serialNumber * 48271 + (post.id ? post.id.charCodeAt(0) * 883 : 7)
  ) % 100;

  // Varied distribution as requested by user (105, 500, 1k, 2k, 4k etc.):
  // 25% get ~105 - 350 comments
  // 35% get ~500 - 950 comments
  // 25% get ~1,000 - 2,200 comments (1k - 2k)
  // 15% get ~2,500 - 4,200 comments (2.5k - 4k)
  if (seed < 25) {
    return 105 + (seed % 25) * 10; // 105 to 345
  } else if (seed < 60) {
    return 500 + ((seed - 25) % 35) * 13; // 500 to 942
  } else if (seed < 85) {
    return 1000 + ((seed - 60) % 25) * 48; // 1000 to 2152 (1k - 2k)
  } else {
    return 2500 + ((seed - 85) % 15) * 115; // 2500 to 4110 (2.5k - 4k)
  }
}

/**
 * Calculates current comments count based on post creation age:
 * - 12 hours duration window (720 minutes)
 * - Grows at a realistic rate of ~2 to 6 comments per minute
 * - After 12 hours: STOPPED permanently at target max comments!
 */
export function computeCurrentCommentsForPost(post: SerialPost): number {
  const targetMax = getPostTargetComments(post);
  const now = Date.now();
  const elapsedMs = Math.max(0, now - post.createdAt);
  const elapsedMinutes = elapsedMs / (1000 * 60);

  let baseComments = 0;

  if (elapsedMs < TARGET_COMMENTS_GROWTH_DURATION_MS) {
    // 0 to 12 hours: Grows steadily at 2 to 6 comments per minute
    // 12 hours = 720 minutes.
    // Calculate progress using a smooth growth curve capped at targetMax
    const progress = Math.pow(elapsedMinutes / 720, 0.75);
    
    // Minute-based linear rate check (2 to 6 per min average during early minutes)
    const minuteRateComponent = Math.floor(elapsedMinutes * 3.5);
    const curveComponent = Math.floor(targetMax * progress);

    baseComments = Math.min(targetMax, Math.max(minuteRateComponent, curveComponent));
  } else {
    // 12+ hours old: STOPPED permanently at target max comments!
    baseComments = targetMax;
  }

  return Math.min(targetMax, Math.max(0, baseComments));
}

/**
 * Sample pool of realistic multi-type English comments
 */
const SAMPLE_COMMENTS_POOL = [
  'Awesome post! Completely agree with this point. 👏',
  'Agree 100%! Really good insight right here.',
  'You hit the nail on the head with post #SERIAL! 🔥',
  'Such a great perspective. Thanks for sharing this!',
  'Very thoughtful and well articulated insight!',
  'Haha so relatable, true story! 😂',
  'Wow, post #SERIAL was super interesting!',
  'Well written bro! 👍',
  'Spot on! We definitely need more discussions like this.',
  'I agree 100% with your thoughts on this.',
  'Love this perspective! ❤️',
  'When is the next post coming out? Looking forward to it! 👀',
  'Super insightful and clear explanation! 🙌',
  'Absolutely spot on. Could not agree more.',
  'So true! You explained it really well.',
  'I was actually thinking about this exact topic earlier today. 💡',
  'Great post man! Thanks for posting.',
  'Amazing thought process! 🔥👏',
  'THIS! Exactly what I had in mind.',
  'Learned something new from this post today.',
  '10/10 post right here! 👌',
  'This is definitely worth reflecting on.',
  'Brilliant execution and concept!',
  'Pure gold! Absolutely solid points made. 💯',
  'Extremely helpful and relevant discussion point.',
  'Totally makes sense. Appreciate the clarity!',
  'This deserves way more attention! 🚀',
  'Very well put together.',
  'Couldn\'t have said it better myself! 🌟',
  'Keep these posts coming, really quality content!',
];

/**
 * Generates dynamic realistic multi-type comments to render inside CommentsModal
 */
export function generateRealisticCommentsForPost(
  post: SerialPost,
  targetCount: number,
  realComments: PostComment[]
): PostComment[] {
  // Start with real user comments
  const result: PostComment[] = [...realComments];

  // If we already have enough real comments, return them
  if (result.length >= targetCount) {
    return result;
  }

  const needed = Math.min(60, targetCount - result.length); // Render up to 60 rich comments in modal
  const baseSeed = Math.abs(post.serialNumber * 1337 + (post.id ? post.id.charCodeAt(0) * 97 : 19));

  for (let i = 0; i < needed; i++) {
    const poolIndex = (baseSeed + i * 17) % SAMPLE_COMMENTS_POOL.length;
    let commentText = SAMPLE_COMMENTS_POOL[poolIndex];
    commentText = commentText.replace('#SERIAL', `${post.serialNumber}`);

    // Generate realistic relative creation timestamp within post lifetime
    const ageSpreadMs = Math.max(1000 * 60, Date.now() - post.createdAt);
    const timeOffset = Math.floor(((i + 1) / (needed + 1)) * ageSpreadMs);
    const commentTime = post.createdAt + timeOffset;

    result.push({
      id: `generated-${post.id}-${i}`,
      postId: post.id,
      content: commentText,
      createdAt: commentTime,
      authorToken: `anon-${(baseSeed + i * 3) % 9000 + 1000}`,
      likesCount: (baseSeed + i * 7) % 45,
      likedBy: [],
    });
  }

  // Sort chronological
  result.sort((a, b) => b.createdAt - a.createdAt);
  return result;
}
