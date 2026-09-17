const fs = require('fs');

let file = fs.readFileSync('src/lib/firebase.ts', 'utf8');

// Remove Auth imports
file = file.replace(
  "import { getAuth, signInAnonymously } from 'firebase/auth';",
  ""
);

// Remove Auth initialization and getUid function
file = file.replace(
  /export const auth = getAuth\(app\);[\s\S]*?return 'unauthenticated';\n  }\n}/g,
  ""
);

// Remove authorUid and likedUids from createSerialPost
file = file.replace(
  /authorUid: await getUid\(\),/g,
  ""
);
file = file.replace(
  /likedUids: \[\],/g,
  ""
);

// Remove uid from togglePostLike
file = file.replace(
  /const uid = await getUid\(\);/g,
  ""
);

file = file.replace(
  /likedUids: arrayRemove\(uid\),/g,
  ""
);

file = file.replace(
  /likedUids: arrayUnion\(uid\),/g,
  ""
);

fs.writeFileSync('src/lib/firebase.ts', file);
