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
          commentsCount: typeof data.commentsCount === 'number' ? data.commentsCount : 0,
          likedBy: Array.isArray(data.likedBy) ? data.likedBy : [],
          reactions: data.reactions || {},
          tag: data.tag || undefined,
        });
      });
      // Sort strictly by continuous serialNumber ascending
      posts.sort((a, b) => a.serialNumber - b.serialNumber);
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
  tag?: string
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

  const newPostData = {
    serialNumber: nextSerial,
    content: trimmed,
    createdAt: Date.now(),
    authorToken,
    likesCount: 0,
    commentsCount: 0,
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

