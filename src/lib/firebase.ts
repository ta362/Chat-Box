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
  limit,
  limitToLast,
  getDocs,
  runTransaction,
  Timestamp,
} from 'firebase/firestore';
import { ChatMessage } from '../types';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || undefined);

const MESSAGES_COLLECTION = 'messages';
const META_DOC_ID = 'chat_meta';

/**
 * Subscribe to real-time chat messages from Firestore (active stream of latest 1000 messages)
 */
export function subscribeToMessages(
  onUpdate: (messages: ChatMessage[]) => void,
  onError?: (err: Error) => void
) {
  const q = query(
    collection(db, MESSAGES_COLLECTION),
    orderBy('serialNumber', 'asc'),
    limitToLast(1000)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const msgs: ChatMessage[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        msgs.push({
          id: docSnap.id,
          serialNumber: Number(data.serialNumber) || 1,
          text: data.text || '',
          createdAt:
            data.createdAt instanceof Timestamp
              ? data.createdAt.toMillis()
              : typeof data.createdAt === 'number'
              ? data.createdAt
              : Date.now(),
          authorToken: data.authorToken,
          reactions: data.reactions || {},
          replyTo: data.replyTo || null,
        });
      });
      // Sort strictly by continuous serialNumber ascending
      msgs.sort((a, b) => a.serialNumber - b.serialNumber);
      onUpdate(msgs);
    },
    (err) => {
      console.error('Firestore real-time subscription error:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Fetch a specific chat message by its serial number
 */
export async function fetchMessageBySerial(
  serialNumber: number
): Promise<ChatMessage | null> {
  try {
    const q = query(
      collection(db, MESSAGES_COLLECTION),
      where('serialNumber', '==', serialNumber),
      limit(1)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      const docSnap = snap.docs[0];
      const data = docSnap.data();
      return {
        id: docSnap.id,
        serialNumber: data.serialNumber || serialNumber,
        text: data.text || '',
        createdAt:
          data.createdAt instanceof Timestamp
            ? data.createdAt.toMillis()
            : typeof data.createdAt === 'number'
            ? data.createdAt
            : Date.now(),
        authorToken: data.authorToken,
        reactions: data.reactions || {},
        replyTo: data.replyTo || null,
      };
    }
    return null;
  } catch (err) {
    console.error(`Error querying serial message #${serialNumber}:`, err);
    return null;
  }
}

/**
 * Fetch older compressed messages before a specific serial number
 */
export async function fetchOlderArchivedMessages(
  beforeSerial: number,
  count: number = 50
): Promise<ChatMessage[]> {
  try {
    const q = query(
      collection(db, MESSAGES_COLLECTION),
      where('serialNumber', '<', beforeSerial),
      orderBy('serialNumber', 'desc'),
      limit(count)
    );
    const snap = await getDocs(q);
    const msgs: ChatMessage[] = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      msgs.push({
        id: docSnap.id,
        serialNumber: data.serialNumber || 1,
        text: data.text || '',
        createdAt:
          data.createdAt instanceof Timestamp
            ? data.createdAt.toMillis()
            : typeof data.createdAt === 'number'
            ? data.createdAt
            : Date.now(),
        authorToken: data.authorToken,
        reactions: data.reactions || {},
        replyTo: data.replyTo || null,
      });
    });
    return msgs.sort((a, b) => a.serialNumber - b.serialNumber);
  } catch (err) {
    console.error('Error fetching older archived messages:', err);
    return [];
  }
}

/**
 * Send an anonymous message with strictly sequential serial numbers (#1, #2, #3, #4...)
 */
export async function sendChatMessage(
  text: string,
  authorToken: string,
  replyTo?: { serialNumber: number; text: string } | null
): Promise<ChatMessage> {
  const trimmed = text.trim();
  const counterRef = doc(db, 'meta', META_DOC_ID);

  let nextSerial = 1;

  try {
    // 1. Try atomic transaction to ensure consecutive serial numbers across all users
    nextSerial = await runTransaction(db, async (transaction) => {
      const metaDoc = await transaction.get(counterRef);
      let currentSerial = 0;

      if (metaDoc.exists() && typeof metaDoc.data().lastSerialNumber === 'number') {
        currentSerial = metaDoc.data().lastSerialNumber;
      } else {
        // Find existing maximum serial if meta doc not yet initialized
        const highestSerialQuery = query(
          collection(db, MESSAGES_COLLECTION),
          orderBy('serialNumber', 'desc'),
          limit(1)
        );
        const snap = await getDocs(highestSerialQuery);
        if (!snap.empty) {
          currentSerial = Number(snap.docs[0].data().serialNumber) || 0;
        }
      }

      const assignedSerial = currentSerial + 1;
      transaction.set(counterRef, { lastSerialNumber: assignedSerial, updatedAt: Date.now() }, { merge: true });
      return assignedSerial;
    });
  } catch (err) {
    console.warn('Transaction serial assignment fallback:', err);
    // Fallback: fetch highest serial number directly
    try {
      const highestSerialQuery = query(
        collection(db, MESSAGES_COLLECTION),
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

  const newMsgData = {
    serialNumber: nextSerial,
    text: trimmed,
    createdAt: Date.now(),
    authorToken,
    reactions: {},
    replyTo: replyTo || null,
  };

  const docRef = await addDoc(collection(db, MESSAGES_COLLECTION), newMsgData);

  return {
    id: docRef.id,
    ...newMsgData,
  };
}

/**
 * Add reaction to a message in Firestore
 */
export async function addMessageReaction(messageId: string, emoji: string) {
  try {
    const msgRef = doc(db, MESSAGES_COLLECTION, messageId);
    await updateDoc(msgRef, {
      [`reactions.${emoji}`]: increment(1),
    });
  } catch (err) {
    console.error('Failed to update reaction in Firestore:', err);
  }
}
