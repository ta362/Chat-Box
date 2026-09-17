const fs = require('fs');
let file = fs.readFileSync('src/lib/firebase.ts', 'utf8');

// remove duplicate arrayRemove and arrayUnion lines
const lines = file.split('\n');
const newLines = [];
let lastLine = '';

for (let line of lines) {
  if (line.trim() === 'likedUids: arrayRemove(uid),' && lastLine.trim() === 'likedUids: arrayRemove(uid),') {
    continue;
  }
  if (line.trim() === 'likedUids: arrayUnion(uid),' && lastLine.trim() === 'likedUids: arrayUnion(uid),') {
    continue;
  }
  newLines.push(line);
  lastLine = line;
}

fs.writeFileSync('src/lib/firebase.ts', newLines.join('\n'));
