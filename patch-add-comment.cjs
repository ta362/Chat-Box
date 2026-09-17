const fs = require('fs');

let file = fs.readFileSync('src/lib/firebase.ts', 'utf8');

file = file.replace(
  /const newCommentData = \{[\s\S]*?postId,[\s\S]*?content: trimmed,[\s\S]*?createdAt: Date.now\(\),[\s\S]*?authorToken,[\s\S]*?likesCount: 0,[\s\S]*?likedBy: \[\],[\s\S]*?\};/g,
  `const newCommentData = {
    postId,
    content: trimmed,
    createdAt: Date.now(),
    authorToken,
    authorUid: await getUid(),
    likesCount: 0,
    likedBy: [],
    likedUids: [],
  };`
);

fs.writeFileSync('src/lib/firebase.ts', file);
