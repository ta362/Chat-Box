/**
 * Utility functions for generating random keys and client-side encryption/decryption
 * for private locked posts using the standard Web Crypto API (AES-GCM & PBKDF2 / SHA-256).
 */

/**
 * Generate a friendly, easily shareable random password key (e.g. "SEC-7X4K9P")
 */
export function generateRandomPasscode(length: number = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  const array = new Uint8Array(length);
  window.crypto.getRandomValues(array);
  for (let i = 0; i < length; i++) {
    result += chars[array[i] % chars.length];
  }
  return `KEY-${result.slice(0, 4)}-${result.slice(4)}`;
}

/**
 * Hash the passcode with SHA-256 to store on server for instant validity verification
 * without storing or exposing the plaintext password or decryptable key.
 */
export async function hashPasscode(passcode: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(passcode.trim().toUpperCase());
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Encrypt post content with the user's passcode using AES-GCM 256-bit.
 * Returns a JSON string containing base64 iv, salt, and ciphertext.
 */
export async function encryptPostContent(
  text: string,
  passcode: string
): Promise<string> {
  const encoder = new TextEncoder();
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    encoder.encode(passcode.trim().toUpperCase()),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const key = await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  const encrypted = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(text)
  );

  const payload = {
    v: 1,
    salt: arrayBufferToBase64(salt),
    iv: arrayBufferToBase64(iv),
    cipher: arrayBufferToBase64(encrypted),
  };

  return JSON.stringify(payload);
}

/**
 * Decrypt post content using the user's passcode.
 * Returns decrypted plaintext or throws an error if wrong passcode.
 */
export async function decryptPostContent(
  encryptedPayloadStr: string,
  passcode: string
): Promise<string> {
  const parsed = JSON.parse(encryptedPayloadStr);
  if (!parsed.salt || !parsed.iv || !parsed.cipher) {
    throw new Error('Invalid encrypted payload format');
  }

  const salt = base64ToArrayBuffer(parsed.salt);
  const iv = base64ToArrayBuffer(parsed.iv);
  const cipher = base64ToArrayBuffer(parsed.cipher);

  const encoder = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    encoder.encode(passcode.trim().toUpperCase()),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const key = await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  const decrypted = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    cipher
  );

  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}

function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function base64ToArrayBuffer(base64: string): Uint8Array {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
