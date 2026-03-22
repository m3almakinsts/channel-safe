// Client-side AES-256-GCM encryption using Web Crypto API
// Keys are derived from user ID + salt using PBKDF2

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12;
const SALT_LENGTH = 16;
const PBKDF2_ITERATIONS = 100000;
const BASE64_CHUNK_SIZE = 0x8000;

const derivedKeyCache = new Map<string, Promise<CryptoKey>>();

export function generateSalt(): string {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  return arrayBufferToBase64(salt.buffer);
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunks: string[] = [];

  for (let i = 0; i < bytes.length; i += BASE64_CHUNK_SIZE) {
    const chunk = bytes.subarray(i, i + BASE64_CHUNK_SIZE);
    chunks.push(String.fromCharCode(...chunk));
  }

  return btoa(chunks.join(''));
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function deriveKey(userId: string, salt: string): Promise<CryptoKey> {
  const cacheKey = `${userId}:${salt}`;
  const cached = derivedKeyCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const derivePromise = (async () => {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(userId),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: new Uint8Array(base64ToArrayBuffer(salt)),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
  })();

  derivedKeyCache.set(cacheKey, derivePromise);

  try {
    return await derivePromise;
  } catch (error) {
    derivedKeyCache.delete(cacheKey);
    throw error;
  }
}

export async function encryptData(
  data: ArrayBuffer,
  userId: string,
  salt: string
): Promise<{ encrypted: ArrayBuffer; iv: string }> {
  const key = await deriveKey(userId, salt);
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  const encrypted = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    data
  );

  return {
    encrypted,
    iv: arrayBufferToBase64(iv.buffer),
  };
}

export async function decryptData(
  encrypted: ArrayBuffer,
  iv: string,
  userId: string,
  salt: string
): Promise<ArrayBuffer> {
  const key = await deriveKey(userId, salt);
  const ivBuffer = new Uint8Array(base64ToArrayBuffer(iv));

  return crypto.subtle.decrypt(
    { name: ALGORITHM, iv: ivBuffer },
    key,
    encrypted
  );
}

export async function encryptString(
  text: string,
  userId: string,
  salt: string
): Promise<{ encrypted: string; iv: string }> {
  const encoder = new TextEncoder();
  const { encrypted, iv } = await encryptData(encoder.encode(text).buffer, userId, salt);
  return { encrypted: arrayBufferToBase64(encrypted), iv };
}

export async function decryptString(
  encryptedBase64: string,
  iv: string,
  userId: string,
  salt: string
): Promise<string> {
  const decrypted = await decryptData(base64ToArrayBuffer(encryptedBase64), iv, userId, salt);
  return new TextDecoder().decode(decrypted);
}
