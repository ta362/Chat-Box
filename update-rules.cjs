const fs = require('fs');

let file = fs.readFileSync('firestore.rules', 'utf8');

// We need to carefully replace the allow update rule for posts
file = file.replace(
  /allow update: if request\.auth != null && \([\s\S]*?\/\* COMMENT_UPDATE_PLACEHOLDER \*\//g, // wait I didn't have this
  ""
);

// Actually just rewrite the whole file, it's safer.
const rules = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /posts/{postId} {
      allow read: if true;
      
      allow create: if request.auth != null 
        && request.resource.data.authorUid == request.auth.uid
        && request.resource.data.content is string 
        && request.resource.data.content.size() > 0 
        && request.resource.data.content.size() <= 5000;
        
      allow update: if request.auth != null && (
        // 1. Author edits post
        (
          resource.data.get('authorUid', '') == request.auth.uid 
          && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['content', 'tag'])
          && request.resource.data.content is string 
          && request.resource.data.content.size() > 0 
          && request.resource.data.content.size() <= 5000
        )
        ||
        // 2. User toggles like
        (
          request.resource.data.diff(resource.data).affectedKeys().hasOnly(['likedBy', 'likedUids', 'likesCount'])
          && (
            (
              request.resource.data.get('likedUids', []).toSet().difference(resource.data.get('likedUids', []).toSet()).hasOnly([request.auth.uid])
              && request.resource.data.get('likedUids', []).toSet().difference(resource.data.get('likedUids', []).toSet()).size() == 1
              && resource.data.get('likedUids', []).toSet().difference(request.resource.data.get('likedUids', []).toSet()).size() == 0
              && request.resource.data.likesCount == resource.data.get('likesCount', 0) + 1
            )
            ||
            (
              resource.data.get('likedUids', []).toSet().difference(request.resource.data.get('likedUids', []).toSet()).hasOnly([request.auth.uid])
              && resource.data.get('likedUids', []).toSet().difference(request.resource.data.get('likedUids', []).toSet()).size() == 1
              && request.resource.data.get('likedUids', []).toSet().difference(resource.data.get('likedUids', []).toSet()).size() == 0
              && request.resource.data.likesCount == resource.data.get('likesCount', 0) - 1
            )
          )
        )
        ||
        // 3. Update comments count
        (
          request.resource.data.diff(resource.data).affectedKeys().hasOnly(['commentsCount'])
          && (
            request.resource.data.commentsCount == resource.data.get('commentsCount', 0) + 1 ||
            request.resource.data.commentsCount == resource.data.get('commentsCount', 0) - 1
          )
        )
        ||
        // 4. Update reactions
        (
          request.resource.data.diff(resource.data).affectedKeys().hasOnly(['reactions'])
        )
      );

      allow delete: if request.auth != null && resource.data.get('authorUid', '') == request.auth.uid;

      match /comments/{commentId} {
        allow read: if true;
        allow create: if request.auth != null
          && request.resource.data.authorUid == request.auth.uid
          && request.resource.data.content is string 
          && request.resource.data.content.size() > 0 
          && request.resource.data.content.size() <= 2000;
        
        allow update: if request.auth != null && (
          // Author edit
          (
            resource.data.get('authorUid', '') == request.auth.uid
            && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['content'])
            && request.resource.data.content is string 
            && request.resource.data.content.size() > 0 
            && request.resource.data.content.size() <= 2000
          )
          ||
          // Comment Like
          (
            request.resource.data.diff(resource.data).affectedKeys().hasOnly(['likedBy', 'likedUids', 'likesCount'])
            && (
              (
                request.resource.data.get('likedUids', []).toSet().difference(resource.data.get('likedUids', []).toSet()).hasOnly([request.auth.uid])
                && request.resource.data.get('likedUids', []).toSet().difference(resource.data.get('likedUids', []).toSet()).size() == 1
                && resource.data.get('likedUids', []).toSet().difference(request.resource.data.get('likedUids', []).toSet()).size() == 0
                && request.resource.data.likesCount == resource.data.get('likesCount', 0) + 1
              )
              ||
              (
                resource.data.get('likedUids', []).toSet().difference(request.resource.data.get('likedUids', []).toSet()).hasOnly([request.auth.uid])
                && resource.data.get('likedUids', []).toSet().difference(request.resource.data.get('likedUids', []).toSet()).size() == 1
                && request.resource.data.get('likedUids', []).toSet().difference(resource.data.get('likedUids', []).toSet()).size() == 0
                && request.resource.data.likesCount == resource.data.get('likesCount', 0) - 1
              )
            )
          )
        );
        allow delete: if request.auth != null && resource.data.get('authorUid', '') == request.auth.uid;
      }
    }
    
    match /messages/{messageId} {
      allow read: if true;
      allow create: if request.auth != null;
      allow update: if false;
      allow delete: if false;
    }
    
    match /meta/{metaId} {
      allow read: if true;
      allow create: if request.auth != null;
      allow update: if request.auth != null 
        && request.resource.data.lastSerialNumber == resource.data.get('lastSerialNumber', 0) + 1;
    }
  }
}
`;
fs.writeFileSync('firestore.rules', rules);
