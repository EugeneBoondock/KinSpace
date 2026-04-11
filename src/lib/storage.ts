import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { storage } from './firebase'

const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]

export class StorageService {
  static validateFile(
    file: File,
    maxSizeMB = 5
  ): { valid: boolean; error?: string } {
    const maxBytes = maxSizeMB * 1024 * 1024
    if (file.size > maxBytes) {
      return { valid: false, error: `File size exceeds ${maxSizeMB}MB limit` }
    }
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return {
        valid: false,
        error: 'Invalid file type. Allowed: JPEG, PNG, WebP, GIF',
      }
    }
    return { valid: true }
  }

  static async uploadProfileAvatar(
    userId: string,
    file: File
  ): Promise<string> {
    const validation = this.validateFile(file)
    if (!validation.valid) throw new Error(validation.error)

    const path = `avatars/${userId}/${Date.now()}_${file.name}`
    const storageRef = ref(storage, path)
    await uploadBytes(storageRef, file)
    return getDownloadURL(storageRef)
  }

  static async uploadPostImage(
    userId: string,
    file: File
  ): Promise<string> {
    const validation = this.validateFile(file)
    if (!validation.valid) throw new Error(validation.error)

    const path = `posts/${userId}/${Date.now()}_${file.name}`
    const storageRef = ref(storage, path)
    await uploadBytes(storageRef, file)
    return getDownloadURL(storageRef)
  }

  static async uploadGroupCover(
    groupId: string,
    file: File
  ): Promise<string> {
    const validation = this.validateFile(file)
    if (!validation.valid) throw new Error(validation.error)

    const path = `groups/${groupId}/cover_${Date.now()}`
    const storageRef = ref(storage, path)
    await uploadBytes(storageRef, file)
    return getDownloadURL(storageRef)
  }

  static async deleteFile(url: string): Promise<void> {
    try {
      const storageRef = ref(storage, url)
      await deleteObject(storageRef)
    } catch {
      // Silently catch - file may not exist
    }
  }
}
