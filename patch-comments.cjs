const fs = require('fs');

let file = fs.readFileSync('src/lib/firebase.ts', 'utf8');

// Modify createComment
file = file.replace(
  /export async function addComment[\s\S]*?const newCommentData = \{[\s\S]*?\};/g,
  (match) => {
    return match.replace(
      "authorToken,",
      "authorToken,\n    authorUid: await getUid(),"
    ).replace(
      "likedBy: [],",
      "likedBy: [],\n    likedUids: [],"
    );
  }
);

// Modify toggleCommentLike to handle likedUids
file = file.replace(
  /export async function toggleCommentLike\([\s\S]*?try \{/g,
  `export async function toggleCommentLike(
  postId: string,
  commentId: string,
  authorToken: string,
  isCurrentlyLiked: boolean
) {
  try {
    const uid = await getUid();`
);

// We need to handle both occurrences (post like and comment like)
// but patch-firebase.cjs already did post like. We just target toggleCommentLike now.
// Since we used regex, it should be fine.
file = file.replace(
  /likedBy: arrayRemove\(authorToken\),/g,
  "likedBy: arrayRemove(authorToken),\n        likedUids: arrayRemove(uid),"
);

file = file.replace(
  /likedBy: arrayUnion\(authorToken\),/g,
  "likedBy: arrayUnion(authorToken),\n        likedUids: arrayUnion(uid),"
);

// Wait, the previous patch might have already modified the ones in togglePostLike. 
// Replacing it globally will duplicate it! Let's be careful.
fs.writeFileSync('src/lib/firebase.ts', file);
