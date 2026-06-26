// Pass-through shim (no Firebase).
//
// The legacy client-side field encryption stored each user's AES key right next
// to the data in Firestore, so it added no real confidentiality, and it was
// applied inconsistently (profiles were written in plaintext anyway). With the
// Cloudflare cutover, profile data lives in D1 behind server-side auth. Field
// encryption is intentionally a no-op here and is tracked as a future
// server-managed-KMS control — see docs/MIGRATION_STATUS.md.

type HealthFields = {
  conditions?: string[]
  comorbidities?: string[]
  medications?: string[]
  status?: string | null
  accessNeeds?: string[]
}

export class EncryptionService {
  static async getOrCreateUserKey(_userId: string): Promise<CryptoKey | null> {
    return null
  }

  static async encrypt(plaintext: string, _key?: CryptoKey | null): Promise<string> {
    return plaintext
  }

  static async decrypt(ciphertext: string, _key?: CryptoKey | null): Promise<string> {
    return ciphertext
  }

  static async encryptFields(
    data: HealthFields,
    _key?: CryptoKey | null,
  ): Promise<Record<string, string | string[] | null>> {
    return {
      conditions: data.conditions ?? [],
      comorbidities: data.comorbidities ?? [],
      medications: data.medications ?? [],
      status: data.status ?? null,
      access_needs: data.accessNeeds ?? [],
    }
  }

  static async decryptFields(
    profile: Record<string, unknown>,
    _key?: CryptoKey | null,
  ): Promise<{
    conditions: string[]
    comorbidities: string[]
    medications: string[]
    status: string | null
    accessNeeds: string[]
  }> {
    return {
      conditions: Array.isArray(profile.conditions) ? (profile.conditions as string[]) : [],
      comorbidities: Array.isArray(profile.comorbidities) ? (profile.comorbidities as string[]) : [],
      medications: Array.isArray(profile.medications) ? (profile.medications as string[]) : [],
      status: typeof profile.status === 'string' ? profile.status : null,
      accessNeeds: Array.isArray(profile.access_needs) ? (profile.access_needs as string[]) : [],
    }
  }
}
