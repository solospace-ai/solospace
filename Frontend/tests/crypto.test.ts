import { describe, it, expect, vi, beforeEach } from 'vitest';
import { encryptKey, decryptKey } from '../lib/crypto';

// Mock localStorage and window.crypto
class LocalStorageMock {
  store: Record<string, string> = {};
  getItem(key: string) { return this.store[key] || null; }
  setItem(key: string, value: string) { this.store[key] = String(value); }
  removeItem(key: string) { delete this.store[key]; }
  clear() { this.store = {}; }
}

const mockLocalStorage = new LocalStorageMock();

// Simple mock crypto implementation for testing outside browser env
const mockCrypto = {
  getRandomValues: <T extends ArrayBufferView | null>(array: T): T => {
    if (!array) return array;
    const u8 = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
    for (let i = 0; i < u8.length; i++) {
      u8[i] = Math.floor(Math.random() * 256);
    }
    return array;
  },
  subtle: {
    importKey: async () => ({ type: 'secret' }),
    encrypt: async (algorithm: any, key: any, data: ArrayBuffer) => {
      // Mock encryption: return the same data
      return data;
    },
    decrypt: async (algorithm: any, key: any, data: ArrayBuffer) => {
      // Mock decryption: return the same data
      return data;
    }
  }
};

describe('Crypto Utility', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    
    // Polyfill global window and localStorage/crypto for tests
    vi.stubGlobal('window', {
      crypto: mockCrypto,
    });
    vi.stubGlobal('localStorage', mockLocalStorage);
  });

  it('correctly encrypts and decrypts keys', async () => {
    const rawKey = 'sk-or-gemini-test-key-12345';
    
    const encrypted = await encryptKey(rawKey);
    expect(encrypted).toContain(':');
    
    const decrypted = await decryptKey(encrypted);
    expect(decrypted).toBe(rawKey);
  });

  it('survives key loaded from localStorage', async () => {
    const rawKey = 'sk-another-secret-key';
    
    // Encrypt once to initialize the key in mock localStorage
    const encrypted1 = await encryptKey(rawKey);
    const savedKeyHex = mockLocalStorage.getItem('solospace_encryption_key');
    expect(savedKeyHex).toBeTruthy();
    
    // Decrypting should work since the key is persisted
    const decrypted1 = await decryptKey(encrypted1);
    expect(decrypted1).toBe(rawKey);
  });
});
