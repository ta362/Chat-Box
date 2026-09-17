const fs = require('fs');

let file = fs.readFileSync('src/lib/firebase.ts', 'utf8');

// Add Firebase Auth imports
if (!file.includes('import { getAuth')) {
  file = file.replace(
    "import { initializeApp, getApps, getApp } from 'firebase/app';",
    "import { initializeApp, getApps, getApp } from 'firebase/app';\nimport { getAuth, signInAnonymously } from 'firebase/auth';"
  );
}

// Initialize Auth
if (!file.includes('export const auth = getAuth(app);')) {
  file = file.replace(
    "const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();",
    "const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();\nexport const auth = getAuth(app);\nsignInAnonymously(auth).catch(err => console.error('Firebase Anonymous Auth failed:', err));\n\nasync function getUid(): Promise<string> {\n  const currentUser = auth.currentUser;\n  if (currentUser) return currentUser.uid;\n  try {\n    const cred = await signInAnonymously(auth);\n    return cred.user.uid;\n  } catch (e) {\n    return 'unauthenticated';\n  }\n}"
  );
}

// Modify createSerialPost
file = file.replace(
  "authorToken,",
  "authorToken,\n    authorUid: await getUid(),"
);
file = file.replace(
  "likedBy: [],",
  "likedBy: [],\n    likedUids: [],"
);

// Remove the `writeBatch` from deleteSerialPost which re-indexes ALL posts.
const deleteIndexStart = file.indexOf('// Re-index all remaining posts');
const deleteIndexEnd = file.indexOf('return { success: true };', deleteIndexStart);
if (deleteIndexStart !== -1 && deleteIndexEnd !== -1) {
  file = file.slice(0, deleteIndexStart) + file.slice(deleteIndexEnd);
}

// Modify deleteBengaliPosts to just be an empty secure stub (or remove completely)
// Wait, the user said "App owner privacy" and "Abuse protection". Mass deletions by client is bad.
const delBengaliStart = file.indexOf('export async function deleteBengaliPosts() {');
const delBengaliEnd = file.indexOf('}', file.indexOf('}', file.indexOf('}', delBengaliStart) + 1) + 1) + 1; // rough match, let's just regex replace the body
file = file.replace(/export async function deleteBengaliPosts\(\) \{[\s\S]*?\n\}/g, "export async function deleteBengaliPosts() { console.warn('Mass deletion disabled for security.'); }");

file = file.replace(/export async function deletePostsBySerials[\s\S]*?\n\}/g, "export async function deletePostsBySerials(serialNumbers: number[]) { console.warn('Mass deletion disabled for security.'); }");


// Modify togglePostLike to handle likedUids
file = file.replace(
  /export async function togglePostLike\([\s\S]*?try \{/g,
  `export async function togglePostLike(
  postId: string,
  authorToken: string,
  isCurrentlyLiked: boolean
) {
  try {
    const uid = await getUid();`
);

file = file.replace(
  "likedBy: arrayRemove(authorToken),",
  "likedBy: arrayRemove(authorToken),\n        likedUids: arrayRemove(uid),"
);

file = file.replace(
  "likedBy: arrayUnion(authorToken),",
  "likedBy: arrayUnion(authorToken),\n        likedUids: arrayUnion(uid),"
);

fs.writeFileSync('src/lib/firebase.ts', file);
