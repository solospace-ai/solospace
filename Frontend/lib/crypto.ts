/**
 * Browser-based cryptography helper using Web Crypto API.
 * Uses AES-GCM 256-bit encryption with a persistent, device-bound
 * master key stored in localStorage.
 */

const ENCRYPTION_KEY_NAME = 'solospace_encryption_key';

async function getMasterKey(): Promise<CryptoKey> {
  if (typeof window === 'undefined') {
    throw new Error('Web Crypto is only available in the browser.');
  }

  let rawKeyHex = localStorage.getItem(ENCRYPTION_KEY_NAME);
  if (!rawKeyHex) {
    // Generate a new random key
    const rawKey = window.crypto.getRandomValues(new Uint8Array(32)); // 256 bits
    rawKeyHex = Array.from(rawKey)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    localStorage.setItem(ENCRYPTION_KEY_NAME, rawKeyHex);
  }

  // Convert hex back to Uint8Array
  const hexMatch = rawKeyHex.match(/.{1,2}/g);
  if (!hexMatch) {
    throw new Error('Invalid encryption key format in localStorage.');
  }
  const keyBytes = new Uint8Array(
    hexMatch.map((byte) => parseInt(byte, 16))
  );

  // Import as CryptoKey
  return await window.crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM' },
    false, // not extractable
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt a plain-text string (e.g. API key).
 * Returns the hex-encoded representation of IV + ciphertext.
 */
export async function encryptKey(text: string): Promise<string> {
  if (!text) return '';
  const key = await getMasterKey();
  const iv = window.crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV is standard for AES-GCM
  const encoder = new TextEncoder();
  const encrypted = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(text)
  );

  // Combine IV and Ciphertext
  const ivHex = Array.from(iv)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const ciphertextBytes = new Uint8Array(encrypted);
  const ciphertextHex = Array.from(ciphertextBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return `${ivHex}:${ciphertextHex}`;
}

/**
 * Decrypt a hex-encoded cipher string.
 */
export async function decryptKey(encryptedStr: string): Promise<string> {
  if (!encryptedStr) return '';
  const parts = encryptedStr.split(':');
  if (parts.length !== 2) {
    throw new Error('Invalid encrypted format');
  }

  const [ivHex, ciphertextHex] = parts;
  
  const ivMatch = ivHex.match(/.{1,2}/g);
  const cipherMatch = ciphertextHex.match(/.{1,2}/g);
  if (!ivMatch || !cipherMatch) {
    throw new Error('Invalid hex format');
  }

  const iv = new Uint8Array(ivMatch.map((byte) => parseInt(byte, 16)));
  const ciphertext = new Uint8Array(cipherMatch.map((byte) => parseInt(byte, 16)));

  const key = await getMasterKey();
  const decrypted = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );

  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}
