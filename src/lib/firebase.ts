import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  increment,
  limitToLast,
  getDocs,
  Timestamp,
} from 'firebase/firestore';
import { ChatMessage } from '../types';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || undefined);

const MESSAGES_COLLECTION = 'messages';

/**
 * Subscribe to real-time chat messages from Firestore
 */
export function subscribeToMessages(
  onUpdate: (messages: ChatMessage[]) => void,
  onError?: (err: Error) => void
) {
  const q = query(
    collection(db, MESSAGES_COLLECTION),
    orderBy('createdAt', 'asc'),
    limitToLast(500)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const msgs: ChatMessage[] = [];
      snapshot.forEach((docSnap) => {
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
      // Sort by serialNumber
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
 * Send an anonymous message to Firestore
 */
export async function sendChatMessage(
  text: string,
  authorToken: string,
  replyTo?: { serialNumber: number; text: string } | null
): Promise<ChatMessage> {
  // Determine next serial number
  const q = query(
    collection(db, MESSAGES_COLLECTION),
    orderBy('serialNumber', 'desc'),
    limitToLast(1)
  );
  
  let nextSerial = 1;
  try {
    const snap = await getDocs(q);
    if (!snap.empty) {
      const topDoc = snap.docs[0].data();
      nextSerial = (topDoc.serialNumber || 0) + 1;
    }
  } catch (err) {
    console.warn('Could not query last serial, fallback to timestamp calculation:', err);
  }

  const newMsgData = {
    serialNumber: nextSerial,
    text: text.trim(),
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
