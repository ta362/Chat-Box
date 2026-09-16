import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  increment,
  arrayUnion,
  arrayRemove,
  limit,
  limitToLast,
  getDocs,
  runTransaction,
  deleteDoc,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';
import { SerialPost, PostComment } from '../types';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || undefined);

const POSTS_COLLECTION = 'posts';
const META_DOC_ID = 'post_serial_meta';

/**
 * Subscribe to real-time posts from Firestore (ordered strictly by serialNumber)
 */
export function subscribeToPosts(
  onUpdate: (posts: SerialPost[]) => void,
  onError?: (err: Error) => void
) {
  const q = query(
    collection(db, POSTS_COLLECTION),
    orderBy('serialNumber', 'asc'),
    limitToLast(1000)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const posts: SerialPost[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        posts.push({
          id: docSnap.id,
          serialNumber: Number(data.serialNumber) || 1,
          content: data.content || data.text || '',
          createdAt:
            data.createdAt instanceof Timestamp
              ? data.createdAt.toMillis()
              : typeof data.createdAt === 'number'
              ? data.createdAt
              : Date.now(),
          authorToken: data.authorToken || 'anon',
          likesCount: typeof data.likesCount === 'number' ? data.likesCount : (data.likedBy?.length || 0),
          targetLikes: typeof data.targetLikes === 'number' ? data.targetLikes : undefined,
          commentsCount: typeof data.commentsCount === 'number' ? data.commentsCount : 0,
          targetComments: typeof data.targetComments === 'number' ? data.targetComments : undefined,
          likedBy: Array.isArray(data.likedBy) ? data.likedBy : [],
          reactions: data.reactions || {},
          tag: data.tag || undefined,
        });
      });
      // Sort strictly chronologically by creation time and re-assign continuous serial numbers (#1, #2, #3...)
      posts.sort((a, b) => a.createdAt - b.createdAt);
      posts.forEach((p, index) => {
        p.serialNumber = index + 1;
      });
      onUpdate(posts);
    },
    (err) => {
      console.error('Firestore posts real-time subscription error:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Fetch a specific post by its serial number
 */
export async function fetchPostBySerial(
  serialNumber: number
): Promise<SerialPost | null> {
  try {
    const q = query(
      collection(db, POSTS_COLLECTION),
      where('serialNumber', '==', serialNumber),
      limit(1)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      const docSnap = snap.docs[0];
      const data = docSnap.data();
      return {
        id: docSnap.id,
        serialNumber: Number(data.serialNumber) || serialNumber,
        content: data.content || data.text || '',
        createdAt:
          data.createdAt instanceof Timestamp
            ? data.createdAt.toMillis()
            : typeof data.createdAt === 'number'
            ? data.createdAt
            : Date.now(),
        authorToken: data.authorToken || 'anon',
        likesCount: typeof data.likesCount === 'number' ? data.likesCount : (data.likedBy?.length || 0),
        commentsCount: typeof data.commentsCount === 'number' ? data.commentsCount : 0,
        likedBy: Array.isArray(data.likedBy) ? data.likedBy : [],
        reactions: data.reactions || {},
        tag: data.tag || undefined,
      };
    }
    return null;
  } catch (err) {
    console.error(`Error querying serial post #${serialNumber}:`, err);
    return null;
  }
}

/**
 * Create a new Post with strictly sequential atomic serial numbers (#1, #2, #3, #4...)
 */
export async function createSerialPost(
  content: string,
  authorToken: string,
  tag?: string,
  overrideTimestamp?: number
): Promise<SerialPost> {
  const trimmed = content.trim();
  const counterRef = doc(db, 'meta', META_DOC_ID);

  let nextSerial = 1;

  try {
    // Atomic transaction ensures continuous serial sequence across all concurrent users
    nextSerial = await runTransaction(db, async (transaction) => {
      const metaDoc = await transaction.get(counterRef);
      let currentSerial = 0;

      if (metaDoc.exists() && typeof metaDoc.data().lastSerialNumber === 'number') {
        currentSerial = metaDoc.data().lastSerialNumber;
      } else {
        // Look up highest existing serial if meta not yet saved
        const highestSerialQuery = query(
          collection(db, POSTS_COLLECTION),
          orderBy('serialNumber', 'desc'),
          limit(1)
        );
        const snap = await getDocs(highestSerialQuery);
        if (!snap.empty) {
          currentSerial = Number(snap.docs[0].data().serialNumber) || 0;
        }
      }

      const assignedSerial = currentSerial + 1;
      transaction.set(
        counterRef,
        { lastSerialNumber: assignedSerial, updatedAt: Date.now() },
        { merge: true }
      );
      return assignedSerial;
    });
  } catch (err) {
    console.warn('Transaction serial assignment fallback:', err);
    try {
      const highestSerialQuery = query(
        collection(db, POSTS_COLLECTION),
        orderBy('serialNumber', 'desc'),
        limit(1)
      );
      const snap = await getDocs(highestSerialQuery);
      if (!snap.empty) {
        nextSerial = (Number(snap.docs[0].data().serialNumber) || 0) + 1;
      } else {
        nextSerial = 1;
      }
    } catch (fallbackErr) {
      console.error('Failed to get last serial number:', fallbackErr);
      nextSerial = 1;
    }
  }

  // Generate unique target max likes for the post strictly under 60k (5k to 59k)
  const targetLikes = Math.floor(Math.random() * 54000) + 5000;
  // Generate unique target max comments for the post (105 to 4000)
  const targetComments = Math.floor(Math.random() * 3800) + 105;

  const newPostData = {
    serialNumber: nextSerial,
    content: trimmed,
    createdAt: overrideTimestamp || Date.now(),
    authorToken,
    likesCount: 0,
    targetLikes,
    commentsCount: 0,
    targetComments,
    likedBy: [],
    reactions: {},
    tag: tag || null,
  };

  const docRef = await addDoc(collection(db, POSTS_COLLECTION), newPostData);

  return {
    id: docRef.id,
    ...newPostData,
    tag: tag || undefined,
  };
}

/**
 * Delete a post if author matches and created within 30 minutes window
 */
export async function deleteSerialPost(
  postId: string,
  authorToken: string,
  postAuthorToken: string,
  createdAt: number
): Promise<{ success: boolean; message?: string }> {
  // Check author token match
  if (authorToken !== postAuthorToken) {
    return {
      success: false,
      message: 'You can only delete your own posts.',
    };
  }

  // Check 30 minute time limit (30 * 60 * 1000 = 1,800,000 ms)
  const THIRTY_MINUTES_MS = 30 * 60 * 1000;
  const elapsed = Date.now() - createdAt;

  if (elapsed > THIRTY_MINUTES_MS) {
    return {
      success: false,
      message: '30 minutes have passed! This post can no longer be deleted.',
    };
  }

  try {
    const postRef = doc(db, POSTS_COLLECTION, postId);
    await deleteDoc(postRef);

    // Re-index all remaining posts in Firestore so serial numbers stay strictly continuous (#1, #2, #3...)
    try {
      const remainingSnap = await getDocs(
        query(collection(db, POSTS_COLLECTION), orderBy('createdAt', 'asc'))
      );
      const batch = writeBatch(db);
      let count = 0;
      remainingSnap.forEach((docSnap) => {
        count++;
        batch.update(docSnap.ref, { serialNumber: count });
      });
      // Update meta document with updated lastSerialNumber
      const metaRef = doc(db, 'meta', META_DOC_ID);
      batch.set(metaRef, { lastSerialNumber: count, updatedAt: Date.now() }, { merge: true });
      await batch.commit();
    } catch (reindexErr) {
      console.warn('Re-indexing notice after post deletion:', reindexErr);
    }

    return { success: true };
  } catch (err: any) {
    console.error('Failed to delete post:', err);
    return {
      success: false,
      message: err?.message || 'Failed to delete post.',
    };
  }
}

/**
 * Utility to delete all posts containing Bengali characters (\u0980-\u09FF) and re-index remaining posts
 */
export async function deleteBengaliPosts() {
  try {
    const snap = await getDocs(collection(db, POSTS_COLLECTION));
    if (!snap.empty) {
      const bengaliRegex = /[\u0980-\u09FF]/;
      const batch = writeBatch(db);
      let deletedCount = 0;
      snap.docs.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.content && bengaliRegex.test(data.content)) {
          batch.delete(docSnap.ref);
          deletedCount++;
        }
      });

      if (deletedCount > 0) {
        await batch.commit();

        // Re-index remaining posts
        const remainingSnap = await getDocs(
          query(collection(db, POSTS_COLLECTION), orderBy('createdAt', 'asc'))
        );
        const reindexBatch = writeBatch(db);
        let count = 0;
        remainingSnap.forEach((docSnap) => {
          count++;
          reindexBatch.update(docSnap.ref, { serialNumber: count });
        });
        await reindexBatch.commit();
      }
    }
  } catch (err) {
    console.warn('deleteBengaliPosts notice:', err);
  }
}

/**
 * Utility to delete posts by specific serial numbers and re-index remaining posts
 */
export async function deletePostsBySerials(serialNumbers: number[]) {
  try {
    const q = query(
      collection(db, POSTS_COLLECTION),
      where('serialNumber', 'in', serialNumbers)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      const batch = writeBatch(db);
      snap.docs.forEach((docSnap) => {
        batch.delete(docSnap.ref);
      });
      await batch.commit();

      // Re-index remaining posts
      const remainingSnap = await getDocs(
        query(collection(db, POSTS_COLLECTION), orderBy('createdAt', 'asc'))
      );
      const reindexBatch = writeBatch(db);
      let count = 0;
      remainingSnap.forEach((docSnap) => {
        count++;
        reindexBatch.update(docSnap.ref, { serialNumber: count });
      });
      await reindexBatch.commit();
    }
  } catch (err) {
    console.warn('deletePostsBySerials notice:', err);
  }
}

/**
 * Toggle like for a post (atomic update with user token tracking)
 */
export async function togglePostLike(
  postId: string,
  authorToken: string,
  isCurrentlyLiked: boolean
) {
  try {
    const postRef = doc(db, POSTS_COLLECTION, postId);
    if (isCurrentlyLiked) {
      await updateDoc(postRef, {
        likedBy: arrayRemove(authorToken),
        likesCount: increment(-1),
      });
    } else {
      await updateDoc(postRef, {
        likedBy: arrayUnion(authorToken),
        likesCount: increment(1),
      });
    }
  } catch (err) {
    console.error('Failed to toggle post like:', err);
  }
}

/**
 * Add emoji reaction to a post
 */
export async function addPostReaction(postId: string, emoji: string) {
  try {
    const postRef = doc(db, POSTS_COLLECTION, postId);
    await updateDoc(postRef, {
      [`reactions.${emoji}`]: increment(1),
    });
  } catch (err) {
    console.error('Failed to update reaction in Firestore:', err);
  }
}

/**
 * Subscribe in real-time to comments for a specific post
 */
export function subscribeToPostComments(
  postId: string,
  onUpdate: (comments: PostComment[]) => void,
  onError?: (err: Error) => void
) {
  const q = query(
    collection(db, POSTS_COLLECTION, postId, 'comments'),
    orderBy('createdAt', 'asc'),
    limit(200)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const comments: PostComment[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        comments.push({
          id: docSnap.id,
          postId,
          content: data.content || '',
          createdAt:
            data.createdAt instanceof Timestamp
              ? data.createdAt.toMillis()
              : typeof data.createdAt === 'number'
              ? data.createdAt
              : Date.now(),
          authorToken: data.authorToken || 'anon',
          likesCount: typeof data.likesCount === 'number' ? data.likesCount : (data.likedBy?.length || 0),
          likedBy: Array.isArray(data.likedBy) ? data.likedBy : [],
        });
      });
      onUpdate(comments);
    },
    (err) => {
      console.error(`Comments subscription error for post ${postId}:`, err);
      if (onError) onError(err);
    }
  );
}

/**
 * Add a comment to a post and atomically update post comment count
 */
export async function addPostComment(
  postId: string,
  content: string,
  authorToken: string
): Promise<PostComment> {
  const trimmed = content.trim();
  const commentsColRef = collection(db, POSTS_COLLECTION, postId, 'comments');
  const postRef = doc(db, POSTS_COLLECTION, postId);

  const newCommentData = {
    postId,
    content: trimmed,
    createdAt: Date.now(),
    authorToken,
    likesCount: 0,
    likedBy: [],
  };

  const docRef = await addDoc(commentsColRef, newCommentData);

  // Increment comments count on post
  try {
    await updateDoc(postRef, {
      commentsCount: increment(1),
    });
  } catch (err) {
    console.warn('Could not increment post commentsCount:', err);
  }

  return {
    id: docRef.id,
    ...newCommentData,
  };
}

/**
 * Toggle like for a comment
 */
export async function toggleCommentLike(
  postId: string,
  commentId: string,
  authorToken: string,
  isCurrentlyLiked: boolean
) {
  try {
    const commentRef = doc(db, POSTS_COLLECTION, postId, 'comments', commentId);
    if (isCurrentlyLiked) {
      await updateDoc(commentRef, {
        likedBy: arrayRemove(authorToken),
        likesCount: increment(-1),
      });
    } else {
      await updateDoc(commentRef, {
        likedBy: arrayUnion(authorToken),
        likesCount: increment(1),
      });
    }
  } catch (err) {
    console.error('Failed to toggle comment like:', err);
  }
}

// Backward-compatibility exports
export const subscribeToMessages = subscribeToPosts;
export const sendChatMessage = async (text: string, authorToken: string) => {
  return createSerialPost(text, authorToken);
};
export const addMessageReaction = addPostReaction;
export const fetchOlderArchivedMessages = async () => [];
export const fetchMessageBySerial = fetchPostBySerial;

