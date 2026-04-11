import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

// ── helpers ──────────────────────────────────────────────────────────────────

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

// ── in-memory key cache ──────────────────────────────────────────────────────

const keyCache = new Map<string, CryptoKey>();

// ── encryption service ───────────────────────────────────────────────────────

export class EncryptionService {
  // ── key management (private) ───────────────────────────────────────────────

  private static async generateKey(): Promise<CryptoKey> {
    return crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt'],
    );
  }

  private static async exportKey(key: CryptoKey): Promise<string> {
    const jwk = await crypto.subtle.exportKey('jwk', key);
    return JSON.stringify(jwk);
  }

  private static async importKey(jwkString: string): Promise<CryptoKey> {
    const jwk = JSON.parse(jwkString) as JsonWebKey;
    return crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt'],
    );
  }

  // ── encrypt / decrypt ──────────────────────────────────────────────────────

  static async encrypt(plaintext: string, key: CryptoKey): Promise<string> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(plaintext);

    const cipherBuffer = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encoded,
    );

    const combined = new Uint8Array(iv.length + cipherBuffer.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(cipherBuffer), iv.length);

    return arrayBufferToBase64(combined.buffer);
  }

  static async decrypt(ciphertext: string, key: CryptoKey): Promise<string> {
    const data = new Uint8Array(base64ToArrayBuffer(ciphertext));

    const iv = data.slice(0, 12);
    const encrypted = data.slice(12);

    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encrypted,
    );

    return new TextDecoder().decode(decryptedBuffer);
  }

  // ── per-user key retrieval ─────────────────────────────────────────────────

  static async getOrCreateUserKey(userId: string): Promise<CryptoKey> {
    const cached = keyCache.get(userId);
    if (cached) return cached;

    const keyDocRef = doc(db, 'encryption_keys', userId);
    const keyDoc = await getDoc(keyDocRef);

    let key: CryptoKey;

    if (keyDoc.exists()) {
      const jwkString = keyDoc.data().jwk as string;
      key = await EncryptionService.importKey(jwkString);
    } else {
      key = await EncryptionService.generateKey();
      const jwkString = await EncryptionService.exportKey(key);
      await setDoc(keyDocRef, { jwk: jwkString, createdAt: new Date() });
    }

    keyCache.set(userId, key);
    return key;
  }

  // ── field-level encrypt / decrypt ──────────────────────────────────────────

  static async encryptFields(
    data: {
      conditions?: string[];
      comorbidities?: string[];
      medications?: string[];
      status?: string | null;
    },
    key: CryptoKey,
  ): Promise<Record<string, string | string[] | null>> {
    const result: Record<string, string | string[] | null> = {};

    if (data.conditions && data.conditions.length > 0) {
      result.conditions_encrypted = await EncryptionService.encrypt(
        JSON.stringify(data.conditions),
        key,
      );
      result.conditions = [];
    }

    if (data.comorbidities && data.comorbidities.length > 0) {
      result.comorbidities_encrypted = await EncryptionService.encrypt(
        JSON.stringify(data.comorbidities),
        key,
      );
      result.comorbidities = [];
    }

    if (data.medications && data.medications.length > 0) {
      result.medications_encrypted = await EncryptionService.encrypt(
        JSON.stringify(data.medications),
        key,
      );
      result.medications = [];
    }

    if (data.status) {
      result.status_encrypted = await EncryptionService.encrypt(
        JSON.stringify(data.status),
        key,
      );
      result.status = null;
    }

    return result;
  }

  static async decryptFields(
    profile: Record<string, unknown>,
    key: CryptoKey,
  ): Promise<{
    conditions: string[];
    comorbidities: string[];
    medications: string[];
    status: string | null;
  }> {
    let conditions: string[] = [];
    let comorbidities: string[] = [];
    let medications: string[] = [];
    let status: string | null = null;

    // Conditions
    if (profile.conditions_encrypted) {
      const decrypted = await EncryptionService.decrypt(
        profile.conditions_encrypted as string,
        key,
      );
      conditions = JSON.parse(decrypted) as string[];
    } else if (Array.isArray(profile.conditions)) {
      conditions = profile.conditions as string[];
    }

    // Comorbidities
    if (profile.comorbidities_encrypted) {
      const decrypted = await EncryptionService.decrypt(
        profile.comorbidities_encrypted as string,
        key,
      );
      comorbidities = JSON.parse(decrypted) as string[];
    } else if (Array.isArray(profile.comorbidities)) {
      comorbidities = profile.comorbidities as string[];
    }

    // Medications
    if (profile.medications_encrypted) {
      const decrypted = await EncryptionService.decrypt(
        profile.medications_encrypted as string,
        key,
      );
      medications = JSON.parse(decrypted) as string[];
    } else if (Array.isArray(profile.medications)) {
      medications = profile.medications as string[];
    }

    // Status
    if (profile.status_encrypted) {
      const decrypted = await EncryptionService.decrypt(
        profile.status_encrypted as string,
        key,
      );
      status = JSON.parse(decrypted) as string;
    } else if (typeof profile.status === 'string') {
      status = profile.status;
    }

    return { conditions, comorbidities, medications, status };
  }
}
