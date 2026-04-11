import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { storage } from './firebase'

const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]

const ALLOWED_VIDEO_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
]

const ALLOWED_AUDIO_TYPES = [
  'audio/mpeg',
  'audio/mp4',
  'audio/ogg',
  'audio/webm',
  'audio/wav',
]

const ALLOWED_POST_MEDIA_TYPES = [
  ...ALLOWED_IMAGE_TYPES,
  ...ALLOWED_VIDEO_TYPES,
  ...ALLOWED_AUDIO_TYPES,
]

export type MediaType = 'image' | 'video' | 'audio'

export function detectMediaType(mimeType: string): MediaType | null {
  if (ALLOWED_IMAGE_TYPES.includes(mimeType)) return 'image'
  if (ALLOWED_VIDEO_TYPES.includes(mimeType)) return 'video'
  if (ALLOWED_AUDIO_TYPES.includes(mimeType)) return 'audio'
  return null
}

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

  static validatePostMedia(
    file: File,
    maxSizeMB = 25
  ): { valid: boolean; error?: string } {
    const maxBytes = maxSizeMB * 1024 * 1024
    if (file.size > maxBytes) {
      return { valid: false, error: `File size exceeds ${maxSizeMB}MB limit` }
    }
    if (!ALLOWED_POST_MEDIA_TYPES.includes(file.type)) {
      return {
        valid: false,
        error: 'Invalid file type. Allowed: images, videos (MP4/WebM), audio (MP3/WAV/OGG)',
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

  static async uploadProfileCover(
    userId: string,
    file: File
  ): Promise<string> {
    const validation = this.validateFile(file, 8)
    if (!validation.valid) throw new Error(validation.error)

    const path = `covers/${userId}/${Date.now()}_${file.name}`
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

  static async uploadPostMedia(
    userId: string,
    file: File
  ): Promise<{ url: string; mediaType: MediaType }> {
    const validation = this.validatePostMedia(file)
    if (!validation.valid) throw new Error(validation.error)

    const mediaType = detectMediaType(file.type)
    if (!mediaType) throw new Error('Unsupported media type')

    const path = `posts/${userId}/${Date.now()}_${file.name}`
    const storageRef = ref(storage, path)
    await uploadBytes(storageRef, file)
    const url = await getDownloadURL(storageRef)
    return { url, mediaType }
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
