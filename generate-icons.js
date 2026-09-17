const fs = require('fs');
const sharp = require('sharp');

const svgCode = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-60 -124 760 760">
  <rect x="-60" y="-124" width="760" height="760" fill="white"/>
  <path fill="#09090b" d="M320 0c74.4 0 134.9 60.5 134.9 135.1 0 25.1-6.9 48.6-18.8 68.6 23.8 22.9 52 54.3 69.6 87.7 20.3 38.5 25.2 75.3 25.2 92.7 0 35.3-28.7 64-64 64-21.1 0-39.8-10.3-51.5-26.1-14.2 22.4-37.1 38.1-63.5 41.5-20.4-13.9-45.4-22.2-72-22.2-26.6 0-51.7 8.3-72 22.2-26.4-3.5-49.3-19.1-63.5-41.5-11.7 15.8-30.4 26.1-51.5 26.1-35.3 0-64-28.7-64-64 0-17.4 4.9-54.1 25.2-92.7 17.6-33.4 45.8-64.8 69.6-87.7-11.9-20-18.8-43.5-18.8-68.6C185.1 60.5 245.6 0 320 0z"/>
  <circle cx="250" cy="135" r="25" fill="white" />
  <circle cx="390" cy="135" r="25" fill="white" />
</svg>`;

fs.writeFileSync('public/icon.svg', svgCode);

async function generate() {
  await sharp(Buffer.from(svgCode))
    .resize(192, 192)
    .toFile('public/icon-192.png');
    
  await sharp(Buffer.from(svgCode))
    .resize(512, 512)
    .toFile('public/icon-512.png');
    
  console.log('Icons generated successfully!');
}

generate().catch(console.error);
